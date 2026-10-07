import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';
import { logFromRequest } from '@/app/lib/logger';
import { gradeAnswers, upsertStudentAnswers } from '@/app/lib/grading';
import { archiveTempAnswers } from '@/app/lib/temp-archive';
import redis, { isRedisReady } from '@/app/lib/redis';
import { publish } from '@/app/lib/redis-pubsub';
import { invalidateExamCache } from '@/app/lib/exams';

// Toleransi (detik) sebelum submit dianggap terlambat.
// Menyerap latensi jaringan, perbedaan jam server/komputer siswa, dan delay
// saat auto-submit dari timer-stream berebut masuk.
const SUBMIT_GRACE_SECONDS = 120;

// Jendela waktu (detik) di mana student masih boleh mengirim jawaban SESUDAH
// attempt selesai. Diperlukan karena halaman siswa mengirim ulang jawaban dari
// memoryright setelah auto-submit terjadi (submitAnswersSafeguard). Di luar
// jendela ini jawaban dianggap terkunci.
const POST_SUBMIT_GRACE_SECONDS = 180;

// Tentukan batas waktu (epoch detik) dari sisi server.
// Mengembalikan null kalau tidak bisa dihitung -> pemanggil harus fail-open.
async function resolveAttemptDeadline(examId, attempt) {
    const rows = await query({
        query: `
            SELECT e.timer_mode, e.duration_minutes,
                   UNIX_TIMESTAMP(s.end_time) AS end_time_ts
            FROM rhs_exams e
            LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
            WHERE e.id = ?
        `,
        values: [examId],
    }).catch(() => []);

    const exams = Array.isArray(rows) ? rows : [];

    for (const exam of exams) {
      if (exam.timer_mode === 'async') {
        // Ujian async: waktu dihitung dari saat siswa mulai
        const durationSeconds = (exam.duration_minutes || 0) * 60;
        const startTs = Number(attempt.start_time_ts) || 0;
        if (startTs > 0) return startTs + durationSeconds + ((attempt.time_extension || 0) * 60);
      } else {
        // Ujian sync: waktu selesai ditentukan pengajar
        const endTs = Number(exam.end_time_ts) || 0;
        if (endTs > 0) return endTs + ((attempt.time_extension || 0) * 60);
      }
    }

    // Tidak ada deadline yang bisa dihitung -> fail-open (biarkan submit)
    return null;
}

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// POST handler for final exam submission
export async function POST(request) {
  const session = await getSession();

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId, answers, attemptId, isForce } = await request.json();

    if (!examId || !answers || !attemptId) {
      return NextResponse.json({ message: 'Missing examId, answers, or attemptId' }, { status: 400 });
    }

    // 0. Validasi attempt milik user ini (mencegah submit ngintip attempt orang lain)
    const attemptRows = await query({
      query: `
        SELECT id, status,
               UNIX_TIMESTAMP(start_time) AS start_time_ts,
               UNIX_TIMESTAMP(end_time) AS end_time_ts,
               time_extension
        FROM rhs_exam_attempts
        WHERE id = ? AND user_id = ? AND exam_id = ?
      `,
      values: [attemptId, session.user.id, examId],
    });

    if (attemptRows.length === 0) {
      return NextResponse.json({ message: 'Attempt tidak ditemukan' }, { status: 404 });
    }

    const attemptStatus = attemptRows[0].status;

    // 1. Settings + daftar soal
    const settingsRows = await query({
      query: 'SELECT require_all_answered, show_result FROM rhs_exam_settings WHERE exam_id = ?',
      values: [examId],
    });
    const requireAllAnswered = settingsRows.length > 0 && Boolean(settingsRows[0].require_all_answered);

    // 1b. Deadline check SERVER-SIDE.
    // Timer di browser sama sekali tidak bisa dipercaya (user bisa freeze jam /
    // manipulate localStorage), jadi batas waktu harus ditegakkan di server.
    //
    // Fail-open: kalau deadline tidak bisa dihitung (setting belum ada, null, dll)
    // submit tetap DIIZINKAN. Tujuannya menutup jalur submit-terlambat, bukan
    // mengunci siswa karena konfigurasi yang belum lengkap.
    let deadlinePassed = false;
    if (attemptStatus === 'in_progress') {
      const deadline = await resolveAttemptDeadline(examId, attemptRows[0]);

      if (deadline !== null) {
        const now_ts = Math.floor(Date.now() / 1000);
        // Grace period 120 detik untuk menyerap latensi jaringan & selisih jam.
        deadlinePassed = now_ts > deadline + SUBMIT_GRACE_SECONDS;
        if (deadlinePassed) {
          logFromRequest(request, session, 'EXAM_SUBMIT_REJECTED_LATE', 'warn', {
            examId,
            attemptId,
            secondsPastDeadline: now_ts - deadline,
          });
          return NextResponse.json(
            { message: 'Waktu ujian sudah habis. Jawaban dikumpulkan otomatis oleh sistem.' },
            { status: 409 }
          );
        }
      }
    }

    // 1c. Cegah penulisan ulang jawaban setelah attempt benar-benar selesai.
    //
    // Client memanggil endpoint ini lagi sesaat setelah auto-submit untuk
    // mem-"safeguard" jawaban yang masih ada di memory (lihat
    // submitAnswersSafeguard di halaman siswa). Itu alur yang sah dan harus
    // tetap jalan - jadi kita izinkan dalam jendela waktu singkat.
    //
    // Di luar jendela itu, request DITOLAK: tanpa ini student bisa mengirim
    // POST ulang ke /api/exams/submit kapan saja dan menimpa selected_option,
    // is_correct, serta score_earned di tabel hasil.
    if (attemptStatus !== 'in_progress') {
      const completedTs = Number(attemptRows[0].end_time_ts) || 0;
      const now_ts = Math.floor(Date.now() / 1000);
      const secondsSinceDone = completedTs > 0 ? now_ts - completedTs : Infinity;

      if (completedTs === 0 || secondsSinceDone > POST_SUBMIT_GRACE_SECONDS) {
        logFromRequest(request, session, 'EXAM_SUBMIT_REJECTED_LOCKED', 'warn', {
          examId,
          attemptId,
          attemptStatus,
          secondsSinceDone: Number.isFinite(secondsSinceDone) ? secondsSinceDone : null,
        });
        return NextResponse.json(
          { message: 'Ujian sudah selesai dan jawaban sudah dikunci.' },
          { status: 409 }
        );
      }
    }

    // 2. Penilaian (SAMA dengan auto-submit server -> app/lib/grading.js)
    const grading = await gradeAnswers(examId, answers || {});
    const { score, maxPoints, earnedPoints, questionIds, rows } = grading;

    // 3. Check require_all_answered.
    // Catatan: `isForce` dari body request TIDAK lagi dipakai untuk melewati aturan
    // ini, karena student bisa mengirimnya sendiri untuk bypass.
    // Kalau waktu sudah habis, student tidak boleh mengirim jawaban baru sama
    // sekali (lihat deadline check di atas) - jawaban yang sudah tersimpan di
    // temp-answer tetap dinilai oleh auto-submit server.
    if (requireAllAnswered && questionIds.length > 0 && attemptStatus === 'in_progress') {
      const answeredQuestionIds = new Set(
        Object.keys(answers || {}).filter(id => answers[id] !== null && answers[id] !== undefined && answers[id] !== '')
      );
      const unansweredCount = questionIds.filter(id => !answeredQuestionIds.has(id)).length;
      if (unansweredCount > 0) {
        return NextResponse.json(
          { message: `Semua soal harus dijawab sebelum mengumpulkan. Masih ada ${unansweredCount} soal yang belum dijawab.` },
          { status: 422 }
        );
      }
    }

    let claimed = false;

    // 4. Simpan jawaban SELALU (upsert, idempotent) + selesaikan attempt kalau masih berjalan
    await transaction(async (txQuery) => {
      if (attemptStatus === 'in_progress') {
        const updateResult = await txQuery({
          query: `
            UPDATE rhs_exam_attempts 
            SET status = 'completed', end_time = NOW(), score = ? 
            WHERE id = ? AND user_id = ? AND status = 'in_progress'
          `,
          values: [score, attemptId, session.user.id],
        });

        claimed = updateResult.affectedRows > 0;
      }

      // Upsert jawaban: aman baik saat manual submit maupun setelah auto-submit
      // (mis. student menekan "Kumpulkan" tepat saat timer-stream auto-submit).
      await upsertStudentAnswers(txQuery, {
        userId: session.user.id,
        examId,
        attemptId,
        rows,
      });

      if (claimed) {
        // Jawaban sementara diarsipkan dulu (tidak hilang begitu saja),
        // baru dihapus dari tabel live.
        await archiveTempAnswers(txQuery, {
          userId: session.user.id,
          examId,
          attemptId,
          reason: 'submit'
        });

        await txQuery({
          query: `INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, 'SUBMIT', ?)`,
          values: [attemptId, isForce ? 'Dikumpulkan otomatis oleh sistem (Waktu habis / dipaksa)' : 'Dikumpulkan oleh siswa'],
        });
      }
    });

    // 5. Invalidate Redis caches
    if (isRedisReady()) {
      const userId = session.user.id;
      await Promise.all([
        redis.del(`exam:active-attempt:${userId}:${examId}`),
        redis.del(`exam:attempt-meta:${userId}:${examId}`),
        redis.del(`temp:ans:${userId}:${examId}`),
        redis.srem(`user:active_exams:${userId}`, examId)
      ]).catch(() => {});
    }

    if (claimed) {
      logFromRequest(request, session, 'EXAM_SUBMIT', 'info', {
        examId,
        attemptId,
        score: score.toFixed(1),
        earned: earnedPoints.toFixed(1),
        max: maxPoints.toFixed(1)
      });
      await invalidateExamCache(examId).catch(() => {});
      publish('exam_change', { type: 'submit', userId: session.user.id, examId });
    } else {
      // Attempt sudah selesai lebih dulu (auto-submit): jawaban siswa tetap
      // disimpan di atas, tapi skor tidak ditimpa.
      logFromRequest(request, session, 'EXAM_SUBMIT_MERGED', 'warn', {
        examId,
        attemptId,
        details: 'Attempt sudah completed sebelum submit manual; jawaban digabung tanpa menimpa skor'
      });
    }

    const latestShowResult = (settingsRows.length > 0) ? settingsRows[0].show_result : false;

    return NextResponse.json({ 
      message: 'Exam submitted successfully', 
      score: score,
      saved: true,
      show_result: latestShowResult 
    });

  } catch (error) {
    console.error('Submit Error:', error);
    return NextResponse.json({ message: 'Failed to submit exam', error: error.message }, { status: 500 });
  }
}
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
      query: 'SELECT id, status FROM rhs_exam_attempts WHERE id = ? AND user_id = ? AND exam_id = ?',
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

    // 2. Penilaian (SAMA dengan auto-submit server -> app/lib/grading.js)
    const grading = await gradeAnswers(examId, answers || {});
    const { score, maxPoints, earnedPoints, questionIds, rows } = grading;

    // 3. Check require_all_answered
    if (requireAllAnswered && questionIds.length > 0 && !isForce && attemptStatus === 'in_progress') {
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
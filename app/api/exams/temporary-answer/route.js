import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { getClientIP, logFromRequest } from '@/app/lib/logger';
import redis, { isRedisReady } from '@/app/lib/redis';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET handler to fetch temporary answers for a user in an exam
export async function GET(request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('exam_id');

  if (!examId) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    const userId = session.user.id;
    const redisKey = `temp:ans:${userId}:${examId}`;

    // 1. Try Redis first (High speed)
    if (isRedisReady()) {
      const cached = await redis.hgetall(redisKey);
      if (cached && Object.keys(cached).length > 0) {
        return NextResponse.json(cached);
      }
    }

    // 2. Fallback to DB
    const answers = await query({
      query: `
        SELECT question_id, selected_option 
        FROM rhs_temporary_answer 
        WHERE user_id = ? AND exam_id = ?
      `,
      values: [userId, examId],
    });

    const answersMap = answers.reduce((acc, answer) => {
      acc[answer.question_id] = answer.selected_option;
      return acc;
    }, {});

    // 3. Backfill Redis if it was a cache miss
    if (isRedisReady() && Object.keys(answersMap).length > 0) {
      await redis.hmset(redisKey, answersMap).catch(() => {});
      await redis.expire(redisKey, 7200).catch(() => {}); // 2 hour TTL
    }

    return NextResponse.json(answersMap);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve temporary answers', error: error.message }, { status: 500 });
  }
}

// POST handler to save (upsert) a temporary answer
// Mendukung dua format:
//   { examId, questionId, selectedOption }  -> satu soal (klik biasa)
//   { examId, answers: { qid: value } }     -> banyak soal (sendBeacon / flush)
export async function POST(request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const { examId, questionId, selectedOption, answers } = payload;
    const userId = session.user.id;

    if (examId === undefined || examId === null) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Normalisasi menjadi map { question_id: value }
    let answerMap = {};
    if (answers && typeof answers === 'object') {
      answerMap = answers;
    } else if (questionId !== undefined && questionId !== null) {
      answerMap = { [questionId]: selectedOption };
    } else {
      return NextResponse.json({ message: 'Missing questionId or answers' }, { status: 400 });
    }

    const entries = Object.entries(answerMap).filter(([qid]) => qid !== undefined && qid !== null);
    if (entries.length === 0) {
      return NextResponse.json({ message: 'Nothing to save' }, { status: 200 });
    }

// 1. Save to Redis (instant, source of truth saat Redis aktif)
    if (isRedisReady()) {
      const redisKey = `temp:ans:${userId}:${examId}`;
      // HSET dipecah per 200 pasangan agar tidak melebihi batas argumen perintah
      const CHUNK = 200;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const flat = [];
        entries.slice(i, i + CHUNK).forEach(([qid, val]) => {
          flat.push(String(qid), val === null || val === undefined ? '' : String(val));
        });
        if (flat.length > 0) {
          await redis.hset(redisKey, ...flat).catch(() => {});
        }
      }
      await redis.expire(redisKey, 7200).catch(() => {}); // Refresh TTL
    }

    // 2. Sync ke MySQL (batch upsert; selected_option sudah TEXT sehingga
    //    jawaban panjang seperti essay/matching JSON tidak terpotong)
    const CHUNK = 200;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      const valueTuples = chunk.map(() => '(?, ?, ?, ?)').join(', ');
      const flatValues = [];
      chunk.forEach(([qid, val]) => {
        flatValues.push(userId, examId, qid, val === undefined ? null : val);
      });

      await query({
        query: `
          INSERT INTO rhs_temporary_answer (user_id, exam_id, question_id, selected_option)
          VALUES ${valueTuples}
          ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option)
        `,
        values: flatValues,
      });
    }

    return NextResponse.json({ message: 'Answer saved temporarily', saved: entries.length }, { status: 200 });
  } catch (error) {
    console.error('Temporary answer save error:', error);
    return NextResponse.json({ message: 'Failed to save temporary answer', error: error.message }, { status: 500 });
  }
}
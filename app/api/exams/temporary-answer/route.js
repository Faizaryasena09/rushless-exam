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
export async function POST(request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId, questionId, selectedOption } = await request.json();
    const userId = session.user.id;

    if (examId === undefined || questionId === undefined) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // 1. Save to Redis IMMEDIATELY (Instant response)
    if (isRedisReady()) {
      const redisKey = `temp:ans:${userId}:${examId}`;
      // Use HSET to store question_id -> selected_option mapping
      await redis.hset(redisKey, questionId, selectedOption || '').catch(() => {});
      await redis.expire(redisKey, 7200).catch(() => {}); // Refresh TTL
    }

    // 2. Async Sync to MySQL (Don't await if we want absolute speed, but user asked for "fire-and-forget" correction earlier)
    // Actually, to balance reliability and speed, we'll await but since it's one INSERT it's fast.
    // If we truly want "Instant", we'd skip await, but then we lose the "Error 200" fix.
    // DECISION: Await it for safety, but with Redis it's already redundant for most GETs.
    await query({
      query: `
        INSERT INTO rhs_temporary_answer (user_id, exam_id, question_id, selected_option)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option)
      `,
      values: [userId, examId, questionId, selectedOption],
    });

    return NextResponse.json({ message: 'Answer saved temporarily' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save temporary answer', error: error.message }, { status: 500 });
  }
}

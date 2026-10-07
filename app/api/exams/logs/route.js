import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { logExamActivity, logSystemError } from '@/app/lib/logger';
import redis, { isRedisReady } from '@/app/lib/redis';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

export async function POST(request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { attemptId, actionType, description } = await request.json();

    if (!attemptId || !actionType) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Use Redis-buffered logging (Ultra Fast)
    await logExamActivity({ attemptId, actionType, description });

    // --- Violation Handling Logic ---
    // Catatan: server TIDAK boleh mencocokkan string deskripsi dari client,
    // karena lebih rapuh. Pola string dulu ('left the exam page') tidak pernah
    // cocok karena client mengirim deskripsi berbahasa Indonesia.
    // Pola ini hanya menerima event "siswa meninggalkan halaman ujian".
    const LEFT_EXAM_EVENTS = ['meninggalkan halaman ujian'];

    if (actionType === 'SECURITY' && typeof description === 'string' && LEFT_EXAM_EVENTS.some(p => description.includes(p))) {
      // 1. Get the violation setting for this exam.
      //    WAJIB difilter user_id: tanpa ini, siapa pun bisa mengirim
      //    attemptId orang lain dan mengunci ujiannya.
      const examSettings = await query({
        query: `
          SELECT s.violation_action, ea.user_id, ea.exam_id
          FROM rhs_exam_attempts ea
          JOIN rhs_exam_settings s ON ea.exam_id = s.exam_id
          WHERE ea.id = ? AND ea.user_id = ?
        `,
        values: [attemptId, session.user.id]
      });

      if (examSettings.length > 0 && examSettings[0].violation_action === 'kunci') {
        // 2. Lock the attempt
        await query({
          query: 'UPDATE rhs_exam_attempts SET is_violation_locked = 1 WHERE id = ? AND user_id = ?',
          values: [attemptId, session.user.id]
        });

        // 3. Notify the student via Redis Pub/Sub
        const { publish } = await import('@/app/lib/redis-pubsub');
        publish('violation_lock', { userId: examSettings[0].user_id });
        
        return NextResponse.json({ message: 'Log saved and exam LOCKED due to violation', locked: true });
      }
    }

    return NextResponse.json({ message: 'Log saved' });
  } catch (error) {
    await logSystemError(error, { action: 'SYSTEM_EXAM_LOG_WRITE_FAILED', request, context: { endpoint: '/api/exams/logs' } });
    return NextResponse.json({ message: 'Failed to save log' }, { status: 500 });
  }
}

export async function GET(request) {
  const session = await getSession();

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const attemptId = searchParams.get('attempt_id');

  if (!attemptId) {
    return NextResponse.json({ message: 'Attempt ID required' }, { status: 400 });
  }

  try {
    // 1. Fetch persistent logs from MySQL
    const dbLogs = await query({
      query: 'SELECT * FROM rhs_exam_logs WHERE attempt_id = ? ORDER BY created_at ASC',
      values: [attemptId],
    });

    // 2. Fetch "flying" logs from Redis (not yet flushed to DB)
    let recentLogs = [];
    if (isRedisReady()) {
      const redisLogsRaw = await redis.lrange(`exam:logs:recent:${attemptId}`, 0, -1).catch(() => []);
      recentLogs = redisLogsRaw.map(raw => {
        const parsed = JSON.parse(raw);
        return {
          id: `temp-${Date.now()}-${Math.random()}`,
          attempt_id: attemptId,
          action_type: parsed.actionType,
          description: parsed.description,
          created_at: parsed.timestamp
        };
      }).reverse(); // L-pushed logs are newest first, so reverse to match ASC order
    }

    // 3. Merge and Deduplicate (simple sort by timestamp)
    // We use a Map to avoid duplicates if flushing happened during our GET
    const allLogsMap = new Map();
    dbLogs.forEach(log => {
        // Unique key: timestamp + type + description
        const key = `${new Date(log.created_at).getTime()}-${log.action_type}-${log.description}`;
        allLogsMap.set(key, log);
    });
    
    recentLogs.forEach(log => {
        const key = `${new Date(log.created_at).getTime()}-${log.action_type}-${log.description}`;
        if (!allLogsMap.has(key)) {
            allLogsMap.set(key, log);
        }
    });

    const mergedLogs = Array.from(allLogsMap.values()).sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return NextResponse.json({ logs: mergedLogs });
  } catch (error) {
    await logSystemError(error, { action: 'SYSTEM_EXAM_LOG_READ_FAILED', request, session, context: { endpoint: '/api/exams/logs' } });
    return NextResponse.json({ message: 'Failed to fetch logs' }, { status: 500 });
  }
}

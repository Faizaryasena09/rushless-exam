import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import redis, { isRedisReady } from '@/app/lib/redis';

// DELETE handler to remove ALL questions for an exam
export async function DELETE(request) {
    const session = await getIronSession(await cookies(), sessionOptions);
    if (!session.user || session.user.roleName !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { examId } = await request.json();
        if (!examId) {
            return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
        }

        const result = await query({
            query: 'DELETE FROM rhs_exam_questions WHERE exam_id = ?',
            values: [examId],
        });

        // Invalidate Redis Cache IMMEDIATELY after update
        if (isRedisReady()) {
            await Promise.all([
                redis.del(`exam:data:${examId}`),
                redis.del(`exam:settings-full:${examId}`),
                redis.keys('exams:list:*').then(keys => keys.length > 0 ? redis.del(keys) : null)
            ]).catch(() => {});
        }

        await recalculateExamScores(examId);

        return NextResponse.json({ message: `Successfully deleted ${result.affectedRows} questions.` });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to delete questions', error: error.message }, { status: 500 });
    }
}

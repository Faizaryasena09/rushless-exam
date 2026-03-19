import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import redis, { isRedisReady } from '@/app/lib/redis';
import { recalculateExamScores } from '@/app/lib/exams';

// PATCH handler to reorder questions
export async function PATCH(request) {
    const session = await getIronSession(await cookies(), sessionOptions);
    if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { orderedIds } = await request.json();
        if (!orderedIds || !Array.isArray(orderedIds)) {
            return NextResponse.json({ message: 'orderedIds array is required' }, { status: 400 });
        }

        // Update sort_order for each question
        const promises = orderedIds.map((id, index) =>
            query({
                query: 'UPDATE rhs_exam_questions SET sort_order = ? WHERE id = ?',
                values: [index, id],
            })
        );

        await Promise.all(promises);

        // Invalidate Redis cache
        if (orderedIds.length > 0) {
            // We need the examId. We can fetch it from one of the questions.
            const qInfo = await query({
                query: 'SELECT exam_id FROM rhs_exam_questions WHERE id = ?',
                values: [orderedIds[0]],
            });
            
            if (qInfo.length > 0) {
                const examId = qInfo[0].exam_id;

                // Invalidate Redis Cache IMMEDIATELY after update
                if (isRedisReady()) {
                    await Promise.all([
                        redis.del(`exam:data:${examId}`),
                        redis.del(`exam:settings-full:${examId}`),
                        redis.keys('exams:list:*').then(keys => keys.length > 0 ? redis.del(keys) : null)
                    ]).catch(() => {});
                }

                await recalculateExamScores(examId);
            }
        }

        return NextResponse.json({ message: 'Questions reordered successfully' });
    } catch (error) {
        console.error('Reorder Error:', error);
        return NextResponse.json({ message: 'Failed to reorder questions', error: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

// PATCH handler to reorder questions
export async function PATCH(request) {
    const session = await getIronSession(await cookies(), sessionOptions);
    if (!session.user || session.user.roleName !== 'admin') {
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

        return NextResponse.json({ message: 'Questions reordered successfully' });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to reorder questions', error: error.message }, { status: 500 });
    }
}

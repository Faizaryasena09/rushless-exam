import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';
import redis, { isRedisReady } from '@/app/lib/redis';
import { invalidateExamCache } from '@/app/lib/exams';

async function getSession(request) {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

export async function POST(request) {
    const session = await getSession(request);

    if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { examId } = await request.json();
        if (!examId) {
            return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
        }

        const newExamId = await transaction(async (txQuery) => {
            // 1. Fetch original exam data
            const originalExam = await txQuery({
                query: 'SELECT * FROM rhs_exams WHERE id = ?',
                values: [examId]
            });
            if (originalExam.length === 0) throw new Error('Exam not found');
            const sourceExam = originalExam[0];

            // 2. Insert new exam copy (Core Exam Data)
            const insertExamRes = await txQuery({
                query: `INSERT INTO rhs_exams (
                exam_name, description, subject_id, shuffle_questions, shuffle_answers, 
                timer_mode, duration_minutes, min_time_minutes, max_attempts, 
                scoring_mode, total_target_score, auto_distribute
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values: [
                    `${sourceExam.exam_name} (Copy)`,
                    sourceExam.description || null,
                    sourceExam.subject_id || null,
                    sourceExam.shuffle_questions || 0,
                    sourceExam.shuffle_answers || 0,
                    sourceExam.timer_mode || 'async',
                    sourceExam.duration_minutes || 0,
                    sourceExam.min_time_minutes || 0,
                    sourceExam.max_attempts || 0,
                    sourceExam.scoring_mode || 'raw',
                    sourceExam.total_target_score || 0,
                    sourceExam.auto_distribute || 0
                ]
            });
            const newId = insertExamRes.insertId;

            // 3. Copy Settings (Extended Exam Settings)
            const originalSettings = await txQuery({
                query: 'SELECT * FROM rhs_exam_settings WHERE exam_id = ?',
                values: [examId]
            });
            if (originalSettings.length > 0) {
                const s = originalSettings[0];
                await txQuery({
                    query: `INSERT INTO rhs_exam_settings (
                    exam_id, start_time, end_time, require_safe_browser, require_seb, 
                    show_instructions, instruction_type, custom_instructions, 
                    show_result, show_analysis, require_all_answered, require_token, 
                    token_type, current_token, violation_action, seb_config_key
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values: [
                        newId,
                        s.start_time || null,
                        s.end_time || null,
                        s.require_safe_browser !== undefined ? s.require_safe_browser : 0,
                        s.require_seb !== undefined ? s.require_seb : 0,
                        s.show_instructions !== undefined ? s.show_instructions : 0,
                        s.instruction_type || 'template',
                        s.custom_instructions || null,
                        s.show_result !== undefined ? s.show_result : 0,
                        s.show_analysis !== undefined ? s.show_analysis : 0,
                        s.require_all_answered !== undefined ? s.require_all_answered : 0,
                        s.require_token !== undefined ? s.require_token : 0,
                        s.token_type || 'static',
                        s.current_token || null,
                        s.violation_action || 'abaikan',
                        s.seb_config_key || null
                    ]
                });
            }

            // 4. Copy Class Assignments
            const originalClasses = await txQuery({
                query: 'SELECT class_id FROM rhs_exam_classes WHERE exam_id = ?',
                values: [examId]
            });
            if (originalClasses.length > 0) {
                const placeholders = originalClasses.map(() => '(?, ?)').join(', ');
                const flatValues = [];
                originalClasses.forEach(c => flatValues.push(newId, c.class_id));

                await txQuery({
                    query: `INSERT INTO rhs_exam_classes (exam_id, class_id) VALUES ${placeholders}`,
                    values: flatValues
                });
            }

            // 5. Copy Questions (Include all modern fields)
            const originalQuestions = await txQuery({
                query: 'SELECT * FROM rhs_exam_questions WHERE exam_id = ?',
                values: [examId]
            });

            if (originalQuestions.length > 0) {
                const qPlaceholders = originalQuestions.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
                const qValues = [];
                originalQuestions.forEach(q => {
                    const optionsValue = typeof q.options === 'string' ? q.options : JSON.stringify(q.options || {});
                    const metadataValue = typeof q.scoring_metadata === 'string' ? q.scoring_metadata : (q.scoring_metadata ? JSON.stringify(q.scoring_metadata) : null);

                    qValues.push(
                        newId,
                        q.question_text || '',
                        optionsValue,
                        q.correct_option || '',
                        q.question_type || 'multiple_choice',
                        q.points !== undefined ? q.points : 1.0,
                        q.scoring_strategy || 'standard',
                        metadataValue,
                        q.sort_order !== undefined ? q.sort_order : 0
                    );
                });

                await txQuery({
                    query: `INSERT INTO rhs_exam_questions (
                    exam_id, question_text, options, correct_option, 
                    question_type, points, scoring_strategy, scoring_metadata, sort_order
                ) VALUES ${qPlaceholders}`,
                    values: qValues
                });
            }

            return newId;
        });

        // 6. Invalidate Redis Cache
        await invalidateExamCache(examId);
        await invalidateExamCache(null); // Also clear lists for the new exam

        return NextResponse.json({ message: 'Exam duplicated successfully', newExamId: newExamId });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Failed to duplicate exam', error: error.message }, { status: 500 });
    }
}

import { query, transaction } from './db';
import { calculateQuestionScore } from './scoring';
import redis, { isRedisReady } from './redis';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions } from './session';
import { validateUserSession } from './auth';
import { eventBus } from './event-bus';

/**
 * Recalculates all scores for a given exam.
 * Useful when questions are updated, deleted, or points are changed.
 */
export async function recalculateExamScores(examId) {
    console.log(`[Recalculation] Starting for exam ${examId}`);

    // 1. Get all current questions for this exam
    const questions = await query({
        query: 'SELECT id, correct_option, question_type, points, scoring_strategy, scoring_metadata FROM rhs_exam_questions WHERE exam_id = ?',
        values: [examId]
    });

    if (questions.length === 0) {
        // If no questions, all attempts should ideally be 0? 
        // But usually this means questions were deleted.
        await query({
            query: "UPDATE rhs_exam_attempts SET score = 0 WHERE exam_id = ? AND status = 'completed'",
            values: [examId]
        });
        return;
    }

    const questionInfoMap = questions.reduce((acc, q) => {
        acc[q.id] = {
            correct: q.correct_option,
            type: q.question_type,
            points: (q.points !== undefined && q.points !== null) ? q.points : 1.0,
            strategy: q.scoring_strategy || 'standard',
            metadata: typeof q.scoring_metadata === 'string' ? JSON.parse(q.scoring_metadata) : (q.scoring_metadata || {})
        };
        return acc;
    }, {});

    const totalMaxPoints = questions.reduce((sum, q) => {
        const p = (q.points !== undefined && q.points !== null) ? q.points : 1.0;
        return sum + p;
    }, 0);

    // 2. Get all completed attempts
    const attempts = await query({
        query: "SELECT id FROM rhs_exam_attempts WHERE exam_id = ? AND status = 'completed'",
        values: [examId]
    });

    for (const attempt of attempts) {
        const attemptId = attempt.id;

        // Fetch student answers for this attempt
        const answers = await query({
            query: "SELECT question_id, selected_option FROM rhs_student_answer WHERE attempt_id = ?",
            values: [attemptId]
        });

        let earnedTotal = 0;

        await transaction(async (txQuery) => {
            for (const ans of answers) {
                const qInfo = questionInfoMap[ans.question_id];
                if (!qInfo) {
                    // Question was likely deleted, score earned for it should be 0
                    await txQuery({
                        query: "UPDATE rhs_student_answer SET score_earned = 0, is_correct = 0 WHERE attempt_id = ? AND question_id = ?",
                        values: [attemptId, ans.question_id]
                    });
                    continue;
                }

                const earned = calculateQuestionScore(qInfo, ans.selected_option);
                earnedTotal += earned;

                // Update individual answer
                let isCorrect = false;
                if (qInfo.type === 'essay') {
                    isCorrect = earned > 0;
                } else {
                    isCorrect = qInfo.correct === ans.selected_option;
                }

                await txQuery({
                    query: "UPDATE rhs_student_answer SET score_earned = ?, is_correct = ? WHERE attempt_id = ? AND question_id = ?",
                    values: [earned, isCorrect, attemptId, ans.question_id]
                });
            }

            // Update entire attempt score
            const examSettings = await txQuery({
                query: "SELECT scoring_mode FROM rhs_exams WHERE id = ?",
                values: [examId]
            });
            const scoringMode = examSettings[0]?.scoring_mode || 'percentage';

            const finalScore = (scoringMode === 'raw')
                ? earnedTotal
                : (totalMaxPoints > 0 ? (earnedTotal / totalMaxPoints) * 100 : 0);

            await txQuery({
                query: "UPDATE rhs_exam_attempts SET score = ? WHERE id = ?",
                values: [finalScore, attemptId]
            });
        });
    }

    console.log(`[Recalculation] Finished for exam ${examId}. Processed ${attempts.length} attempts.`);
}

/**
 * Distributes total_target_score equally among all questions in an exam.
 */
export async function distributeExamPoints(examId) {
    console.log(`[Distribution] Starting for exam ${examId}`);

    const examData = await query({
        query: "SELECT total_target_score FROM rhs_exams WHERE id = ?",
        values: [examId]
    });

    if (examData.length === 0) return;
    const targetScore = examData[0].total_target_score || 100;

    const questions = await query({
        query: "SELECT id FROM rhs_exam_questions WHERE exam_id = ?",
        values: [examId]
    });

    if (questions.length === 0) return;

    const pointsPerQuestion = targetScore / questions.length;

    await transaction(async (txQuery) => {
        for (const q of questions) {
            await txQuery({
                query: "UPDATE rhs_exam_questions SET points = ? WHERE id = ?",
                values: [pointsPerQuestion, q.id]
            });
        }
    });

    console.log(`[Distribution] Finished. Set ${pointsPerQuestion} points for ${questions.length} questions.`);
}

/**
 * Fetches the complete exam settings object (standardized for Redis and DB)
 */
export async function getExamSettings(examId, forceFresh = false) {
    const cacheKey = `exam:settings-full:${examId}`;

    if (!forceFresh && isRedisReady()) {
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return JSON.parse(cached);
    }

    const results = await query({
        query: `
            SELECT 
                e.id, e.id as exam_id, e.exam_name, e.description, e.subject_id,
                e.shuffle_questions, e.shuffle_answers, e.timer_mode, 
                e.duration_minutes, e.min_time_minutes, e.max_attempts,
                e.scoring_mode, e.total_target_score, e.auto_distribute,
                s.start_time, s.end_time,
                UNIX_TIMESTAMP(s.start_time) as start_time_ts,
                UNIX_TIMESTAMP(s.end_time) as end_time_ts,
                s.require_safe_browser, s.require_seb, s.seb_config_key,
                s.show_instructions, s.instruction_type, s.custom_instructions,
                s.show_result, s.show_analysis, s.require_all_answered,
                s.require_token, s.token_type, s.current_token, s.violation_action
            FROM rhs_exams e
            LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
            WHERE e.id = ?
        `,
        values: [examId],
    });

    if (results.length === 0) return null;

    const classResults = await query({
        query: `SELECT class_id FROM rhs_exam_classes WHERE exam_id = ?`,
        values: [examId]
    });
    const allowedClasses = classResults.map(r => r.class_id);

    const examData = {
        ...results[0],
        subject_id: results[0].subject_id || '',
        shuffle_questions: Boolean(results[0].shuffle_questions),
        shuffle_answers: Boolean(results[0].shuffle_answers),
        scoring_mode: results[0].scoring_mode || 'percentage',
        total_target_score: results[0].total_target_score || 100,
        auto_distribute: Boolean(results[0].auto_distribute),
        require_safe_browser: Boolean(results[0].require_safe_browser),
        require_seb: Boolean(results[0].require_seb),
        show_instructions: Boolean(results[0].show_instructions),
        instruction_type: results[0].instruction_type || 'template',
        custom_instructions: results[0].custom_instructions || '',
        show_result: Boolean(results[0].show_result),
        show_analysis: Boolean(results[0].show_analysis),
        require_all_answered: Boolean(results[0].require_all_answered),
        require_token: Boolean(results[0].require_token),
        token_type: results[0].token_type || 'static',
        current_token: results[0].current_token || '',
        violation_action: results[0].violation_action || 'abaikan',
        allowed_classes: allowedClasses
    };

    if (isRedisReady()) {
        await redis.set(cacheKey, JSON.stringify(examData), 'EX', 3600).catch(() => { });
    }

    return examData;
}

/**
 * Fetches exam questions (standardized for Redis and DB)
 */
export async function getExamQuestions(examId, forceFresh = false) {
    const cacheKey = `exam:data:${examId}`;

    if (!forceFresh && isRedisReady()) {
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return JSON.parse(cached);
    }

    // 1. Fetch minimal settings needed for questions view
    const examSettings = await query({
        query: 'SELECT shuffle_questions, shuffle_answers FROM rhs_exams WHERE id = ?',
        values: [examId],
    });

    if (examSettings.length === 0) return null;

    // 2. Fetch all questions
    const questions = await query({
        query: `
            SELECT id, exam_id, question_text, options, correct_option, question_type, points, scoring_strategy, scoring_metadata
            FROM rhs_exam_questions 
            WHERE exam_id = ?
            ORDER BY sort_order ASC, id ASC
        `,
        values: [examId],
    });

    const examData = {
        settings: examSettings[0],
        questions
    };

    if (isRedisReady()) {
        await redis.set(cacheKey, JSON.stringify(examData), 'EX', 3600).catch(() => { });
    }

    return examData;
}

/**
 * Invalidates all related Redis caches for an exam
 */
export async function invalidateExamCache(examId) {
    if (!isRedisReady()) return;

    try {
        const pipeline = redis.pipeline();
        // Clear specific exam data
        if (examId) {
            pipeline.del(`exam:settings-full:${examId}`);
            pipeline.del(`exam:data:${examId}`);
        }

        // 1. Get all tracked list keys from the Set
        const listKeys = await redis.smembers('exams:active_list_keys').catch(() => []);
        
        if (listKeys.length > 0) {
            // 2. Delete all tracked lists
            pipeline.del(listKeys);
            // 3. Clear the tracking set
            pipeline.del('exams:active_list_keys');
        }

        await pipeline.exec();

        // Emit change event to trigger SSE streams
        eventBus.emit('exam_change', { examId });
    } catch (e) {
        console.error(`Redis Invalidation Error [Exam ${examId}]:`, e);
    }
}

/**
 * Fetches the list of exams based on user role and class
 */
export async function getExamsList(user, forceFresh = false) {
    if (!user) return [];

    const { id: userId, roleName: role, class_id: classId } = user;
    let exams;
    const listCacheKey = role === 'student' ? `exams:list:class:${classId}` : `exams:list:${role}:${userId}`;

    if (!forceFresh && isRedisReady()) {
        const cached = await redis.get(listCacheKey).catch(() => null);
        if (cached) exams = JSON.parse(cached);
    }

    if (!exams) {
        let examsQuery = `
            SELECT e.*,
                e.is_hidden as exam_is_hidden,
                s.require_safe_browser,
                s.require_seb,
                s.seb_config_key,
                s.start_time,
                s.end_time,
                s.show_result,
                s.show_analysis,
                c.name as category_name,
                c.is_hidden as category_is_hidden,
                s_subj.name as subject_name
            FROM rhs_exams e
            LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
            LEFT JOIN rhs_exam_categories c ON e.category_id = c.id
            LEFT JOIN rhs_subjects s_subj ON e.subject_id = s_subj.id
        `;
        let queryValues = [];

        if (role === 'student') {
            examsQuery += `
                INNER JOIN rhs_exam_classes ec ON e.id = ec.exam_id
                WHERE ec.class_id = ? AND e.is_hidden = FALSE 
                AND (c.id IS NULL OR (c.is_hidden = FALSE AND c.is_admin_hidden = FALSE))
            `;
            queryValues.push(classId || -1);
        } else if (role === 'teacher') {
            examsQuery += `
                WHERE EXISTS (
                    SELECT 1 FROM rhs_exam_classes ec
                    INNER JOIN rhs_teacher_classes tc ON ec.class_id = tc.class_id
                    WHERE ec.exam_id = e.id AND tc.teacher_id = ?
                )
                AND (
                    e.subject_id IS NULL 
                    OR EXISTS (
                        SELECT 1 FROM rhs_teacher_subjects ts
                        WHERE ts.subject_id = e.subject_id AND ts.teacher_id = ?
                    )
                )
                AND (c.id IS NULL OR c.is_admin_hidden = FALSE)
            `;
            queryValues.push(userId, userId);
        }

        examsQuery += ` ORDER BY e.created_at DESC`;
        exams = await query({ query: examsQuery, values: queryValues });

        if (isRedisReady() && exams.length > 0) {
            await Promise.all([
                redis.set(listCacheKey, JSON.stringify(exams), 'EX', 300),
                redis.sadd('exams:active_list_keys', listCacheKey)
            ]).catch(() => { });
        }
    }

    if (role === 'student') {
        const allUserAttempts = await query({
            query: `SELECT id as attempt_id, exam_id, status, score, UNIX_TIMESTAMP(start_time) as start_time_ts FROM rhs_exam_attempts WHERE user_id = ? ORDER BY start_time DESC`,
            values: [userId]
        });

        const now_ts = Math.floor(Date.now() / 1000);
        const attemptsInfo = allUserAttempts.reduce((acc, attempt) => {
            if (!acc[attempt.exam_id]) {
                acc[attempt.exam_id] = { count: 0, hasInProgress: false, latestAttemptId: attempt.attempt_id, latestScore: attempt.score };
            }
            acc[attempt.exam_id].count++;

            if (attempt.status === 'in_progress') {
                const exam = exams.find(ex => ex.id === attempt.exam_id);
                let isExpired = false;
                if (exam) {
                    if (exam.timer_mode === 'async') {
                        const durationSeconds = (exam.duration_minutes || 0) * 60;
                        if (now_ts > (attempt.start_time_ts + durationSeconds)) isExpired = true;
                    } else if (exam.end_time) {
                        const globalEndTime = Math.floor(new Date(exam.end_time).getTime() / 1000);
                        if (now_ts > globalEndTime) isExpired = true;
                    }
                }
                if (!isExpired) acc[attempt.exam_id].hasInProgress = true;
            }
            return acc;
        }, {});

        exams.forEach(exam => {
            const info = attemptsInfo[exam.id];
            exam.user_attempts = info ? info.count : 0;
            exam.has_in_progress = info ? info.hasInProgress : false;
            exam.latest_attempt_id = info ? info.latestAttemptId : null;
            exam.latest_score = info ? info.latestScore : null;
        });
    }

    return exams;
}

/**
 * Fetches the list of categories based on user role
 */
export async function getCategoriesList(user) {
    if (!user) return [];

    const { roleName: role } = user;
    let categoriesQuery = `SELECT id, name, created_by, created_at, is_hidden, is_hidden as isHidden, sort_order, is_admin_hidden, is_admin_hidden as isAdminHidden FROM rhs_exam_categories`;
    let queryValues = [];

    if (role === 'student') {
        categoriesQuery += ` WHERE is_admin_hidden = FALSE AND is_hidden = FALSE`;
    } else if (role !== 'admin') {
        categoriesQuery += ` WHERE is_admin_hidden = FALSE`;
    }
    categoriesQuery += ` ORDER BY sort_order ASC, created_at ASC`;

    return await query({ query: categoriesQuery, values: queryValues });
}

import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { seededShuffle } from '@/app/lib/utils';
import { validateUserSession } from '@/app/lib/auth';
import { recalculateExamScores, distributeExamPoints } from '@/app/lib/exams';
import redis, { isRedisReady } from '@/app/lib/redis';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET handler to fetch all questions for an exam, with shuffling logic
export async function GET(request) {
  const session = await getSession(request);

  if (!session.user || !session.user.id || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId') || searchParams.get('exam_id');

  if (!examId) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    const cacheKey = `exam:data:${examId}`;
    let examData;

    // Try to get from Redis cache (ONLY if ready)
    let cachedData = null;
    if (isRedisReady()) {
      cachedData = await redis.get(cacheKey).catch(() => null);
    }
    
    if (cachedData) {
      examData = JSON.parse(cachedData);
    } else {
      // 1. Fetch exam settings
      const examSettings = await query({
        query: 'SELECT shuffle_questions, shuffle_answers FROM rhs_exams WHERE id = ?',
        values: [examId],
      });

      if (examSettings.length === 0) {
        return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
      }

      // 2. Fetch all questions for the exam
      const questions = await query({
        query: `
          SELECT id, exam_id, question_text, options, correct_option, question_type, points, scoring_strategy, scoring_metadata
          FROM rhs_exam_questions 
          WHERE exam_id = ?
          ORDER BY sort_order ASC, id ASC
        `,
        values: [examId],
      });

      examData = {
        settings: examSettings[0],
        questions
      };

      // Store in Redis for 1 hour (3600s) - ONLY if ready
      if (isRedisReady()) {
        await redis.set(cacheKey, JSON.stringify(examData), 'EX', 3600).catch(() => {});
      }
    }

    const { shuffle_questions, shuffle_answers } = examData.settings;
    let questions = [...examData.questions]; // Deep copy for shuffling

    // 3. Create a deterministic seed for this user and exam
    const seed = session.user.id + '-' + examId;

    // 4. Shuffle questions if enabled only for students
    if (shuffle_questions && session.user.roleName === 'student') {
      seededShuffle(questions, seed);
    }

    // 5. Process questions: parse options, and shuffle answers if enabled
    const processedQuestions = questions.map(question => {
      let parsedOptions;
      try {
        parsedOptions = typeof question.options === 'string' 
          ? JSON.parse(question.options || '{}') 
          : (question.options || {});
      } catch (e) {
        console.error('Failed to parse options for question ' + question.id + ': ', e);
        return {
          id: question.id,
          exam_id: question.exam_id,
          question_text: question.question_text,
          correct_option: question.correct_option,
          options: [],
        };
      }

      let optionsArray = Object.entries(parsedOptions).map(([key, text]) => ({
        originalKey: key,
        text,
      }));

      if (shuffle_answers && session.user.roleName === 'student') {
        const answerSeed = seed + '-q' + question.id;
        seededShuffle(optionsArray, answerSeed);
      }

      return {
        id: question.id,
        exam_id: question.exam_id,
        question_text: question.question_text,
        correct_option: question.correct_option,
        options: optionsArray,
        question_type: question.question_type,
        points: question.points,
        scoring_strategy: question.scoring_strategy,
        scoring_metadata: question.scoring_metadata,
      };
    });

    return NextResponse.json(processedQuestions, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ message: 'Failed to retrieve questions', error: error.message }, { status: 500 });
  }
}

// POST handler to add a new question (Admin/Teacher Only)
export async function POST(request) {
  const session = await getSession(request);
  if (!session.user || !['admin', 'teacher'].includes(session.user.roleName)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId, questionText, options, correctOption, questionType, points, scoringStrategy, scoringMetadata } = await request.json();
    if (!examId || !questionText || (!options && questionType !== 'essay') || (!correctOption && questionType !== 'essay')) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const result = await query({
      query: 'INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option, question_type, points, scoring_strategy, scoring_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      values: [
          examId, 
          questionText, 
          JSON.stringify(options || {}), 
          correctOption || '', 
          questionType || 'multiple_choice',
          (points !== undefined && points !== null) ? points : 1.0,
          scoringStrategy || 'standard',
          scoringMetadata ? JSON.stringify(scoringMetadata) : null
      ],
    });

    // Invalidate Redis Cache IMMEDIATELY after update
    if (isRedisReady()) {
      await Promise.all([
        redis.del(`exam:data:${examId}`),
        redis.del(`exam:settings-full:${examId}`),
        redis.keys('exams:list:*').then(keys => keys.length > 0 ? redis.del(keys) : null)
      ]).catch(() => {});
    }

    const examSettings = await query({
      query: 'SELECT auto_distribute FROM rhs_exams WHERE id = ?',
      values: [examId],
    });

    if (examSettings.length > 0 && examSettings[0].auto_distribute) {
      await distributeExamPoints(examId);
    }

    await recalculateExamScores(examId);

    // Invalidate Redis Cache
    if (isRedisReady()) {
      await Promise.all([
        redis.del(`exam:data:${examId}`),
        redis.del(`exam:settings-full:${examId}`),
        redis.keys('exams:list:*').then(keys => keys.length > 0 ? redis.del(keys) : null)
      ]).catch(() => {});
    }

    return NextResponse.json({ message: 'Question added successfully', id: result.insertId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to add question', error: error.message }, { status: 500 });
  }
}

// DELETE handler to remove a question (Admin/Teacher Only)
export async function DELETE(request) {
  const session = await getSession(request);
  if (!session.user || !['admin', 'teacher'].includes(session.user.roleName)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ message: 'Question ID is required' }, { status: 400 });
    }

    // Get examId before deleting
    const qData = await query({
      query: 'SELECT exam_id FROM rhs_exam_questions WHERE id = ?',
      values: [id],
    });

    const result = await query({
      query: 'DELETE FROM rhs_exam_questions WHERE id = ?',
      values: [id],
    });

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: 'Question not found' }, { status: 404 });
    }

    if (qData.length > 0) {
      const examId = qData[0].exam_id;

      // Invalidate Redis Cache IMMEDIATELY after update
      if (isRedisReady()) {
        await Promise.all([
          redis.del(`exam:data:${examId}`),
          redis.del(`exam:settings-full:${examId}`),
          redis.keys('exams:list:*').then(keys => keys.length > 0 ? redis.del(keys) : null)
        ]).catch(() => {});
      }

      const examSettings = await query({
        query: 'SELECT auto_distribute FROM rhs_exams WHERE id = ?',
        values: [examId],
      });

      if (examSettings.length > 0 && examSettings[0].auto_distribute) {
        await distributeExamPoints(examId);
      }
      await recalculateExamScores(examId);
    }

    return NextResponse.json({ message: 'Question deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete question', error: error.message }, { status: 500 });
  }
}

// PUT handler to update a question (Admin/Teacher Only)
export async function PUT(request) {
  const session = await getSession(request);
  if (!session.user || !['admin', 'teacher'].includes(session.user.roleName)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, questionText, options, correctOption, questionType, points, scoringStrategy, scoringMetadata } = await request.json();
    if (!id || !questionText || (!options && questionType !== 'essay') || (!correctOption && questionType !== 'essay')) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Get examId to recalculate scores
    const qData = await query({
      query: 'SELECT exam_id FROM rhs_exam_questions WHERE id = ?',
      values: [id],
    });

    const result = await query({
      query: 'UPDATE rhs_exam_questions SET question_text = ?, options = ?, correct_option = ?, question_type = ?, points = ?, scoring_strategy = ?, scoring_metadata = ? WHERE id = ?',
      values: [
          questionText, 
          JSON.stringify(options || {}), 
          correctOption || '', 
          questionType || 'multiple_choice', 
          (points !== undefined && points !== null) ? points : 1.0,
          scoringStrategy || 'standard',
          scoringMetadata ? JSON.stringify(scoringMetadata) : null,
          id
      ],
    });

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: 'Question not found' }, { status: 404 });
    }

    if (qData.length > 0) {
      const examId = qData[0].exam_id;

      // Invalidate Redis Cache IMMEDIATELY after update
      if (isRedisReady()) {
        await Promise.all([
          redis.del(`exam:data:${examId}`),
          redis.del(`exam:settings-full:${examId}`),
          redis.keys('exams:list:*').then(keys => keys.length > 0 ? redis.del(keys) : null)
        ]).catch(() => {});
      }

      const examSettings = await query({
        query: 'SELECT auto_distribute FROM rhs_exams WHERE id = ?',
        values: [examId],
      });

      if (examSettings.length > 0 && examSettings[0].auto_distribute) {
        await distributeExamPoints(examId);
      }
      await recalculateExamScores(examId);
    }

    return NextResponse.json({ message: 'Question updated successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update question', error: error.message }, { status: 500 });
  }
}
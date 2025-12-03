import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { seededShuffle } from '@/app/lib/utils'; // <-- Import the shuffle utility

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET handler to fetch all questions for an exam, with shuffling logic
export async function GET(request) {
  const session = await getSession(request);

  if (!session.user || !session.user.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId') || searchParams.get('exam_id');

  if (!examId) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    // 1. Fetch exam settings first
    const examSettings = await query({
      query: 'SELECT shuffle_questions, shuffle_answers FROM rhs_exams WHERE id = ?',
      values: [examId],
    });

    if (examSettings.length === 0) {
      return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
    }
    const { shuffle_questions, shuffle_answers } = examSettings[0];

    // 2. Fetch all questions for the exam
    let questions = await query({
      query: `
        SELECT id, exam_id, question_text, options, correct_option 
        FROM rhs_exam_questions 
        WHERE exam_id = ?
      `,
      values: [examId],
    });

    // 3. Create a deterministic seed for this user and exam
    const seed = `${session.user.id}-${examId}`;

    // 4. Shuffle questions if enabled only for students
    if (shuffle_questions && session.user.roleName === 'student') {
      seededShuffle(questions, seed);
    }

    // 5. Process questions: parse options, and shuffle answers if enabled
    const processedQuestions = questions.map(question => {
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(question.options || '{}');
      } catch (e) {
        console.error(`Failed to parse options for question ${question.id}:`, e);
        return {
          id: question.id,
          exam_id: question.exam_id,
          question_text: question.question_text,
          correct_option: question.correct_option,
          options: [], 
        };
      }
      
      // Convert options object to an array of { originalKey, text }
      // This is crucial for shuffling text while preserving the correct answer key.
      let optionsArray = Object.entries(parsedOptions).map(([key, text]) => ({
        originalKey: key,
        text,
      }));

      // Shuffle the answers array if enabled only for students
      if (shuffle_answers && session.user.roleName === 'student') {
        // Use a question-specific seed to ensure different answer shuffles per question
        const answerSeed = `${seed}-q${question.id}`;
        seededShuffle(optionsArray, answerSeed);
      }

      // Return the new, robust question structure
      return {
        id: question.id,
        exam_id: question.exam_id,
        question_text: question.question_text,
        correct_option: question.correct_option, // This still refers to the originalKey
        options: optionsArray, // The frontend will now receive this array and must adapt
      };
    });

    return NextResponse.json(processedQuestions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ message: 'Failed to retrieve questions', error: error.message }, { status: 500 });
  }
}

// POST handler to add a new question (Admin Only)
export async function POST(request) {
    const session = await getSession(request);
    if (!session.user || session.user.roleName !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  
    try {
      const { examId, questionText, options, correctOption } = await request.json();
      if (!examId || !questionText || !options || !correctOption) {
        return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
      }
  
      const result = await query({
        query: 'INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option) VALUES (?, ?, ?, ?)',
        values: [examId, questionText, JSON.stringify(options), correctOption],
      });
  
      return NextResponse.json({ message: 'Question added successfully', id: result.insertId }, { status: 201 });
    } catch (error) {
      return NextResponse.json({ message: 'Failed to add question', error: error.message }, { status: 500 });
    }
  }
  
  // DELETE handler to remove a question (Admin Only)
  export async function DELETE(request) {
      const session = await getSession(request);
      if (!session.user || session.user.roleName !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
    
      try {
        const { id } = await request.json();
        if (!id) {
          return NextResponse.json({ message: 'Question ID is required' }, { status: 400 });
        }
    
        const result = await query({
          query: 'DELETE FROM rhs_exam_questions WHERE id = ?',
          values: [id],
        });
  
        if (result.affectedRows === 0) {
          return NextResponse.json({ message: 'Question not found' }, { status: 404 });
        }
    
        return NextResponse.json({ message: 'Question deleted successfully' });
      } catch (error) {
        return NextResponse.json({ message: 'Failed to delete question', error: error.message }, { status: 500 });
      }
    }
  
  // PUT handler to update a question (Admin Only)
  export async function PUT(request) {
    const session = await getSession(request);
    if (!session.user || session.user.roleName !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  
    try {
        const { id, questionText, options, correctOption } = await request.json();
        if (!id || !questionText || !options || !correctOption) {
          return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }
  
      const result = await query({
        query: 'UPDATE rhs_exam_questions SET question_text = ?, options = ?, correct_option = ? WHERE id = ?',
        values: [questionText, JSON.stringify(options), correctOption, id],
      });
  
      if (result.affectedRows === 0) {
        return NextResponse.json({ message: 'Question not found' }, { status: 404 });
      }
  
      return NextResponse.json({ message: 'Question updated successfully' });
    } catch (error) {
      return NextResponse.json({ message: 'Failed to update question', error: error.message }, { status: 500 });
    }
  }
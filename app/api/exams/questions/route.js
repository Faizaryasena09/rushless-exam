import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET handler to fetch all questions for an exam
export async function GET(request) {
  const session = await getSession(request);

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId') || searchParams.get('exam_id');

  if (!examId) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    const questions = await query({
      query: `
        SELECT id, exam_id, question_text, options, correct_option 
        FROM rhs_exam_questions 
        WHERE exam_id = ? 
        ORDER BY created_at ASC
      `,
      values: [examId],
    });

    // Parse options for each question and transform keys before sending
    const processedQuestions = questions.map(question => {
      try {
        const parsedOptions = JSON.parse(question.options || '{}');
        const transformedOptions = {};
        // Transform keys from A, B, C, D, E to option_a, option_b, etc.
        if (parsedOptions.A) transformedOptions.option_a = parsedOptions.A;
        if (parsedOptions.B) transformedOptions.option_b = parsedOptions.B;
        if (parsedOptions.C) transformedOptions.option_c = parsedOptions.C;
        if (parsedOptions.D) transformedOptions.option_d = parsedOptions.D;
        if (parsedOptions.E) transformedOptions.option_e = parsedOptions.E; // Assuming E might exist
        
        return {
          ...question,
          ...transformedOptions, // Spread the transformed options into the question object
        };
      } catch (e) {
        console.error(`Failed to parse or transform options for question ${question.id}:`, question.options, e);
        return { ...question }; // Return original question on error
      }
    });

    return NextResponse.json(processedQuestions);
  } catch (error) {
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
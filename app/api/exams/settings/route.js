import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET handler to fetch exam settings
export async function GET(request) {
  const session = await getSession(request);
  // No admin check here to allow students to get exam details

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId') || searchParams.get('exam_id');

  if (!examId) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    const results = await query({
      query: `
          SELECT 
            e.id as exam_id, 
            e.exam_name, 
            e.description,
            e.subject_id,
            e.shuffle_questions,
            e.shuffle_answers,
            e.timer_mode,
            e.duration_minutes,
            e.min_time_minutes,
            e.max_attempts,
            e.scoring_mode,
            e.total_target_score,
            e.auto_distribute,
            s.start_time, 
            s.end_time,
            s.require_safe_browser,
            s.require_seb,
            s.seb_config_key,
            s.show_instructions,
            s.instruction_type,
            s.custom_instructions,
            s.show_result,
            s.show_analysis,
            s.require_all_answered,
            s.require_token,
            s.token_type,
            s.current_token,
            s.violation_action
          FROM rhs_exams e
          LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
          WHERE e.id = ?
        `,
      values: [examId],
    });

    if (results.length === 0) {
      return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
    }

    // Fetch allowed classes
    const classResults = await query({
      query: `SELECT class_id FROM rhs_exam_classes WHERE exam_id = ?`,
      values: [examId]
    });
    const allowedClasses = classResults.map(r => r.class_id);

    // Convert TINYINT(1) from DB to boolean
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

    return NextResponse.json(examData);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve exam settings', error: error.message }, { status: 500 });
  }
}

// POST handler to create or update exam settings (Admin Only)
export async function POST(request) {
  const session = await getSession(request);

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      examId, startTime, endTime,
      shuffleQuestions, shuffleAnswers,
      timerMode, durationMinutes, minTimeMinutes, maxAttempts,
      scoringMode, totalTargetScore, autoDistribute,
      requireSafeBrowser, requireSeb,
      showInstructions, instructionType, customInstructions,
      showResult, showAnalysis,
      requireAllAnswered,
      requireToken, tokenType, currentToken,
      violationAction,
      allowedClasses
    } = await request.json();

    if (!examId) {
      return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    // Teacher Validation: Ensure they only assign classes they manage
    if (session.user.roleName === 'teacher' && allowedClasses && allowedClasses.length > 0) {
      const teacherClasses = await query({
        query: `SELECT class_id FROM rhs_teacher_classes WHERE teacher_id = ?`,
        values: [session.user.id]
      });
      const validClassIds = new Set(teacherClasses.map(r => r.class_id));

      const hasInvalidClass = allowedClasses.some(id => !validClassIds.has(id));
      if (hasInvalidClass) {
        return NextResponse.json({ message: 'You are attempting to assign a class you do not manage.' }, { status: 403 });
      }
    }

    // If no start or end time is provided, force the mode to async
    // But ONLY if we are actually updating timing/mode
    let finalTimerMode = timerMode;
    if (startTime !== undefined || endTime !== undefined) {
      if (!startTime || !endTime) {
        finalTimerMode = 'async';
      }
    }

    await transaction(async (txQuery) => {
      // 1. Update main exam details (rhs_exams)
      const examFields = {
        shuffle_questions: shuffleQuestions,
        shuffle_answers: shuffleAnswers,
        timer_mode: finalTimerMode,
        duration_minutes: durationMinutes,
        min_time_minutes: minTimeMinutes,
        max_attempts: maxAttempts,
        scoring_mode: scoringMode,
        total_target_score: totalTargetScore,
        auto_distribute: autoDistribute
      };

      const examUpdates = [];
      const examValues = [];
      for (const [key, value] of Object.entries(examFields)) {
        if (value !== undefined) {
          examUpdates.push(`${key} = ?`);
          examValues.push(value);
        }
      }

      if (examUpdates.length > 0) {
        examValues.push(examId);
        await txQuery({
          query: `UPDATE rhs_exams SET ${examUpdates.join(', ')} WHERE id = ?`,
          values: examValues,
        });
      }

      // 2. Update exam time settings (rhs_exam_settings)
      // We use INSERT ... ON DUPLICATE KEY UPDATE
      // But we only update fields that are provided
      const settingsFields = {
        start_time: startTime,
        end_time: endTime,
        require_safe_browser: requireSafeBrowser,
        require_seb: requireSeb,
        show_instructions: showInstructions,
        instruction_type: instructionType,
        custom_instructions: customInstructions,
        show_result: showResult,
        show_analysis: showAnalysis,
        require_all_answered: requireAllAnswered,
        require_token: requireToken,
        token_type: tokenType,
        current_token: currentToken,
        violation_action: violationAction
      };

      const providedSettingsKeys = Object.entries(settingsFields)
        .filter(([_, value]) => value !== undefined)
        .map(([key, _]) => key);

      if (providedSettingsKeys.length > 0) {
        // Since we want to support partial update even on first insert, 
        // we might need to handle the case where it doesn't exist yet.
        // However, usually rhs_exams and rhs_exam_settings are created together or settings added later.
        
        // Build the query
        const keys = ['exam_id', ...providedSettingsKeys];
        const placeholders = keys.map(() => '?').join(', ');
        const updateClause = providedSettingsKeys.map(key => `${key} = VALUES(${key})`).join(', ');
        
        const settingsValues = [examId];
        providedSettingsKeys.forEach(key => {
          let val = settingsFields[key];
          // convert undefined to null for safety if somehow slipped, 
          // but we filtered them out
          settingsValues.push(val === undefined ? null : val);
        });

        await txQuery({
          query: `
                INSERT INTO rhs_exam_settings (${keys.join(', ')})
                VALUES (${placeholders})
                ON DUPLICATE KEY UPDATE ${updateClause}
              `,
          values: settingsValues,
        });
      }

      // 3. Update Allowed Classes
      // First, clear existing
      await txQuery({
        query: `DELETE FROM rhs_exam_classes WHERE exam_id = ?`,
        values: [examId]
      });

      // Then, insert new ones if any
      if (allowedClasses && Array.isArray(allowedClasses) && allowedClasses.length > 0) {
        const values = allowedClasses.map(classId => [examId, classId]);

        const placeholders = allowedClasses.map(() => '(?, ?)').join(', ');
        const flatValues = [];
        allowedClasses.forEach(cId => {
          flatValues.push(examId, cId);
        });

        await txQuery({
          query: `INSERT INTO rhs_exam_classes (exam_id, class_id) VALUES ${placeholders}`,
          values: flatValues
        });
      }
    });

    return NextResponse.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Failed to save settings', error: error.message }, { status: 500 });
  }
}

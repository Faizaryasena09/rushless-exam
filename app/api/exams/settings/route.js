import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';
import redis, { isRedisReady } from '@/app/lib/redis';
import { recalculateExamScores, distributeExamPoints, getExamSettings, invalidateExamCache } from '@/app/lib/exams';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET handler to fetch exam settings
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
    const examData = await getExamSettings(examId);

    if (!examData) {
      return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json(examData, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Settings GET Error:', error);
    return NextResponse.json({ message: 'Failed to retrieve exam settings', error: error.message }, { status: 500 });
  }
}

// POST handler to update exam settings (Admin/Teacher Only)
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
      subjectId,
      allowedClasses
    } = await request.json();

    if (!examId) {
      return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    // Teacher Validation
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

    let finalTimerMode = timerMode;
    if (startTime !== undefined || endTime !== undefined) {
      if (!startTime || !endTime) {
        finalTimerMode = 'async';
      }
    }

    await transaction(async (txQuery) => {
      // 1. Update rhs_exams
      const examFields = {
        shuffle_questions: shuffleQuestions,
        shuffle_answers: shuffleAnswers,
        timer_mode: finalTimerMode,
        duration_minutes: durationMinutes,
        min_time_minutes: minTimeMinutes,
        max_attempts: maxAttempts,
        scoring_mode: scoringMode,
        total_target_score: totalTargetScore,
        auto_distribute: autoDistribute,
        subject_id: subjectId
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

      // 2. Update rhs_exam_settings
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
        const keys = ['exam_id', ...providedSettingsKeys];
        const placeholders = keys.map(() => '?').join(', ');
        const updateClause = providedSettingsKeys.map(key => `${key} = VALUES(${key})`).join(', ');
        const settingsValues = [examId, ...providedSettingsKeys.map(k => settingsFields[k])];

        await txQuery({
          query: `INSERT INTO rhs_exam_settings (${keys.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
          values: settingsValues,
        });
      }

      // 3. Update Allowed Classes
      if (allowedClasses !== undefined) {
        await txQuery({ query: `DELETE FROM rhs_exam_classes WHERE exam_id = ?`, values: [examId] });
        if (Array.isArray(allowedClasses) && allowedClasses.length > 0) {
          const placeholders = allowedClasses.map(() => '(?, ?)').join(', ');
          const flatValues = [];
          allowedClasses.forEach(cId => flatValues.push(examId, cId));
          await txQuery({ query: `INSERT INTO rhs_exam_classes (exam_id, class_id) VALUES ${placeholders}`, values: flatValues });
        }
      }

      // Invalidate Redis Cache IMMEDIATELY after update
      await invalidateExamCache(examId);

      if (autoDistribute) {
        await distributeExamPoints(examId);
      }
      await recalculateExamScores(examId);
    });

    return NextResponse.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Settings POST Error:', error);
    return NextResponse.json({ message: 'Failed to save settings', error: error.message }, { status: 500 });
  }
}

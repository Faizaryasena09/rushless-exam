'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

// --- Custom Hook for Debouncing ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// --- Helper Functions ---
const formatTime = (seconds) => {
  if (seconds === null || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

// --- Icons Component ---
const Icons = {
  Clock: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
    </svg>
  ),
  Flag: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-8a2 2 0 012-2h10a2 2 0 012 2v8m0-8a2 2 0 00-2-2H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  ),
  Grid: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
};

// --- Timer Component ---
const Timer = ({ timeLeft }) => {
  const isCritical = timeLeft !== null && timeLeft <= 300;
  return (
    <div className={`flex items-center gap-2 font-mono px-3 py-1.5 rounded-lg ${isCritical ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
      <Icons.Clock />
      <span className="text-sm font-semibold tracking-wider">{formatTime(timeLeft)}</span>
    </div>
  );
};


// --- Finish Confirmation Modal ---
const FinishConfirmationModal = ({ isOpen, onClose, onConfirm, questions, answers }) => {
  if (!isOpen) return null;

  const unansweredQuestions = questions.filter(q => answers[q.id] === undefined);
  const isComplete = unansweredQuestions.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4 mx-auto text-indigo-600">
            <Icons.CheckCircle />
          </div>
          <h3 className="text-xl font-bold text-slate-800 text-center mb-2">
            Selesai Ujian?
          </h3>

          {!isComplete ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="text-amber-600 mt-0.5"><Icons.Flag /></div>
                <div>
                  <h4 className="font-bold text-amber-800 text-sm">Masih ada soal yang belum dijawab!</h4>
                  <p className="text-amber-700 text-sm mt-1">
                    Anda belum menjawab <span className="font-bold">{unansweredQuestions.length}</span> dari <span className="font-bold">{questions.length}</span> soal.
                  </p>
                  <p className="text-amber-700 text-xs mt-2">
                    Sebaiknya periksa kembali jawaban Anda sebelum mengumpulkan.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 text-center mb-6">
              Anda telah menjawab semua soal. Apakah Anda yakin ingin mengakhiri ujian ini? Jawaban tidak dapat diubah setelah dikirim.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
            >
              Batal & Periksa
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
            >
              Ya, Selesaikan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default function ExamTakingPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id;

  const [examDetails, setExamDetails] = useState(null);
  const [attemptDetails, setAttemptDetails] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [doubtfulAnswers, setDoubtfulAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const finishExamHandled = useRef(false);
  const initExamRef = useRef(false);
  const [showTimeAddedAlert, setShowTimeAddedAlert] = useState(false);

  // Modal State
  const [showFinishModal, setShowFinishModal] = useState(false);

  const logAction = useCallback(async (actionType, description) => {
    if (!attemptDetails?.id) return;
    try {
      await fetch('/api/exams/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attemptDetails.id,
          actionType,
          description
        })
      });
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  }, [attemptDetails?.id]);

  // 1. Logic for 1-second decrement
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!finishExamHandled.current) submitExam(true);
      return;
    }
    const interval = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // 2. Logic for 5-second server sync
  useEffect(() => {
    if (!examId) return;

    const syncInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/exams/attempt-details?exam_id=${examId}`);
        if (res.ok) {
          const data = await res.json();

          setTimeLeft(prevTime => {
            if (data.seconds_left > prevTime + 10) {
              setShowTimeAddedAlert(true);
              setTimeout(() => setShowTimeAddedAlert(false), 5000);
            }
            return data.seconds_left;
          });
        } else if (res.status === 401 || res.status === 404) {
          router.push('/dashboard/exams');
        }
      } catch (e) {
        console.error("Timer sync failed", e);
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [examId, router]);

  // 3. Security & Activity Logging
  useEffect(() => {
    if (!attemptDetails?.id) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logAction('SECURITY', 'Student left the exam page (tab switched or minimized)');
      } else {
        logAction('SECURITY', 'Student returned to the exam page');
      }
    };

    const handleBlur = () => logAction('SECURITY', 'Window lost focus');
    const handleFocus = () => logAction('SECURITY', 'Window regained focus');
    const handleCopy = () => logAction('SECURITY', 'Student copied text');
    const handlePaste = () => logAction('SECURITY', 'Student pasted text');

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [attemptDetails?.id, logAction]);

  const debouncedQuestionIndex = useDebounce(currentQuestionIndex, 1000);

  const progressPercentage = useMemo(() => {
    if (questions.length === 0) return 0;
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answers, questions.length]);

  useEffect(() => {
    fetch('/api/user-session').then((res) => {
      if (!res.ok) router.push('/');
    });
  }, [router]);

  // Actual submission logic
  const submitExam = useCallback(async (isAutoSubmit = false) => {
    if (finishExamHandled.current) return;
    finishExamHandled.current = true;

    // Close modal if open
    setShowFinishModal(false);

    if (isAutoSubmit) {
      alert('Time is up! Your answers will be submitted automatically.');
    }

    try {
      logAction('SUBMIT', isAutoSubmit ? 'Auto-submitted due to timeout' : 'Manually submitted by student');
      const response = await fetch('/api/exams/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, answers, attemptId: attemptDetails.id }),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to submit exam.');

      // Notify Safe Browser if running inside it
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage('submit_success');
      }

      router.push('/dashboard/exams');
    } catch (err) {
      alert(`Error: ${err.message}`);
      finishExamHandled.current = false;
    }
  }, [examId, answers, router, attemptDetails, logAction]);

  // Handler for button click
  const handleFinishRequest = () => {
    setShowFinishModal(true);
  };

  // Enforce Safe Browser Check
  useEffect(() => {
    if (examDetails?.require_safe_browser) {
      // Check if running in WebView2 (standard way to check)
      const isSafeBrowser = window.chrome && window.chrome.webview;

      if (!isSafeBrowser) {
        // Block access
        document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:sans-serif;text-align:center;padding:20px;">
                    <div style="font-size:4rem;margin-bottom:20px;">🛡️</div>
                    <h1 style="color:#1e293b;font-size:2rem;margin-bottom:10px;">Safe Browser Required</h1>
                    <p style="color:#64748b;font-size:1.1rem;max-width:600px;">This exam can only be taken using the <strong>Exam Safer Application</strong>.</p>
                    <p style="color:#64748b;margin-top:10px;">Please close this window and launch the exam from the application.</p>
                    <a href="/dashboard/exams" style="margin-top:30px;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Return to Dashboard</a>
                </div>
            `;
        // Stop further execution
        return;
      }
    }
  }, [examDetails]);

  useEffect(() => {
    if (!examId || initExamRef.current) return;
    initExamRef.current = true;

    async function getExamData() {
      try {
        setLoading(true);
        const [settingsRes, attemptRes, questionsRes, tempAnswersRes] = await Promise.all([
          fetch(`/api/exams/settings?exam_id=${examId}`),
          fetch('/api/exams/start-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examId }),
          }),
          fetch(`/api/exams/questions?exam_id=${examId}`),
          fetch(`/api/exams/temporary-answer?exam_id=${examId}`)
        ]);

        if (!settingsRes.ok) throw new Error((await settingsRes.json()).message || 'Could not fetch exam settings.');
        if (!attemptRes.ok) throw new Error((await attemptRes.json()).message || 'Could not start exam.');
        if (!questionsRes.ok) throw new Error((await questionsRes.json()).message || 'Could not fetch questions.');

        const settingsData = await settingsRes.json();
        const attemptData = await attemptRes.json();
        const questionsData = await questionsRes.json();

        setExamDetails(settingsData);
        setAttemptDetails(attemptData.attempt);
        setTimeLeft(attemptData.initial_seconds_left);
        setQuestions(questionsData);

        if (attemptData.attempt.last_question_index) setCurrentQuestionIndex(attemptData.attempt.last_question_index);

        // Log start/resume
        await fetch('/api/exams/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attemptId: attemptData.attempt.id,
            actionType: 'START',
            description: attemptData.status === 'resumed' ? 'Exam session resumed' : 'Exam session started'
          })
        });

        if (attemptData.attempt.doubtful_questions) {
          try {
            const doubtful = typeof attemptData.attempt.doubtful_questions === 'string'
              ? JSON.parse(attemptData.attempt.doubtful_questions)
              : attemptData.attempt.doubtful_questions;
            setDoubtfulAnswers(doubtful || {});
          } catch (e) {
            console.error("Failed to parse doubtful questions:", e);
            setDoubtfulAnswers({});
          }
        }
        if (tempAnswersRes.ok) setAnswers(await tempAnswersRes.json() || {});

      } catch (err) {
        setError(err.message);
        initExamRef.current = false;
      } finally {
        setLoading(false);
      }
    }
    getExamData();
  }, [examId]);

  const updateAttemptState = useCallback(async (dataToUpdate) => {
    if (!attemptDetails?.id) return;
    try {
      await fetch('/api/exams/update-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attemptDetails.id,
          ...dataToUpdate
        })
      });
    } catch (err) {
      console.error("Failed to update attempt state:", err);
    }
  }, [attemptDetails?.id]);

  useEffect(() => {
    if (debouncedQuestionIndex !== undefined && attemptDetails) {
      updateAttemptState({ lastQuestionIndex: debouncedQuestionIndex });
    }
  }, [debouncedQuestionIndex, attemptDetails, updateAttemptState]);

  const handleAnswerSelect = async (questionId, option) => {
    const qIndex = questions.findIndex(q => q.id === questionId);
    logAction('ANSWER', `Selected option ${option} for question #${qIndex + 1}`);
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    try {
      await fetch('/api/exams/temporary-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, questionId, selectedOption: option }),
      });
    } catch (error) {
      console.error('Failed to save temporary answer:', error);
    }
  };

  const handleClearAnswer = async (questionId) => {
    const qIndex = questions.findIndex(q => q.id === questionId);
    logAction('ANSWER', `Cleared answer for question #${qIndex + 1}`);
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[questionId];
      return newAnswers;
    });
    try {
      await fetch('/api/exams/temporary-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, questionId, selectedOption: null }),
      });
    } catch (error) {
      console.error('Failed to clear temporary answer:', error);
    }
  };

  const handleToggleDoubtful = (questionId) => {
    const qIndex = questions.findIndex(q => q.id === questionId);
    const isNowDoubtful = !doubtfulAnswers[questionId];
    logAction('FLAG', `${isNowDoubtful ? 'Marked' : 'Unmarked'} question #${qIndex + 1} as doubtful`);
    const newDoubtful = { ...doubtfulAnswers, [questionId]: isNowDoubtful };
    setDoubtfulAnswers(newDoubtful);
    updateAttemptState({ doubtfulQuestions: newDoubtful });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      logAction('NAVIGATE', `Moved to question #${currentQuestionIndex + 2}`);
      setCurrentQuestionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      logAction('NAVIGATE', `Moved to question #${currentQuestionIndex}`);
      setCurrentQuestionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectQuestion = (index) => {
    logAction('NAVIGATE', `Jumped to question #${index + 1}`);
    setCurrentQuestionIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentQuestion = questions[currentQuestionIndex];

  // --- DERIVED STATE FOR UI ---
  const minTimeLockoutSeconds = (examDetails?.min_time_minutes || 0) * 60;
  let isSubmitDisabled = true;
  let submitTitle = 'Finish and submit your answers';

  if (minTimeLockoutSeconds === 0) {
    isSubmitDisabled = false;
  } else if (timeLeft !== null) {
    isSubmitDisabled = timeLeft > minTimeLockoutSeconds;
    if (isSubmitDisabled) {
      submitTitle = `Submission is locked until the final ${examDetails.min_time_minutes} minute(s).`;
    }
  }

  if (loading) { return <div className="text-center p-20">Loading...</div> }
  if (error) { return <div className="text-center p-20 text-red-500">Error: {error}</div> }

  const QuestionNavigation = ({ questions, answers, doubtful, currentIndex, onSelect }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Navigasi Soal</h3>
        <span className="text-xs font-medium px-2 py-1 bg-white border border-slate-200 rounded text-slate-500">
          Total: {questions.length}
        </span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, index) => {
            const isAnswered = answers[q.id] !== undefined;
            const isDoubtful = doubtful[q.id];
            const isActive = index === currentIndex;
            let buttonClass = 'h-10 w-full rounded-lg text-sm font-bold transition-all duration-200 relative ';
            if (isActive) buttonClass += 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2';
            else if (isDoubtful) buttonClass += 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200';
            else if (isAnswered) buttonClass += 'bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200';
            else buttonClass += 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400 hover:bg-slate-50';
            return (
              <button key={q.id} onClick={() => onSelect(index)} className={buttonClass}>
                {index + 1}
                {isDoubtful && (<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white"></span>)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Time Added Notification */}
      {showTimeAddedAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white">
            <Icons.Clock />
            <span className="font-bold">Waktu ujian telah ditambahkan oleh pengawas!</span>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
              <Icons.ArrowLeft />
            </button>
            <div><h1 className="text-base md:text-lg font-bold text-slate-800 line-clamp-1">{examDetails?.exam_name}</h1></div>
          </div>
          <div className="flex items-center gap-4">
            <Timer timeLeft={timeLeft} />
            <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"><Icons.Grid /></button>
          </div>
        </div>
        <div className="h-1 w-full bg-slate-100 md:hidden"><div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div></div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8 lg:col-span-9 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
              {currentQuestion ? (
                <>
                  <div className="p-6 md:p-8 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">Soal No. {currentQuestionIndex + 1}</span>
                      <button onClick={() => handleToggleDoubtful(currentQuestion.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${doubtfulAnswers[currentQuestion.id] ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                        <Icons.Flag />
                        {doubtfulAnswers[currentQuestion.id] ? 'Ditandai Ragu' : 'Tandai Ragu'}
                      </button>
                    </div>
                    <div className="prose prose-slate max-w-none mb-8">
                      <p className="text-lg md:text-xl font-medium text-slate-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: currentQuestion.question_text }} />
                    </div>
                    <div className="space-y-3">
                      {currentQuestion.options && currentQuestion.options.map((option, idx) => {
                        const optionLabel = String.fromCharCode(65 + idx);
                        const isSelected = answers[currentQuestion.id] === option.originalKey;
                        return (
                          <div key={option.originalKey} onClick={() => handleAnswerSelect(currentQuestion.id, option.originalKey)} className={`group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${isSelected ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                            <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>{optionLabel}</div>
                            <span className={`text-base font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`} dangerouslySetInnerHTML={{ __html: option.text }} />
                            {isSelected && (<div className="absolute right-4 text-indigo-600"><Icons.CheckCircle /></div>)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 md:p-6 border-t border-slate-200 flex flex-col-reverse md:flex-row justify-between items-center gap-4">
                    <button onClick={() => handleClearAnswer(currentQuestion.id)} disabled={!answers[currentQuestion.id]} className={`text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${!answers[currentQuestion.id] ? 'opacity-0 pointer-events-none' : 'text-red-600 hover:bg-red-50'}`}>
                      <Icons.Trash />
                      Hapus Jawaban
                    </button>
                    <div className="flex w-full md:w-auto gap-3">
                      <button onClick={handlePrevQuestion} disabled={currentQuestionIndex === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                        <Icons.ChevronLeft />
                        Sebelumnya
                      </button>
                      {currentQuestionIndex === questions.length - 1 ? (
                        <div className="relative">
                          <button onClick={handleFinishRequest} disabled={isSubmitDisabled} title={submitTitle} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-100 disabled:bg-emerald-300 disabled:cursor-not-allowed">
                            <Icons.CheckCircle />
                            {isSubmitDisabled && minTimeLockoutSeconds > 0 && timeLeft !== null ?
                              <span>Selesai Ujian ({formatTime(timeLeft - minTimeLockoutSeconds)})</span> :
                              <span>Selesai Ujian</span>
                            }
                          </button>                            </div>
                      ) : (
                        <button onClick={handleNextQuestion} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100">
                          Selanjutnya
                          <Icons.ChevronRight />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                !loading && <div className="flex-1 flex flex-col items-center justify-center text-center p-10"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400"><Icons.Flag /></div><h2 className="text-xl font-semibold text-slate-800">Tidak ada soal dimuat.</h2><p className="text-slate-500 mt-2">Mungkin ada masalah dengan konfigurasi ujian ini.</p></div>
              )}
            </div>
          </div>
          <div className="hidden md:block md:col-span-4 lg:col-span-3">
            <QuestionNavigation questions={questions} answers={answers} doubtful={doubtfulAnswers} currentIndex={currentQuestionIndex} onSelect={handleSelectQuestion} />
          </div>
        </div>
      </div>
      {isSidebarVisible && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarVisible(false)}></div>
          <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Daftar Soal</h3>
              <button onClick={() => setIsSidebarVisible(false)} className="p-2 bg-white rounded-full text-slate-500 hover:text-slate-800 shadow-sm border border-slate-200"><Icons.ChevronRight /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, index) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isDoubtful = doubtfulAnswers[q.id];
                  const isActive = index === currentQuestionIndex;
                  let buttonClass = 'h-10 rounded-lg text-sm font-bold transition-all border ';
                  if (isActive) buttonClass += 'bg-indigo-600 text-white border-indigo-600';
                  else if (isDoubtful) buttonClass += 'bg-amber-100 text-amber-800 border-amber-200';
                  else if (isAnswered) buttonClass += 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  else buttonClass += 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
                  return (
                    <button key={q.id} onClick={() => { handleSelectQuestion(index); setIsSidebarVisible(false); }} className={buttonClass}>
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <FinishConfirmationModal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onConfirm={() => submitExam(false)}
        questions={questions}
        answers={answers}
      />
    </div>
  );
}
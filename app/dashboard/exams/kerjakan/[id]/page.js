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
  ),
  XCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  CheckCircleSmall: () => (
    <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  )
};

// --- Timer Component ---
const Timer = ({ timeLeft }) => {
  const isCritical = timeLeft !== null && timeLeft <= 300;
  return (
    <div className={`flex items-center gap-2 font-mono px-3 py-1.5 rounded-lg ${isCritical ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
      <Icons.Clock />
      <span className="text-sm font-semibold tracking-wider">{formatTime(timeLeft)}</span>
    </div>
  );
};


// --- Finish Confirmation Modal ---
const FinishConfirmationModal = ({ isOpen, onClose, onConfirm, questions, answers, requireAllAnswered }) => {
  if (!isOpen) return null;

  const unansweredQuestions = questions.filter(q => answers[q.id] === undefined);
  const isComplete = unansweredQuestions.length === 0;
  const blockSubmit = requireAllAnswered && !isComplete;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4 mx-auto text-indigo-600 dark:text-indigo-400">
            <Icons.CheckCircle />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-2">
            Selesai Ujian?
          </h3>

          {!isComplete ? (
            <div className={`${blockSubmit ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'} border rounded-lg p-4 mb-6`}>
              <div className="flex items-start gap-3">
                <div className={`${blockSubmit ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} mt-0.5`}><Icons.Flag /></div>
                <div>
                  <h4 className={`font-bold ${blockSubmit ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'} text-sm`}>
                    {blockSubmit ? '⛔ Harus jawab semua soal terlebih dahulu!' : 'Masih ada soal yang belum dijawab!'}
                  </h4>
                  <p className={`${blockSubmit ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'} text-sm mt-1`}>
                    Anda belum menjawab <span className="font-bold">{unansweredQuestions.length}</span> dari <span className="font-bold">{questions.length}</span> soal.
                  </p>
                  {blockSubmit && (
                    <p className="text-red-700 dark:text-red-400 text-xs mt-2 font-medium">
                      Ujian ini mengharuskan semua soal dijawab sebelum bisa dikumpulkan.
                    </p>
                  )}
                  {!blockSubmit && (
                    <p className="text-amber-700 dark:text-amber-400 text-xs mt-2">
                      Sebaiknya periksa kembali jawaban Anda sebelum mengumpulkan.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
              Anda telah menjawab semua soal. Apakah Anda yakin ingin mengakhiri ujian ini? Jawaban tidak dapat diubah setelah dikirim.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            >
              Batal &amp; Periksa
            </button>
            <button
              onClick={onConfirm}
              disabled={blockSubmit}
              className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-lg ${
                blockSubmit
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100 dark:shadow-emerald-900/30'
              }`}
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

  // Instruction State
  const [showInstructionsScreen, setShowInstructionsScreen] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  const [branding, setBranding] = useState({ site_name: 'Rushless Exam', site_logo: '/favicon.ico' });
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const finishExamHandled = useRef(false);
  const initExamRef = useRef(false);
  const [showTimeAddedAlert, setShowTimeAddedAlert] = useState(false);

  // Modal State
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Instruction confirmation state (persisted per-exam in localStorage)
  const [instructionsConfirmed, setInstructionsConfirmed] = useState(false);
  const lsConfirmKey = `exam_instructions_ack_${examId}`;

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

  // 2. Logic for SSE Server Sync
  useEffect(() => {
    if (!examId || !attemptDetails?.id) return;

    let sse;
    try {
      sse = new EventSource(`/api/exams/timer-stream?exam_id=${examId}`);
      
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            console.error("SSE Error:", data.error);
            if (data.error === "Not found" || data.error === "No active attempt" || data.error === "Unauthorized") {
              sse.close();
              router.push('/dashboard/exams');
            }
            return;
          }

          // Server auto-submitted the exam (student was offline when timer expired)
          if (data.auto_submitted) {
            finishExamHandled.current = true;
            sse.close();
            if (typeof window !== 'undefined') {
              localStorage.removeItem(`exam_instructions_ack_${examId}`);
            }
            setTimeLeft(0);
            alert('Waktu ujian telah habis. Jawaban Anda telah dikumpulkan secara otomatis oleh server.');
            if (examDetails?.show_result) {
              router.push(`/dashboard/exams/hasil/${attemptDetails?.id}`);
            } else {
              router.push('/dashboard/exams');
            }
            return;
          }

          setTimeLeft(prevTime => {
            if (prevTime !== null && data.seconds_left > prevTime + 5) {
              setShowTimeAddedAlert(true);
              setTimeout(() => setShowTimeAddedAlert(false), 5000);
            }
            return data.seconds_left;
          });

          if (data.status && data.status !== 'in_progress') {
             sse.close();
             // Admin force-ended this attempt — clear the instruction confirmation for this exam
             if (typeof window !== 'undefined') {
               localStorage.removeItem(`exam_instructions_ack_${examId}`);
             }
             if (examDetails?.show_result) {
                 router.push(`/dashboard/exams/hasil/${attemptDetails.id}`);
             } else {
                 router.push('/dashboard/exams');
             }
          }
        } catch (err) {
          console.error("Failed to parse SSE data", err);
        }
      };

      sse.onerror = (err) => {
        console.error("EventSource failed:", err);
      };
    } catch (e) {
      console.error("Failed to connect to SSE", e);
    }

    return () => {
      if (sse) sse.close();
    };
  }, [examId, router, attemptDetails?.id]);

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
      if (!res.ok) {
        // Session invalidated (force-logout by admin) — clear all instruction confirmations
        if (typeof window !== 'undefined') {
          Object.keys(localStorage)
            .filter(k => k.startsWith('exam_instructions_ack_'))
            .forEach(k => localStorage.removeItem(k));
        }
        router.push('/');
      }
    });

    // Fetch site branding
    fetch('/api/web-settings?mode=branding')
         .then(res => res.json())
         .then(data => {
             setBranding(data);
             if (data.site_name) {
                 const plainTextName = data.site_name.replace(/<[^>]*>?/gm, '').trim();
                 document.title = `${plainTextName || 'Rushless Exam'} - Ujian`;
             }
         })
         .catch(err => console.error(err));

    // Load confirmation state from localStorage
    if (typeof window !== 'undefined' && examId) {
      const confirmed = localStorage.getItem(`exam_instructions_ack_${examId}`);
      if (confirmed === 'true') setInstructionsConfirmed(true);
    }
  }, [router, examId]);

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

      // Clear instruction confirmation for this exam on successful submit
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`exam_instructions_ack_${examId}`);
      }

      // Notify Safe Browser if running inside it
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage('submit_success');
      }

      if (examDetails?.show_result) {
        router.push(`/dashboard/exams/hasil/${attemptDetails.id}`);
      } else {
        router.push('/dashboard/exams');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      finishExamHandled.current = false;
    }
  }, [examId, answers, router, attemptDetails, logAction]);

  // Handler for button click
  const handleFinishRequest = () => {
    setShowFinishModal(true);
  };

  // Enforce Browser Checks
  useEffect(() => {
    if (examDetails?.require_safe_browser) {
      const userAgent = navigator.userAgent.toLowerCase();
      const isWebView2 = window.chrome && window.chrome.webview;
      const isRushless = userAgent.includes('rushless');
      const isSafeBrowser = isWebView2 || isRushless;

      if (!isSafeBrowser) {
        // Block access
        document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:sans-serif;text-align:center;padding:20px;">
                    <div style="font-size:4rem;margin-bottom:20px;">🛡️</div>
                    <h1 style="color:#1e293b;font-size:2rem;margin-bottom:10px;">Rushless Safer Required</h1>
                    <p style="color:#64748b;font-size:1.1rem;max-width:600px;">Ujian ini hanya bisa dikerjakan menggunakan <strong>Aplikasi Rushless Safer</strong>.</p>
                    <p style="color:#64748b;margin-top:10px;">Harap tutup jendela ini dan buka ujian dari dalam aplikasi Rushless Safer.</p>
                    <a href="/dashboard/exams" style="margin-top:30px;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Kembali ke Dashboard</a>
                </div>
            `;
        // Stop further execution
        return;
      }
    }

    if (examDetails?.require_seb) {
      const userAgent = navigator.userAgent.toLowerCase();
      const isSEB = userAgent.includes('seb');

      if (!isSEB) {
        document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:sans-serif;text-align:center;padding:20px;">
                    <div style="font-size:4rem;margin-bottom:20px;">🔒</div>
                    <h1 style="color:#1e293b;font-size:2rem;margin-bottom:10px;">Safe Exam Browser Required</h1>
                    <p style="color:#64748b;font-size:1.1rem;max-width:600px;">Ujian ini hanya bisa dikerjakan menggunakan <strong>Safe Exam Browser (SEB)</strong>.</p>
                    <p style="color:#64748b;margin-top:10px;">Harap buka ujian ini melalui aplikasi SEB.</p>
                    <a href="/dashboard/exams" style="margin-top:30px;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Kembali ke Dashboard</a>
                </div>
            `;
        return;
      }
    }
  }, [examDetails]);

  useEffect(() => {
    if (!examId || initExamRef.current) return;
    initExamRef.current = true;

    async function loadExamSettings() {
      try {
        setLoading(true);
        const settingsRes = await fetch(`/api/exams/settings?exam_id=${examId}`);
        if (!settingsRes.ok) throw new Error((await settingsRes.json()).message || 'Could not fetch exam settings.');
        const settingsData = await settingsRes.json();
        setExamDetails(settingsData);

        if (settingsData.show_instructions) {
          const alreadyConfirmed = typeof window !== 'undefined' &&
            localStorage.getItem(`exam_instructions_ack_${examId}`) === 'true';

          if (alreadyConfirmed) {
            // Already confirmed — skip instruction screen, go straight to exam
            setInstructionsConfirmed(true);
            if (settingsData.require_token) {
              setShowTokenModal(true);
              setLoading(false);
            } else {
              await startExamProcess(settingsData);
            }
          } else {
            setShowInstructionsScreen(true);
            setLoading(false);
          }
        } else {
          // No instructions configured, automatically start
          if (settingsData.require_token) {
            setShowTokenModal(true);
            setLoading(false);
          } else {
            await startExamProcess(settingsData);
          }
        }
      } catch (err) {
        setError(err.message);
        setLoading(false);
        initExamRef.current = false;
      }
    }
    loadExamSettings();
  }, [examId]);

  const startExamProcess = async (settingsData) => {
    setStartingExam(true);
    setError(null);

    const payload = { examId };
    if (settingsData?.require_token) {
       payload.token = tokenInput;
    }

    try {
      const [attemptRes, questionsRes, tempAnswersRes] = await Promise.all([
        fetch('/api/exams/start-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch(`/api/exams/questions?exam_id=${examId}`),
        fetch(`/api/exams/temporary-answer?exam_id=${examId}`)
      ]);

      if (!attemptRes.ok) throw new Error((await attemptRes.json()).message || 'Could not start exam.');
      if (!questionsRes.ok) throw new Error((await questionsRes.json()).message || 'Could not fetch questions.');

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

      setShowInstructionsScreen(false); // Hide instructions
      setShowTokenModal(false); // Hide token modal
      setTokenInput(''); // Clear token input
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStartingExam(false);
    }
  };

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
  const requireAllAnswered = !!examDetails?.require_all_answered;
  const allAnswered = questions.length > 0 && Object.keys(answers).length >= questions.length;

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

  // Block submit button entirely if require_all_answered is enabled and not all answered
  if (requireAllAnswered && !allAnswered) {
    isSubmitDisabled = true;
    submitTitle = 'Semua soal harus dijawab terlebih dahulu sebelum bisa mengumpulkan.';
  }

  if (loading) { return <div className="text-center p-20 dark:text-slate-300">Loading...</div> }
  if (error) { return <div className="text-center p-20 text-red-500">Error: {error}</div> }

  const QuestionNavigation = ({ questions, answers, doubtful, currentIndex, onSelect }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-6">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Navigasi Soal</h3>
        <span className="text-xs font-medium px-2 py-1 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded text-slate-500 dark:text-slate-300">
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
            if (isActive) buttonClass += 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-slate-800';
            else if (isDoubtful) buttonClass += 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/50';
            else if (isAnswered) buttonClass += 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900/50';
            else buttonClass += 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600';
            return (
              <button key={q.id} onClick={() => onSelect(index)} className={buttonClass}>
                {index + 1}
                {isDoubtful && (<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white dark:border-slate-800"></span>)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (showInstructionsScreen) {
    const handleConfirmationChange = (e) => {
      const checked = e.target.checked;
      setInstructionsConfirmed(checked);
      if (typeof window !== 'undefined') {
        if (checked) {
          localStorage.setItem(lsConfirmKey, 'true');
        } else {
          localStorage.removeItem(lsConfirmKey);
        }
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl w-full max-w-2xl border border-slate-200 dark:border-slate-700">

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-transparent flex items-center justify-center mx-auto mb-4">
              <img src={branding.site_logo} alt={branding.site_name} className="w-16 h-16 object-contain drop-shadow-sm" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white">Petunjuk Ujian</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{examDetails?.exam_name}</p>
          </div>

          {/* Instruction Body */}
          <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl mb-6 border border-slate-100 dark:border-slate-600">
            {examDetails?.instruction_type === 'custom' && examDetails?.custom_instructions ? (
              <div
                className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
                dangerouslySetInnerHTML={{ __html: examDetails.custom_instructions }}
              />
            ) : (
              <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                <ul className="space-y-3">
                  <li>Berdoalah sebelum mengerjakan ujian.</li>
                  <li>Periksa daftar soal untuk melihat ragam pertanyaan yang tersedia.</li>
                  <li>Silakan gunakan fitur <strong>Tandai Ragu</strong> jika belum yakin dengan jawaban.</li>
                  <li>Kerjakan dengan jujur dan teliti.</li>
                  <li>Pastikan untuk menekan <strong>Selesai Ujian</strong> sebelum waktu habis.</li>
                </ul>
              </div>
            )}
            {examDetails?.duration_minutes && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600 flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                <Icons.Clock /> Waktu Pengerjaan: {examDetails.duration_minutes} Menit
              </div>
            )}
          </div>

          {/* Confirmation Checkbox */}
          <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all mb-6 ${
            instructionsConfirmed
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
          }`}>
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={instructionsConfirmed}
                onChange={handleConfirmationChange}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                instructionsConfirmed
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700'
              }`}>
                {instructionsConfirmed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <span className={`text-sm font-semibold ${
                instructionsConfirmed ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'
              }`}>
                Saya sudah membaca dan memahami petunjuk ujian
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Wajib dicentang sebelum dapat memulai ujian.
              </p>
            </div>
          </label>

          {/* Start Button */}
          <button
            onClick={() => {
              if (examDetails?.require_token) {
                 setShowInstructionsScreen(false);
                 setShowTokenModal(true);
              } else {
                 startExamProcess(examDetails);
              }
            }}
            disabled={startingExam || !instructionsConfirmed}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-lg transition-all ${
              !instructionsConfirmed
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 disabled:opacity-70 disabled:cursor-not-allowed'
            }`}
          >
            {startingExam ? 'Memulai...' : instructionsConfirmed ? 'Mulai Ujian Sekarang' : 'Centang konfirmasi untuk melanjutkan'}
            {!startingExam && instructionsConfirmed && <Icons.ChevronRight />}
          </button>
        </div>

      </div>
    );
  }

  if (showTokenModal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => { setShowTokenModal(false); setTokenInput(''); setError(null); setShowInstructionsScreen(true); }}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
             <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
             </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-2">Masukkan Token Ujian</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">Ujian ini dilindungi dengan token. Masukkan token yang valid untuk melanjutkan.</p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm text-center">
              {error}
            </div>
          )}

          <input 
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
            placeholder="Cth: ABCD12"
            maxLength={6}
            autoFocus
            className="w-full text-center text-3xl font-mono font-black tracking-widest uppercase p-4 mb-6 border-2 border-slate-200 dark:border-slate-600 rounded-2xl bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
          />
          
          <button
            onClick={() => startExamProcess(examDetails)}
            disabled={startingExam || tokenInput.length < 1}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {startingExam ? 'Memverifikasi...' : 'Verifikasi & Mulai Ujian'}
          </button>
        </div>
      </div>
    );
  }

  // --- RENDERING ACTUAL EXAM ---
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-transparent pb-20">
      {/* Time Added Notification */}
      {showTimeAddedAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white dark:border-slate-700">
            <Icons.Clock />
            <span className="font-bold">Waktu ujian telah ditambahkan oleh pengawas!</span>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
              <Icons.ArrowLeft />
            </button>
            <div><h1 className="text-base md:text-lg font-bold text-slate-800 dark:text-white line-clamp-1">{examDetails?.exam_name}</h1></div>
          </div>
          <div className="flex items-center gap-4">
            <Timer timeLeft={timeLeft} />
            <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"><Icons.Grid /></button>
          </div>
        </div>
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 md:hidden"><div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div></div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8 lg:col-span-9 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px] flex flex-col">
              {currentQuestion ? (
                <>
                  <div className="p-6 md:p-8 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">Soal No. {currentQuestionIndex + 1}</span>
                      <button onClick={() => handleToggleDoubtful(currentQuestion.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${doubtfulAnswers[currentQuestion.id] ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                        <Icons.Flag />
                        {doubtfulAnswers[currentQuestion.id] ? 'Ditandai Ragu' : 'Tandai Ragu'}
                      </button>
                    </div>
                    <div className="prose prose-slate dark:prose-invert max-w-none mb-8">
                      <div 
                        className="text-lg md:text-xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed overflow-x-auto custom-content-wrapper" 
                        dangerouslySetInnerHTML={{ __html: currentQuestion.question_text }} 
                      />
                    </div>
                    <div className="space-y-3">
                      {currentQuestion.options && currentQuestion.options.map((option, idx) => {
                        const optionLabel = String.fromCharCode(65 + idx);
                        const isSelected = answers[currentQuestion.id] === option.originalKey;
                        return (
                          <div key={option.originalKey} onClick={() => handleAnswerSelect(currentQuestion.id, option.originalKey)} className={`group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-500 shadow-sm ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white'}`}>{optionLabel}</div>
                            <div className="overflow-x-auto flex-1 custom-content-wrapper">
                                <span className={`text-base font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300 group-hover:text-indigo-900 dark:group-hover:text-white'}`} dangerouslySetInnerHTML={{ __html: option.text }} />
                            </div>
                            {isSelected && (<div className="absolute right-4 text-indigo-600 dark:text-indigo-400"><Icons.CheckCircle /></div>)}
                          </div>
                        );
                      })}
                    </div>

                    <style jsx global>{`
                        .custom-content-wrapper img {
                            max-width: 100% !important;
                            height: auto !important;
                            border-radius: 12px;
                            margin: 1rem 0;
                        }
                        .custom-content-wrapper table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                            margin: 1rem 0 !important;
                            min-width: 300px;
                        }
                        .custom-content-wrapper table td, 
                        .custom-content-wrapper table th {
                            border: 1px solid #e2e8f0;
                            padding: 8px 12px;
                            text-align: left;
                        }
                        .dark .custom-content-wrapper table td, 
                        .dark .custom-content-wrapper table th {
                            border-color: #334155;
                        }
                        .custom-content-wrapper p {
                            margin-bottom: 0.5rem;
                        }
                        .custom-content-wrapper blockquote {
                            border-left: 4px solid #6366f1;
                            padding-left: 1rem;
                            font-style: italic;
                            color: #64748b;
                        `}</style>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 px-2 md:px-8 py-5 md:py-8 border-t border-slate-200 dark:border-slate-700 flex flex-col-reverse md:flex-row justify-between items-center gap-4">
                    <button onClick={() => handleClearAnswer(currentQuestion.id)} disabled={!answers[currentQuestion.id]} className={`text-[10px] md:text-sm font-black flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${!answers[currentQuestion.id] ? 'opacity-0 pointer-events-none' : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95'}`}>
                      <Icons.Trash />
                      Hapus <span className="hidden sm:inline">Jawaban</span>
                    </button>
                    <div className="flex w-full md:w-auto gap-2">
                      <button onClick={handlePrevQuestion} disabled={currentQuestionIndex === 0} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 md:px-6 py-3.5 text-xs md:text-sm font-black text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95">
                        <Icons.ChevronLeft />
                        Prev
                      </button>
                      {currentQuestionIndex === questions.length - 1 ? (
                        <div className="relative flex-[2] md:flex-none">
                          <button onClick={handleFinishRequest} disabled={isSubmitDisabled} title={submitTitle} className={`w-full flex items-center justify-center gap-2 px-4 md:px-8 py-3.5 text-xs md:text-sm font-black text-white rounded-xl active:scale-95 transition-all shadow-xl disabled:cursor-not-allowed ${
                            requireAllAnswered && !allAnswered
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shadow-none'
                              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 dark:shadow-none disabled:bg-emerald-300 dark:disabled:bg-emerald-800'
                          }`}>
                            <Icons.CheckCircleSmall />
                            {requireAllAnswered && !allAnswered ? (
                                <span>Jawab ({Object.keys(answers).length})</span>
                            ) : isSubmitDisabled && minTimeLockoutSeconds > 0 && timeLeft !== null ? (
                                <span>({formatTime(timeLeft - minTimeLockoutSeconds)})</span>
                            ) : (
                                <span>Selesai</span>
                            )}
                          </button>
                        </div>
                      ) : (
                        <button onClick={handleNextQuestion} className="flex-[2] md:flex-none flex items-center justify-center gap-2 px-4 md:px-8 py-3.5 text-xs md:text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-100 dark:shadow-none text-center">
                          Next
                          <Icons.ChevronRight />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                !loading && <div className="flex-1 flex flex-col items-center justify-center text-center p-10"><div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-400"><Icons.Flag /></div><h2 className="text-xl font-semibold text-slate-800 dark:text-white">Tidak ada soal dimuat.</h2><p className="text-slate-500 dark:text-slate-400 mt-2">Mungkin ada masalah dengan konfigurasi ujian ini.</p></div>
              )}
            </div>
          </div>
          <div className="hidden md:block md:col-span-4 lg:col-span-3">
            <QuestionNavigation questions={questions} answers={answers} doubtful={doubtfulAnswers} currentIndex={currentQuestionIndex} onSelect={handleSelectQuestion} />
          </div>
        </div>
      </div>
      {isSidebarVisible && (
        <div className="fixed inset-0 z-50 md:hidden overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300" onClick={() => setIsSidebarVisible(false)}></div>
          <div className="absolute right-0 top-0 h-full w-[85%] sm:w-80 bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col animate-in slide-in-from-right">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Icons.Grid />
                  Daftar Soal
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ujian: {examDetails?.exam_name}</p>
              </div>
              <button 
                onClick={() => setIsSidebarVisible(false)} 
                className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all active:scale-90 shadow-sm border border-slate-100 dark:border-slate-800"
              >
                <Icons.XCircle />
              </button>
            </div>

            {/* Stats Summary */}
            <div className="px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
               <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className="text-sm font-black text-emerald-600">{Object.keys(answers).length}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Dijawab</div>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className="text-sm font-black text-amber-600">{Object.keys(doubtfulAnswers).length}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Ragu</div>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className="text-sm font-black text-slate-500">{questions.length - Object.keys(answers).length}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Belum</div>
                  </div>
               </div>
            </div>

            {/* Question Grid */}
            <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 pb-8">
                {questions.map((q, index) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isDoubtful = doubtfulAnswers[q.id];
                  const isActive = index === currentQuestionIndex;
                  
                  let buttonClass = 'h-12 rounded-2xl text-sm font-black transition-all border-2 relative active:scale-90 flex items-center justify-center ';
                  
                  if (isActive) {
                    buttonClass += 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none ring-4 ring-indigo-500/10 drop-shadow-md';
                  } else if (isDoubtful) {
                    buttonClass += 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100';
                  } else if (isAnswered) {
                    buttonClass += 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100';
                  } else {
                    buttonClass += 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600';
                  }
                  
                  return (
                    <button 
                      key={q.id} 
                      onClick={() => { handleSelectQuestion(index); setIsSidebarVisible(false); }} 
                      className={buttonClass}
                    >
                      {index + 1}
                      {isDoubtful && <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>}
                      {isAnswered && !isDoubtful && <span className="absolute bottom-1 right-1"><Icons.CheckCircleSmall /></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
               <button 
                  onClick={() => setIsSidebarVisible(false)}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:opacity-90 active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
               >
                  Tutup Panel
               </button>
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
        requireAllAnswered={requireAllAnswered}
      />
    </div>
  );
}
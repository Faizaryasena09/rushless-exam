'use client';

import { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { useUser } from '@/app/context/UserContext';
import dynamic from 'next/dynamic';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

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
  Flag: ({ filled = false }) => (
    <svg className={`w-4 h-4 transition-all duration-300 ${filled ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H11l-1-1H5a2 2 0 00-2 2z" />
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
  ),
  Sidebar: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l2 2 4-4" />
    </svg>
  ),
  Type: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 5v12m0 0H7m2 0h2M13 12h7m-3.5 0v5m0 0H15m1.5 0H18" />
    </svg>
  )
};

// --- Timer Component ---
const Timer = memo(({ timeLeft, isHidden, onToggle }) => {
  const isCritical = timeLeft !== null && timeLeft <= 300;
  
  if (isHidden) {
    return (
      <button 
        onClick={onToggle}
        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all active:scale-90 ${isCritical ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}
        title="Klik untuk melihat sisa waktu"
      >
        <Icons.Clock />
      </button>
    );
  }

  return (
    <div 
      onClick={onToggle}
      className={`flex items-center gap-2 font-mono px-3 py-1.5 rounded-lg cursor-pointer select-none transition-all active:scale-95 hover:brightness-95 ${isCritical ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
      title="Klik untuk menyembunyikan timer"
    >
      <Icons.Clock />
      <span className="text-sm font-semibold tracking-wider">{formatTime(timeLeft)}</span>
    </div>
  );
});
Timer.displayName = 'Timer';

// --- Save Status Indicator Component ---
const SaveStatusIndicator = memo(({ status }) => {
  if (status === 'idle') return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
      status === 'saving' 
        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' 
        : status === 'saved'
        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    }`}>
      {status === 'saving' && (
        <>
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="animate-pulse">Menyimpan...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Icons.CheckCircleSmall />
          <span>Tersimpan di Server</span>
        </>
      )}
      {status === 'error' && (
        <>
          <Icons.XCircle />
          <span>Gagal Menyimpan</span>
        </>
      )}
    </div>
  );
});
SaveStatusIndicator.displayName = 'SaveStatusIndicator';

// --- Question Navigation Component ---
const QuestionNavigation = memo(({ questions, answers, doubtful, currentIndex, onSelect }) => {
  const answeredCount = Object.keys(answers).length;
  const doubtfulCount = Object.keys(doubtful).length;
  const remainingCount = questions.length - answeredCount;
  const progress = (answeredCount / questions.length) * 100;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-24 transition-all">
      {/* Header with Progress */}
      <div className="relative p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/50">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Status Progres</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{Math.round(progress)}% Selesai</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
             <Icons.Grid />
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
           <div className="h-full bg-indigo-600 transition-all duration-700 ease-out" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700 border-b border-slate-100 dark:border-slate-700">
         <div className="p-4 text-center">
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">{answeredCount}</div>
            <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">Dijawab</div>
         </div>
         <div className="p-4 text-center">
            <div className="text-lg font-black text-amber-500 leading-none">{doubtfulCount}</div>
            <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">Ragu</div>
         </div>
         <div className="p-4 text-center">
            <div className="text-lg font-black text-slate-400 leading-none">{remainingCount}</div>
            <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">Belum</div>
         </div>
      </div>

      {/* Question Grid */}
      <div className="p-5 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
        <div className="grid grid-cols-5 gap-2.5">
          {questions.map((q, index) => {
            const isAnswered = answers[q.id] !== undefined;
            const isDoubtful = doubtful[q.id];
            const isActive = index === currentIndex;
            
            let btnStyle = "relative h-11 w-full rounded-xl text-xs font-black transition-all active:scale-90 flex items-center justify-center border-2 ";
            
            if (isActive) {
              btnStyle += "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none ring-4 ring-indigo-500/10";
            } else if (isDoubtful) {
              btnStyle += "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100";
            } else if (isAnswered) {
              btnStyle += "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100";
            } else {
              btnStyle += "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600";
            }

            return (
              <button 
                key={q.id} 
                onClick={() => onSelect(index)} 
                className={btnStyle}
              >
                {index + 1}
                {isDoubtful && <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border border-white dark:border-slate-800"></span>}
                {isAnswered && !isDoubtful && <span className="absolute bottom-1 right-1"><Icons.CheckCircleSmall /></span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend / Key */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
         <div className="flex flex-wrap gap-y-2 gap-x-4 items-center justify-center">
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
               <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Sudah</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
               <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Ragu</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
               <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Belum</span>
            </div>
         </div>
      </div>
    </div>
  );
});


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
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [fontSize, setFontSize] = useState('md'); // 'sm', 'md', 'lg', 'xl'
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isTimerHidden, setIsTimerHidden] = useState(false);

  // --- Derived State (Must be before hooks that use these) ---
  const currentQuestion = questions[currentQuestionIndex];
  
  // Font Size Classes Mapping
  const fontSizeClasses = {
    sm: { question: 'text-base', options: 'text-sm' },
    md: { question: 'text-lg md:text-xl', options: 'text-base' },
    lg: { question: 'text-xl md:text-2xl', options: 'text-lg' },
    xl: { question: 'text-2xl md:text-3xl', options: 'text-xl' }
  };
  const fsClasses = fontSizeClasses[fontSize] || fontSizeClasses.md;


  // Instruction State
  const [showInstructionsScreen, setShowInstructionsScreen] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  const [branding, setBranding] = useState({ site_name: 'Rushless Exam', site_logo: '/favicon.ico' });
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const editorRef = useRef(null);

  const editorConfig = useMemo(() => ({
    readonly: false,
    toolbar: true,
    placeholder: 'Tulis jawaban esai Anda di sini...',
    height: 300,
    buttons: ['bold', 'italic', 'underline', 'strikethrough', '|', 'ul', 'ol', '|', 'font', 'fontsize', 'brush', 'paragraph', '|', 'image', 'table', 'link', '|', 'align', 'undo', 'redo', '|', 'hr', 'eraser', 'fullsize']
  }), []);
  const finishExamHandled = useRef(false);
  const initExamRef = useRef(false);
  const [showTimeAddedAlert, setShowTimeAddedAlert] = useState(false);

  // Modal State
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [isViolationLocked, setIsViolationLocked] = useState(false);

  // Instruction confirmation state (persisted per-exam in localStorage)
  const [instructionsConfirmed, setInstructionsConfirmed] = useState(false);
  const lsConfirmKey = `exam_instructions_ack_${examId}`;

  const logAction = useCallback(async (actionType, description) => {
    if (!attemptDetails?.id) return;
    try {
      const res = await fetch('/api/exams/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attemptDetails.id,
          actionType,
          description
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.locked) {
          setIsViolationLocked(true);
        }
      }
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  }, [attemptDetails?.id]);

  // --- Handlers (Must be before Effects) ---
  const submitExam = useCallback(async (isAutoSubmit = false) => {
    if (finishExamHandled.current) return;
    finishExamHandled.current = true;

    // Close modal if open
    setShowFinishModal(false);

    if (isAutoSubmit) {
      alert('Time is up! Your answers will be submitted automatically.');
    }

    try {
      logAction('SUBMIT', isAutoSubmit ? 'Dikumpulkan otomatis oleh sistem (Waktu habis)' : 'Dikumpulkan secara manual oleh siswa');
      const response = await fetch('/api/exams/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, answers, attemptId: attemptDetails.id, isForce: isAutoSubmit }),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to submit exam.');

      // Clear instruction confirmation for this exam on successful submit
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`exam_instructions_ack_${examId}`);
      }

      // Improved check: handles true, 1, or "1" from database
      const shouldShowResult = examDetails?.show_result === true || 
                               examDetails?.show_result === 1 || 
                               String(examDetails?.show_result) === '1';
      
      // If we need to show results, we navigate FIRST and do NOT send quit signals yet.
      // The quit signal will be handled by the exit button on the results page.
      if (shouldShowResult && attemptDetails?.id) {
        router.push(`/dashboard/exams/hasil/${attemptDetails.id}`);
        return; // EXIT early, do not trigger quit signals or dashboard navigation
      }

      // -------------------------------------------------------------------------
      // ONLY IF NOT SHOWING RESULTS: Trigger Quit Signals
      // -------------------------------------------------------------------------
      
      // Notify Safe Browser or Android app if running inside it
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage('submit_success');
      }
      
      if (window.RushlessSafer && typeof window.RushlessSafer.finishExam === 'function') {
        window.RushlessSafer.finishExam();
        return;
      } else if (window.SafeExamBrowser && typeof window.SafeExamBrowser.quit === 'function') {
        window.SafeExamBrowser.quit();
        return;
      } else if (navigator.userAgent.toLowerCase().includes('seb')) {
        window.location.href = "/seb-quit-signal";
        return;
      } else if (navigator.userAgent.toLowerCase().includes('geschool-secure') || navigator.userAgent.toLowerCase().includes('gsms')) {
        window.location.href = "geschool://close";
        return;
      }

      router.push('/dashboard/exams');
    } catch (err) {
      alert(`Error: ${err.message}`);
      finishExamHandled.current = false;
    }
  }, [examId, answers, router, attemptDetails, logAction, examDetails?.show_result]);

  const handleFinishRequest = () => {
    setShowFinishModal(true);
  };

  const startExamProcess = useCallback(async (settingsData) => {
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
      setIsViolationLocked(!!attemptData.attempt.is_violation_locked);
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
          description: attemptData.status === 'resumed' ? 'Sesi ujian dilanjutkan (Resume)' : 'Sesi ujian dimulai'
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
  }, [examId, tokenInput, setCurrentQuestionIndex, setQuestions, setAttemptDetails, setIsViolationLocked, setTimeLeft, setAnswers, setDoubtfulAnswers]);

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

  const handleAnswerSelect = useCallback(async (questionId, option) => {
    const qIndex = questions.findIndex(q => q.id === questionId);
    const qType = questions[qIndex].question_type || 'multiple_choice';
    let newAnswer;

    if (qType === 'multiple_choice_complex') {
        const currentAnswer = answers[questionId] || '';
        const selectedOptions = currentAnswer ? currentAnswer.split(',') : [];
        if (selectedOptions.includes(option)) {
            newAnswer = selectedOptions.filter(o => o !== option).sort().join(',');
        } else {
            newAnswer = [...selectedOptions, option].sort().join(',');
        }
    } else {
        newAnswer = option;
    }

    logAction('ANSWER', `Memperbarui jawaban untuk soal nomor ${qIndex + 1}`);
    setAnswers((prev) => {
        if (!newAnswer) {
            const next = { ...prev };
            delete next[questionId];
            return next;
        }
        return { ...prev, [questionId]: newAnswer };
    });

    try {
      setSaveStatus('saving');
      const response = await fetch('/api/exams/temporary-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, questionId, selectedOption: newAnswer || null }),
      });
      if (response.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save temporary answer:', error);
      setSaveStatus('error');
    }
  }, [examId, questions, answers, logAction]);

  const handleEssayChange = async (questionId, text) => {
      setAnswers((prev) => ({ ...prev, [questionId]: text }));
      // We'll save this via a separate mechanism or on blur
  };

  const saveEssayAnswer = async (questionId, text) => {
      try {
          setSaveStatus('saving');
          const response = await fetch('/api/exams/temporary-answer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ examId, questionId, selectedOption: text }),
          });
          if (response.ok) {
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 3000);
          } else {
              setSaveStatus('error');
          }
      } catch (error) {
          console.error('Failed to save essay answer:', error);
          setSaveStatus('error');
      }
  };

  const handleClearAnswer = async (questionId) => {
    const qIndex = questions.findIndex(q => q.id === questionId);
    logAction('ANSWER', `Menghapus jawaban untuk soal nomor ${qIndex + 1}`);
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[questionId];
      return newAnswers;
    });
    try {
      setSaveStatus('saving');
      const response = await fetch('/api/exams/temporary-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, questionId, selectedOption: null }),
      });
      if (response.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to clear temporary answer:', error);
      setSaveStatus('error');
    }
  };

  const handleToggleDoubtful = (questionId) => {
    const qIndex = questions.findIndex(q => q.id === questionId);
    const isNowDoubtful = !doubtfulAnswers[questionId];
    logAction('FLAG', `${isNowDoubtful ? 'Menandai' : 'Menghapus tanda'} ragu-ragu untuk soal nomor ${qIndex + 1}`);
    const newDoubtful = { ...doubtfulAnswers, [questionId]: isNowDoubtful };
    setDoubtfulAnswers(newDoubtful);
    updateAttemptState({ doubtfulQuestions: newDoubtful });
  };

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentQuestionIndex, questions.length]);

  const handlePrevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentQuestionIndex]);

  const handleSelectQuestion = useCallback((index) => {
    setCurrentQuestionIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const enforceRushlessSafer = useCallback(async () => {
    // 1. Detect All Possible Secure Environments
    const userAgent = navigator.userAgent.toLowerCase();
    const isRushless = userAgent.includes('rushless') || (window.chrome && window.chrome.webview) || (typeof window !== 'undefined' && !!window.RushlessSafer);
    const isSEB = userAgent.includes('seb');
    const isGeschool = userAgent.includes('geschool-secure') || userAgent.includes('gsms');
    
    // UNIFIED CHECK: If the exam requires ANY secure browser, and we are in ANY secure browser, we PASS.
    const isAnySecureRequired = examDetails?.require_safe_browser || examDetails?.require_seb || examDetails?.require_geschool;
    const isAnySecureDetected = isRushless || isSEB || isGeschool;

    if (isAnySecureRequired && isAnySecureDetected) {
        // Student is using a supported secure browser, access granted!
        return;
    }

    // 2. If NO secure browser is detected but one is required, show the appropriate locker.
    
    // Rushless Safer Locker
    if (examDetails?.require_safe_browser && !isRushless) {
        let handoffToken = '';
        try {
          const tokenRes = await fetch('/api/auth/generate-token', { method: 'POST' });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            handoffToken = tokenData.token;
          }
        } catch (e) {
          console.error("Failed to generate handoff token for enforcement screen:", e);
        }

        const baseUrl = window.location.href;
        const launchUrl = `rushless-safer://lock?url=${encodeURIComponent(baseUrl)}${handoffToken ? `&handoff_token=${handoffToken}` : ''}`;
        
        document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f1f5f9;font-family:sans-serif;text-align:center;padding:24px;">
                    <div style="font-size:5rem;margin-bottom:24px;">🛡️</div>
                    <h1 style="color:#0f172a;font-size:2.5rem;font-weight:900;margin-bottom:12px;letter-spacing:-0.05em;">Rushless Safer Required</h1>
                    <div style="background:white;padding:40px;border-radius:32px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02);max-width:500px;width:100%;border:1px solid #e2e8f0;">
                        <p style="color:#475569;font-size:1.1rem;line-height:1.6;margin-bottom:32px;">Ujian ini diproteksi dan hanya bisa dikerjakan melalui aplikasi <strong>Rushless Safer</strong> untuk menjaga integritas ujian.</p>
                        
                        <a id="launchBtn" href="${launchUrl}" style="display:block;width:100%;padding:18px;background:#4f46e5;color:white;text-decoration:none;border-radius:16px;font-weight:800;font-size:1.1rem;margin-bottom:12px;transition:all 0.2s;box-shadow:0 10px 15px -3px rgba(79,70,229,0.3);">Buka di Rushless Safer</a>
                        
                        <a href="/dashboard/exams" style="display:block;width:100%;padding:16px;background:transparent;color:#64748b;text-decoration:none;border-radius:16px;font-weight:600;font-size:0.95rem;border:1px solid #e2e8f0;">Kembali ke Dashboard</a>
                    </div>
                    <div id="autoLaunchToast" style="margin-top:24px;background:#e2e8f0;padding:8px 16px;border-radius:full;font-size:0.75rem;color:#64748b;font-weight:600;display:none;">Membuka aplikasi otomatis dlm 2 detik...</div>
                    <p style="color:#94a3b8;font-size:0.875rem;margin-top:32px;font-weight:500;">Belum punya aplikasinya? Hubungi proktor ujian Anda.</p>
                </div>
                <script>
                    const isMobileLookup = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    if (isMobileLookup) {
                        const toast = document.getElementById('autoLaunchToast');
                        toast.style.display = 'block';
                        setTimeout(() => {
                            window.location.href = "${launchUrl}";
                        }, 2000);
                    }
                </script>
            `;
        return;
    }

    // Safe Exam Browser (SEB) Locker
    if (examDetails?.require_seb && !isSEB) {
        document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f8fafc;font-family:sans-serif;text-align:center;padding:24px;">
                    <div style="font-size:5rem;margin-bottom:24px; animation: pulse 2s infinite;">🔒</div>
                    <h1 style="color:#1e293b;font-size:2.5rem;font-weight:900;margin-bottom:12px;letter-spacing:-0.05em;">SEB Login Required</h1>
                    <div style="background:white;padding:40px;border-radius:32px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02);max-width:500px;width:100%;border:1px solid #e2e8f0;">
                        <p style="color:#64748b;font-size:1.1rem;line-height:1.6;margin-bottom:32px;">Ujian ini hanya dapat dikerjakan melalui <strong>Safe Exam Browser</strong> dengan session yang valid.</p>
                        
                        <button id="launchBtn" style="display:block;width:100%;padding:18px;background:#4f46e5;color:white;text-decoration:none;border-radius:16px;font-weight:800;font-size:1.1rem;margin-bottom:12px;transition:all 0.2s;box-shadow:0 10px 15px -3px rgba(79,70,229,0.3);border:none;cursor:pointer;">Buka & Login SEB Otomatis</button>
                        
                        <a href="/dashboard/exams" style="display:block;width:100%;padding:16px;background:transparent;color:#64748b;text-decoration:none;border-radius:16px;font-weight:600;font-size:0.95rem;border:1px solid #e2e8f0;">Kembali ke Dashboard</a>
                    </div>
                    
                    <div id="countdownContainer" style="margin-top:32px; opacity:0; transition: opacity 0.5s;">
                        <div style="width:240px; height:8px; background:#e2e8f0; border-radius:99px; overflow:hidden; margin:0 auto 16px; border:1px solid #cbd5e1;">
                            <div id="progressBar" style="width:100%; height:100%; background:linear-gradient(90deg, #4f46e5, #818cf8); transition: width 1s linear;"></div>
                        </div>
                        <p style="color:#475569; font-size:0.95rem; font-weight:700;">Membuka Safe Exam Browser dalam <span id="countdownSec" style="color:#4f46e5; font-size:1.25rem;">3</span> detik...</p>
                    </div>

                    <p style="color:#94a3b8;font-size:0.875rem;margin-top:32px;font-weight:500;">Jika SEB tidak terbuka, pastikan aplikasi sudah terinstal.</p>
                    
                    <style>
                        @keyframes pulse {
                            0% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.05); opacity: 0.9; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    </style>
                </div>
            `;
        
        let isLaunching = false;
        const launchBtn = document.getElementById('launchBtn');
        const countdownContainer = document.getElementById('countdownContainer');
        const countdownSec = document.getElementById('countdownSec');
        const progressBar = document.getElementById('progressBar');
        
        const launchSeb = async (e) => {
            if (e) e.preventDefault();
            if (isLaunching) return;
            isLaunching = true;
            
            const oldText = launchBtn.innerText;
            launchBtn.innerText = 'Mempersiapkan Ujian...';
            
            try {
                const resCount = await fetch('/api/auth/generate-token', { method: 'POST' });
                if (resCount.ok) {
                    const dataRes = await resCount.json();
                    const protocol = window.location.protocol === 'https:' ? 'sebs://' : 'seb://';
                    const host = window.location.host;
                    const clientProtocol = window.location.protocol.replace(':', '');
                    const clientHost = window.location.host;
                    const launchUrl = `${protocol}${host}/api/exams/${examId}/seb-config?token=${dataRes.token}&clientProtocol=${clientProtocol}&clientHost=${clientHost}`;
                    window.location.href = launchUrl;
                } else {
                    alert('Gagal membuat token autentikasi SEB. Coba muat ulang halaman.');
                }
            } catch (err) {
                console.error(err);
                alert('Gagal menghubungi server.');
            } finally {
                launchBtn.innerText = oldText;
                isLaunching = false;
            }
        };

        launchBtn.addEventListener('click', (e) => {
            clearInterval(countdownTimer);
            countdownContainer.style.opacity = '0';
            launchSeb(e);
        });
        
        // Auto auto-redirect when SEB finishes the exam
        let attemptWasRunning = false;
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/exams/attempt-details?exam_id=' + examId);
                if (res.ok) {
                    attemptWasRunning = true; // Exam is being taken inside SEB
                } else if (res.status === 404 && attemptWasRunning) {
                    // If it was running and now it's 404, it means the attempt is completed/deleted.
                    clearInterval(pollInterval);
                    const shouldShowResult = examDetails?.show_result === true || 
                                             examDetails?.show_result === 1 || 
                                             String(examDetails?.show_result) === '1';

                    if (shouldShowResult && attemptDetails?.id) {
                        window.location.href = `/dashboard/exams/hasil/${attemptDetails.id}`;
                    } else {
                        window.location.href = '/dashboard/exams';
                    }
                }
            } catch (e) {}
        }, 3000);

        // Auto launch logic with countdown
        let secondsLeftCountdown = 3;
        countdownContainer.style.opacity = '1';
        
        const countdownTimer = setInterval(() => {
            secondsLeftCountdown--;
            if (secondsLeftCountdown >= 0) {
                countdownSec.innerText = secondsLeftCountdown;
                progressBar.style.width = (secondsLeftCountdown / 3 * 100) + '%';
            }
            
            if (secondsLeftCountdown <= 0) {
                clearInterval(countdownTimer);
                launchSeb();
            }
        }, 1000);
        
        return;
    }

    // Geschool Secure Mode (GSMS) Locker
    if (examDetails?.require_geschool && !isGeschool) {
        let handoffToken = '';
        try {
          const tokenRes = await fetch('/api/auth/generate-token', { method: 'POST' });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            handoffToken = tokenData.token;
          }
        } catch (e) {
          console.error("Failed to generate handoff token for Geschool enforcement screen:", e);
        }

        const baseUrl = window.location.origin + window.location.pathname;
        const finalRedirectUrl = window.location.origin + `/api/auth/handoff?token=${handoffToken}&redirect=${encodeURIComponent(window.location.href)}`;
        const launchUrl = `geschool://open?url=${encodeURIComponent(finalRedirectUrl)}`;

        document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#eff6ff;font-family:sans-serif;text-align:center;padding:24px;">
                    <div style="font-size:5rem;margin-bottom:24px;">🛡️</div>
                    <h1 style="color:#1d4ed8;font-size:2.5rem;font-weight:900;margin-bottom:12px;letter-spacing:-0.05em;">Geschool Secure Mode</h1>
                    <div style="background:white;padding:40px;border-radius:32px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.02);max-width:500px;width:100%;border:1px solid #dbeafe;">
                        <p style="color:#1e40af;font-size:1.1rem;line-height:1.6;margin-bottom:32px;">Ujian ini wajib dikerjakan menggunakan aplikasi <strong>Geschool Secure Mode (GSMS)</strong>.</p>
                        
                        <a href="${launchUrl}" style="display:block;width:100%;padding:18px;background:#2563eb;color:white;text-decoration:none;border-radius:16px;font-weight:800;font-size:1.1rem;margin-bottom:12px;transition:all 0.2s;box-shadow:0 10px 15px -3px rgba(37,99,235,0.3);">Buka di Geschool</a>
                        
                        <a href="/dashboard/exams" style="display:block;width:100%;padding:16px;background:transparent;color:#4b5563;text-decoration:none;border-radius:16px;font-weight:600;font-size:0.95rem;border:1px solid #e5e7eb;">Kembali ke Dashboard</a>
                    </div>
                    <p style="color:#60a5fa;font-size:0.875rem;margin-top:32px;font-weight:500;">Sandi Emergency Exit: <strong>${examDetails.geschool_exit_password || 'rushless'}</strong></p>
                </div>
            `;
        return;
    }
  }, [examDetails, examId]);

  // --- Effects (Must be after Handlers) ---
  // 1. Logic for 1-second decrement
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!finishExamHandled.current) submitExam(true);
      return;
    }
    const interval = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, submitExam]);

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

            // Handle force_logout signal from Admin
            if (data.force_logout) {
              sse.close();
              if (typeof window !== 'undefined') {
                localStorage.removeItem(`exam_instructions_ack_${examId}`);
              }
              window.location.href = '/';
              return;
            }

            // Handle force_submit signal from Admin
            if (data.force_submit) {
              submitExam(true); // Call existing submit logic with isAutoSubmit=true
              return;
            }

            // Handle refresh signal from Admin
            if (data.refresh) {
              // If we are currently locked, a refresh might clear it if the teacher unlocked it in DB
              window.location.reload();
              return;
            }

            // Handle real-time violation lock
            if (data.violation_lock) {
              setIsViolationLocked(true);
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
             
             // Unlock Android App if running in Rushless Safer
             if (window.RushlessSafer && typeof window.RushlessSafer.remoteUnlock === 'function') {
               window.RushlessSafer.remoteUnlock();
             }

             // If the student already submitted manually, let the submit function handle navigation.
             // If we get here because of force-submit or other status change, we handle it here.
             if (finishExamHandled.current) return;

             const shouldShowResult = examDetails?.show_result === true || 
                                      examDetails?.show_result === 1 || 
                                      String(examDetails?.show_result) === '1';

             if (shouldShowResult && attemptDetails?.id) {
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
  }, [examId, router, attemptDetails?.id, examDetails?.show_result, submitExam]);

  // 3. Security & Activity Logging
  useEffect(() => {
    if (!attemptDetails?.id) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logAction('SECURITY', 'Siswa meninggalkan halaman ujian (pindah tab atau minimalkan)');
      } else {
        logAction('SECURITY', 'Siswa kembali ke halaman ujian');
        // Show warning if configured
        if (examDetails?.violation_action === 'peringatan' && !isViolationLocked) {
          toast.warning('Peringatan: Anda terdeteksi meninggalkan halaman ujian. Aktivitas ini telah dicatat.', {
            duration: 5000,
            position: 'top-center',
          });
        }
      }
    };

    const handleBlur = () => logAction('SECURITY', 'Jendela kehilangan fokus');
    const handleFocus = () => logAction('SECURITY', 'Jendela mendapatkan fokus kembali');
    const handleCopy = () => logAction('SECURITY', 'Siswa menyalin (copy) teks');
    const handlePaste = () => logAction('SECURITY', 'Siswa menempel (paste) teks');

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
  }, [attemptDetails?.id, logAction, examDetails?.violation_action, isViolationLocked]);

  const debouncedQuestionIndex = useDebounce(currentQuestionIndex, 1000);

  const progressPercentage = useMemo(() => {
    if (questions.length === 0) return 0;
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answers, questions.length]);

  useEffect(() => {
    // Removed redundant /api/user-session fetch. DashboardLayout monitors this via SSE.

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


  // Enforce Browser Checks
  useEffect(() => {
    enforceRushlessSafer();
  }, [enforceRushlessSafer]);

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
  }, [examId, startExamProcess]);


  // Instruction State


  // Keyboard Shortcuts & Offline Detection
  useEffect(() => {
    // 1. Offline Detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof navigator !== 'undefined') setIsOnline(navigator.onLine);

    // 2. Keyboard Shortcuts
    const handleKeyDown = (e) => {
      // Ignore if in input or editor
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      if (!currentQuestion) return;

      // Navigation
      if (e.key === 'ArrowLeft') {
        handlePrevQuestion();
      } else if (e.key === 'ArrowRight') {
        handleNextQuestion();
      }

      // Answering (A, B, C, D, E or 1, 2, 3, 4, 5)
      if (currentQuestion.question_type === 'multiple_choice') {
        const optionKeys = ['a', 'b', 'c', 'd', 'e'];
        const numberKeys = ['1', '2', '3', '4', '5'];
        const key = e.key.toLowerCase();
        
        let index = -1;
        if (optionKeys.includes(key)) index = optionKeys.indexOf(key);
        else if (numberKeys.includes(key)) index = numberKeys.indexOf(key);

        if (index !== -1 && currentQuestion.options && currentQuestion.options[index]) {
            handleAnswerSelect(currentQuestion.id, currentQuestion.options[index].originalKey);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentQuestion, currentQuestionIndex, questions.length, handleAnswerSelect, handleNextQuestion, handlePrevQuestion]);

  useEffect(() => {
    if (debouncedQuestionIndex !== undefined && attemptDetails) {
      updateAttemptState({ lastQuestionIndex: debouncedQuestionIndex });
      logAction('NAVIGATE', `Siswa berpindah ke soal nomor ${debouncedQuestionIndex + 1}`);
    }
  }, [debouncedQuestionIndex, attemptDetails, updateAttemptState, logAction]);



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
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-300">
          <div className="bg-red-600 text-white px-6 py-2 shadow-2xl flex items-center justify-center gap-3">
            <Icons.XCircle />
            <span className="font-bold text-sm tracking-tight animate-pulse">Koneksi Terputus! Cek internet Anda agar jawaban tetap tersinkron.</span>
          </div>
        </div>
      )}

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
            <div className="hidden sm:block">
              <SaveStatusIndicator status={saveStatus} />
            </div>
            
            {/* Font Size Control */}
            <div className="relative">
              <button 
                onClick={() => setShowFontSizeMenu(!showFontSizeMenu)} 
                className={`flex p-2.5 rounded-xl transition-all active:scale-95 ${
                  showFontSizeMenu 
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' 
                    : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
                title="Ukuran Font"
              >
                <Icons.Type />
              </button>
              
              {showFontSizeMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFontSizeMenu(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 py-2 overflow-hidden animate-in zoom-in-95 duration-200 origin-top-right">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ukuran Font</span>
                    </div>
                    {[
                      { id: 'sm', label: 'Kecil', class: 'text-xs' },
                      { id: 'md', label: 'Sedang (Default)', class: 'text-sm' },
                      { id: 'lg', label: 'Besar', class: 'text-base' },
                      { id: 'xl', label: 'Ekstra Besar', class: 'text-lg' }
                    ].map((size) => (
                      <button
                        key={size.id}
                        onClick={() => { setFontSize(size.id); setShowFontSizeMenu(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                          fontSize === size.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className={size.class}>{size.label}</span>
                        {fontSize === size.id && <Icons.CheckCircleSmall />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)} 
              className={`hidden md:flex p-2.5 rounded-xl transition-all active:scale-95 ${
                isDesktopSidebarOpen 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' 
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
              title={isDesktopSidebarOpen ? "Sembunyikan Navigasi" : "Tampilkan Navigasi"}
            >
              <Icons.Sidebar />
            </button>
            <Timer 
              timeLeft={timeLeft} 
              isHidden={isTimerHidden} 
              onToggle={() => setIsTimerHidden(!isTimerHidden)} 
            />
            <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"><Icons.Grid /></button>
          </div>
        </div>
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 md:hidden"><div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div></div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className={`${isDesktopSidebarOpen ? 'md:col-span-8 lg:col-span-9' : 'md:col-span-12'} space-y-6 transition-all duration-500 ease-in-out`}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px] flex flex-col">
              {currentQuestion ? (
                <>
                  <div className="p-6 md:p-8 flex-1">
                    <div className="flex justify-between items-start mb-6">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">Soal No. {currentQuestionIndex + 1}</span>
                      <button 
                        onClick={() => handleToggleDoubtful(currentQuestion.id)} 
                        className={`group flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all duration-300 ${
                          doubtfulAnswers[currentQuestion.id] 
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 dark:shadow-none border-transparent' 
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-amber-400'
                        }`}
                      >
                        <Icons.Flag filled={!!doubtfulAnswers[currentQuestion.id]} />
                        <span className="tracking-tight">
                          {doubtfulAnswers[currentQuestion.id] ? 'Ditandai Ragu' : 'Tandai Ragu'}
                        </span>
                      </button>
                    </div>
                    <div className="prose prose-slate dark:prose-invert max-w-none mb-8">
                      <div 
                        className={`${fsClasses.question} font-medium text-slate-800 dark:text-slate-100 leading-relaxed overflow-x-auto custom-content-wrapper transition-all duration-300`} 
                        dangerouslySetInnerHTML={{ __html: currentQuestion.question_text }} 
                      />
                    </div>
                    <div className="space-y-3">
                      {currentQuestion.question_type === 'essay' ? (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Jawaban Anda:</label>
                          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <JoditEditor
                              ref={editorRef}
                              value={answers[currentQuestion.id] || ''}
                              config={editorConfig}
                              onBlur={(newContent) => {
                                handleEssayChange(currentQuestion.id, newContent);
                                saveEssayAnswer(currentQuestion.id, newContent);
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-400 italic font-medium flex items-center gap-1.5">
                            <Icons.CheckCircleSmall /> Jawaban otomatis tersimpan saat Anda pindah soal atau selesai mengetik.
                          </p>
                        </div>
                      ) : (
                        currentQuestion.options && currentQuestion.options.map((option, idx) => {
                          const optionLabel = String.fromCharCode(65 + idx);
                          const isSelected = currentQuestion.question_type === 'multiple_choice_complex'
                            ? (answers[currentQuestion.id] || '').split(',').includes(option.originalKey)
                            : answers[currentQuestion.id] === option.originalKey;
                          
                          return (
                            <div key={option.originalKey} onClick={() => handleAnswerSelect(currentQuestion.id, option.originalKey)} className={`group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-500 shadow-sm ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                              <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white'}`}>{optionLabel}</div>
                              <div className="overflow-x-auto flex-1 custom-content-wrapper">
                                  <span className={`${fsClasses.options} font-medium transition-all duration-300 ${isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300 group-hover:text-indigo-900 dark:group-hover:text-white'}`} dangerouslySetInnerHTML={{ __html: option.text }} />
                              </div>
                              {currentQuestion.question_type === 'multiple_choice_complex' ? (
                                <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-500'}`}>
                                  {isSelected && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                </div>
                              ) : (
                                isSelected && (<div className="absolute right-4 text-indigo-600 dark:text-indigo-400"><Icons.CheckCircle /></div>)
                              )}
                            </div>
                          );
                        })
                      )}
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
          {isDesktopSidebarOpen && (
            <div className="hidden md:block md:col-span-4 lg:col-span-3 transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-right-4">
              <QuestionNavigation questions={questions} answers={answers} doubtful={doubtfulAnswers} currentIndex={currentQuestionIndex} onSelect={handleSelectQuestion} />
            </div>
          )}
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

      {/* Violation Locked Overlay */}
      {isViolationLocked && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-red-200 dark:border-red-900/30 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-400">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-11a4 4 0 11-8 0 4 4 0 018 0zm-4 7v1a3 3 0 00-3 3v1h10v-1a3 3 0 00-3-3v-1" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tight">Ujian Terkunci!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              Ujian Anda telah dikunci secara otomatis karena terdeteksi meninggalkan halaman pengerjaan. 
              <br /><br />
              Silakan <strong>hubungi pengawas atau admin ujian</strong> untuk membuka kembali akses Anda.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
              >
                Cek Status Kunci (Refresh)
              </button>
              <button 
                onClick={() => router.push('/dashboard/exams')}
                className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
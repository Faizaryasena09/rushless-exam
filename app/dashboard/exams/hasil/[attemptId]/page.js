'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/app/context/LanguageContext';

// Simple Icons
const Icons = {
  ArrowLeft: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  CheckCircle: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  XCircle: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Dash: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
};

export default function AnalysisPage() {
  const { attemptId } = useParams();
  const router = useRouter();
  const { t } = useLanguage();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const res = await fetch(`/api/exams/hasil/${attemptId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Gagal memuat analisis');
        }
        const jsonData = await res.json();
        setData(jsonData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalysis();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-red-200 dark:border-red-900/50 max-w-md w-full text-center space-y-4">
            <Icons.XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('admin_nav_logs_desc').includes('Akses') ? 'Akses Ditolak' : 'Access Denied'}</h2>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
            <button onClick={() => router.push('/dashboard')} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition">
                {t('exams_btn_back_dashboard')}
            </button>
        </div>
      </div>
    );
  }

  const isRaw = data.scoring_mode === 'raw';
  const rawScore = Number(data.score);
  const score = isRaw ? (rawScore % 1 === 0 ? rawScore : rawScore.toFixed(2)) : Math.round(rawScore);
  
  // Use stats from API if available, fallback to 0
  const stats = data.stats || { total: 0, correct: 0, wrong: 0, unanswered: 0 };
  const { total, correct, wrong, unanswered } = stats;

  const handleExit = () => {
    // Notify Safe Browser or Android app if running inside it
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage('submit_success');
    }

    if (window.RushlessSafer && typeof window.RushlessSafer.finishExam === 'function') {
      window.RushlessSafer.finishExam();
    } else if (window.SafeExamBrowser && typeof window.SafeExamBrowser.quit === 'function') {
      window.SafeExamBrowser.quit();
    } else if (navigator.userAgent.toLowerCase().includes('seb')) {
      window.location.href = "/seb-quit-signal";
    } else if (navigator.userAgent.toLowerCase().includes('geschool-secure') || navigator.userAgent.toLowerCase().includes('gsms')) {
      window.location.href = "geschool://close";
    }
    
    router.push('/dashboard/exams');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-lg font-bold text-slate-800 dark:text-white truncate">{t('exams_analysis_title')}</h1>
          </div>
          <button onClick={handleExit} className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all border border-slate-200 dark:border-slate-700">
            <Icons.ArrowLeft />
            <span className="hidden sm:inline">{t('exams_btn_back_dashboard')}</span>
            <span className="sm:hidden">Dashboard</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {/* Professional Score Section */}
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-8 md:p-12">
                <div className="flex flex-col items-center">
                    {/* Header Info */}
                    <div className="text-center mb-10">
                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-2 block">{t('exams_analysis_score_title')}</span>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white leading-tight">{data.exam_name}</h2>
                    </div>

                    {/* Score Centerpiece */}
                    <div className="flex flex-col items-center justify-center mb-12">
                        <div className="relative flex items-end">
                            <span className="text-8xl md:text-9xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{score}</span>
                            <div className="mb-2 ml-1 px-2 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black rounded uppercase tracking-widest hidden sm:block">PTS</div>
                        </div>
                        <div className="mt-4 flex items-center gap-3 w-full max-w-[280px] sm:max-w-none">
                            <div className="flex-1 h-0.5 bg-slate-100 dark:bg-slate-700"></div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Final Examination Result</span>
                            <div className="flex-1 h-0.5 bg-slate-100 dark:bg-slate-700"></div>
                        </div>
                    </div>

                    {/* Stats Divider */}
                    <div className="w-full h-px bg-slate-100 dark:bg-slate-700/50 mb-8"></div>

                    {/* Stats Layout - Clean & Horizontally Aligned */}
                    <div className="w-full grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-700/50">
                        <div className="py-4 md:py-0 md:px-6 flex flex-col items-center text-center">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                                <Icons.CheckCircle />
                                <span className="text-2xl font-bold">{correct}</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('exams_analysis_correct')}</span>
                        </div>
                        
                        <div className="py-4 md:py-0 md:px-6 flex flex-col items-center text-center">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                                <Icons.XCircle />
                                <span className="text-2xl font-bold">{wrong}</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('exams_analysis_wrong')}</span>
                        </div>

                        <div className="py-4 md:py-0 md:px-6 flex flex-col items-center text-center">
                            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                                <Icons.Dash />
                                <span className="text-2xl font-bold">{unanswered}</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('exams_analysis_empty')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Detailed Analysis List - Only if show_analysis is true */}
        {data.show_analysis && data.analysis && data.analysis.length > 0 && (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    {t('exams_analysis_details')}
                    <span className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold">{total} {t('exams_label_questions')}</span>
                </h3>
                
                {data.analysis.map((q, index) => {
                    const isCorrect = q.is_correct;
                    const isUnanswered = !q.student_option;
                    
                    let borderColor = 'border-slate-200 dark:border-slate-700';
                    if (isCorrect) borderColor = 'border-emerald-300 dark:border-emerald-900';
                    else if (!isUnanswered) borderColor = 'border-red-300 dark:border-red-900';

                    return (
                        <div key={q.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm border-2 ${borderColor}`}>
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                                <span className="w-fit inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                                    {t('exams_analysis_question')} {index + 1}
                                </span>
                                <div className="flex items-center sm:items-end gap-2 sm:flex-col">
                                    <span className={`inline-flex items-center gap-1.5 font-bold text-sm px-3 py-1 rounded-lg ${isCorrect ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : isUnanswered ? 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'}`}>
                                        {isCorrect ? <Icons.CheckCircle /> : isUnanswered ? <Icons.Dash /> : <Icons.XCircle />}
                                        {isCorrect ? t('exams_analysis_correct') : isUnanswered ? t('exams_analysis_empty') : t('exams_analysis_wrong')}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-md">
                                        {Number(q.score_earned) % 1 === 0 ? q.score_earned : Number(q.score_earned).toFixed(2)} / {q.points} {t('exams_analysis_points')}
                                    </span>
                                </div>
                            </div>

                            {/* Question Text */}
                            <div className="prose prose-slate dark:prose-invert max-w-none mb-6">
                                <div className="text-base text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: q.question_text }} />
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                {Array.isArray(q.options) && q.options.map((opt, optIdx) => {
                                    const optionLetter = String.fromCharCode(65 + optIdx);
                                    const isSelected = q.student_option === opt.originalKey;
                                    const isActualCorrect = q.correct_option === opt.originalKey;

                                    let optClass = 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400';
                                    
                                    if (isActualCorrect) {
                                        optClass = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 dark:border-emerald-500 ring-1 ring-emerald-500 shadow-sm text-emerald-900 dark:text-emerald-100 font-medium';
                                    } else if (isSelected && !isActualCorrect) {
                                        optClass = 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-500 shadow-sm text-red-900 dark:text-red-100 font-medium';
                                    }

                                    return (
                                        <div key={opt.originalKey} className={`flex items-start gap-4 p-3 rounded-xl border relative ${optClass}`}>
                                            <div className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold mt-0.5 ${
                                                isActualCorrect ? 'bg-emerald-500 text-white' : 
                                                (isSelected && !isActualCorrect) ? 'bg-red-500 text-white' : 
                                                'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                            }`}>
                                                {optionLetter}
                                            </div>
                                            <div className="pt-1 flex-1 pr-12 sm:pr-24" dangerouslySetInnerHTML={{ __html: opt.text }} />
                                            
                                            <div className="absolute right-3 top-3 flex items-center gap-2">
                                                {isActualCorrect && isSelected && (
                                                    <div className="text-emerald-600 dark:text-emerald-400"><Icons.CheckCircle /></div>
                                                )}
                                                {isSelected && !isActualCorrect && (
                                                    <div className="text-red-600 dark:text-red-400"><Icons.XCircle /></div>
                                                )}
                                                {isActualCorrect && !isSelected && (
                                                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded whitespace-nowrap">
                                                        <span className="hidden sm:inline">{t('exams_analysis_key')}</span>
                                                        <span className="sm:hidden"><Icons.CheckCircle /></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </main>
    </div>
  );
}

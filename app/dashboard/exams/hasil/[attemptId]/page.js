'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';

// Simple Icons
const Icons = {
  ArrowLeft: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  CheckCircle: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  XCircle: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Dash: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>,
  Alert: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0l-7 12a2 2 0 001.74 3z" /></svg>
};

export default function AnalysisPage() {
  const { attemptId } = useParams();
  const router = useRouter();
  const { t } = useLanguage();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

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

  const analysisList = useMemo(() => (data?.show_analysis && Array.isArray(data.analysis) ? data.analysis : []), [data]);

  const counts = useMemo(() => {
    let c = 0;
    let w = 0;
    let u = 0;
    analysisList.forEach((q) => {
      if (q.is_correct) c += 1;
      else if (!q.student_option) u += 1;
      else w += 1;
    });
    return { correct: c, wrong: w, unanswered: u, all: analysisList.length };
  }, [analysisList]);

  const filteredList = useMemo(() => {
    if (filter === 'all') return analysisList;
    return analysisList.filter((q) => {
      if (filter === 'correct') return q.is_correct;
      if (filter === 'unanswered') return !q.is_correct && !q.student_option;
      return !q.is_correct && !!q.student_option;
    });
  }, [analysisList, filter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
        <span className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-white animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Memuat hasil ujian...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-900/5 dark:shadow-black/40 p-6 text-center">
          <span className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/60 flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
            <Icons.Alert />
          </span>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Data tidak tersedia</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 break-words">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            <Icons.ArrowLeft />
            {t('exams_btn_back_dashboard')}
          </button>
        </div>
      </div>
    );
  }

  const isRaw = data.scoring_mode === 'raw';
  const rawScore = Number(data.score);
  const score = isRaw ? (rawScore % 1 === 0 ? rawScore : rawScore.toFixed(2)) : Math.round(rawScore);

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

  const filterTabs = [
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'correct', label: t('exams_analysis_correct'), count: counts.correct },
    { id: 'wrong', label: t('exams_analysis_wrong'), count: counts.wrong },
    { id: 'unanswered', label: t('exams_analysis_empty'), count: counts.unanswered }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">{t('exams_analysis_title')}</h1>
          <button
            onClick={handleExit}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.ArrowLeft />
            <span className="hidden sm:inline">{t('exams_btn_back_dashboard')}</span>
            <span className="sm:hidden">Dashboard</span>
          </button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Ringkasan nilai */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-6 sm:px-8 py-7 text-center">
            <p className="text-[11px] uppercase font-semibold tracking-[0.18em] text-slate-400">{t('exams_analysis_score_title')}</p>
            <h2 className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">{data.exam_name}</h2>

            <div className="mt-6 flex items-end justify-center gap-2">
              <span className="text-7xl sm:text-8xl font-bold text-slate-900 dark:text-white leading-none tracking-tight tabular-nums">{score}</span>
              <span className="mb-2 px-2 py-1 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold uppercase tracking-widest">PTS</span>
            </div>

            <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-5">
              <div className="flex flex-col items-center gap-1 px-2">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Icons.CheckCircle />
                  <span className="text-xl font-bold tabular-nums">{correct}</span>
                </span>
                <span className="text-[11px] text-slate-400">{t('exams_analysis_correct')}</span>
              </div>
              <div className="flex flex-col items-center gap-1 px-2">
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <Icons.XCircle />
                  <span className="text-xl font-bold tabular-nums">{wrong}</span>
                </span>
                <span className="text-[11px] text-slate-400">{t('exams_analysis_wrong')}</span>
              </div>
              <div className="flex flex-col items-center gap-1 px-2">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Icons.Dash />
                  <span className="text-xl font-bold tabular-nums">{unanswered}</span>
                </span>
                <span className="text-[11px] text-slate-400">{t('exams_analysis_empty')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Analisis per soal */}
        {analysisList.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {t('exams_analysis_details')}
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold">{total} {t('exams_label_questions')}</span>
              </h3>
            </div>

            {/* Filter status */}
            <div className="flex flex-wrap gap-1.5">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === tab.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {tab.label}
                  <span className={`tabular-nums ${filter === tab.id ? 'text-white/70 dark:text-slate-900/70' : 'text-slate-400'}`}>{tab.count}</span>
                </button>
              ))}
            </div>

            {filteredList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada soal pada filter ini.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredList.map((q) => {
                  const originalIndex = analysisList.indexOf(q);
                  const isCorrect = q.is_correct;
                  const isUnanswered = !q.student_option;

                  return (
                    <article key={q.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                      {/* Header soal */}
                      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                          {t('exams_analysis_question')} {originalIndex + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md ${isCorrect
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                            : isUnanswered
                              ? 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                              : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20'}`}
                          >
                            {isCorrect ? <Icons.CheckCircle /> : isUnanswered ? <Icons.Dash /> : <Icons.XCircle />}
                            {isCorrect ? t('exams_analysis_correct') : isUnanswered ? t('exams_analysis_empty') : t('exams_analysis_wrong')}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                            {Number(q.score_earned) % 1 === 0 ? q.score_earned : Number(q.score_earned).toFixed(2)} / {q.points} {t('exams_analysis_points')}
                          </span>
                        </div>
                      </div>

                      {/* Isi soal */}
                      <div className="px-5 sm:px-6 py-5 space-y-4">
                        <div className="prose prose-slate dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: q.question_text }} />

                        <div className="space-y-2">
                          {q.question_type === 'matching' && q.options?.pairs ? (
                            <div className="grid grid-cols-1 gap-3">
                              {q.options.pairs.map((pair, pIdx) => {
                                let studentChoices = {};
                                try {
                                  studentChoices = typeof q.student_option === 'string' ? JSON.parse(q.student_option) : (q.student_option || {});
                                } catch (e) { studentChoices = {}; }

                                const studentResp = studentChoices[pair.id];
                                const isPairCorrect = studentResp === pair.r;
                                const isUnansweredPair = !studentResp;

                                return (
                                  <div key={pair.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                                      <div className="flex-1 flex gap-3 items-center">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">{pIdx + 1}</span>
                                        <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: pair.p }} />
                                      </div>
                                      <div className="w-full md:w-64">
                                        <div className={`p-2.5 rounded-lg border text-sm font-medium flex items-center justify-between gap-2 ${isPairCorrect
                                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                                          : isUnansweredPair
                                            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'}`}
                                        >
                                          <span className="truncate">{studentResp ? studentResp.replace(/<[^>]*>?/gm, '').trim() : '(Kosong)'}</span>
                                          {isPairCorrect ? <Icons.CheckCircle /> : !isUnansweredPair ? <Icons.XCircle /> : <Icons.Dash />}
                                        </div>
                                        {!isPairCorrect && (
                                          <div className="mt-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/60 rounded-lg px-2.5 py-1.5 flex items-start gap-2">
                                            <span className="uppercase tracking-wider shrink-0">Kunci:</span>
                                            <span>{pair.r.replace(/<[^>]*>?/gm, '').trim()}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            Array.isArray(q.options) && q.options.map((opt, optIdx) => {
                              const optionLetter = String.fromCharCode(65 + optIdx);
                              const isSelected = q.student_option
                                ? String(q.student_option).split(',').includes(opt.originalKey)
                                : false;
                              const isActualCorrect = q.correct_option
                                ? String(q.correct_option).split(',').includes(opt.originalKey)
                                : false;

                              return (
                                <div
                                  key={opt.originalKey}
                                  className={`flex items-start gap-3 p-3 rounded-xl border ${isActualCorrect
                                    ? 'bg-emerald-50/70 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-900/70'
                                    : isSelected
                                      ? 'bg-red-50/70 dark:bg-red-900/15 border-red-200 dark:border-red-900/70'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                                >
                                  <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold ${isActualCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : isSelected
                                      ? 'bg-red-600 text-white'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                                  >
                                    {optionLetter}
                                  </span>
                                  <div className="pt-1 flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: opt.text }} />

                                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                    {isSelected && (
                                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md ${isActualCorrect
                                        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40'
                                        : 'text-red-700 dark:text-red-300 bg-red-100/70 dark:bg-red-900/40'}`}
                                      >
                                        {isActualCorrect ? <Icons.CheckCircle /> : <Icons.XCircle />}
                                        Jawabanmu
                                      </span>
                                    )}
                                    {!isSelected && isActualCorrect && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40">
                                        <Icons.CheckCircle />
                                        {t('exams_analysis_key')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
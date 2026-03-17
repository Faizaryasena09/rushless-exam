'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Akses Ditolak</h2>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
            <button onClick={() => router.push('/dashboard/exams')} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition">
                Kembali ke Dashboard
            </button>
        </div>
      </div>
    );
  }

  const isRaw = data.scoring_mode === 'raw';
  const score = isRaw ? data.score : Math.round(Number(data.score));
  
  // Use stats from API if available, fallback to 0
  const stats = data.stats || { total: 0, correct: 0, wrong: 0, unanswered: 0 };
  const { total, correct, wrong, unanswered } = stats;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-16 flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/exams')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
            <Icons.ArrowLeft />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1">Pembahasan Ujian</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {/* Score Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{data.exam_name}</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Hasil Akhir Pengerjaan</p>
            
            <div className="flex flex-col items-center justify-center">
                <div className="w-32 h-32 md:w-40 md:h-40 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center border-4 border-indigo-100 dark:border-indigo-800/50 mb-6">
                    <span className="text-5xl md:text-6xl font-black text-indigo-600 dark:text-indigo-400">{score}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 md:gap-8 w-full max-w-sm">
                    <div className="text-center">
                        <div className="text-emerald-500 mb-1 flex justify-center"><Icons.CheckCircle /></div>
                        <div className="text-xl font-bold text-slate-800 dark:text-white">{correct}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Benar</div>
                    </div>
                    <div className="text-center">
                        <div className="text-red-500 mb-1 flex justify-center"><Icons.XCircle /></div>
                        <div className="text-xl font-bold text-slate-800 dark:text-white">{wrong}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Salah</div>
                    </div>
                    <div className="text-center">
                        <div className="text-slate-400 mb-1 flex justify-center"><Icons.Dash /></div>
                        <div className="text-xl font-bold text-slate-800 dark:text-white">{unanswered}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Kosong</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Detailed Analysis List - Only if show_analysis is true */}
        {data.show_analysis && data.analysis && data.analysis.length > 0 && (
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    Rincian Jawaban
                    <span className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold">{total} Soal</span>
                </h3>
                
                {data.analysis.map((q, index) => {
                    const isCorrect = q.is_correct;
                    const isUnanswered = !q.student_option;
                    
                    let borderColor = 'border-slate-200 dark:border-slate-700';
                    if (isCorrect) borderColor = 'border-emerald-300 dark:border-emerald-900';
                    else if (!isUnanswered) borderColor = 'border-red-300 dark:border-red-900';

                    return (
                        <div key={q.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-2 ${borderColor}`}>
                            <div className="flex justify-between items-start mb-4">
                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                                    Soal No. {index + 1}
                                </span>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`inline-flex items-center gap-1.5 font-bold text-sm px-3 py-1 rounded-lg ${isCorrect ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : isUnanswered ? 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'}`}>
                                            {isCorrect ? <Icons.CheckCircle /> : isUnanswered ? <Icons.Dash /> : <Icons.XCircle />}
                                            {isCorrect ? 'Benar' : isUnanswered ? 'Kosong' : 'Salah'}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-2 py-0.5 rounded-md">
                                            {q.score_earned} / {q.points} Poin
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
                                            <div className="pt-1 w-full" dangerouslySetInnerHTML={{ __html: opt.text }} />
                                            
                                            {isActualCorrect && isSelected && (
                                                <div className="absolute right-3 top-3 text-emerald-600 dark:text-emerald-400"><Icons.CheckCircle /></div>
                                            )}
                                            {isSelected && !isActualCorrect && (
                                                <div className="absolute right-3 top-3 text-red-600 dark:text-red-400"><Icons.XCircle /></div>
                                            )}
                                            {isActualCorrect && !isSelected && (
                                                <div className="absolute right-3 top-3 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded">Kunci Jawaban</div>
                                            )}
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// --- Icons ---
const Icons = {
  Plus: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  ChevronRight: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>,
  Calendar: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  FileText: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
};

export default function ExamsPage() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [errorExams, setErrorExams] = useState(null);

  // Session check logic
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/user-session');
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        if (!data.user) throw new Error('User data not found in session');
      } catch (error) {
        router.push('/');
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
  }, [router]);

  // Fetch exams logic
  useEffect(() => {
    if (!loadingSession) {
      async function fetchExams() {
        try {
          const res = await fetch('/api/exams');
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to fetch exams');
          }
          const data = await res.json();
          setExams(data.exams);
        } catch (err) {
          setErrorExams(err.message);
        } finally {
          setLoadingExams(false);
        }
      }
      fetchExams();
    }
  }, [loadingSession]);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (loadingSession || loadingExams) {
    return (
        <div className="text-center py-20">
            <p className="text-lg font-semibold text-slate-600 animate-pulse">Loading Exams...</p>
        </div>
    );
  }

  if (errorExams) {
    return <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-medium text-center">Error: {errorExams}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manage Exams</h1>
          <p className="text-sm text-slate-500 mt-1">
            You have {exams.length} exams.
          </p>
        </div>
        <Link
          href="/dashboard/exams/baru"
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200"
        >
          <Icons.Plus />
          <span>Create New Exam</span>
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <Icons.FileText className="mx-auto w-12 h-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-800">No Exams Found</h3>
            <p className="mt-1 text-sm text-slate-500">Click "Create New Exam" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <div key={exam.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-indigo-300 transition-all duration-300 flex flex-col">
              <div className="p-6">
                <h2 className="text-xl font-bold text-slate-800 truncate" title={exam.exam_name}>{exam.exam_name}</h2>
                <p className="text-sm text-slate-500 mt-2 h-10 overflow-hidden">{exam.description || 'No description provided.'}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Icons.Calendar />
                  <span>Created on {formatDate(exam.created_at)}</span>
                </div>
              </div>
              <div className="mt-auto border-t border-slate-200 p-4 bg-slate-50/50 rounded-b-2xl">
                 <Link href={`/dashboard/exams/manage/${exam.id}`} className="group w-full flex items-center justify-between text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                    <span>Manage Settings</span>
                    <Icons.ChevronRight className="transition-transform group-hover:translate-x-1" />
                 </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

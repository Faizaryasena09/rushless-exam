'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// --- Icons ---
const Icons = {
  Plus: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  ChevronRight: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>,
  Calendar: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  FileText: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Play: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ChartBar: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Cog: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
};

// --- Student Action Button Component ---
const StudentExamActions = ({ exam }) => {
    const now = new Date();
    const startTime = exam.start_time ? new Date(exam.start_time) : null;
    const endTime = exam.end_time ? new Date(exam.end_time) : null;

    // 1. Check for an in-progress exam first
    if (exam.has_in_progress) {
        return (
            <Link href={`/dashboard/exams/kerjakan/${exam.id}`} className="group w-full flex items-center justify-between text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                <div className="flex items-center gap-2">
                    <Icons.Play />
                    <span>Lanjutkan Ujian</span>
                </div>
                <Icons.ChevronRight className="transition-transform group-hover:translate-x-1" />
            </Link>
        );
    }

    // 2. Check if max attempts have been reached
    if (exam.max_attempts > 0 && exam.user_attempts >= exam.max_attempts) {
        return (
            <div className="w-full text-center py-2 text-sm font-semibold text-slate-500 bg-slate-100 rounded-lg">
                Max attempts reached
            </div>
        );
    }

    // 3. Check against schedule
    if (startTime && endTime) {
        if (now < startTime) {
            return (
                <div className="w-full text-center py-2 text-sm font-semibold text-amber-600 bg-amber-100 rounded-lg">
                    Ujian belum bisa dimulai
                </div>
            );
        }
    
        if (now > endTime) {
            return (
                <div className="w-full text-center py-2 text-sm font-semibold text-red-600 bg-red-100 rounded-lg">
                    Ujian selesai
                </div>
            );
        }
    }

    // 4. If all checks pass, it's available to start
    return (
        <Link href={`/dashboard/exams/kerjakan/${exam.id}`} className="group w-full flex items-center justify-between text-sm font-semibold text-green-600 hover:text-green-800 transition-colors">
            <div className="flex items-center gap-2">
                <Icons.Play />
                <span>Mulai Kerjakan</span>
            </div>
            <Icons.ChevronRight className="transition-transform group-hover:translate-x-1" />
        </Link>
    );
};

export default function ExamsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [errorExams, setErrorExams] = useState(null);

  // Session check and role fetching logic
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/user-session');
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        if (!data.user) throw new Error('User data not found in session');
        console.log('Session data:', data);
        setUserRole(data.user.roleName); // Store user role
      } catch (error) {
        router.push('/');
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
  }, [router]);

  // Fetch exams logic with polling
  useEffect(() => {
    if (loadingSession) return;

    let isMounted = true;

    async function fetchExams() {
      try {
        const res = await fetch('/api/exams');
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to fetch exams');
        }
        const data = await res.json();
        if (isMounted) {
            setExams(data.exams);
            setLoadingExams(false);
        }
      } catch (err) {
        if (isMounted) {
            console.error("Failed to fetch exams:", err);
            // Only show error on full page load if we have no exams yet
            if (loadingExams) {
                setErrorExams(err.message);
                setLoadingExams(false);
            }
        }
      }
    }

    fetchExams(); // Initial fetch
    const intervalId = setInterval(fetchExams, 5000); // Poll every 5 seconds

    return () => {
        isMounted = false;
        clearInterval(intervalId);
    };
  }, [loadingSession, loadingExams]);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const isStudent = userRole === 'student';

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
          <h1 className="text-3xl font-bold text-slate-900">{isStudent ? 'Available Exams' : 'Manage Exams'}</h1>
          <p className="text-sm text-slate-500 mt-1">
            You have {exams.length} exams available.
          </p>
        </div>
        {!isStudent && (
          <Link
            href="/dashboard/exams/baru"
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200"
          >
            <Icons.Plus />
            <span>Create New Exam</span>
          </Link>
        )}
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <Icons.FileText className="mx-auto w-12 h-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-800">No Exams Found</h3>
            <p className="mt-1 text-sm text-slate-500">{isStudent ? 'There are no exams available for you at the moment.' : 'Click "Create New Exam" to get started.'}</p>
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
                 {isStudent ? (
                   <StudentExamActions exam={exam} />
                 ) : (
                   <div className="flex items-center justify-between gap-2">
                     <Link href={`/dashboard/exams/manage/${exam.id}`} className="group flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 py-2 px-3 rounded-lg transition-colors">
                        <Icons.Cog />
                        <span>Manage</span>
                     </Link>
                     <Link href={`/dashboard/exams/results/${exam.id}`} className="group flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 py-2 px-3 rounded-lg transition-colors">
                        <Icons.ChartBar />
                        <span>Results</span>
                     </Link>
                   </div>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

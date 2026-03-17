'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

// --- Icons ---
const Icons = {
    ArrowLeft: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    UserGroup: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.224-1.27-.63-1.742M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-4 7a4 4 0 018 0v-1c0-1.105-1.19-2-2.673-2H8.673C7.19 16 6 17.105 6 18v1z" /></svg>,
    ClipboardList: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    CheckCircle: () => <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    XCircle: () => <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    MinusCircle: () => <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    AlertCircle: () => <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Refresh: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

export default function ExamResultsPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.id;

    const [resultsData, setResultsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [nameFilter, setNameFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [showExportModal, setShowExportModal] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [recalculating, setRecalculating] = useState(false);

    const fetchResults = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/exams/results?exam_id=${examId}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to fetch results');
            }
            const data = await res.json();
            setResultsData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Export Handler
    const handleExport = (attemptMode) => {
        // Construct detailed filename date part
        const dateStr = new Date().toISOString().split('T')[0];

        // Build URL
        const url = `/api/exams/export?exam_id=${examId}&class_id=${classFilter}&attempt_mode=${attemptMode}`;

        // Trigger download
        window.location.href = url;
        setShowExportModal(false);
    };

    useEffect(() => {
        if (!examId) return;
        fetchResults();
    }, [examId]);

    const handleRecalculate = async () => {
        if (!confirm('Recalculate all student scores for this exam? This will update all existing attempt scores based on current questions and points.')) return;
        
        try {
            setRecalculating(true);
            const res = await fetch('/api/exams/recalculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId })
            });
            
            if (!res.ok) throw new Error('Failed to recalculate');
            
            // Refetch results to show updated scores
            await fetchResults();
            alert('Recalculation complete!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setRecalculating(false);
        }
    };

    const classOptions = useMemo(() => {
        if (!resultsData) return [];
        const classes = new Set(resultsData.results.map(r => r.className));
        return ['all', ...Array.from(classes)];
    }, [resultsData]);

    const filteredResults = useMemo(() => {
        if (!resultsData) return [];
        return resultsData.results.filter(student => {
            const nameMatch = student.studentName.toLowerCase().includes(nameFilter.toLowerCase()) ||
                (student.username && student.username.toLowerCase().includes(nameFilter.toLowerCase()));
            const classMatch = classFilter === 'all' || student.className === classFilter;
            return nameMatch && classMatch;
        });
    }, [resultsData, nameFilter, classFilter]);

    const toggleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />;
        
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 animate-in zoom-in-95 duration-200">
                {sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span className="text-[10px] font-black tracking-tighter uppercase whitespace-nowrap">
                    {sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A'}
                </span>
            </div>
        );
    };

    const sortedResults = useMemo(() => {
        const data = [...filteredResults];
        const { direction } = sortConfig;
        
        data.sort((a, b) => {
            const valA = a.studentName.toLowerCase();
            const valB = b.studentName.toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        return data;
    }, [filteredResults, sortConfig]);

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-600 bg-emerald-50';
        if (score >= 60) return 'text-amber-600 bg-amber-50';
        return 'text-red-600 bg-red-50';
    };

    const handleRowClick = (student) => {
        if (student.status !== 'Completed') return;

        if (selectedStudent?.studentId === student.studentId) {
            setSelectedStudent(null);
        } else {
            setSelectedStudent(student);
        }
    };

    if (loading) {
        return <div className="text-center py-20"><p className="text-lg font-semibold text-slate-600 dark:text-slate-400 animate-pulse">Loading Results...</p></div>;
    }

    if (error) {
        return <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium text-center">Error: {error}</div>;
    }

    return (
        <div className="space-y-8">
            {/* Header section with Premium feel */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1">
                    <Link href="/dashboard/exams" className="group inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all">
                        <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/40 group-hover:text-indigo-600 transition-colors">
                            <Icons.ArrowLeft />
                        </span>
                        Back to Exams
                    </Link>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none pt-2">
                        {resultsData.examName}
                    </h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-2xl">
                        Comprehensive result analysis and student performance breakdown.
                    </p>
                </div>
                
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                    <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-2xl shadow-xl shadow-amber-200 dark:shadow-none font-black text-xs uppercase tracking-widest transition-all active:scale-95 group"
                    >
                        <Icons.Refresh />
                        {recalculating ? 'Processing...' : 'Recalculate'}
                    </button>

                    <button
                        onClick={() => setShowExportModal(true)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none font-black text-xs uppercase tracking-widest transition-all active:scale-95 group"
                    >
                        <svg className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export Data
                    </button>

                    <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
                        <div className="flex-1 sm:flex-none p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                <Icons.UserGroup />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Students</div>
                                <div className="text-xl font-black text-slate-900 dark:text-white leading-none mt-1">{resultsData.results.length}</div>
                            </div>
                        </div>
                        <div className="flex-1 sm:flex-none p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Icons.ClipboardList />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Questions</div>
                                <div className="text-xl font-black text-slate-900 dark:text-white leading-none mt-1">{resultsData.totalQuestions}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2 lg:col-span-3 relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search student name or username..."
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 text-sm font-medium text-slate-900 dark:text-white transition-all outline-none"
                    />
                </div>
                <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 text-sm font-bold text-slate-700 dark:text-slate-200 transition-all outline-none appearance-none cursor-pointer"
                >
                    {classOptions.map(c => (
                        <option key={c} value={c}>{c === 'all' ? '🏷️ All Classes' : `🏛️ ${c}`}</option>
                    ))}
                </select>
            </div>

            {/* Results Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="w-2 h-6 bg-indigo-500 rounded-full" />
                        Student Results
                    </h2>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                        {sortedResults.length} Showing
                    </span>
                </div>

                {sortedResults.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-600 mx-auto mb-4">
                            <Icons.UserGroup />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white">No Matching Students</h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop View Table */}
                        <div className="hidden lg:block bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                                        <th 
                                            className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group select-none hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                                            onClick={() => toggleSort('name')}
                                        >
                                            <div className="flex items-center gap-3">
                                                Student
                                                <SortIcon columnKey="name" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Attempts</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Performance</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Best Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                    {sortedResults.map((student) => {
                                        const isCompleted = student.status === 'Completed';
                                        const isSelected = selectedStudent?.studentId === student.studentId;
                                        return (
                                            <tr
                                                key={student.studentId}
                                                className={`group transition-all ${isCompleted ? 'cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10' : 'opacity-60'} ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                                                onClick={() => handleRowClick(student)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-transform group-hover:scale-110 ${isCompleted ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 text-slate-400'}`}>
                                                            {student.studentName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black text-slate-800 dark:text-white">{student.studentName}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{student.className} • @{student.username || 'user'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                        {student.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="text-sm font-black text-slate-700 dark:text-slate-300">{isCompleted ? student.attempts.length : '-'}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">Attempts</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isCompleted ? (
                                                        <div className="flex items-center justify-center gap-4">
                                                            <div className="text-center">
                                                                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">{student.correctCount}</div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase">Correct</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-sm font-black text-red-600 dark:text-red-400">{student.incorrectCount}</div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase">Wrong</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-sm font-black text-slate-500">{student.notAnsweredCount}</div>
                                                                <div className="text-[9px] font-bold text-slate-400 uppercase">Skipped</div>
                                                            </div>
                                                        </div>
                                                    ) : <div className="text-center text-slate-300 dark:text-slate-600">—</div>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {isCompleted ? (
                                                        <span className={`inline-block px-4 py-2 rounded-2xl font-black text-lg ${student.bestScore >= 80 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : student.bestScore >= 60 ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'}`}>
                                                            {student.bestScore}
                                                        </span>
                                                    ) : <span className="text-slate-300 dark:text-slate-600 font-black">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Grid/Card View */}
                        <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {sortedResults.map((student) => {
                                const isCompleted = student.status === 'Completed';
                                const isSelected = selectedStudent?.studentId === student.studentId;
                                return (
                                    <div
                                        key={student.studentId}
                                        onClick={() => handleRowClick(student)}
                                        className={`p-5 rounded-3xl border-2 transition-all active:scale-[0.98] ${isCompleted ? 'bg-white dark:bg-slate-800 border-transparent shadow-sm' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-70'} ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-white dark:border-slate-800'}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${isCompleted ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                                    {student.studentName.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="text-base font-black text-slate-800 dark:text-white leading-tight">{student.studentName}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.className}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-tighter rounded-full ${isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                {student.status}
                                            </span>
                                        </div>

                                        {isCompleted && (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                                                    <div className="text-center">
                                                        <div className="text-xs font-black text-indigo-600 dark:text-indigo-400">{student.attempts.length}</div>
                                                        <div className="text-[8px] font-bold text-slate-400 uppercase">Attempts</div>
                                                    </div>
                                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                                                    <div className="text-center">
                                                        <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{student.correctCount}</div>
                                                        <div className="text-[8px] font-bold text-slate-400 uppercase">Correct</div>
                                                    </div>
                                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                                                    <div className="text-center">
                                                        <div className="text-xs font-black text-red-600 dark:text-red-400">{student.incorrectCount}</div>
                                                        <div className="text-[8px] font-bold text-slate-400 uppercase">Wrong</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance Score</span>
                                                        {student.bestScore}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Detail View */}
            {selectedStudent && (
                <StudentAnalysisDetail
                    student={selectedStudent}
                    scoringMode={resultsData?.scoringMode}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
            {/* Export Modal */}
            {showExportModal && (
                <ExportOptionsModal
                    onClose={() => setShowExportModal(false)}
                    onExport={handleExport}
                />
            )}
        </div>
    );
}

function StudentAnalysisDetail({ student, scoringMode, onClose }) {
    const [selectedAttemptId, setSelectedAttemptId] = useState(null);
    const [attemptIdForLog, setAttemptIdForLog] = useState(null);

    // Helper to format date
    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return 'N/A';
        return new Date(dateTimeString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (selectedAttemptId) {
        return <AttemptAnalysisDetail attemptId={selectedAttemptId} onClose={() => setSelectedAttemptId(null)} studentName={student.studentName} />
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-md transition-all duration-300" onClick={onClose}>
            <div className="relative w-full max-w-6xl max-h-[95vh] sm:max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <span className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl"><Icons.ClipboardList /></span>
                            History: {student.studentName}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Reviewing all exam submissions</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-100 dark:border-slate-800">
                        <Icons.XCircle />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {/* Desktop View Table */}
                    <div className="hidden md:block bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 dark:bg-slate-800/50">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">No</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Performance</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Score</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Period</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {student.attempts.map((attempt, index) => (
                                    <tr key={attempt.attemptId} className="group hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer" onClick={() => setSelectedAttemptId(attempt.attemptId)}>
                                        <td className="px-6 py-4 text-center font-black text-slate-700 dark:text-slate-300">{index + 1}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-3">
                                                <div className="text-center">
                                                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">{attempt.correctCount}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">Correct</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-sm font-black text-red-600 dark:text-red-400">{attempt.incorrectCount}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase">Wrong</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-block px-3 py-1.5 rounded-xl font-black text-base ${attempt.score >= 80 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : attempt.score >= 60 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20'}`}>
                                                {scoringMode === 'raw' ? attempt.score : Math.round(attempt.score)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{formatDateTime(attempt.startTime)}</div>
                                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">to {formatDateTime(attempt.endTime)}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setAttemptIdForLog(attempt.attemptId); }}
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95"
                                            >
                                                Logs
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="md:hidden space-y-4">
                        {student.attempts.map((attempt, index) => (
                            <div key={attempt.attemptId} onClick={() => setSelectedAttemptId(attempt.attemptId)} className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-700 relative active:scale-[0.98] transition-all">
                                <div className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-200 dark:border-slate-700">
                                    #{index + 1}
                                </div>
                                
                                <div className="mb-4">
                                    <span className={`inline-block px-4 py-1.5 rounded-2xl font-black text-xl mb-1 ${attempt.score >= 80 ? 'text-emerald-600' : attempt.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {scoringMode === 'raw' ? attempt.score : Math.round(attempt.score)}
                                    </span>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Overall Score</div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-5">
                                    <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <div className="text-lg font-black text-emerald-600">{attempt.correctCount}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Correct Answers</div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <div className="text-lg font-black text-red-600">{attempt.incorrectCount}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Wrong Answers</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{formatDateTime(attempt.startTime)}</div>
                                        <div className="text-[9px] font-medium text-slate-400">Submission Date</div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setAttemptIdForLog(attempt.attemptId); }}
                                        className="px-5 py-2.5 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-90"
                                    >
                                        View Logs
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {attemptIdForLog && (
                <LogViewerModal
                    attemptId={attemptIdForLog}
                    studentName={student.studentName}
                    onClose={() => setAttemptIdForLog(null)}
                />
            )}
        </div>
    );
}

function LogViewerModal({ attemptId, studentName, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLogs() {
            try {
                const res = await fetch(`/api/exams/logs?attempt_id=${attemptId}`);
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data.logs || []);
                }
            } catch (e) {
                console.error("Failed to fetch logs", e);
            } finally {
                setLoading(false);
            }
        }
        fetchLogs();
    }, [attemptId]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">Activity Logs</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Student: {studentName}</p>
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all active:scale-90 border border-slate-100 dark:border-slate-800">
                        <Icons.XCircle />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900 shadow-inner scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compiling Logs...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-slate-200 dark:text-slate-800 mb-4 flex justify-center"><Icons.ClipboardList /></div>
                            <p className="text-sm font-bold text-slate-400 italic">No activity logs recorded for this session.</p>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className={`flex gap-4 p-4 rounded-2xl border transition-all ${log.action_type === 'SECURITY' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 hover:shadow-md hover:shadow-red-100/50' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:shadow-md'}`}>
                                <div className="flex-shrink-0 pt-1">
                                    {log.action_type === 'SECURITY' ? (
                                        <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 shadow-sm shadow-red-100">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-tighter">
                                            {log.action_type.substring(0, 3)}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <p className={`text-sm font-bold leading-tight ${log.action_type === 'SECURITY' ? 'text-red-900 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{log.description}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                        <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                                        <span className="text-[9px] font-bold text-slate-400">{new Date(log.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function AttemptAnalysisDetail({ attemptId, onClose, studentName }) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!attemptId) return;
        async function fetchAnalysis() {
            try {
                setLoading(true);
                const res = await fetch(`/api/exams/analysis?attempt_id=${attemptId}`);
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Failed to fetch attempt details');
                }
                const data = await res.json();
                setAnalysis(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchAnalysis();
    }, [attemptId]);

    return (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-md transition-all duration-300" onClick={onClose}>
            <div className="relative w-full max-w-5xl max-h-[95vh] sm:max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <span className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl"><Icons.CheckCircle /></span>
                            Analysis: {studentName}
                            {analysis?.score !== undefined && (
                                <span className={`ml-3 px-3 py-1 rounded-xl text-sm font-black ${analysis.score >= 80 ? 'bg-emerald-100 text-emerald-600' : analysis.score >= 60 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                                    Score: {analysis.scoringMode === 'raw' ? analysis.score : Math.round(analysis.score)}
                                </span>
                            )}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Detailed Question-by-Question breakdown</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all active:scale-90 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <Icons.XCircle />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Analyzing Answers...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-12 text-center">
                        <div className="max-w-xs">
                            <div className="text-red-500 mb-4 flex justify-center scale-150"><Icons.XCircle /></div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">Analysis Failed</h3>
                            <p className="text-sm font-medium text-slate-500">{error}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/30 dark:bg-slate-900/30 space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                        {analysis?.analysis?.map((ans, index) => (
                            <div key={ans.questionId} className="group p-5 sm:p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                                <div className="flex items-start justify-between gap-6 mb-8">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                                    {ans.questionType?.replace(/_/g, ' ') || 'MULTIPLE CHOICE'}
                                                </span>
                                            </div>
                                            <div className="prose dark:prose-invert max-w-none text-base font-bold text-slate-800 dark:text-slate-200 leading-relaxed custom-content-wrapper" dangerouslySetInnerHTML={{ __html: ans.questionText }} />
                                        </div>
                                    <div className="shrink-0 flex flex-col items-center gap-2">
                                        <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl transition-transform group-hover:rotate-12 border bg-white dark:bg-slate-900 shadow-sm border-slate-100 dark:border-slate-800">
                                            {ans.scoreEarned >= ans.points ? <Icons.CheckCircle /> : (ans.scoreEarned > 0 ? <Icons.AlertCircle /> : ((ans.studentAnswer && ans.scoringStrategy !== 'essay_manual') ? <Icons.XCircle /> : <Icons.MinusCircle />))}
                                        </div>
                                        <div className={`text-[10px] font-black px-2 py-1 rounded-lg border ${ans.scoreEarned >= ans.points ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : (ans.scoreEarned > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : (ans.scoringStrategy === 'essay_manual' ? 'bg-slate-50 text-slate-500 border-slate-100' : 'bg-red-50 text-red-600 border-red-100'))}`}>
                                            {ans.scoreEarned} / {ans.points} Poin
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className={`p-5 rounded-2xl border transition-colors ${ans.isCorrect ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50' : (ans.studentAnswer ? (ans.scoringStrategy === 'essay_manual' ? 'bg-slate-50 border-slate-200' : 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-800/50') : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700')}`}>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Student Answer</div>
                                            <div className={`text-sm font-black ${ans.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : (ans.studentAnswer ? (ans.scoringStrategy === 'essay_manual' ? 'text-slate-700' : 'text-red-700 dark:text-red-400') : 'text-slate-500 italic')}`}>
                                                {ans.questionType === 'essay' ? (
                                                    <div className="prose dark:prose-invert prose-sm max-w-none custom-content-wrapper" dangerouslySetInnerHTML={{ __html: ans.studentAnswer || 'Skipped / Not Answered' }} />
                                                ) : (
                                                    ans.studentAnswer || 'Skipped / Not Answered'
                                                )}
                                            </div>
                                        </div>
                                        {ans.questionType !== 'essay' && !ans.isCorrect && (
                                            <div className="p-5 rounded-2xl border bg-emerald-50/30 dark:bg-emerald-900/5 border-emerald-100/50 dark:border-emerald-800/30">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Correct Answer</div>
                                                <div className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                                                    {ans.correctAnswer}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {ans.questionType !== 'essay' && ans.options && Object.keys(ans.options).length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Options Detail</div>
                                            <div className="space-y-2">
                                                {Object.entries(ans.options).map(([key, value]) => {
                                                    const studentChoices = ans.studentAnswer ? String(ans.studentAnswer).split(',') : [];
                                                    const correctChoices = ans.correctAnswer ? String(ans.correctAnswer).split(',') : [];
                                                    const isSelected = studentChoices.includes(key);
                                                    const isCorrect = correctChoices.includes(key);
                                                    
                                                    let statusClass = "border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400";
                                                    if (isCorrect) statusClass = "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold";
                                                    else if (isSelected && !isCorrect) statusClass = "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-bold";

                                                    return (
                                                        <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${statusClass}`}>
                                                            <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black shrink-0 ${isCorrect ? 'bg-emerald-500 text-white' : (isSelected ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-600')}`}>
                                                                {key}
                                                            </div>
                                                            <div className="prose dark:prose-invert prose-sm max-w-none flex-1 custom-content-wrapper" dangerouslySetInnerHTML={{ __html: value }} />
                                                            {isCorrect && <Icons.CheckCircle />}
                                                            {isSelected && !isCorrect && <Icons.XCircle />}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
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
                                min-width: 200px;
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
                        `}</style>
                    </div>
                )}
            </div>
        </div>
    );
}


function ExportOptionsModal({ onClose, onExport }) {
    const [mode, setMode] = useState('all');

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Export Results</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Select how you want to export the exam data to Excel.</p>

                <div className="space-y-3 mb-8">
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${mode === 'all' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'}`}>
                        <input type="radio" name="exportMode" value="all" checked={mode === 'all'} onChange={() => setMode('all')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <div className="ml-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">All Attempts</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Export every single attempt made by users</div>
                        </div>
                    </label>
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${mode === 'best' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'}`}>
                        <input type="radio" name="exportMode" value="best" checked={mode === 'best'} onChange={() => setMode('best')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <div className="ml-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">Best Attempt Only</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Export only the highest score per user</div>
                        </div>
                    </label>
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${mode === 'latest' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'}`}>
                        <input type="radio" name="exportMode" value="latest" checked={mode === 'latest'} onChange={() => setMode('latest')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <div className="ml-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">Latest Attempt Only</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Export only the most recent submission</div>
                        </div>
                    </label>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                    <button onClick={() => onExport(mode)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-medium rounded-lg shadow-sm transition-colors">
                        Download Excel
                    </button>
                </div>
            </div>
        </div>
    );
}

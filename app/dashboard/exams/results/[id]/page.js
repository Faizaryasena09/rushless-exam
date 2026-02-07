'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// --- Icons ---
const Icons = {
    ArrowLeft: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    UserGroup: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.224-1.27-.63-1.742M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-4 7a4 4 0 018 0v-1c0-1.105-1.19-2-2.673-2H8.673C7.19 16 6 17.105 6 18v1z" /></svg>,
    ClipboardList: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    CheckCircle: () => <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    XCircle: () => <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    MinusCircle: () => <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
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

    useEffect(() => {
        if (!examId) return;

        async function fetchResults() {
            try {
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
        }

        fetchResults();
    }, [examId]);

    const classOptions = useMemo(() => {
        if (!resultsData) return [];
        const classes = new Set(resultsData.results.map(r => r.className));
        return ['all', ...Array.from(classes)];
    }, [resultsData]);

    const filteredResults = useMemo(() => {
        if (!resultsData) return [];
        return resultsData.results.filter(student => {
            const nameMatch = student.studentName.toLowerCase().includes(nameFilter.toLowerCase());
            const classMatch = classFilter === 'all' || student.className === classFilter;
            return nameMatch && classMatch;
        });
    }, [resultsData, nameFilter, classFilter]);

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
        return <div className="text-center py-20"><p className="text-lg font-semibold text-slate-600 animate-pulse">Loading Results...</p></div>;
    }

    if (error) {
        return <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-medium text-center">Error: {error}</div>;
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <Link href="/dashboard/exams" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-2 transition-colors">
                        <Icons.ArrowLeft />
                        Back to Exams
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">{resultsData.examName}</h1>
                    <p className="text-sm text-slate-500 mt-1">Select a student who completed the exam to view their analysis.</p>
                </div>
                <div className="flex gap-4">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                        <Icons.UserGroup className="text-slate-400" />
                        <div>
                            <div className="text-xs text-slate-500">Total Students</div>
                            <div className="text-base font-bold text-slate-800">{resultsData.results.length}</div>
                        </div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                        <Icons.ClipboardList className="text-slate-400" />
                        <div>
                            <div className="text-xs text-slate-500">Total Questions</div>
                            <div className="text-base font-bold text-slate-800">{resultsData.totalQuestions}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Controls */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Filter by name..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    className="w-full md:w-1/3 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full md:w-auto px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition bg-white"
                >
                    {classOptions.map(c => (
                        <option key={c} value={c}>{c === 'all' ? 'All Classes' : c}</option>
                    ))}
                </select>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {filteredResults.length === 0 ? (
                    <div className="text-center py-20">
                        <h3 className="text-lg font-semibold text-slate-800">No Matching Results</h3>
                        <p className="mt-1 text-sm text-slate-500">Try adjusting your filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Student Name</th>
                                    <th scope="col" className="px-6 py-3">Class</th>
                                    <th scope="col" className="px-6 py-3 text-center">Status</th>
                                    <th scope="col" className="px-6 py-3 text-center">Attempts</th>
                                    <th scope="col" className="px-6 py-3 text-center">Correct</th>
                                    <th scope="col" className="px-6 py-3 text-center">Incorrect</th>
                                    <th scope="col" className="px-6 py-3 text-center">Not Answered</th>
                                    <th scope="col" className="px-6 py-3 text-center">Best Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredResults.map((student) => {
                                    const isCompleted = student.status === 'Completed';
                                    return (
                                        <tr
                                            key={student.studentId}
                                            className={`border-b transition-colors ${isCompleted
                                                    ? (selectedStudent?.studentId === student.studentId ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50 cursor-pointer')
                                                    : 'bg-slate-50 text-slate-500'
                                                }`}
                                            onClick={() => handleRowClick(student)}
                                        >
                                            <th scope="row" className={`px-6 py-4 font-bold whitespace-nowrap ${isCompleted ? 'text-slate-900' : ''}`}>
                                                {student.studentName}
                                            </th>
                                            <td className="px-6 py-4">{student.className}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                                    }`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-semibold">
                                                {isCompleted ? <span className="text-slate-600">{student.attempts.length}</span> : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-semibold">
                                                {isCompleted ? <span className="text-emerald-600">{student.correctCount}</span> : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-semibold">
                                                {isCompleted ? <span className="text-red-600">{student.incorrectCount}</span> : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-semibold">
                                                {isCompleted ? <span className="text-slate-500">{student.notAnsweredCount}</span> : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isCompleted ? (
                                                    <span className={`font-bold text-base px-2 py-1 rounded-md ${getScoreColor(student.bestScore)}`}>
                                                        {student.bestScore}%
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-slate-500">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail View */}
            {selectedStudent && (
                <StudentAnalysisDetail
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </div>
    );
}

function StudentAnalysisDetail({ student, onClose }) {
    const [selectedAttemptId, setSelectedAttemptId] = useState(null);
    const [attemptIdForLog, setAttemptIdForLog] = useState(null);

    // Helper to format date
    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return 'N/A';
        return new Date(dateTimeString).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-600 bg-emerald-50';
        if (score >= 60) return 'text-amber-600 bg-amber-50';
        return 'text-red-600 bg-red-50';
    };

    if (selectedAttemptId) {
        return <AttemptAnalysisDetail attemptId={selectedAttemptId} onClose={() => setSelectedAttemptId(null)} studentName={student.studentName} />
    }

    return (
        <div className="space-y-4 fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-center items-start p-4 pt-16" onClick={onClose}>
            <div className="relative w-full max-w-7xl max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-slate-900">Attempt History for {student.studentName}</h2>
                    <p className="text-sm text-slate-500">Showing all completed attempts. Click an attempt to see details or logs.</p>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="overflow-y-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50/50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-center">Attempt</th>
                                <th scope="col" className="px-6 py-3 text-center">Score</th>
                                <th scope="col" className="px-6 py-3 text-center">Correct</th>
                                <th scope="col" className="px-6 py-3 text-center">Incorrect</th>
                                <th scope="col" className="px-6 py-3 text-center">Not Answered</th>
                                <th scope="col" className="px-6 py-3 text-center">Actions</th>
                                <th scope="col" className="px-6 py-3">Start Time</th>
                                <th scope="col" className="px-6 py-3">End Time</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {student.attempts.map((attempt, index) => (
                                <tr key={attempt.attemptId} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedAttemptId(attempt.attemptId)}>
                                    <td className="px-6 py-4 text-center font-bold text-slate-700">{index + 1}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`font-bold text-base px-2 py-1 rounded-md ${getScoreColor(attempt.score)}`}>
                                            {Math.round(attempt.score)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-semibold text-emerald-600">{attempt.correctCount}</td>
                                    <td className="px-6 py-4 text-center font-semibold text-red-600">{attempt.incorrectCount}</td>
                                    <td className="px-6 py-4 text-center font-semibold text-slate-500">{attempt.notAnsweredCount}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setAttemptIdForLog(attempt.attemptId); }}
                                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all text-xs"
                                        >
                                            View Logs
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">{formatDateTime(attempt.startTime)}</td>
                                    <td className="px-6 py-4">{formatDateTime(attempt.endTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Activity Logs</h3>
                        <p className="text-xs text-slate-500 font-medium">Student: {studentName} (Attempt #{attemptId})</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200 shadow-sm">
                        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/30">
                    {loading ? (
                        <div className="text-center py-10 animate-pulse text-slate-400 font-medium">Fetching logs...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 font-medium italic">No logs found for this attempt.</div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className={`flex gap-4 p-3 rounded-xl border shadow-sm transition-all ${log.action_type === 'SECURITY' ? 'bg-red-50 border-red-100 hover:bg-red-100/50' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                <div className="flex-shrink-0 pt-1">
                                    {log.action_type === 'SECURITY' ? (
                                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold">
                                            {log.action_type.substring(0, 3)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className={`text-sm font-semibold ${log.action_type === 'SECURITY' ? 'text-red-900' : 'text-slate-800'}`}>{log.description}</p>
                                    <p className="text-[10px] font-mono text-slate-400 mt-1">{new Date(log.created_at).toLocaleString()}</p>
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
        <div className="space-y-4 fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-slate-900">Analysis for {studentName}</h2>
                    <p className="text-sm text-slate-500">Review of all questions and answers for this attempt.</p>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {loading && <div className="text-center p-20">Loading analysis...</div>}
                {error && <div className="text-center p-20 text-red-500">Error: {error}</div>}

                {analysis && (
                    <div className="p-6 space-y-4 overflow-y-auto">
                        {analysis.map((ans, index) => (
                            <div key={ans.questionId} className="p-4 border rounded-xl bg-slate-50/50">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="font-semibold text-slate-800 flex-1">
                                        <span className="font-bold mr-2">{index + 1}.</span>
                                        <div className="inline-block" dangerouslySetInnerHTML={{ __html: ans.questionText }} />
                                    </div>
                                    {ans.isCorrect ? <Icons.CheckCircle /> : (ans.studentAnswer ? <Icons.XCircle /> : <Icons.MinusCircle />)}
                                </div>
                                <div className="mt-3 pl-6 border-l-2 ml-2 space-y-2">
                                    <p className={`text-sm font-medium ${ans.isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                                        Your Answer: <span className="font-bold">{ans.studentAnswer || 'Not Answered'}</span>
                                    </p>
                                    {!ans.isCorrect && (
                                        <p className="text-sm font-medium text-slate-600">
                                            Correct Answer: <span className="font-bold">{ans.correctAnswer}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


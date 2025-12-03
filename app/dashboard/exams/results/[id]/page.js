'use client';

import { useEffect, useState } from 'react';
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

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-600 bg-emerald-50';
        if (score >= 60) return 'text-amber-600 bg-amber-50';
        return 'text-red-600 bg-red-50';
    };

    const handleRowClick = (student) => {
        if (selectedStudent?.studentId === student.studentId) {
            setSelectedStudent(null); // Toggle off if already selected
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
                    <p className="text-sm text-slate-500 mt-1">Select a student to view their detailed answer analysis.</p>
                </div>
                <div className="flex gap-4">
                     <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                        <Icons.UserGroup className="text-slate-400" />
                        <div>
                            <div className="text-xs text-slate-500">Participants</div>
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

            {/* Results Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {resultsData.results.length === 0 ? (
                    <div className="text-center py-20">
                        <h3 className="text-lg font-semibold text-slate-800">No Submissions Yet</h3>
                        <p className="mt-1 text-sm text-slate-500">No students have completed this exam.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Student Name</th>
                                    <th scope="col" className="px-6 py-3 text-center">Correct</th>
                                    <th scope="col" className="px-6 py-3 text-center">Incorrect</th>
                                    <th scope="col" className="px-6 py-3 text-center">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultsData.results.map((student) => (
                                    <tr 
                                        key={student.studentId} 
                                        className={`border-b cursor-pointer transition-colors ${selectedStudent?.studentId === student.studentId ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                                        onClick={() => handleRowClick(student)}
                                    >
                                        <th scope="row" className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                                            {student.studentName}
                                        </th>
                                        <td className="px-6 py-4 text-center text-emerald-600 font-semibold">
                                            {student.correctCount}
                                        </td>
                                        <td className="px-6 py-4 text-center text-red-600 font-semibold">
                                            {student.incorrectCount}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`font-bold text-base px-2 py-1 rounded-md ${getScoreColor(student.score)}`}>
                                                {student.score}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
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
    return (
        <div className="space-y-4 fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-slate-900">Analysis for {student.studentName}</h2>
                    <p className="text-sm text-slate-500">Review of all questions and answers.</p>
                     <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors">
                        <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    {student.answers.map((ans, index) => (
                        <div key={ans.questionId} className="p-4 border rounded-xl bg-slate-50/50">
                            <div className="flex items-start justify-between gap-4">
                                <p className="font-semibold text-slate-800 flex-1">
                                    <span className="font-bold mr-2">{index + 1}.</span>
                                    <span dangerouslySetInnerHTML={{ __html: ans.questionText }} />
                                </p>
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
            </div>
        </div>
    );
}


'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Upload: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

const ManualInputForm = ({ examId, onQuestionAdded }) => {
    const [questionText, setQuestionText] = useState('');
    const [options, setOptions] = useState({ A: '', B: '', C: '', D: '', E: '' });
    const [correctOption, setCorrectOption] = useState('A');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleOptionChange = (key, value) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!questionText.trim() || Object.values(options).some(o => !o.trim())) {
            setError('Please fill out the question and all options.');
            return;
        }
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/exams/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId, questionText, options, correctOption }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to add question');
            }
            // Reset form and notify parent
            setQuestionText('');
            setOptions({ A: '', B: '', C: '', D: '', E: '' });
            setCorrectOption('A');
            onQuestionAdded();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
                <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md"
                    rows="3"
                    required
                ></textarea>
            </div>
            {Object.keys(options).map(key => (
                <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Option {key}</label>
                    <input
                        type="text"
                        value={options[key]}
                        onChange={(e) => handleOptionChange(key, e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-md"
                        required
                    />
                </div>
            ))}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correct Answer</label>
                <select
                    value={correctOption}
                    onChange={(e) => setCorrectOption(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white"
                >
                    {Object.keys(options).map(key => (
                        <option key={key} value={key}>{key}</option>
                    ))}
                </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="text-right">
                <button type="submit" disabled={loading} className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:bg-indigo-300">
                    <Icons.Plus /> {loading ? 'Adding...' : 'Add Question'}
                </button>
            </div>
        </form>
    );
};

const ImportWordForm = ({ examId, onQuestionAdded }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            setFile(selectedFile);
            setError('');
        } else {
            setFile(null);
            setError('Please select a .docx file.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('No file selected.');
            return;
        }
        setLoading(true);
        setError('');
        setSuccess('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('examId', examId);

        try {
            const res = await fetch('/api/exams/questions/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to upload file.');
            }
            setSuccess(data.message);
            setFile(null);
            e.target.reset();
            onQuestionAdded(); // Refresh the questions list
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select .docx file</label>
                <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col w-full h-32 border-2 border-dashed border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Icons.Upload />
                            <p className="text-sm text-slate-500">{file ? file.name : 'Click to upload'}</p>
                        </div>
                        <input type="file" className="hidden" accept=".docx" onChange={handleFileChange} />
                    </label>
                </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <div className="text-right">
                <button type="submit" disabled={!file || loading} className="inline-flex items-center justify-center px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg disabled:bg-sky-300">
                    {loading ? 'Uploading...' : 'Upload & Import'}
                </button>
            </div>
        </form>
    );
};

export default function ManageQuestionsPage() {
    const { id: examId } = useParams();
    const [activeTab, setActiveTab] = useState('manual');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/exams/questions?examId=${examId}`);
            if (!res.ok) throw new Error('Failed to fetch questions');
            const data = await res.json();
            setQuestions(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [examId]);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);
    
    const handleDelete = async (questionId) => {
        if (!window.confirm('Are you sure you want to delete this question?')) return;
        
        try {
            const res = await fetch('/api/exams/questions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: questionId }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to delete question');
            }
            fetchQuestions(); // Refresh list
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Manage Questions</h1>
                <p className="text-slate-500 mt-1">Exam ID: <span className="font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-md">{examId}</span></p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 sticky top-24">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Add Questions</h2>
                        <div className="flex border-b border-slate-200 mb-4">
                             <button onClick={() => setActiveTab('manual')} className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'manual' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
                                Manual Input
                            </button>
                            <button onClick={() => setActiveTab('import')} className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'import' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>
                                Import from Word
                            </button>
                        </div>
                        
                        {activeTab === 'manual' && <ManualInputForm examId={examId} onQuestionAdded={fetchQuestions} />}
                        {activeTab === 'import' && <ImportWordForm examId={examId} onQuestionAdded={fetchQuestions} />}
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Existing Questions ({questions.length})</h2>
                        {error && <p className="text-red-500 bg-red-50 p-3 rounded-md">{error}</p>}
                        {loading ? <p className="text-slate-500 animate-pulse">Loading questions...</p> : (
                            <div className="space-y-4">
                                {questions.length === 0 ? (
                                     <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                                        <p className="text-slate-500">No questions have been added yet.</p>
                                    </div>
                                ) : (
                                    questions.map((q, index) => (
                                        <div key={q.id} className="p-4 border border-slate-200 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold text-slate-800">Q{index + 1}: {q.question_text}</p>
                                                <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"><Icons.Trash /></button>
                                            </div>
                                            <div className="mt-2 space-y-1 text-sm">
                                                {Object.entries(JSON.parse(q.options)).map(([key, value]) => (
                                                    <p key={key} className={`pl-4 ${key === q.correct_option ? 'font-bold text-green-700' : 'text-slate-600'}`}>
                                                        {key}. {value} {key === q.correct_option && '✓'}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="mt-8">
                <Link href={`/dashboard/exams/manage/${examId}`} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                    &larr; Back to Exam Settings
                </Link>
            </div>
        </div>
    );
}
'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import JoditEditor from 'jodit-react';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Upload: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>,
};

const ManualInputForm = ({ examId, onQuestionAdded }) => {
    const editor = useRef(null);
    const [questionText, setQuestionText] = useState('');
    const [options, setOptions] = useState({ A: '', B: '', C: '', D: '', E: '' });
    const [correctOption, setCorrectOption] = useState('A');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const config = useMemo(() => ({ readonly: false }), []);

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
                <JoditEditor
                    ref={editor}
                    value={questionText}
                    config={config}
                    tabIndex={1}
                    onBlur={newContent => setQuestionText(newContent)}
                />
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

const EditQuestionForm = ({ question, onSave, onCancel }) => {
    const editor = useRef(null);
    const [questionText, setQuestionText] = useState(question.question_text);
    const [options, setOptions] = useState(
        question.options && typeof question.options === 'string'
            ? JSON.parse(question.options)
            : question.options || {}
    );
    const [correctOption, setCorrectOption] = useState(question.correct_option);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const config = useMemo(() => ({ readonly: false }), []);

    const handleOptionChange = (key, value) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!questionText.trim() || Object.values(options).some(o => !o.trim())) {
            setError('Please fill out the question and all options.');
            return;
        }
        setLoading(true);
        setError('');
        await onSave({
            id: question.id,
            questionText,
            options,
            correctOption,
        });
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Edit Question</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
                        <JoditEditor
                            ref={editor}
                            value={questionText}
                            config={config}
                            tabIndex={1}
                            onBlur={newContent => setQuestionText(newContent)}
                        />
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
                    <div className="flex justify-end gap-4">
                        <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={loading} className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:bg-indigo-300">
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ImportWordForm = ({ examId, onQuestionAdded }) => {
    // ... (rest of the component is unchanged)
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
    const [editingQuestion, setEditingQuestion] = useState(null);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/exams/questions?examId=${examId}`);
            if (!res.ok) throw new Error('Failed to fetch questions');
            const data = await res.json();
            
            const normalizedData = data.map(q => {
                const optionsRaw = q.options && typeof q.options === 'string'
                    ? JSON.parse(q.options)
                    : q.options || {};

                const optionValues = Object.values(optionsRaw);
                const letterKeys = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

                const reKeyedOptions = optionValues.reduce((acc, value, index) => {
                    const letterKey = letterKeys[index];
                    if (letterKey) { // Ensure we don't run out of letters
                        let optionText = value;
                        if (value && typeof value === 'object' && value.hasOwnProperty('text')) {
                            optionText = value.text;
                        }
                        acc[letterKey] = optionText;
                    }
                    return acc;
                }, {});

                // Also update correct_option if it's numeric
                let newCorrectOption = q.correct_option;
                if (q.correct_option && typeof q.correct_option === 'string' && /^\d+$/.test(q.correct_option)) {
                    const numericIndex = parseInt(q.correct_option, 10);
                    if (numericIndex >= 0 && numericIndex < letterKeys.length) {
                        newCorrectOption = letterKeys[numericIndex];
                    }
                } else if (q.correct_option && typeof q.correct_option === 'number') {
                    if (q.correct_option >= 0 && q.correct_option < letterKeys.length) {
                        newCorrectOption = letterKeys[q.correct_option];
                    }
                }

                return { ...q, options: reKeyedOptions, correct_option: newCorrectOption };
            });

            setQuestions(normalizedData);
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
            fetchQuestions();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUpdateQuestion = async (updatedQuestion) => {
        try {
            const res = await fetch('/api/exams/questions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedQuestion),
            });
             if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update question');
            }
            setEditingQuestion(null);
            fetchQuestions();
        } catch (err) {
            // This error will be shown in the Edit modal
            alert(`Error updating question: ${err.message}`);
        }
    };

    return (
        <>
            {editingQuestion && (
                <EditQuestionForm 
                    question={editingQuestion}
                    onSave={handleUpdateQuestion}
                    onCancel={() => setEditingQuestion(null)}
                />
            )}
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
                                        questions.map((q, index) => {
                                            const options = q.options && typeof q.options === 'string' ? JSON.parse(q.options) : q.options || {};
                                            return (
                                                <div key={q.id} className="p-4 border border-slate-200 rounded-lg">
                                                    <div className="flex justify-between items-start">
                                                        <div className="prose max-w-none">
                                                            <p className="font-semibold text-slate-800">Q{index + 1}: <span dangerouslySetInnerHTML={{ __html: q.question_text }} /></p>
                                                        </div>
                                                        <div className="flex gap-2 flex-shrink-0">
                                                            <button onClick={() => setEditingQuestion(q)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"><Icons.Edit /></button>
                                                            <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"><Icons.Trash /></button>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 space-y-1 text-sm">
                                                        {Object.entries(options).map(([key, value]) => (
                                                            <p key={key} className={`pl-4 ${key === q.correct_option ? 'font-bold text-green-700' : 'text-slate-600'}`}>
                                                                {key}. {value} {key === q.correct_option && '✓'}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })
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
        </>
    );
}

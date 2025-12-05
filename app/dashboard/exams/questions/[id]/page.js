'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { uploadBase64Images } from '@/app/lib/utils';
import dynamic from 'next/dynamic';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Upload: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>,
    Close: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
};

// --- Editor Configuration ---
const useJoditConfig = () => {
    return useMemo(() => ({
        readonly: false,
        height: 'auto',
        minHeight: 100,
        insertImageAsBase64URL: true, // Insert images as Base64
        buttons: 'bold,italic,underline,strikethrough,|,ul,ol,|,outdent,indent,|,font,fontsize,brush,paragraph,|,image,video,table,link,|,align,undo,redo,\n,cut,hr,eraser,copyformat,|,symbol,fullsize,print,about'
    }), []);
};


const JoditEditorWithUpload = ({ value, onBlur }) => {
    const editor = useRef(null);
    const editorConfig = useJoditConfig();

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            if (editor.current) {
                editor.current.selection.insertImage(base64Image);
            }
        };
        reader.readAsDataURL(file);
        event.target.value = null; 
    };

    return (
        <div>
            <JoditEditor
                ref={editor}
                value={value}
                config={editorConfig}
                onBlur={newContent => onBlur(newContent)}
            />
            <div className="mt-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-md border border-slate-300">
                    <Icons.Upload />
                    Upload Image
                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                </label>
            </div>
        </div>
    );
};


const ManualInputForm = ({ examId, onQuestionAdded }) => {
    const [questionText, setQuestionText] = useState('');
    const [options, setOptions] = useState([
        { id: 1, key: 'A', value: '' },
        { id: 2, key: 'B', value: '' },
    ]);
    const [correctOption, setCorrectOption] = useState('A');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const nextOptionId = useRef(3);

    const handleOptionChange = (id, value) => {
        setOptions(prevOptions => 
            prevOptions.map(opt => opt.id === id ? { ...opt, value } : opt)
        );
    };

    const addOption = () => {
        setOptions(prev => {
            const nextKey = String.fromCharCode(65 + prev.length);
            return [...prev, { id: nextOptionId.current++, key: nextKey, value: '' }];
        });
    };

    const removeOption = (id) => {
        const optionToRemove = options.find(opt => opt.id === id);
        if (optionToRemove && correctOption === optionToRemove.key) {
            setCorrectOption(options[0].key);
        }
        setOptions(prev => prev.filter(opt => opt.id !== id));
    };
    
    const resetForm = () => {
        setQuestionText('');
        setOptions([
            { id: 1, key: 'A', value: '' },
            { id: 2, key: 'B', value: '' },
        ]);
        nextOptionId.current = 3;
        setCorrectOption('A');
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!questionText.trim() || options.some(o => !o.value.trim())) {
            setError('Please fill out the question and all options.');
            return;
        }
        setError('');
        setLoading(true);

        try {
            // Process content to upload Base64 images and get URLs
            const processedQuestionText = await uploadBase64Images(questionText);
            const processedOptions = await Promise.all(
                options.map(async (opt) => ({
                    ...opt,
                    value: await uploadBase64Images(opt.value),
                }))
            );

            const optionsForApi = processedOptions.reduce((acc, opt) => {
                acc[opt.key] = opt.value;
                return acc;
            }, {});

            const res = await fetch('/api/exams/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId, questionText: processedQuestionText, options: optionsForApi, correctOption }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to add question');
            
            resetForm();
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
                <JoditEditorWithUpload
                    value={questionText}
                    onBlur={newContent => setQuestionText(newContent)}
                />
            </div>
            {options.map((opt, index) => (
                <div key={opt.id} className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-slate-700">Option {opt.key}</label>
                        {options.length > 2 && (
                            <button type="button" onClick={() => removeOption(opt.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full" title={`Remove option ${opt.key}`}>
                                <Icons.Trash />
                            </button>
                        )}
                    </div>
                    <JoditEditorWithUpload
                        value={opt.value}
                        onBlur={newContent => handleOptionChange(opt.id, newContent)}
                    />
                </div>
            ))}
            <div className="text-left pt-2">
                <button type="button" onClick={addOption} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-md">
                    <Icons.Plus /> Add Option
                </button>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correct Answer</label>
                <select value={correctOption} onChange={(e) => setCorrectOption(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md bg-white">
                    {options.map(opt => (
                        <option key={opt.id} value={opt.key}>{opt.key}</option>
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
    const [questionText, setQuestionText] = useState(question.question_text);
    
    // Initialize options state from potentially stringified JSON
    const initialOptions = useMemo(() => {
        let parsedOpts = {};
        try {
            parsedOpts = typeof question.options === 'string' ? JSON.parse(question.options) : (question.options || {});
        } catch (e) { console.error("Failed to parse options for editing:", e) }
        
        return Object.entries(parsedOpts).map(([key, value], index) => ({
            id: index + 1, // Simple ID generation for the edit session
            key,
            value
        }));
    }, [question.options]);

    const [options, setOptions] = useState(initialOptions);
    const [correctOption, setCorrectOption] = useState(question.correct_option);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const nextOptionId = useRef(options.length + 1);

    const handleOptionChange = (id, value) => {
        setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, value } : opt));
    };
    
    const addOption = () => {
        setOptions(prev => {
            const nextKey = String.fromCharCode(65 + prev.length);
            return [...prev, { id: nextOptionId.current++, key: nextKey, value: '' }];
        });
    };

    const removeOption = (id) => {
        const optionToRemove = options.find(opt => opt.id === id);
        if (optionToRemove && correctOption === optionToRemove.key) {
            setCorrectOption(options[0].key);
        }
        setOptions(prev => prev.filter(opt => opt.id !== id));
    };

    const handleSave = async () => {
        if (!questionText.trim() || options.some(o => !o.value.trim())) {
            setError('Please fill out the question and all options.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            // Process content to upload Base64 images and get URLs
            const processedQuestionText = await uploadBase64Images(questionText);
            const processedOptions = await Promise.all(
                options.map(async (opt) => ({
                    ...opt,
                    value: await uploadBase64Images(opt.value),
                }))
            );

            const optionsForApi = processedOptions.reduce((acc, opt) => {
                acc[opt.key] = opt.value;
                return acc;
            }, {});

            await onSave({
                id: question.id,
                questionText: processedQuestionText,
                options: optionsForApi,
                correctOption,
            });
        } catch (err) {
            setError('An error occurred while saving. ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-100 z-50">
            <div className="bg-white shadow-2xl flex flex-col h-full">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">Edit Question</h2>
                    <button onClick={onCancel} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
                        <Icons.Close />
                    </button>
                </div>

                {/* Main Content (Scrollable) */}
                <div className="flex-grow overflow-y-auto p-6 space-y-8">
                    {/* Question Editor */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <label className="block text-lg font-semibold text-slate-800 mb-3">Question</label>
                        <JoditEditorWithUpload 
                            value={questionText} 
                            onBlur={newContent => setQuestionText(newContent)} 
                        />
                    </div>

                    {/* Options Section */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Options</h3>
                            <button type="button" onClick={addOption} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-md">
                                <Icons.Plus /> Add Option
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {options.map((opt) => (
                                <div key={opt.id} className="space-y-2 border border-slate-200 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                        <label className="font-semibold text-slate-700">Option {opt.key}</label>
                                        {options.length > 2 && (
                                            <button type="button" onClick={() => removeOption(opt.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full" title={`Remove option ${opt.key}`}>
                                                <Icons.Trash />
                                            </button>
                                        )}
                                    </div>
                                    <JoditEditorWithUpload value={opt.value} onBlur={newContent => handleOptionChange(opt.id, newContent)} />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Correct Answer Section */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                         <label className="block text-lg font-semibold text-slate-800 mb-3">Correct Answer</label>
                        <select value={correctOption} onChange={(e) => setCorrectOption(e.target.value)} className="w-full max-w-xs p-2 border border-slate-300 rounded-md bg-white text-slate-800">
                            {options.map(opt => (
                                <option key={opt.id} value={opt.key}>{`Option ${opt.key}`}</option>
                            ))}
                        </select>
                    </div>

                    {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                </div>

                {/* Footer (Action Buttons) */}
                <div className="flex justify-end gap-4 p-4 bg-white border-t border-slate-200">
                    <button onClick={onCancel} className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={loading} className="inline-flex items-center justify-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:bg-indigo-300 transition-colors">
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
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
                let optionsObject;
                try {
                    optionsObject = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || {});
                } catch { optionsObject = {} }

                const optionValues = Object.values(optionsObject);
                const letterKeys = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

                const reKeyedOptions = optionValues.reduce((acc, value, index) => {
                    const letterKey = letterKeys[index];
                    if (letterKey) {
                        let optionText = (value && typeof value === 'object' && value.hasOwnProperty('text')) ? value.text : value;
                        acc[letterKey] = optionText;
                    }
                    return acc;
                }, {});

                let newCorrectOption = q.correct_option;
                if (q.correct_option && /^\\d+\\$/.test(String(q.correct_option))) {
                    const numericIndex = parseInt(q.correct_option, 10);
                    if (numericIndex >= 0 && numericIndex < letterKeys.length) {
                        newCorrectOption = letterKeys[numericIndex];
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
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to delete question');
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
             if (!res.ok) throw new Error((await res.json()).message || 'Failed to update question');
            setEditingQuestion(null);
            fetchQuestions();
        } catch (err) {
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
                                        questions.map((q, index) => (
                                            <div key={q.id} className="p-4 border border-slate-200 rounded-lg">
                                                <div className="flex justify-between items-start">
                                                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: `<p><strong>Q${index + 1}:</strong> ${q.question_text}</p>` }} />
                                                    <div className="flex gap-2 flex-shrink-0 ml-4">
                                                        <button onClick={() => setEditingQuestion(q)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"><Icons.Edit /></button>
                                                        <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"><Icons.Trash /></button>
                                                    </div>
                                                </div>
                                                <div className="mt-2 space-y-1 text-sm prose prose-slate max-w-none">
                                                    {Object.entries(q.options).map(([key, value]) => (
                                                        <div key={key} className={`pl-4 ${key === q.correct_option ? 'font-bold text-green-700' : 'text-slate-600'}`} dangerouslySetInnerHTML={{ __html: `${key}. ${value} ${key === q.correct_option ? '✓' : ''}`}} />
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
        </>
    );
}
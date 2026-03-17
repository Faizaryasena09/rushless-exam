'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { uploadBase64Images } from '@/app/lib/utils';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Upload: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    TrashAll: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>,
    Close: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Grip: () => <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" /></svg>,
    Warning: () => <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.997L13.732 4.832c-.77-1.333-2.694-1.333-3.464 0L3.34 16.003c-.77 1.33.192 2.997 1.732 2.997z" /></svg>,
    Download: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
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
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-600">
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
    const [questionType, setQuestionType] = useState('multiple_choice');
    const [correctOptions, setCorrectOptions] = useState(['A']); // For complex choice
    const [points, setPoints] = useState(1);
    const [scoringStrategy, setScoringStrategy] = useState('standard');
    const [keywords, setKeywords] = useState('');
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
        setCorrectOptions(['A']);
        setQuestionType('multiple_choice');
        setPoints(1);
        setScoringStrategy('standard');
        setKeywords('');
    }

    const handleTypeChange = (type) => {
        setQuestionType(type);
        setScoringStrategy('standard');
        if (type === 'true_false') {
            setOptions([
                { id: 1, key: 'A', value: 'Benar' },
                { id: 2, key: 'B', value: 'Salah' },
            ]);
            setCorrectOption('A');
        } else if (type === 'essay') {
            setOptions([]);
            setCorrectOption('');
            setScoringStrategy('essay_manual');
        } else if (type === 'multiple_choice') {
            if (options.length === 0) {
                setOptions([
                    { id: 1, key: 'A', value: '' },
                    { id: 2, key: 'B', value: '' },
                ]);
            }
            setCorrectOption('A');
        } else if (type === 'multiple_choice_complex') {
            if (options.length === 0) {
                setOptions([
                    { id: 1, key: 'A', value: '' },
                    { id: 2, key: 'B', value: '' },
                ]);
            }
            setCorrectOptions(['A']);
            setScoringStrategy('pgk_partial');
        }
    };

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

            const finalCorrectOption = questionType === 'multiple_choice_complex' 
                ? correctOptions.sort().join(',') 
                : correctOption;

            const res = await fetch('/api/exams/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    examId, 
                    questionText: processedQuestionText, 
                    options: optionsForApi, 
                    correctOption: finalCorrectOption,
                    questionType,
                    points,
                    scoringStrategy,
                    scoringMetadata: questionType === 'essay' ? { keywords: keywords.split(',').map(k => k.trim()).filter(k => k) } : null
                }),
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question Type</label>
                    <select 
                        value={questionType} 
                        onChange={(e) => handleTypeChange(e.target.value)} 
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 dark:text-slate-100"
                    >
                        <option value="multiple_choice">Pilihan Ganda</option>
                        <option value="multiple_choice_complex">Pilihan Ganda Kompleks</option>
                        <option value="true_false">Benar / Salah</option>
                        <option value="matching">Menjodohkan (Matching)</option>
                        <option value="essay">Esai</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Poin / Bobot Soal</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={points}
                        onChange={(e) => setPoints(parseFloat(e.target.value))}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
            </div>

            {questionType === 'multiple_choice_complex' && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-2">Strategi Penyekoran PGK</label>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="pgk_strategy" checked={scoringStrategy === 'pgk_partial'} onChange={() => setScoringStrategy('pgk_partial')} />
                            <span className="text-sm dark:text-slate-300">Parsial (Correct - Wrong)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="pgk_strategy" checked={scoringStrategy === 'pgk_strict'} onChange={() => setScoringStrategy('pgk_strict')} />
                            <span className="text-sm dark:text-slate-300">Strict (Full Poin jika Benar Semua)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="pgk_strategy" checked={scoringStrategy === 'pgk_any'} onChange={() => setScoringStrategy('pgk_any')} />
                            <span className="text-sm dark:text-slate-300">Any (Minimal 1 Benar = Full)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="pgk_strategy" checked={scoringStrategy === 'pgk_additive'} onChange={() => setScoringStrategy('pgk_additive')} />
                            <span className="text-sm dark:text-slate-300">Additive (Poin per Item Benar)</span>
                        </label>
                    </div>
                </div>
            )}

            {questionType === 'essay' && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-300 mb-2">Automasi Koreksi Esai</label>
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="essay_strategy" checked={scoringStrategy === 'essay_manual'} onChange={() => setScoringStrategy('essay_manual')} />
                                <span className="text-sm dark:text-slate-300">Manual (Oleh Guru)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="essay_strategy" checked={scoringStrategy === 'essay_keywords'} onChange={() => setScoringStrategy('essay_keywords')} />
                                <span className="text-sm dark:text-slate-300">Rasio Kata (Parsial)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="essay_strategy" checked={scoringStrategy === 'essay_any_keyword'} onChange={() => setScoringStrategy('essay_any_keyword')} />
                                <span className="text-sm dark:text-slate-300">Any (1 Cocok = Full)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="essay_strategy" checked={scoringStrategy === 'essay_strict_keywords'} onChange={() => setScoringStrategy('essay_strict_keywords')} />
                                <span className="text-sm dark:text-slate-300">Strict (Semua Cocok = Full)</span>
                            </label>
                        </div>
                        {(scoringStrategy === 'essay_keywords' || scoringStrategy === 'essay_any_keyword' || scoringStrategy === 'essay_strict_keywords') && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Kata Kunci (Pisahkan dengan koma)</label>
                                <input
                                    type="text"
                                    placeholder="contoh: ekosistem, biologi, lingkungan"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 dark:text-slate-100 text-sm"
                                />
                                <p className="mt-1 text-[10px] text-slate-400">
                                    {scoringStrategy === 'essay_any_keyword' 
                                        ? 'Cukup 1 kata kunci yang cocok untuk mendapatkan poin penuh.' 
                                        : scoringStrategy === 'essay_strict_keywords'
                                            ? 'Harus mengandung SEMUA kata kunci di atas untuk mendapatkan poin penuh.'
                                            : 'Sistem akan menghitung kemunculan kata kunci ini di jawaban siswa untuk memberikan poin.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Question Content</label>
                <JoditEditorWithUpload
                    value={questionText}
                    onBlur={newContent => setQuestionText(newContent)}
                />
            </div>
            {questionType !== 'essay' && options.map((opt, index) => (
                <div key={opt.id} className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Option {opt.key}</label>
                        {options.length > 2 && questionType !== 'true_false' && (
                            <button type="button" onClick={() => removeOption(opt.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full" title={`Remove option ${opt.key}`}>
                                <Icons.Trash />
                            </button>
                        )}
                    </div>
                    {questionType === 'true_false' ? (
                        <input
                            type="text"
                            value={opt.value}
                            readOnly
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 dark:text-slate-100"
                        />
                    ) : (
                        <JoditEditorWithUpload
                            value={opt.value}
                            onBlur={newContent => handleOptionChange(opt.id, newContent)}
                        />
                    )}
                </div>
            ))}
            {questionType !== 'essay' && questionType !== 'true_false' && (
                <div className="text-left pt-2">
                    <button type="button" onClick={addOption} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-md">
                        <Icons.Plus /> Add Option
                    </button>
                </div>
            )}
            {questionType !== 'essay' && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Correct Answer</label>
                    {questionType === 'multiple_choice_complex' ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {options.map(opt => (
                                <label key={opt.id} className="flex items-center gap-2 p-2 border border-slate-200 dark:border-slate-700 rounded-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={correctOptions.includes(opt.key)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setCorrectOptions([...correctOptions, opt.key]);
                                            } else {
                                                setCorrectOptions(correctOptions.filter(k => k !== opt.key));
                                            }
                                        }}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium dark:text-slate-200">Option {opt.key}</span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <select value={correctOption} onChange={(e) => setCorrectOption(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 dark:text-slate-100">
                            {options.map(opt => (
                                <option key={opt.id} value={opt.key}>{opt.key}</option>
                            ))}
                        </select>
                    )}
                </div>
            )}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="text-right">
                <button type="submit" disabled={loading} className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:bg-indigo-300">
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
    const [correctOption, setCorrectOption] = useState(question.correct_option || 'A');
    const [questionType, setQuestionType] = useState(question.question_type || 'multiple_choice');
    const [correctOptions, setCorrectOptions] = useState(
        (question.question_type === 'multiple_choice_complex' && question.correct_option) 
            ? question.correct_option.split(',') 
            : [question.correct_option || 'A']
    );
    const [points, setPoints] = useState(question.points || 1);
    const [scoringStrategy, setScoringStrategy] = useState(question.scoring_strategy || 'standard');
    const [keywords, setKeywords] = useState(() => {
        try {
            const meta = typeof question.scoring_metadata === 'string' ? JSON.parse(question.scoring_metadata) : (question.scoring_metadata || {});
            return (meta.keywords || []).join(', ');
        } catch (e) { return ''; }
    });
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
        if (optionToRemove) {
            if (correctOption === optionToRemove.key) {
                setCorrectOption(options[0].key);
            }
            setCorrectOptions(prev => prev.filter(k => k !== optionToRemove.key));
        }
        setOptions(prev => prev.filter(opt => opt.id !== id));
    };

    const handleTypeChange = (type) => {
        setQuestionType(type);
        setScoringStrategy('standard');
        if (type === 'true_false') {
            setOptions([
                { id: 1, key: 'A', value: 'Benar' },
                { id: 2, key: 'B', value: 'Salah' },
            ]);
            setCorrectOption('A');
            setCorrectOptions(['A']);
        } else if (type === 'essay') {
            setOptions([]);
            setCorrectOption('');
            setCorrectOptions([]);
            setScoringStrategy('essay_manual');
        } else if (type === 'multiple_choice') {
            if (options.length === 0) {
                setOptions([
                    { id: 1, key: 'A', value: '' },
                    { id: 2, key: 'B', value: '' },
                ]);
            }
            setCorrectOption('A');
            setCorrectOptions(['A']);
        } else if (type === 'multiple_choice_complex') {
            if (options.length === 0) {
                setOptions([
                    { id: 1, key: 'A', value: '' },
                    { id: 2, key: 'B', value: '' },
                ]);
            }
            setCorrectOptions(['A']);
            setScoringStrategy('pgk_partial');
        }
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

            const finalCorrectOption = questionType === 'multiple_choice_complex' 
                ? correctOptions.sort().join(',') 
                : correctOption;

            await onSave({
                id: question.id,
                questionText: processedQuestionText,
                options: optionsForApi,
                correctOption: finalCorrectOption,
                questionType,
                points,
                scoringStrategy,
                scoringMetadata: questionType === 'essay' ? { keywords: keywords.split(',').map(k => k.trim()).filter(k => k) } : null
            });
        } catch (err) {
            setError('An error occurred while saving. ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-800 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 fill-mode-both">
                {/* Fixed Header */}
                <div className="bg-white dark:bg-slate-800 px-8 py-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
                            <Icons.Edit />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Sunting Butir Soal</h2>
                            <p className="text-xs text-slate-500 font-medium">Ubah konten dan sistem penilaian soal ini</p>
                        </div>
                    </div>
                    <button 
                        onClick={onCancel} 
                        className="p-2.5 rounded-2xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-all active:scale-90"
                    >
                        <Icons.Close />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                    {/* section: Type & Points */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Metadata Soal</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 tracking-tight pl-1">Tipe Soal</label>
                                    <div className="relative group">
                                        <select 
                                            value={questionType} 
                                            onChange={(e) => handleTypeChange(e.target.value)} 
                                            className="w-full p-3.5 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 dark:text-slate-200 appearance-none shadow-sm"
                                        >
                                            <option value="multiple_choice">Pilihan Ganda</option>
                                            <option value="multiple_choice_complex">Pilihan Ganda Kompleks</option>
                                            <option value="true_false">Benar / Salah</option>
                                            <option value="matching">Menjodohkan (Matching)</option>
                                            <option value="essay">Esai</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 tracking-tight pl-1">Poin / Bobot</label>
                                    <div className="relative group">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            value={points}
                                            onChange={(e) => setPoints(parseFloat(e.target.value))}
                                            className="w-full p-3.5 pl-12 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm"
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 font-black">#</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl shadow-blue-200 dark:shadow-none flex flex-col justify-center overflow-hidden relative">
                            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                            <div className="relative text-sm font-bold opacity-80 uppercase tracking-widest mb-1">Preview Status</div>
                            <div className="relative flex items-center gap-3">
                                <div className="text-4xl font-black">{points}</div>
                                <div className="text-lg font-bold opacity-90 mt-2">Poin</div>
                            </div>
                            <div className="relative mt-4 flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Sistem Penilaian: {scoringStrategy.replace(/_/g, ' ')}</div>
                            </div>
                        </div>
                    </div>

                    {/* section: Question Text */}
                    <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Konten Pertanyaan</h3>
                        </div>
                        <JoditEditorWithUpload
                            value={questionText}
                            onBlur={newContent => setQuestionText(newContent)}
                        />
                    </div>

                    {/* section: Scoring Strategy (Conditional) */}
                    {(questionType === 'multiple_choice_complex' || questionType === 'essay') && (
                        <div className={`p-6 md:p-8 rounded-3xl border-2 shadow-sm animate-in slide-in-from-left-4 duration-500 ${questionType === 'multiple_choice_complex' ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50' : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50'}`}>
                            <div className="flex items-center gap-3 mb-5">
                                <div className={`w-1 h-5 rounded-full ${questionType === 'multiple_choice_complex' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                                <h3 className={`text-sm font-black uppercase tracking-widest ${questionType === 'multiple_choice_complex' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                    {questionType === 'multiple_choice_complex' ? 'Strategi Penyekoran PGK' : 'Automasi Koreksi Esai'}
                                </h3>
                            </div>

                            {questionType === 'multiple_choice_complex' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {[
                                        { id: 'pgk_partial', label: 'Parsial', sub: 'Correct - Wrong' },
                                        { id: 'pgk_strict', label: 'Strict', sub: 'Must Correct All' },
                                        { id: 'pgk_any', label: 'Any', sub: 'Min. 1 Correct' },
                                        { id: 'pgk_additive', label: 'Additive', sub: 'Point per Item' }
                                    ].map(strat => (
                                        <label key={strat.id} className={`flex flex-col p-4 rounded-2xl border-2 transition-all cursor-pointer ${scoringStrategy === strat.id ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-md ring-4 ring-indigo-500/10' : 'bg-white/40 dark:bg-slate-900/20 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`text-sm font-black ${scoringStrategy === strat.id ? 'text-indigo-600' : 'text-slate-600 dark:text-slate-400'}`}>{strat.label}</span>
                                                <input type="radio" name="edit_pgk_strategy" checked={scoringStrategy === strat.id} onChange={() => setScoringStrategy(strat.id)} className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">{strat.sub}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {[
                                            { id: 'essay_manual', label: 'Manual', sub: 'Koreksi Guru' },
                                            { id: 'essay_keywords', label: 'Rasio Kata', sub: 'Poin Parsial' },
                                            { id: 'essay_any_keyword', label: 'Any Keyword', sub: 'Min. 1 Cocok' },
                                            { id: 'essay_strict_keywords', label: 'Strict', sub: 'Semua Cocok' }
                                        ].map(strat => (
                                            <label key={strat.id} className={`flex flex-col p-4 rounded-2xl border-2 transition-all cursor-pointer ${scoringStrategy === strat.id ? 'bg-white dark:bg-slate-800 border-emerald-500 shadow-md ring-4 ring-emerald-500/10' : 'bg-white/40 dark:bg-slate-900/20 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className={`text-sm font-black ${scoringStrategy === strat.id ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}>{strat.label}</span>
                                                    <input type="radio" name="edit_essay_strategy" checked={scoringStrategy === strat.id} onChange={() => setScoringStrategy(strat.id)} className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500" />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">{strat.sub}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {(scoringStrategy !== 'essay_manual') && (
                                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                                            <div className="flex items-center gap-2 mb-3">
                                                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Kata Kunci Automasi</label>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Pisahkan dengan koma, contoh: sel, membran, inti"
                                                value={keywords}
                                                onChange={(e) => setKeywords(e.target.value)}
                                                className="w-full p-4 border-2 border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 dark:text-slate-100 text-sm"
                                            />
                                            <p className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold px-2 flex items-start gap-2">
                                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {scoringStrategy === 'essay_any_keyword' 
                                                    ? 'Cukup 1 kata kunci yang cocok untuk mendapatkan poin penuh.' 
                                                    : scoringStrategy === 'essay_strict_keywords'
                                                        ? 'Harus mengandung SEMUA kata kunci di atas untuk mendapatkan poin penuh.'
                                                        : 'Skor akan dihitung berdasarkan persentase kata kunci yang ditemukan dalam jawaban siswa.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* section: Options */}
                    {questionType !== 'essay' && (
                        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Pilihan Jawaban</h3>
                                </div>
                                {questionType !== 'true_false' && (
                                    <button 
                                        type="button" 
                                        onClick={addOption} 
                                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all active:scale-95"
                                    >
                                        <Icons.Plus /> TAMBAH OPSI
                                    </button>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 gap-6">
                                {options.map((opt) => (
                                    <div key={opt.id} className="relative group p-6 rounded-3xl border-2 border-slate-50 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20 hover:border-blue-200 dark:hover:border-blue-900/30 transition-all duration-300">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 flex items-center justify-center font-black text-slate-700 dark:text-slate-300 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    {opt.key}
                                                </div>
                                                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Opsi {opt.key}</span>
                                            </div>
                                            {options.length > 2 && questionType !== 'true_false' && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeOption(opt.id)} 
                                                    className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all active:scale-90"
                                                >
                                                    <Icons.Trash />
                                                </button>
                                            )}
                                        </div>
                                        {questionType === 'true_false' ? (
                                            <input
                                                type="text"
                                                value={opt.value}
                                                readOnly
                                                className="w-full p-4 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 dark:text-slate-100 font-bold opacity-80"
                                            />
                                        ) : (
                                            <JoditEditorWithUpload value={opt.value} onBlur={newContent => handleOptionChange(opt.id, newContent)} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* section: Correct Answer Selection */}
                    {questionType !== 'essay' && (
                        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1 h-5 bg-green-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Kunci Jawaban</h3>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                                {options.map(opt => {
                                    const isSelected = questionType === 'multiple_choice_complex' 
                                        ? correctOptions.includes(opt.key) 
                                        : correctOption === opt.key;
                                    
                                    return (
                                        <label 
                                            key={opt.id} 
                                            className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all cursor-pointer group select-none ${isSelected ? 'bg-green-50 dark:bg-green-900/20 border-green-500 shadow-md ring-4 ring-green-500/5' : 'bg-slate-50 dark:bg-slate-900 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                                        >
                                            <input
                                                type={questionType === 'multiple_choice_complex' ? "checkbox" : "radio"}
                                                name="edit_correct_choice"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    if (questionType === 'multiple_choice_complex') {
                                                        if (e.target.checked) setCorrectOptions([...correctOptions, opt.key]);
                                                        else setCorrectOptions(correctOptions.filter(k => k !== opt.key));
                                                    } else {
                                                        setCorrectOption(opt.key);
                                                    }
                                                }}
                                                className="hidden"
                                            />
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black mb-1 transition-all ${isSelected ? 'bg-green-500 text-white scale-110 shadow-lg shadow-green-200 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-slate-400 border-2 border-slate-100 dark:border-slate-700'}`}>
                                                {isSelected ? (
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                                                ) : opt.key}
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isSelected ? 'text-green-600' : 'text-slate-400'}`}>
                                                Opsi {opt.key}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-100 dark:border-red-900/50 p-5 rounded-3xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                            <div className="p-2 bg-red-500 text-white rounded-xl">
                                <Icons.Warning />
                            </div>
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                {/* Fixed Footer */}
                <div className="bg-white dark:bg-slate-800 px-8 py-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4 shrink-0">
                    <button 
                        onClick={onCancel} 
                        className="px-6 py-3.5 text-sm font-black text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                        BATALKAN
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={loading} 
                        className="flex items-center gap-3 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-blue-200 dark:shadow-none disabled:bg-slate-300 disabled:shadow-none"
                    >
                        {loading && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {loading ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
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
        if (selectedFile && (selectedFile.type === "application/zip" || selectedFile.type === "application/x-zip-compressed" || selectedFile.name.toLowerCase().endsWith('.zip'))) {
            setFile(selectedFile);
            setError('');
        } else {
            setFile(null);
            setError('Please select a .zip file.');
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Select a .zip file containing HTML and Images</label>
                <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Icons.Upload />
                            <p className="text-sm text-slate-500 dark:text-slate-400">{file ? file.name : 'Click to upload'}</p>
                        </div>
                        <input type="file" className="hidden" accept=".zip,application/zip,application/x-zip-compressed" onChange={handleFileChange} />
                    </label>
                </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}
            <div className="text-right">
                <button type="submit" disabled={!file || loading} className="inline-flex items-center justify-center px-4 py-2 bg-sky-500 hover:bg-sky-600 dark:bg-sky-700 dark:hover:bg-sky-600 text-white text-sm font-semibold rounded-lg disabled:bg-sky-300">
                    {loading ? 'Uploading...' : 'Upload & Import'}
                </button>
            </div>
        </form>
    );
};

// --- Delete All Confirmation Modal ---
const DeleteAllModal = ({ isOpen, onClose, onConfirm, questionCount, loading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <Icons.Warning />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-4">Hapus Semua Soal?</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Anda akan menghapus <span className="font-bold text-red-600 dark:text-red-400">{questionCount}</span> soal.
                        Tindakan ini tidak bisa dibatalkan.
                    </p>
                </div>
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 rounded-lg transition-colors disabled:bg-red-300"
                    >
                        {loading ? 'Menghapus...' : 'Ya, Hapus Semua'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Export Questions Modal ---
const ExportModal = ({ isOpen, onClose, examId, examName }) => {
    const [exportMode, setExportMode] = useState('questions_and_answers');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/exams/questions/export?exam_id=${examId}&mode=${exportMode}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Export failed');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const suffix = exportMode === 'questions_only' ? 'Soal' : exportMode === 'answers_only' ? 'Kunci_Jawaban' : 'Soal_dan_Jawaban';
            a.download = `${examName || 'Exam'}_${suffix}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            onClose();
        } catch (err) {
            alert('Export gagal: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const modes = [
        { value: 'questions_and_answers', label: 'Soal + Jawaban', desc: 'Soal lengkap dengan jawaban benar ditandai' },
        { value: 'questions_only', label: 'Soal Saja', desc: 'Soal tanpa menandai jawaban benar' },
        { value: 'answers_only', label: 'Jawaban Saja', desc: 'Kunci jawaban saja (1. A, 2. B, dst)' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Export Soal</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <Icons.Close />
                    </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Pilih format export ke file Word (.docx)</p>
                <div className="space-y-2">
                    {modes.map((m) => (
                        <label
                            key={m.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${exportMode === m.value
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <input
                                type="radio"
                                name="exportMode"
                                value={m.value}
                                checked={exportMode === m.value}
                                onChange={() => setExportMode(m.value)}
                                className="mt-1 accent-indigo-600"
                            />
                            <div>
                                <div className="font-semibold text-slate-800">{m.label}</div>
                                <div className="text-sm text-slate-500">{m.desc}</div>
                            </div>
                        </label>
                    ))}
                </div>
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 rounded-lg transition-colors disabled:bg-indigo-300 inline-flex items-center justify-center gap-2"
                    >
                        <Icons.Download />
                        {loading ? 'Exporting...' : 'Export'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function ManageQuestionsPage() {
    const { id: examId } = useParams();
    const [activeTab, setActiveTab] = useState('manual');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [editingQuestion, setEditingQuestion] = useState(null);
    const [examName, setExamName] = useState('');
    const [scoringMode, setScoringMode] = useState('percentage');
    const [totalTargetScore, setTotalTargetScore] = useState(100);
    const [autoDistribute, setAutoDistribute] = useState(false);
    const [showScoringSettings, setShowScoringSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [normalizeLoading, setNormalizeLoading] = useState(false);

    // Delete All Modal state
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [deleteAllLoading, setDeleteAllLoading] = useState(false);

    // Export modal state
    const [showExportModal, setShowExportModal] = useState(false);

    // Drag and Drop state
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/exams/questions?examId=${examId}`);
            const examRes = await fetch(`/api/exams/settings?examId=${examId}`); // Fetch exam details

            if (!res.ok) throw new Error('Failed to fetch questions');

            const data = await res.json();

            if (examRes.ok) {
                const examData = await examRes.json();
                setExamName(examData.exam_name || '');
                setScoringMode(examData.scoring_mode || 'raw');
                setTotalTargetScore(examData.total_target_score || 100);
                setAutoDistribute(Boolean(examData.auto_distribute));
            }

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

    const handleSaveScoringSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch('/api/exams/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examId,
                    scoringMode,
                    totalTargetScore,
                    autoDistribute,
                }),
            });
            if (!res.ok) throw new Error('Failed to save settings');
            alert('Pengaturan penyekoran berhasil disimpan.');
            fetchQuestions();
        } catch (err) {
            alert('Gagal menyimpan: ' + err.message);
        } finally {
            setSavingSettings(false);
        }
    };

    const handleNormalizePoints = async () => {
        if (!confirm('Apakah Anda yakin ingin membagi skor soal secara merata? Poin soal yang sudah ada akan berubah.')) return;
        setNormalizeLoading(true);
        try {
            const res = await fetch('/api/exams/questions/normalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId }),
            });
            if (!res.ok) throw new Error('Failed to normalize');
            alert('Skor soal telah dinormalisasi secara merata.');
            fetchQuestions();
        } catch (err) {
            alert('Gagal normalisasi: ' + err.message);
        } finally {
            setNormalizeLoading(false);
        }
    };

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

    const handleDeleteAll = async () => {
        setDeleteAllLoading(true);
        try {
            const res = await fetch('/api/exams/questions/delete-all', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to delete all questions');
            setShowDeleteAllModal(false);
            fetchQuestions();
        } catch (err) {
            setError(err.message);
        } finally {
            setDeleteAllLoading(false);
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

    // --- Drag and Drop Handlers ---
    const handleDragStart = (index) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragEnd = async () => {
        if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const reordered = [...questions];
        const [moved] = reordered.splice(draggedIndex, 1);
        reordered.splice(dragOverIndex, 0, moved);
        setQuestions(reordered);
        setDraggedIndex(null);
        setDragOverIndex(null);

        // Save new order to backend
        try {
            const orderedIds = reordered.map(q => q.id);
            await fetch('/api/exams/questions/reorder', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds }),
            });
        } catch (err) {
            console.error('Failed to save order:', err);
            fetchQuestions(); // Revert on error
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
            <DeleteAllModal
                isOpen={showDeleteAllModal}
                onClose={() => setShowDeleteAllModal(false)}
                onConfirm={handleDeleteAll}
                questionCount={questions.length}
                loading={deleteAllLoading}
            />
            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                examId={examId}
                examName={examName}
            />
            <div className="container mx-auto p-4 md:p-6">
                <Link 
                    href={`/dashboard/exams/manage/${examId}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-all active:scale-95"
                >
                    <ArrowLeft size={18} />
                    Kembali ke Pengaturan Ujian
                </Link>
                <div className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{examName ? `Kelola Soal: ${examName}` : 'Kelola Soal'}</h1>
                    </div>
                    <Link
                        href={`/dashboard/exams/preview/${examId}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-700 dark:hover:bg-amber-600 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-amber-200 dark:shadow-amber-900/30"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Preview Exam
                    </Link>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        {/* Scoring Configuration Panel */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 mb-8 overflow-hidden transition-all duration-300 hover:shadow-2xl">
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-1"></div>
                            <div className="p-6">
                                <button 
                                    onClick={() => setShowScoringSettings(!showScoringSettings)}
                                    className="w-full flex justify-between items-center group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-indigo-400 blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                            <div className="relative p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Pengaturan Penyekoran</h2>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Konfigurasi bobot dan distribusi nilai</p>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-full bg-slate-100 dark:bg-slate-700 transition-all ${showScoringSettings ? 'rotate-180 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-400'}`}>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </button>
                                
                                {showScoringSettings && (
                                    <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 fill-mode-both">
                                        <div className="grid grid-cols-1 gap-6">
                                            {/* Target Score Input */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Target Total Skor</label>
                                                </div>
                                                <div className="group relative">
                                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl opacity-0 group-focus-within:opacity-15 transition duration-300"></div>
                                                    <div className="relative">
                                                        <input 
                                                            type="number"
                                                            value={totalTargetScore}
                                                            onChange={(e) => setTotalTargetScore(parseFloat(e.target.value))}
                                                            className="w-full p-4 pl-12 border-2 border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                                                            placeholder="Contoh: 100"
                                                        />
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor shadow-sm"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 font-medium flex items-center gap-1.5">
                                                    <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                                    Target nilai akhir jika murid menjawab semua soal dengan benar.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Auto Distribute Toggle */}
                                        <div 
                                            onClick={() => setAutoDistribute(!autoDistribute)}
                                            className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer ${autoDistribute ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/50 shadow-sm shadow-indigo-100/50' : 'bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2.5 rounded-xl transition-colors ${autoDistribute ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                                </div>
                                                <div>
                                                    <div className="font-extrabold text-slate-700 dark:text-slate-200 text-sm tracking-tight">Otomatis Bagi Poin</div>
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Poin setiap soal akan dihitung otomatis.</div>
                                                </div>
                                            </div>
                                            <div 
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${autoDistribute ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${autoDistribute ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-3 pt-2">
                                            <button 
                                                onClick={handleSaveScoringSettings}
                                                disabled={savingSettings}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black rounded-xl transition-all shadow-xl shadow-indigo-200 dark:shadow-none disabled:bg-indigo-300 disabled:shadow-none"
                                            >
                                                {savingSettings ? (
                                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor text-white"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                                )}
                                                {savingSettings ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                                            </button>
                                            <button 
                                                onClick={handleNormalizePoints}
                                                disabled={normalizeLoading || questions.length === 0}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all disabled:opacity-50"
                                            >
                                                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                {normalizeLoading ? 'Memproses...' : 'Bagi Rata Sekarang'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 sticky top-24">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Add Questions</h2>
                            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
                                <button onClick={() => setActiveTab('manual')} className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'manual' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'}`}>
                                    Manual Input
                                </button>
                                <button onClick={() => setActiveTab('import')} className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'import' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300'}`}>
                                    Import ZIP
                                </button>
                            </div>

                            {activeTab === 'manual' && <ManualInputForm examId={examId} onQuestionAdded={fetchQuestions} />}
                            {activeTab === 'import' && <ImportWordForm examId={examId} onQuestionAdded={fetchQuestions} />}
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Existing Questions ({questions.length})</h2>
                                {questions.length > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowExportModal(true)}
                                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 border border-indigo-200 dark:border-slate-600 rounded-lg transition-colors"
                                        >
                                            <Icons.Download /> Export
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteAllModal(true)}
                                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 border border-red-200 dark:border-slate-600 rounded-lg transition-colors"
                                        >
                                            <Icons.TrashAll /> Hapus Semua
                                        </button>
                                    </div>
                                )}
                            </div>
                            {error && <p className="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-md">{error}</p>}
                            {loading ? <p className="text-slate-500 dark:text-slate-400 animate-pulse">Loading questions...</p> : (
                                <div className="space-y-2">
                                    {questions.length === 0 ? (
                                        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-lg">
                                            <p className="text-slate-500 dark:text-slate-400">No questions have been added yet.</p>
                                        </div>
                                    ) : (
                                        questions.map((q, index) => (
                                            <div
                                                key={q.id}
                                                draggable
                                                onDragStart={() => handleDragStart(index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragEnd={handleDragEnd}
                                                className={`p-4 border rounded-lg cursor-grab active:cursor-grabbing transition-all ${draggedIndex === index
                                                    ? 'opacity-50 border-indigo-400 bg-indigo-50'
                                                    : dragOverIndex === index
                                                        ? 'border-indigo-400 border-2 bg-indigo-50/50'
                                                        : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        <div className="pt-1 flex-shrink-0 cursor-grab">
                                                            <Icons.Grip />
                                                        </div>
                                                        <div className="prose dark:prose-invert max-w-none flex flex-col gap-1 flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                                                    {q.question_type.replace(/_/g, ' ')}
                                                                </span>
                                                                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                                                    {q.points} Poin
                                                                </span>
                                                                {q.scoring_strategy && q.scoring_strategy !== 'standard' && q.scoring_strategy !== 'essay_manual' && (
                                                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                                                                        {q.scoring_strategy.replace(/_/g, ' ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div dangerouslySetInnerHTML={{ __html: `<p><strong>Q${index + 1}:</strong> ${q.question_text}</p>` }} />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 flex-shrink-0 ml-4">
                                                        <button onClick={() => setEditingQuestion(q)} className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-slate-700"><Icons.Edit /></button>
                                                        <button onClick={() => handleDelete(q.id)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 rounded-full hover:bg-red-50 dark:hover:bg-slate-700"><Icons.Trash /></button>
                                                    </div>
                                                </div>
                                                <div className="mt-2 text-sm max-w-none ml-8">
                                                    {q.question_type === 'essay' ? (
                                                        <div className="pl-4 py-1 text-slate-500 italic">
                                                            Pilihan jawaban disembunyikan untuk tipe Esai.
                                                        </div>
                                                    ) : (
                                                        Object.entries(q.options).map(([key, value]) => {
                                                            const correctOptions = q.correct_option ? String(q.correct_option).split(',') : [];
                                                            const isCorrect = correctOptions.includes(key);
                                                            return (
                                                                <div key={key} className={`pl-4 flex items-center justify-between gap-4 w-full mt-1.5 p-2 rounded-lg transition-colors ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 font-extrabold text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30' : 'text-slate-600 dark:text-slate-400'}`}>
                                                                    <div className="flex gap-3 items-start flex-1">
                                                                        <span className={`${isCorrect ? 'text-green-600' : 'text-slate-400 font-bold'}`}>{key}.</span>
                                                                        <div className="prose dark:prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: value }} />
                                                                    </div>
                                                                    {isCorrect && (
                                                                        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-green-500 text-white rounded-full shadow-sm">
                                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
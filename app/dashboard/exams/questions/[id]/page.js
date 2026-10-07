'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { uploadBase64Images } from '@/app/lib/utils';
import { ArrowLeft, Database, DownloadCloud, Plus, Search, Pencil, Trash2, GripVertical, Check, X, ChevronRight, AlertTriangle, Eye, Upload, FileText, Library, Sparkles, Scale, GitCompareArrows } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import BankPickerModal from '@/app/components/bank/BankPickerModal';

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
    Warning: ({ className = 'w-12 h-12 text-red-500' }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.997L13.732 4.832c-.77-1.333-2.694-1.333-3.464 0L3.34 16.003c-.77 1.33.192 2.997 1.732 2.997z" /></svg>,
    Download: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    BookOpen: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
};

// --- Labels for question types (dipakai di seluruh halaman) ---
const QUESTION_TYPE_LABEL = {
    multiple_choice: 'Pilihan Ganda',
    multiple_choice_complex: 'Pilihan Ganda Kompleks',
    true_false: 'Benar / Salah',
    matching: 'Menjodohkan',
    essay: 'Esai'
};

// --- Deskripsi singkat tiap tipe (bantu user awam memilih) ---
const QUESTION_TYPE_HINT = {
    multiple_choice: 'Satu jawaban benar',
    multiple_choice_complex: 'Bisa lebih dari satu benar',
    true_false: 'Hanya dua pilihan',
    matching: 'Pasangkan kiri ke kanan',
    essay: 'Jawaban panjang, dinilai guru'
};

// --- Cara menghitung nilai, dalam bahasa manusia (bukan kode internal) ---
const SCORING_LABELS = {
    pgk_partial: { label: 'Ada penalti', desc: 'Jawaban salah mengurangi poin. Paling umum.' },
    pgk_strict: { label: 'Wajib semua benar', desc: 'Poin penuh hanya jika semua benar dan tidak ada yang salah.' },
    pgk_any: { label: 'Minimal satu benar', desc: 'Poin penuh jika minimal satu benar dan tidak ada yang salah.' },
    pgk_additive: { label: 'Tanpa penalti', desc: 'Setiap jawaban benar menambah poin, yang salah tidak mengurangi.' },
    essay_manual: { label: 'Dinilai guru', desc: 'Anda yang menilai sendiri setelah ujian selesai.' },
    essay_keywords: { label: 'Kata kunci (proporsional)', desc: 'Semakin banyak kata kunci cocok, semakin tinggi nilainya.' },
    essay_any_keyword: { label: 'Minimal satu kata kunci', desc: 'Poin penuh hanya jika satu kata kunci saja sudah cocok.' },
    essay_strict_keywords: { label: 'Semua kata kunci', desc: 'Poin penuh hanya jika semua kata kunci ditemukan.' }
};

// Nilai dari editor Jodit berupa HTML, jadi <p><br></p> dianggap "terisi" kalau dicek dengan trim()
const hasContent = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

const EDIT_INPUT_CLASS =
    'w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-colors';

// --- Shell modal yang dipakai semua dialog di halaman ini ---
// Stack ini dipakai supaya tombol Escape hanya menutup modal yang paling atas
// (penting saat modal pratinjau dibuka dari dalam modal import).
const modalStack = [];

function ModalShell({ title, description, onClose, children, footer, size = 'md' }) {
    const sizeCls = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-5xl' }[size] || 'sm:max-w-lg';

    useEffect(() => {
        const id = Symbol('modal');
        modalStack.push(id);

        const onKeyDown = (e) => {
            if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            const idx = modalStack.indexOf(id);
            if (idx > -1) modalStack.splice(idx, 1);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className={`relative w-full ${sizeCls} sm:max-h-[90vh] h-full sm:h-auto bg-white dark:bg-slate-900 sm:rounded-2xl shadow-xl flex flex-col overflow-hidden`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Tutup"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">{children}</div>

                {footer && (
                    <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

function FormSection({ title, hint, children, right }) {
    return (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h3>
                    {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
                </div>
                {right}
            </div>
            {children}
        </section>
    );
}

function StrategyPicker({ name, value, onChange, options, accent = 'slate' }) {
    const activeCls = accent === 'indigo'
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
        : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
    const dotCls = accent === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {options.map(opt => {
                const isActive = value === opt.value;
                return (
                    <label
                        key={opt.value}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${isActive
                            ? activeCls
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
                    >
                        <input
                            type="radio"
                            name={name}
                            checked={isActive}
                            onChange={() => onChange(opt.value)}
                            className="sr-only"
                        />
                        <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? dotCls + ' border-transparent' : 'border-slate-300 dark:border-slate-600'}`}>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{opt.label}</span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.sub}</span>
                        </span>
                    </label>
                );
            })}
        </div>
    );
}

// --- Editor Configuration ---
const useJoditConfig = () => {
    return useMemo(() => ({
        readonly: false,
        height: 'auto',
        minHeight: 140,
        insertImageAsBase64URL: true, // Insert images as Base64
        hidePoweredByJodit: true,
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
    const [matchingPairs, setMatchingPairs] = useState([{ id: 1, p: '', r: '' }]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const nextOptionId = useRef(3);
    const nextPairId = useRef(2);

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
        setMatchingPairs([{ id: 1, p: '', r: '' }]);
        nextPairId.current = 2;
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
        } else if (type === 'matching') {
            setOptions([]);
            setMatchingPairs([{ id: 1, p: '', r: '' }]);
            setCorrectOption('MATCHING');
            setScoringStrategy('standard');
        }
    };

    const addPair = () => {
        setMatchingPairs(prev => [...prev, { id: nextPairId.current++, p: '', r: '' }]);
    };

    const removePair = (id) => {
        setMatchingPairs(prev => prev.filter(p => p.id !== id));
    };

    const handlePairChange = (id, field, value) => {
        setMatchingPairs(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasContent(questionText)) {
            setError('Pertanyaan masih kosong.');
            return;
        }
        if (questionType === 'matching') {
            if (matchingPairs.some(p => !hasContent(p.p) || !hasContent(p.r))) {
                setError('Ada pasangan yang belum lengkap.');
                return;
            }
        } else if (questionType !== 'essay' && options.some(o => !hasContent(o.value))) {
            setError('Ada pilihan jawaban yang masih kosong.');
            return;
        }

        if (questionType === 'multiple_choice' && !hasContent(options.find(o => o.key === correctOption)?.value)) {
            setError('Kunci jawaban menunjuk ke pilihan yang masih kosong.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            // Process content to upload Base64 images and get URLs
            const processedQuestionText = await uploadBase64Images(questionText);
            
            let optionsForApi = {};

            if (questionType === 'matching') {
                const processedPairs = await Promise.all(
                    matchingPairs.map(async (pair) => ({
                        id: pair.id,
                        p: await uploadBase64Images(pair.p),
                        r: await uploadBase64Images(pair.r),
                    }))
                );
                optionsForApi = { pairs: processedPairs };
            } else {
                const processedOptions = await Promise.all(
                    options.map(async (opt) => ({
                        ...opt,
                        value: await uploadBase64Images(opt.value),
                    }))
                );
                optionsForApi = processedOptions.reduce((acc, opt) => {
                    acc[opt.key] = opt.value;
                    return acc;
                }, {});
            }

            const finalCorrectOption = questionType === 'multiple_choice_complex' 
                ? correctOptions.sort().join(',') 
                : (questionType === 'matching' ? 'MATCHING' : correctOption);

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

const hasError = !hasContent(questionText)
        || (questionType === 'matching' && matchingPairs.some(p => !hasContent(p.p) || !hasContent(p.r)))
        || (questionType !== 'essay' && questionType !== 'matching' && options.some(o => !hasContent(o.value)));

    const StepHeader = ({ n, title, hint }) => (
        <div className="flex items-baseline gap-2.5 mb-3">
            <span className="shrink-0 w-5 h-5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold flex items-center justify-center tabular-nums">
                {n}
            </span>
            <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
                {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="-mt-1">
            {/* 1. Tipe soal */}
            <section className="mb-6">
                <StepHeader n={1} title="Pilih tipe soal" hint="Menentukan forme soal dan cara penilaiannya." />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {Object.keys(QUESTION_TYPE_LABEL).map(type => {
                        const active = questionType === type;
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => handleTypeChange(type)}
                                aria-pressed={active}
                                className={`text-left p-3 rounded-xl border transition-colors ${active
                                    ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-900'
                                    }`}
                            >
                                <p className="text-[13px] font-semibold leading-tight">{QUESTION_TYPE_LABEL[type]}</p>
                                <p className={`text-[11px] leading-tight mt-0.5 ${active ? 'opacity-70' : 'text-slate-400'}`}>
                                    {QUESTION_TYPE_HINT[type]}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Kolom utama */}
                <div className="lg:col-span-2 space-y-6 min-w-0">
                    {/* 2. Pertanyaan */}
                    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <StepHeader n={2} title="Tulis pertanyaannya" hint="Boleh teks biasa, gambar, tabel, atau rumus." />
                        <JoditEditorWithUpload
                            value={questionText}
                            onBlur={newContent => setQuestionText(newContent)}
                        />
                        {!hasContent(questionText) && hasError && (
                            <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Pertanyaan masih kosong.</p>
                        )}
                    </section>

                    {/* 3. Pilihan jawaban + kunci */}
                    {questionType !== 'essay' && questionType !== 'matching' && (
                        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <StepHeader
                                    n={3}
                                    title="Buat pilihan jawaban"
                                    hint={questionType === 'multiple_choice_complex'
                                        ? 'Centang kunci di sebelah kiri. Boleh lebih dari satu.'
                                        : questionType === 'true_false'
                                            ? 'Pilihan Benar/Salah sudah otomatis, tinggal tentukan kuncinya.'
                                            : 'Pilih satu kunci di sebelah kiri setiap opsi.'}
                                />
                                {questionType !== 'true_false' && (
                                    <button
                                        type="button"
                                        onClick={addOption}
                                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 transition-colors"
                                    >
                                        <Plus size={14} />
                                        <span className="hidden sm:inline">Tambah pilihan</span>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {options.map(opt => {
                                    const isKey = questionType === 'multiple_choice_complex'
                                        ? correctOptions.includes(opt.key)
                                        : correctOption === opt.key;

                                    return (
                                        <div
                                            key={opt.id}
                                            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isKey
                                                ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5'
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                                                }`}
                                        >
                                            <label className="shrink-0 cursor-pointer select-none pt-1 flex flex-col items-center gap-1">
                                                <input
                                                    type={questionType === 'multiple_choice_complex' ? 'checkbox' : 'radio'}
                                                    name="new_correct_choice"
                                                    className="sr-only"
                                                    checked={isKey}
                                                    onChange={() => {
                                                        if (questionType === 'multiple_choice_complex') {
                                                            setCorrectOptions(prev => prev.includes(opt.key)
                                                                ? prev.filter(k => k !== opt.key)
                                                                : [...prev, opt.key]);
                                                        } else {
                                                            setCorrectOption(opt.key);
                                                        }
                                                    }}
                                                />
                                                <span className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors ${isKey
                                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                                                    }`}>
                                                    {isKey ? <Check size={15} strokeWidth={3} /> : <span className="text-xs font-bold">{opt.key}</span>}
                                                </span>
                                                <span className={`text-[9px] font-semibold ${isKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                    {isKey ? 'Kunci' : 'Kunci?'}
                                                </span>
                                            </label>

                                            <div className="flex-1 min-w-0">
                                                {questionType === 'true_false' ? (
                                                    <div className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">
                                                        {opt.value}
                                                    </div>
                                                ) : (
                                                    <JoditEditorWithUpload value={opt.value} onBlur={newContent => handleOptionChange(opt.id, newContent)} />
                                                )}
                                            </div>

                                            {options.length > 2 && questionType !== 'true_false' && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeOption(opt.id)}
                                                    aria-label={`Hapus opsi ${opt.key}`}
                                                    className="shrink-0 p-1.5 mt-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {questionType !== 'true_false' && options.some(o => !hasContent(o.value)) && (
                                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Ada pilihan yang masih kosong.</p>
                            )}
                        </section>
                    )}

                    {/* 3. Pasangan */}
                    {questionType === 'matching' && (
                        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <StepHeader n={3} title="Buat pasangan" hint="Tulis sisi kiri, lalu isi sisi kanan yang tepat." />
                                <button
                                    type="button"
                                    onClick={addPair}
                                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 transition-colors"
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">Tambah pasangan</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                {matchingPairs.map((pair, index) => (
                                    <div key={pair.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                                                Pasangan {index + 1}
                                            </span>
                                            {matchingPairs.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePair(pair.id)}
                                                    aria-label={`Hapus pasangan ${index + 1}`}
                                                    className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                                            <JoditEditorWithUpload value={pair.p} onBlur={newContent => handlePairChange(pair.id, 'p', newContent)} />
                                            <span className="hidden sm:flex items-center justify-center text-slate-300 dark:text-slate-600">
                                                <GitCompareArrows size={16} />
                                            </span>
                                            <JoditEditorWithUpload value={pair.r} onBlur={newContent => handlePairChange(pair.id, 'r', newContent)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Kolom pengaturan */}
                <aside className="space-y-4">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <label htmlFor="new-question-points" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Poin
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Bobot soal ini saat penilaian.</p>
                        <input
                            id="new-question-points"
                            type="number"
                            min="0"
                            step="any"
                            value={points}
                            onChange={(e) => setPoints(parseFloat(e.target.value))}
                            className={EDIT_INPUT_CLASS}
                        />
                    </div>

                    {questionType === 'essay' && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <label htmlFor="new-question-keywords" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Kata kunci
                            </label>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                                Pisahkan dengan koma. Dipakai jika penilaian otomatis aktif.
                            </p>
                            <input
                                id="new-question-keywords"
                                type="text"
                                placeholder="misal: ekosistem, lingkungan"
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                className={EDIT_INPUT_CLASS}
                            />
                        </div>
                    )}

                    {(questionType === 'multiple_choice_complex' || questionType === 'essay') && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cara menghitung nilai</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                                {questionType === 'essay' ? 'Esai' : 'Pilihan ganda kompleks'} — pilih cara penilaian.
                            </p>

                            <div className="space-y-1.5">
                                {(questionType === 'essay'
                                    ? ['essay_manual', 'essay_keywords', 'essay_any_keyword', 'essay_strict_keywords']
                                    : ['pgk_partial', 'pgk_strict', 'pgk_any', 'pgk_additive']
                                ).map(value => {
                                    const meta = SCORING_LABELS[value];
                                    const active = scoringStrategy === value;
                                    return (
                                        <label
                                            key={value}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${active
                                                ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name={questionType === 'essay' ? 'essay_strategy' : 'pgk_strategy'}
                                                className="sr-only"
                                                checked={active}
                                                onChange={() => setScoringStrategy(value)}
                                            />
                                            <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${active
                                                ? 'border-slate-900 dark:border-white'
                                                : 'border-slate-300 dark:border-slate-600'
                                                }`}>
                                                {active && <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white" />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{meta.label}</span>
                                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{meta.desc}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Setelah disimpan</p>
                        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                            Form akan dikosongkan, siap untuk soal berikutnya.
                        </p>
                    </div>
                </aside>
            </div>

            {error && (
                <div className="mt-5 flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                    <AlertTriangle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                    <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                    {hasError ? 'Lengkapi bagian yang masih kosong.' : 'Siap disimpan ke daftar soal.'}
                </p>
                <button
                    type="submit"
                    disabled={loading}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-[0.98]"
                >
                    {loading ? (
                        <>
                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Menyimpan
                        </>
                    ) : (
                        <>
                            <Plus size={15} />
                            Simpan Soal
                        </>
                    )}
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

        if (question.question_type === 'matching') return [];

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

    // Initialize matchingPairs from specialized JSON structure
    const initialPairs = useMemo(() => {
        if (question.question_type !== 'matching') return [{ id: 1, p: '', r: '' }];
        try {
            // Handle both string and pre-parsed object from fetchQuestions
            const optData = question.options;
            const parsed = typeof optData === 'string' ? JSON.parse(optData) : (optData || {});
            return Array.isArray(parsed.pairs) ? parsed.pairs : [{ id: 1, p: '', r: '' }];
        } catch (e) {
            console.error("Failed to parse matching pairs:", e);
            return [{ id: 1, p: '', r: '' }];
        }
    }, [question.options, question.question_type]);

    const [matchingPairs, setMatchingPairs] = useState(initialPairs);
    const nextOptionId = useRef(options.length > 0 ? Math.max(...options.map(o => o.id)) + 1 : 1);
    const nextPairId = useRef(matchingPairs.length > 0 ? Math.max(...matchingPairs.map(p => p.id)) + 1 : 1);

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
        } else if (type === 'matching') {
            setOptions([]);
            if (matchingPairs.length === 0) setMatchingPairs([{ id: 1, p: '', r: '' }]);
            setCorrectOption('MATCHING');
            setCorrectOptions(['MATCHING']);
            setScoringStrategy('standard');
        }
    };

    const addPair = () => {
        setMatchingPairs(prev => [...prev, { id: nextPairId.current++, p: '', r: '' }]);
    };

    const removePair = (id) => {
        setMatchingPairs(prev => prev.filter(p => p.id !== id));
    };

    const handlePairChange = (id, field, value) => {
        setMatchingPairs(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleSave = async () => {
        if (!hasContent(questionText)) {
            setError('Pertanyaan masih kosong.');
            return;
        }

        if (questionType === 'matching') {
            if (matchingPairs.some(p => !hasContent(p.p) || !hasContent(p.r))) {
                setError('Ada pasangan yang belum lengkap.');
                return;
            }
        } else if (questionType !== 'essay' && options.some(o => !hasContent(o.value))) {
            setError('Ada pilihan jawaban yang masih kosong.');
            return;
        }

        if (questionType === 'multiple_choice' && !hasContent(options.find(o => o.key === correctOption)?.value)) {
            setError('Kunci jawaban menunjuk ke pilihan yang masih kosong.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Process content to upload Base64 images and get URLs
            const processedQuestionText = await uploadBase64Images(questionText);
            
            let optionsForApi = {};

            if (questionType === 'matching') {
                const processedPairs = await Promise.all(
                    matchingPairs.map(async (pair) => ({
                        id: pair.id,
                        p: await uploadBase64Images(pair.p),
                        r: await uploadBase64Images(pair.r),
                    }))
                );
                optionsForApi = { pairs: processedPairs };
            } else {
                const processedOptions = await Promise.all(
                    options.map(async (opt) => ({
                        ...opt,
                        value: await uploadBase64Images(opt.value),
                    }))
                );
                optionsForApi = processedOptions.reduce((acc, opt) => {
                    acc[opt.key] = opt.value;
                    return acc;
                }, {});
            }

            const finalCorrectOption = questionType === 'multiple_choice_complex' 
                ? correctOptions.sort().join(',') 
                : (questionType === 'matching' ? 'MATCHING' : correctOption);

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

    const hasError = !hasContent(questionText)
        || (questionType === 'matching' && matchingPairs.some(p => !hasContent(p.p) || !hasContent(p.r)))
        || (questionType !== 'essay' && questionType !== 'matching' && options.some(o => !hasContent(o.value)));

    const StepHeader = ({ n, title, hint }) => (
        <div className="flex items-baseline gap-2.5 mb-3">
            <span className="shrink-0 w-5 h-5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold flex items-center justify-center tabular-nums">
                {n}
            </span>
            <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
                {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-6xl h-[94vh] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
                {/* Grip mobile */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                    <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                </div>

                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center">
                            <Icons.Edit />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">Sunting Soal</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {QUESTION_TYPE_LABEL[questionType] || questionType} · {points} poin
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        aria-label="Tutup"
                        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <Icons.Close />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-grow overflow-y-auto px-5 sm:px-6 py-5 custom-scrollbar bg-slate-50 dark:bg-slate-950/40">
                    {/* 1. Tipe soal */}
                    <section className="mb-6">
                        <StepHeader n={1} title="Tipe soal" hint="Mengubah tipe akan menyesuaikan form di bawah." />
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                            {Object.keys(QUESTION_TYPE_LABEL).map(type => {
                                const active = questionType === type;
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleTypeChange(type)}
                                        aria-pressed={active}
                                        className={`text-left p-3 rounded-xl border transition-colors ${active
                                            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-900'
                                            }`}
                                    >
                                        <p className="text-[13px] font-semibold leading-tight">{QUESTION_TYPE_LABEL[type]}</p>
                                        <p className={`text-[11px] leading-tight mt-0.5 ${active ? 'opacity-70' : 'text-slate-400'}`}>
                                            {QUESTION_TYPE_HINT[type]}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Kolom utama */}
                        <div className="lg:col-span-2 space-y-6 min-w-0">
                            {/* 2. Pertanyaan */}
                            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                                <StepHeader n={2} title="Isi pertanyaan" hint="Boleh teks biasa, gambar, tabel, atau rumus." />
                                <JoditEditorWithUpload
                                    value={questionText}
                                    onBlur={newContent => setQuestionText(newContent)}
                                />
                                {!hasContent(questionText) && hasError && (
                                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Pertanyaan masih kosong.</p>
                                )}
                            </section>

                            {/* 3. Pilihan jawaban + kunci (PG / B-S) */}
                            {questionType !== 'essay' && questionType !== 'matching' && (
                                <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <StepHeader
                                            n={3}
                                            title="Pilihan jawaban & kunci"
                                            hint={questionType === 'multiple_choice_complex'
                                                ? 'Centang kunci di sebelah kiri. Boleh lebih dari satu.'
                                                : 'Pilih satu kunci di sebelah kiri setiap opsi.'}
                                        />
                                        {questionType !== 'true_false' && (
                                            <button
                                                type="button"
                                                onClick={addOption}
                                                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 transition-colors"
                                            >
                                                <Icons.Plus />
                                                <span className="hidden sm:inline">Tambah pilihan</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {options.map(opt => {
                                            const isKey = questionType === 'multiple_choice_complex'
                                                ? correctOptions.includes(opt.key)
                                                : correctOption === opt.key;

                                            return (
                                                <div
                                                    key={opt.id}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isKey
                                                        ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5'
                                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                                                        }`}
                                                >
                                                    <label className="shrink-0 cursor-pointer select-none pt-1 flex flex-col items-center gap-1">
                                                        <input
                                                            type={questionType === 'multiple_choice_complex' ? 'checkbox' : 'radio'}
                                                            name="edit_correct_choice"
                                                            className="sr-only"
                                                            checked={isKey}
                                                            onChange={(e) => {
                                                                if (questionType === 'multiple_choice_complex') {
                                                                    if (e.target.checked) setCorrectOptions([...correctOptions, opt.key]);
                                                                    else setCorrectOptions(correctOptions.filter(k => k !== opt.key));
                                                                } else {
                                                                    setCorrectOption(opt.key);
                                                                }
                                                            }}
                                                        />
                                                        <span className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors ${isKey
                                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                                                            }`}>
                                                            {isKey ? (
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                            ) : (
                                                                <span className="text-xs font-bold">{opt.key}</span>
                                                            )}
                                                        </span>
                                                        <span className={`text-[9px] font-semibold ${isKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                            {isKey ? 'Kunci' : 'Kunci?'}
                                                        </span>
                                                    </label>

                                                    <div className="flex-1 min-w-0">
                                                        {questionType === 'true_false' ? (
                                                            <div className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">
                                                                {opt.value}
                                                            </div>
                                                        ) : (
                                                            <JoditEditorWithUpload value={opt.value} onBlur={newContent => handleOptionChange(opt.id, newContent)} />
                                                        )}
                                                    </div>

                                                    {options.length > 2 && questionType !== 'true_false' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeOption(opt.id)}
                                                            aria-label={`Hapus opsi ${opt.key}`}
                                                            className="shrink-0 p-1.5 mt-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {questionType !== 'true_false' && options.some(o => !hasContent(o.value)) && (
                                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Ada pilihan yang masih kosong.</p>
                                    )}
                                </section>
                            )}

                            {/* 3. Pasangan (matching) */}
                            {questionType === 'matching' && (
                                <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <StepHeader n={3} title="Pasangan" hint="Tulis sisi kiri, lalu isi sisi kanan yang tepat." />
                                        <button
                                            type="button"
                                            onClick={addPair}
                                            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 transition-colors"
                                        >
                                            <Icons.Plus />
                                            <span className="hidden sm:inline">Tambah pasangan</span>
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {matchingPairs.map((pair, index) => (
                                            <div key={pair.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                                                        Pasangan {index + 1}
                                                    </span>
                                                    {matchingPairs.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removePair(pair.id)}
                                                            aria-label={`Hapus pasangan ${index + 1}`}
                                                            className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                                                    <JoditEditorWithUpload value={pair.p} onBlur={newContent => handlePairChange(pair.id, 'p', newContent)} />
                                                    <span className="hidden sm:flex items-center justify-center text-slate-300 dark:text-slate-600">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                                    </span>
                                                    <JoditEditorWithUpload value={pair.r} onBlur={newContent => handlePairChange(pair.id, 'r', newContent)} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Kolom pengaturan */}
                        <aside className="space-y-4">
                            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                <label htmlFor="edit-points" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Poin
                                </label>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Bobot soal ini saat penilaian.</p>
                                <input
                                    id="edit-points"
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={points}
                                    onChange={(e) => setPoints(parseFloat(e.target.value))}
                                    className={EDIT_INPUT_CLASS}
                                />
                            </div>

                            {questionType === 'essay' && (
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <label htmlFor="edit-keywords" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Kata kunci
                                    </label>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Pisahkan dengan koma.</p>
                                    <input
                                        id="edit-keywords"
                                        type="text"
                                        placeholder="misal: sel, membran, inti"
                                        value={keywords}
                                        onChange={(e) => setKeywords(e.target.value)}
                                        className={EDIT_INPUT_CLASS}
                                    />
                                </div>
                            )}

                            {(questionType === 'multiple_choice_complex' || questionType === 'essay') && (
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cara menghitung nilai</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                                        {questionType === 'essay' ? 'Esai' : 'Pilihan ganda kompleks'} — pilih cara penilaian.
                                    </p>

                                    <div className="space-y-1.5">
                                        {(['essay_manual', 'essay_keywords', 'essay_any_keyword', 'essay_strict_keywords'].includes(scoringStrategy)
                                            ? ['essay_manual', 'essay_keywords', 'essay_any_keyword', 'essay_strict_keywords']
                                            : ['pgk_partial', 'pgk_strict', 'pgk_any', 'pgk_additive']
                                        ).map(value => {
                                            const meta = SCORING_LABELS[value];
                                            const active = scoringStrategy === value;
                                            return (
                                                <label
                                                    key={value}
                                                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${active
                                                        ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                                                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="edit_scoring_strategy"
                                                        className="sr-only"
                                                        checked={active}
                                                        onChange={() => setScoringStrategy(value)}
                                                    />
                                                    <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${active
                                                        ? 'border-slate-900 dark:border-white'
                                                        : 'border-slate-300 dark:border-slate-600'
                                                        }`}>
                                                        {active && <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white" />}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{meta.label}</span>
                                                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{meta.desc}</span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Ringkasan</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                                    {points} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">poin</span>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                    Tipe: <span className="font-semibold text-slate-700 dark:text-slate-300">{QUESTION_TYPE_LABEL[questionType]}</span>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Penilaian: <span className="font-semibold text-slate-700 dark:text-slate-300">{SCORING_LABELS[scoringStrategy]?.label || scoringStrategy}</span>
                                </p>
                            </div>
                        </aside>
                    </div>

                    {error && (
                        <div className="mt-5 flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                            <Icons.Warning className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                            <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white dark:bg-slate-900 px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                        {hasError ? 'Lengkapi bagian yang masih kosong.' : 'Siap disimpan.'}
                    </p>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-[0.98]"
                        >
                            {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white dark:border-slate-900/40 dark:border-t-slate-900 rounded-full animate-spin" />}
                            {loading ? 'Menyimpan' : 'Simpan Perubahan'}
                        </button>
                    </div>
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
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        const nameLower = selectedFile.name.toLowerCase();
        if (nameLower.endsWith('.zip') || nameLower.endsWith('.docx')) {
            setFile(selectedFile);
            setError('');
        } else {
            setFile(null);
            setError('Please select a .zip or .docx file.');
        }
    };

    const handlePreview = async () => {
        if (!file) return;
        setPreviewLoading(true);
        setError('');
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await fetch('/api/exams/questions/preview', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Gagal memproses pratinjau file.');
            }
            setPreviewHtml(data.html);
            setShowPreviewModal(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setPreviewLoading(false);
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
            {/* Panduan & template */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">Belum paham format file?</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Buka panduan soal untuk melihat contoh format dan aturan penilaian.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href="/dashboard/exams/questions/panduan"
                        target="_blank"
                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Buka Panduan
                    </Link>
                    <a
                        href="/Template Soal Rushless.docx"
                        download
                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                    >
                        Unduh Template
                    </a>
                </div>
            </div>

            {/* Upload area */}
            <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Pilih file (.docx atau .zip)</p>
                <label className="flex flex-col items-center justify-center w-full px-4 py-10 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
                    <span className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-2">
                        <Upload size={18} />
                    </span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 text-center break-all px-2">
                        {file ? file.name : 'Klik untuk memilih file'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {file ? `${(file.size / 1024).toFixed(0)} KB` : 'Mendukung file .docx dan .zip hasil ekspor Word.'}
                    </span>
                    <input
                        type="file"
                        className="hidden"
                        accept=".docx,.zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed"
                        onChange={handleFileChange}
                    />
                </label>
            </div>

            {error && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/60">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-500" />
                    <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}
            {success && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/60">
                    <Check size={15} className="shrink-0 mt-0.5 text-emerald-500" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">{success}</p>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {file ? 'Cek dulu pratinjau jika perlu sebelum mengimpor.' : 'Pilih file terlebih dahulu.'}
                </p>
                <div className="flex items-center gap-2">
                    {file && (
                        <button
                            type="button"
                            disabled={previewLoading || loading}
                            onClick={handlePreview}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            {previewLoading ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <Eye size={15} />}
                            {previewLoading ? 'Memuat...' : 'Lihat Pratinjau'}
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={!file || loading || previewLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white dark:border-slate-900/40 dark:border-t-slate-900 rounded-full animate-spin" />}
                        {loading ? 'Mengimpor...' : 'Impor Soal'}
                    </button>
                </div>
            </div>

            {showPreviewModal && (
                <ModalShell
                    title="Pratinjau Dokumen"
                    description={file?.name}
                    onClose={() => setShowPreviewModal(false)}
                    size="xl"
                    footer={(
                        <>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Pastikan isi file sudah benar sebelum diimpor.</p>
                            <button
                                type="button"
                                onClick={() => setShowPreviewModal(false)}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Tutup
                            </button>
                        </>
                    )}
                >
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 prose prose-slate dark:prose-invert max-w-none">
                        <div className="parsed-html-preview outline-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                </ModalShell>
            )}
        </form>
    );
};

// --- Delete All Confirmation Modal ---
const DeleteAllModal = ({ isOpen, onClose, onConfirm, questionCount, loading }) => {
    if (!isOpen) return null;
    return (
        <ModalShell
            title="Hapus Semua Soal?"
            description="Tindakan ini permanen dan tidak bisa dibatalkan."
            onClose={onClose}
            footer={(
                <>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {questionCount} soal akan dihapus dari ujian ini.
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            Batal
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                            {loading ? 'Menghapus...' : 'Ya, Hapus Semua'}
                        </button>
                    </div>
                </>
            )}
        >
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/60">
                <AlertTriangle size={18} className="shrink-0 text-red-500" />
                <p className="text-sm text-red-800 dark:text-red-300">
                    Seluruh isi soal beserta kunci jawabannya akan dihapus.
                    Ujian ini akan kembali ke kondisi tanpa soal.
                </p>
            </div>
        </ModalShell>
    );
};

// --- Export Questions Modal ---
const ExportModal = ({ isOpen, onClose, examId, examName }) => {
    const [exportMode, setExportMode] = useState('questions_and_answers');
    const [exportFormat, setExportFormat] = useState('standard');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/exams/questions/export?exam_id=${examId}&mode=${exportMode}&format=${exportFormat}`);
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
            toast.error('Export gagal: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const modes = [
        { value: 'questions_and_answers', label: 'Soal + Jawaban', desc: 'Soal lengkap dengan penanda jawaban benar.' },
        { value: 'questions_only', label: 'Soal Saja', desc: 'Soal tanpa menandai jawaban benar. Bisa dipakai untuk tryout.' },
        { value: 'answers_only', label: 'Jawaban Saja', desc: 'Kunci jawaban saja, misalnya 1. A, 2. B, dan seterusnya.' }
    ];

    return (
        <ModalShell
            title="Export Soal"
            description="Unduh soal ujian ini dalam format Word (.docx)."
            onClose={onClose}
            footer={(
                <>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        Format: {exportFormat === 'standard' ? 'Standar' : 'Rushless (parser)'}
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            Batal
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white dark:border-slate-900/40 dark:border-t-slate-900 rounded-full animate-spin" /> : <DownloadCloud size={15} />}
                            {loading ? 'Menyiapkan...' : 'Unduh Word'}
                        </button>
                    </div>
                </>
            )}
        >
            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Isi file</p>
                {modes.map(m => {
                    const isActive = exportMode === m.value;
                    return (
                        <button
                            key={m.value}
                            type="button"
                            onClick={() => {
                                setExportMode(m.value);
                                if (m.value !== 'questions_and_answers') setExportFormat('standard');
                            }}
                            aria-pressed={isActive}
                            className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${isActive
                                ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
                        >
                            <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-transparent bg-white/90 dark:bg-slate-900' : 'border-slate-300 dark:border-slate-600'}`}>
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white" />}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold">{m.label}</span>
                                <span className={`block text-xs mt-0.5 ${isActive ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>{m.desc}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {exportMode === 'questions_and_answers' && (
                <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Format penulisan</p>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { value: 'standard', label: 'Biasa', desc: 'Kunci jawaban di akhir soal.' },
                            { value: 'rushless', label: 'Rushless', desc: 'Bertanda bintang, bisa di-import lagi.' }
                        ].map(f => {
                            const isActive = exportFormat === f.value;
                            return (
                                <button
                                    key={f.value}
                                    type="button"
                                    onClick={() => setExportFormat(f.value)}
                                    aria-pressed={isActive}
                                    className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${isActive
                                        ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
                                >
                                    <span className="block text-xs font-semibold">{f.label}</span>
                                    <span className={`block text-[11px] mt-0.5 ${isActive ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>{f.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </ModalShell>
    );
};

export default function ManageQuestionsPage() {
    const { id: examId } = useParams();
        const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);
    const [isBankExportOpen, setIsBankExportOpen] = useState(false);
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

    // Filter & Beginners aid
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showGuide, setShowGuide] = useState(true);
    const [addModal, setAddModal] = useState(null); // 'manual' | 'import' | null

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

                // Skip normalization for matching questions - they use a specialized structure
                if (q.question_type === 'matching') {
                    return { ...q, options: optionsObject };
                }

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
            toast.success('Pengaturan penyekoran berhasil disimpan.');
            fetchQuestions();
        } catch (err) {
            toast.error('Gagal menyimpan: ' + err.message);
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
            toast.success('Skor soal telah dinormalisasi secara merata.');
            fetchQuestions();
        } catch (err) {
            toast.error('Gagal normalisasi: ' + err.message);
        } finally {
            setNormalizeLoading(false);
        }
    };

    const handleDelete = async (questionId) => {
        if (!window.confirm('Hapus soal ini? Tindakan ini tidak bisa dibatalkan.')) return;
        try {
            const res = await fetch('/api/exams/questions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: questionId }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to delete question');
            toast.success('Soal berhasil dihapus.');
            fetchQuestions();
        } catch (err) {
            toast.error('Gagal menghapus soal: ' + err.message);
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
            toast.success('Perubahan soal berhasil disimpan.');
            fetchQuestions();
        } catch (err) {
            toast.error('Gagal menyimpan perubahan: ' + err.message);
        }
    };

    // --- Derived values untuk daftar soal & ringkasan ---

const totalPoints = useMemo(
        () => questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
        [questions]
    );

    const typeCounts = useMemo(() => {
        return questions.reduce((acc, q) => {
            acc[q.question_type] = (acc[q.question_type] || 0) + 1;
            return acc;
        }, {});
    }, [questions]);

    const filteredQuestions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return questions.filter(q => {
            const typeMatch = typeFilter === 'all' || q.question_type === typeFilter;
            const textMatch = !query || String(q.question_text || '').toLowerCase().includes(query);
            return typeMatch && textMatch;
        });
    }, [questions, searchQuery, typeFilter]);

    const targetPoints = Number(totalTargetScore) || 0;
    const pointsMismatch = targetPoints > 0 && questions.length > 0 && Math.abs(totalPoints - targetPoints) > 0.001;

    const typeOptions = useMemo(
        () => Object.keys(typeCounts).map(t => ({ value: t, label: QUESTION_TYPE_LABEL[t] || t, count: typeCounts[t] })),
        [typeCounts]
    );

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
        <div className="space-y-5">
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

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                <div className="min-w-0">
                    <Link
                        href={`/dashboard/exams/manage/${examId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Kembali ke Pengaturan Ujian
                    </Link>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5 break-words">
                        {examName ? `Soal: ${examName}` : 'Kelola Soal'}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Susun soal ujian, tentukan kunci jawaban, lalu atur bobot poinnya.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                        href={`/dashboard/exams/results/${examId}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <Library size={14} />
                        Lihat Hasil
                    </Link>
                    <Link
                        href={`/dashboard/exams/preview/${examId}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                    >
                        <Eye size={14} />
                        Preview Soal
                    </Link>
                </div>
            </div>

            {/* Langkah kerja */}
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StepCard step="1" title="Tambah soal" description="Tulis manual, import Word, atau ambil dari Bank Soal." active={questions.length === 0} done={questions.length > 0} />
                <StepCard step="2" title="Atur poin" description="Pastikan total poin sesuai target nilai ujian." active={pointsMismatch} done={!pointsMismatch && questions.length > 0} />
                <StepCard step="3" title="Cek & terbitkan" description="Preview tampilan siswa, lalu buka sesi dari Kontrol Ujian." />
            </ol>

            {/* Panduan untuk pemula */}
            {showGuide && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="flex items-start gap-3">
                        <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                            <Sparkles size={16} />
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-white">Mulai dari sini</p>
                            <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-slate-600 dark:text-slate-400">
                                <GuideItem text="Tambah soal lewat tab Tambah Soal di bawah. Pilih tipe soal: Pilihan Ganda, Benar/Salah, Menjodohkan, atau Esai." />
                                <GuideItem text="Tentukan kunci jawaban. Untuk Pilihan Ganda Kompleks boleh lebih dari satu jawaban benar." />
                                <GuideItem text="Total poin idealnya sama dengan Target Skor di card Penyekoran & Poin. Gunakan Bagi Rata bila belum sesuai." />
                                <GuideItem text="Geser baris soal untuk mengubah urutan, atau klik baris untuk menyunting." />
                            </ul>
                        </div>
                        <button
                            onClick={() => setShowGuide(false)}
                            aria-label="Tutup panduan"
                            className="shrink-0 p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Peringatan total poin */}
            {pointsMismatch && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                    <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300 flex-1 min-w-[200px]">
                        Total poin soal saat ini <strong>{formatPoints(totalPoints)}</strong>, target <strong>{formatPoints(targetPoints)}</strong>. Nilai siswa akan dihitung relatif terhadap total poin ini.
                    </p>
                    <button
                        onClick={handleNormalizePoints}
                        disabled={normalizeLoading}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
                    >
                        {normalizeLoading ? 'Memproses...' : 'Bagi Rata'}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Kolom kiri: tambah soal + penyekoran */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Tambah Soal</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih cara menambahkan soal ke ujian ini.</p>
                        </div>

<div className="p-3 space-y-2">
                            <AddTabButton
                                active={addModal === 'manual'}
                                onClick={() => setAddModal('manual')}
                                icon={<Plus size={15} />}
                                title="Input Manual"
                                description="Tulis satu per satu. Paling fleksibel."
                            />
                            <AddTabButton
                                active={addModal === 'import'}
                                onClick={() => setAddModal('import')}
                                icon={<Upload size={15} />}
                                title="Import Word / ZIP"
                                description="Impor banyak soal sekaligus dari file."
                            />
                            <AddTabButton
                                active={isBankPickerOpen}
                                onClick={() => setIsBankPickerOpen(true)}
                                icon={<Library size={15} />}
                                title="Ambil dari Bank Soal"
                                description="Pakai soal yang sudah pernah dibuat."
                            />
                        </div>

                        {questions.length > 0 && (
                            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Setelah menambah soal, atur poinnya di card <strong>Penyekoran &amp; Poin</strong> di bawah.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Penyekoran */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                        <button
                            onClick={() => setShowScoringSettings(!showScoringSettings)}
                            aria-expanded={showScoringSettings}
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                                <Scale size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-slate-800 dark:text-white">Penyekoran &amp; Poin</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Total {formatPoints(totalPoints)} dari target {formatPoints(targetPoints)} poin
                                </span>
                            </span>
                            <ChevronRight size={16} className={`shrink-0 text-slate-400 transition-transform ${showScoringSettings ? 'rotate-90' : ''}`} />
                        </button>

                        {showScoringSettings && (
                            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-200 dark:border-slate-800">
                                <div>
                                    <label htmlFor="targetScore" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Target Total Skor</label>
                                    <input
                                        id="targetScore"
                                        type="number"
                                        min="0"
                                        value={totalTargetScore}
                                        onChange={(e) => setTotalTargetScore(parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 transition-colors"
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                        Nilai akhir bila siswa menjawab semua soal dengan benar. Contoh: 100.
                                    </p>
                                </div>

                                <label className="flex items-start justify-between gap-4 cursor-pointer">
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Otomatis Bagi Poin</span>
                                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Poin tiap soal dihitung otomatis dari target skor.</span>
                                    </span>
                                    <span className="relative shrink-0 mt-0.5">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={autoDistribute}
                                            onChange={() => setAutoDistribute(!autoDistribute)}
                                        />
                                        <span className="block w-11 h-6 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors peer-checked:bg-slate-900 dark:peer-checked:bg-white" />
                                        <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                                    </span>
                                </label>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={handleSaveScoringSettings}
                                        disabled={savingSettings}
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        {savingSettings && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white dark:border-slate-900/40 dark:border-t-slate-900 rounded-full animate-spin" />}
                                        {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                                    </button>
                                    <button
                                        onClick={handleNormalizePoints}
                                        disabled={normalizeLoading || questions.length === 0}
                                        title="Bagikan poin secara merata ke semua soal"
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <Scale size={15} />
                                        {normalizeLoading ? 'Memproses...' : 'Bagi Poin Rata ke Semua Soal'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Kolom kanan: daftar soal */}
                <div className="lg:col-span-2">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Daftar Soal</h2>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                                    {questions.length} soal
                                </span>
                            </div>

                            {questions.length > 0 && (
                                <div className="sm:ml-auto flex items-center gap-1.5">
                                    <button
                                        onClick={() => setShowExportModal(true)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <DownloadCloud size={14} />
                                        Export
                                    </button>
                                    <button
                                        onClick={() => setIsBankExportOpen(true)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <Database size={14} />
                                        Simpan ke Bank
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteAllModal(true)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                        Hapus Semua
                                    </button>
                                </div>
                            )}
                        </div>

                        {questions.length > 0 && (
                            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                                <div className="relative flex-1">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Cari isi soal..."
                                        aria-label="Cari soal"
                                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
                                    />
                                </div>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    aria-label="Filter tipe soal"
                                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-slate-400 transition-colors"
                                >
                                    <option value="all">Semua tipe ({questions.length})</option>
                                    {typeOptions.map(t => (
                                        <option key={t.value} value={t.value}>{t.label} ({t.count})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="p-3 space-y-2">
                            {error && (
                                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>
                            )}

                            {loading ? (
                                <div className="space-y-2">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                    ))}
                                </div>
                            ) : questions.length === 0 ? (
                                <div className="py-12 text-center">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                                        <FileText size={20} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">Belum ada soal</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                                        Mulai dari panel <strong>Tambah Soal</strong> di sebelah kiri: tulis manual, import dari Word, atau ambil dari Bank Soal.
                                    </p>
                                    <button
                                        onClick={() => setAddModal('manual')}
                                        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity"
                                    >
                                        <Plus size={14} />
                                        Tambah soal pertama
                                    </button>
                                </div>
                            ) : filteredQuestions.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-12">
                                    Tidak ada soal yang cocok dengan pencarian/filter.
                                </p>
                            ) : (
                                filteredQuestions.map((q) => {
                                    const realIndex = questions.findIndex(item => item.id === q.id);
                                    return (
                                        <QuestionListItem
                                            key={q.id}
                                            question={q}
                                            number={realIndex + 1}
                                            onEdit={() => setEditingQuestion(q)}
                                            onDelete={() => handleDelete(q.id)}
                                            onDragStart={() => handleDragStart(realIndex)}
                                            onDragOver={(e) => handleDragOver(e, realIndex)}
                                            onDragEnd={handleDragEnd}
                                            isDragging={draggedIndex === realIndex}
                                            isDragOver={dragOverIndex === realIndex && draggedIndex !== realIndex}
                                        />
                                    );
                                })
                            )}
                        </div>

                        {questions.length > 0 && (
                            <p className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                                Geser ikon titik tiga untuk mengurutkan soal. Klik baris soal untuk menyunting.
                            </p>
                        )}
                    </div>
                </div>
            </div>

<BankPickerModal
                isOpen={isBankPickerOpen}
                onClose={() => setIsBankPickerOpen(false)}
                examId={examId}
                onSelect={fetchQuestions}
            />

            {addModal === 'manual' && (
                <ModalShell
                    title="Tambah Soal"
                    description="Isi soal baru. Setelah disimpan, soal langsung masuk ke daftar di kanan."
                    size="xl"
                    onClose={() => setAddModal(null)}
                >
                    <ManualInputForm
                        examId={examId}
                        onQuestionAdded={() => {
                            toast.success('Soal berhasil ditambahkan.');
                            fetchQuestions();
                            setAddModal(null);
                        }}
                    />
                </ModalShell>
            )}

            {addModal === 'import' && (
                <ModalShell
                    title="Import Soal dari File"
                    description="Unggah file Word (.docx) atau .zip hasil ekspor Word."
                    size="lg"
                    onClose={() => setAddModal(null)}
                >
                    <ImportWordForm
                        examId={examId}
                        onQuestionAdded={() => {
                            fetchQuestions();
                        }}
                    />
                </ModalShell>
            )}

            {isBankExportOpen && (
                <BankSelectorModal
                    isOpen={isBankExportOpen}
                    onClose={() => setIsBankExportOpen(false)}
                    onSelect={async (folderId) => {
                        try {
                            const res = await fetch('/api/bank/transfer', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    mode: 'exam_to_bank',
                                    examId,
                                    folderId,
                                    questionIds: questions.map(q => q.id)
                                })
                            });
                            if (res.ok) {
                                toast.success('Berhasil mengekspor semua soal ke bank!');
                                setIsBankExportOpen(false);
                            } else {
                                toast.error('Gagal mengekspor soal');
                            }
                        } catch (e) {
                            toast.error('Terjadi kesalahan saat mengekspor');
                        }
                    }}
                />
            )}
        </div>
    );
}

function formatPoints(value) {
    const num = Number(value) || 0;
    return Number.isInteger(num) ? num : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function StepCard({ step, title, description, active = false, done = false }) {
    return (
        <li className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${active
            ? 'border-slate-900 dark:border-white bg-white dark:bg-slate-900'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
        >
            <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${done
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                {done ? <Check size={14} /> : step}
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
            </span>
        </li>
    );
}

function GuideItem({ text }) {
    return (
        <li className="flex items-start gap-2">
            <Check size={13} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>{text}</span>
        </li>
    );
}

function AddTabButton({ active, onClick, icon, title, description }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${active
                ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400'}`}
        >
            <span className={`shrink-0 mt-0.5 ${active ? '' : 'text-slate-500 dark:text-slate-400'}`}>{icon}</span>
            <span className="min-w-0">
                <span className="block text-sm font-semibold">{title}</span>
                <span className={`block text-xs mt-0.5 ${active ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>{description}</span>
            </span>
        </button>
    );
}

function QuestionListItem({ question, number, onEdit, onDelete, onDragStart, onDragOver, onDragEnd, isDragging, isDragOver }) {
    const q = question;
    const typeLabel = QUESTION_TYPE_LABEL[q.question_type] || q.question_type;

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onClick={onEdit}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } }}
            className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors cursor-grab active:cursor-grabbing ${isDragging
                ? 'opacity-50 border-slate-400'
                : isDragOver
                    ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
        >
            <span className="shrink-0 mt-0.5 text-slate-300 dark:text-slate-600" title="Geser untuk mengurutkan">
                <GripVertical size={16} />
            </span>

            <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center tabular-nums">
                {number}
            </span>

            <span className="flex-1 min-w-0 space-y-1.5">
                <span className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">{typeLabel}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold tabular-nums">{formatPoints(q.points)} poin</span>
                    {q.scoring_strategy && q.scoring_strategy !== 'standard' && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30">
                            {q.scoring_strategy.replace(/_/g, ' ')}
                        </span>
                    )}
                </span>

<span className="block text-sm text-slate-800 dark:text-slate-100 leading-snug">
                    {stripHtml(q.question_text)}
                </span>

                <QuestionAnswerPreview question={q} />
            </span>

            <span className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                    onClick={onEdit}
                    aria-label={`Sunting soal nomor ${number}`}
                    title="Sunting soal"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                    <Pencil size={15} />
                </button>
                <button
                    onClick={onDelete}
                    aria-label={`Hapus soal nomor ${number}`}
                    title="Hapus soal"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                    <Trash2 size={15} />
                </button>
            </span>
        </div>
    );
}

function QuestionAnswerPreview({ question }) {
    const q = question;

    if (q.question_type === 'essay') {
        return (
            <span className="block text-xs text-slate-400">
                Tipe esai — siswa menjawab bebas, dinilai oleh pengawas.
            </span>
        );
    }

    if (q.question_type === 'matching') {
        const pairs = q.options?.pairs || [];
        return (
            <span className="block text-xs text-slate-500 dark:text-slate-400">
                {pairs.length} pasangan menjodohkan
            </span>
        );
    }

    const correctOptions = q.correct_option ? String(q.correct_option).split(',').map(s => s.trim()).filter(Boolean) : [];

    return (
        <span className="flex flex-wrap gap-1.5">
            {Object.entries(q.options || {}).map(([key, value]) => {
                const isCorrect = correctOptions.includes(key);
                return (
                    <span
                        key={key}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] max-w-full ${isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
<span className="font-bold">{key}</span>
                        <span className="truncate max-w-[220px]">{stripHtml(value)}</span>
                        {isCorrect && <Check size={11} />}
                    </span>
                );
            })}
        </span>
    );
}

function stripHtml(html) {
    const text = String(html || '')
        .replace(/<img[^>]*>/gi, '[gambar]')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > 320 ? `${text.slice(0, 320)}...` : (text || '(kosong)');
}

// Helper component for exporting to bank
function BankSelectorModal({ isOpen, onClose, onSelect }) {
    const [folders, setFolders] = useState([]);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetch('/api/bank/folders')
                .then(res => res.json())
                .then(data => {
                    setFolders(data);
                    setLoading(false);
                });
        }
    }, [isOpen]);

    const currentFolders = folders.filter(f => f.parent_id === currentFolderId);

    if (!isOpen) return null;

    const breadcrumb = (() => {
        const trail = [];
        let cursor = currentFolderId;
        while (cursor) {
            const folder = folders.find(f => f.id === cursor);
            if (!folder) break;
            trail.unshift(folder);
            cursor = folder.parent_id;
        }
        return trail;
    })();

    return (
        <ModalShell
            title="Simpan ke Bank Soal"
            description="Pilih folder tujuan untuk menyimpan seluruh soal ujian ini."
            onClose={onClose}
            footer={(
                <>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Soal akan disalin, tidak dipindahkan dari ujian ini.
                    </p>
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        Batal
                    </button>
                </>
            )}
        >
            {/* Breadcrumb */}
            <div className="flex flex-wrap items-center gap-1 mb-3 text-xs">
                <button
                    onClick={() => setCurrentFolderId(null)}
                    className={`px-2 py-1 rounded-md font-semibold transition-colors ${currentFolderId === null
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    Bank Soal
                </button>
                {breadcrumb.map((folder, i) => (
                    <span key={folder.id} className="flex items-center gap-1">
                        <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />
                        <button
                            onClick={() => setCurrentFolderId(folder.id)}
                            className={`px-2 py-1 rounded-md font-semibold transition-colors ${i === breadcrumb.length - 1
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            {folder.name}
                        </button>
                    </span>
                ))}
            </div>

            <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="h-11 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        ))}
                    </div>
                ) : currentFolders.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                        {currentFolderId ? 'Folder ini tidak memiliki subfolder. Pilih folder ini sebagai tujuan.' : 'Belum ada folder di Bank Soal.'}
                    </p>
                ) : (
                    currentFolders.map(folder => (
                        <div key={folder.id} className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentFolderId(folder.id)}
                                className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                            >
                                <FileText size={15} className="shrink-0 text-slate-400" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{folder.name}</span>
                                <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-slate-600 ml-auto" />
                            </button>
                            <button
                                onClick={() => onSelect(folder.id)}
                                className="shrink-0 px-3 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                            >
                                Simpan ke sini
                            </button>
                        </div>
                    ))
                )}
            </div>
        </ModalShell>
    );
}
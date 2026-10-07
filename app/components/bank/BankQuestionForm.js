'use client';

import { useState, useRef, useMemo } from 'react';
import {
  Plus,
  Trash,
  Save,
  CheckCircle2,
  AlertCircle,
  ListChecks,
  ListFilter,
  ToggleLeft,
  GitCompareArrows,
  AlignLeft,
  Image as ImageIcon
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { uploadBase64Images } from '@/app/lib/utils';
import { toast } from 'sonner';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

/* ---------- Metadata: bahasa manusia, bukan kode internal ---------- */
const QUESTION_TYPES = [
  {
    value: 'multiple_choice',
    label: 'Pilihan Ganda',
    desc: 'Satu jawaban benar',
    icon: ListChecks,
  },
  {
    value: 'multiple_choice_complex',
    label: 'Pilihan Ganda Kompleks',
    desc: 'Bisa lebih dari satu benar',
    icon: ListFilter,
  },
  {
    value: 'true_false',
    label: 'Benar / Salah',
    desc: 'Hanya dua pilihan',
    icon: ToggleLeft,
  },
  {
    value: 'matching',
    label: 'Menjodohkan',
    desc: 'Pasangkan kiri ke kanan',
    icon: GitCompareArrows,
  },
  {
    value: 'essay',
    label: 'Esai',
    desc: 'Jawaban panjang, dinilai guru',
    icon: AlignLeft,
  },
];

const SCORING_OPTIONS = {
  multiple_choice_complex: [
    { value: 'pgk_partial', label: 'Ada penalti', desc: 'Jawaban salah mengurangi poin. Paling umum.' },
    { value: 'pgk_strict', label: 'Wajib semua benar', desc: 'Poin penuh hanya jika semua benar dan tidak ada yang salah.' },
    { value: 'pgk_any', label: 'Minimal satu benar', desc: 'Poin penuh jika minimal satu benar dan tidak ada yang salah.' },
    { value: 'pgk_additive', label: 'Tanpa penalti', desc: 'Setiap jawaban benar menambah poin, yang salah tidak mengurangi.' },
  ],
  essay: [
    { value: 'essay_manual', label: 'Dinilai guru', desc: 'Anda yang menilai sendiri setelah ujian selesai.' },
    { value: 'essay_keywords', label: 'Kata kunci (proporsional)', desc: 'Semakin banyak kata kunci cocok, semakin tinggi nilainya.' },
    { value: 'essay_any_keyword', label: 'Minimal satu kata kunci', desc: 'Poin penuh hanya jika satu kata kunci saja sudah cocok.' },
    { value: 'essay_strict_keywords', label: 'Semua kata kunci', desc: 'Poin penuh hanya jika semua kata kunci ditemukan.' },
  ],
};

// Nilai dari editor Jodit berupa HTML, jadi <p><br></p> dianggap "terisi" kalau dicek dengan trim()
const hasContent = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-colors';

const JoditEditorWithUpload = ({ value, onBlur, placeholder }) => {
    const editor = useRef(null);
    const config = useMemo(() => ({
        readonly: false,
        height: 'auto',
        minHeight: 120,
        placeholder,
        insertImageAsBase64URL: true,
        hidePoweredByJodit: true,
        buttons: 'bold,italic,underline,|,ul,ol,|,image,link,align,undo,redo,clearformat'
    }), [placeholder]);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (editor.current) editor.current.selection.insertImage(e.target.result);
        };
        reader.readAsDataURL(file);
        event.target.value = null;
    };

    return (
        <div className="relative">
            <JoditEditor
                ref={editor}
                value={value}
                config={config}
                onBlur={newContent => onBlur(newContent)}
            />
            <label className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                <ImageIcon size={13} />
                Sisipkan gambar
                <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
            </label>
        </div>
    );
};

export default function BankQuestionForm({ folderId, initialData, onSave, onCancel }) {
    const [questionText, setQuestionText] = useState(initialData?.question_text || '');
    
    // Parse options
    const parsedInitialOptions = useMemo(() => {
        if (!initialData?.options || initialData?.question_type === 'matching') return [
            { id: 1, key: 'A', value: '' },
            { id: 2, key: 'B', value: '' }
        ];
        const opts = typeof initialData.options === 'string' ? JSON.parse(initialData.options) : initialData.options;
        return Object.entries(opts).map(([key, value], idx) => ({ id: idx + 1, key, value }));
    }, [initialData]);

    const parsedInitialPairs = useMemo(() => {
        if (initialData?.question_type !== 'matching' || !initialData?.options) return [
            { id: 1, p: '', r: '' },
            { id: 2, p: '', r: '' }
        ];
        const opts = typeof initialData.options === 'string' ? JSON.parse(initialData.options) : initialData.options;
        return opts.pairs || [
            { id: 1, p: '', r: '' },
            { id: 2, p: '', r: '' }
        ];
    }, [initialData]);

    const [options, setOptions] = useState(parsedInitialOptions);
    const [pairs, setPairs] = useState(parsedInitialPairs);
    const [correctOption, setCorrectOption] = useState(initialData?.correct_option || 'A');
    const [questionType, setQuestionType] = useState(initialData?.question_type || 'multiple_choice');
    const [points, setPoints] = useState(initialData?.points || 1);
    const [scoringStrategy, setScoringStrategy] = useState(initialData?.scoring_strategy || (initialData?.question_type === 'essay' ? 'essay_manual' : 'standard'));
    const [correctOptions, setCorrectOptions] = useState(() => {
        if (initialData?.question_type === 'multiple_choice_complex' && initialData.correct_option) {
            return initialData.correct_option.split(',');
        }
        return [initialData?.correct_option || 'A'];
    });
    const [keywords, setKeywords] = useState(() => {
        try {
            const meta = typeof initialData?.scoring_metadata === 'string' ? JSON.parse(initialData.scoring_metadata) : (initialData?.scoring_metadata || {});
            return (meta.keywords || []).join(', ');
        } catch (e) { return ''; }
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const nextOptionId = useRef(options.length + 1);
    const nextPairId = useRef(pairs.length + 1);

    const handleOptionChange = (id, value) => {
        setOptions(prev => prev.map(opt => opt.id === id ? { ...opt, value } : opt));
    };

    const handlePairChange = (id, field, value) => {
        setPairs(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const addPair = () => {
        setPairs(prev => [...prev, { id: nextPairId.current++, p: '', r: '' }]);
    };

    const removePair = (id) => {
        setPairs(prev => prev.filter(p => p.id !== id));
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
            if (correctOption === optionToRemove.key) setCorrectOption(options[0].key);
            setCorrectOptions(prev => prev.filter(k => k !== optionToRemove.key));
        }
        setOptions(prev => prev.filter(opt => opt.id !== id));
    };

    const handleTypeChange = (type) => {
        setQuestionType(type);
        setScoringStrategy(type === 'essay' ? 'essay_manual' : 'standard');
        if (type === 'true_false') {
            setOptions([
                { id: 1, key: 'A', value: 'Benar' },
                { id: 2, key: 'B', value: 'Salah' },
            ]);
            setCorrectOption('A');
        } else if (type === 'essay') {
            setOptions([]);
        } else if (type === 'matching') {
            setOptions([]);
            if (pairs.length === 0) {
                setPairs([
                    { id: 1, p: '', r: '' },
                    { id: 2, p: '', r: '' }
                ]);
            }
        } else if (type === 'multiple_choice_complex' && scoringStrategy === 'standard') {
            setScoringStrategy('pgk_partial');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validasi
        if (!hasContent(questionText)) {
            setError('Tulis dulu pertanyaannya pada langkah 2.');
            return;
        }
        if (questionType === 'matching' && pairs.some(p => !hasContent(p.p) || !hasContent(p.r))) {
            setError('Ada pasangan yang belum lengkap pada langkah 3.');
            return;
        }
        if (questionType !== 'essay' && questionType !== 'matching' && options.some(o => !hasContent(o.value))) {
            setError('Ada pilihan jawaban yang masih kosong pada langkah 3.');
            return;
        }
        if (
            questionType === 'multiple_choice' && !hasContent(options.find(o => o.key === correctOption)?.value)
        ) {
            setError('Kunci jawaban menunjuk ke pilihan yang masih kosong.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const processedQuestionText = await uploadBase64Images(questionText);
            const processedOptions = await Promise.all(
                options.map(async (opt) => ({
                    ...opt,
                    value: await uploadBase64Images(opt.value),
                }))
            );

            const processedPairs = await Promise.all(
                pairs.map(async (pair) => ({
                    ...pair,
                    p: await uploadBase64Images(pair.p),
                    r: await uploadBase64Images(pair.r),
                }))
            );

            let optionsForApi = {};
            if (questionType === 'matching') {
                optionsForApi = { pairs: processedPairs };
            } else {
                optionsForApi = processedOptions.reduce((acc, opt) => {
                    acc[opt.key] = opt.value;
                    return acc;
                }, {});
            }

            const finalCorrectOption = questionType === 'multiple_choice_complex' 
                ? correctOptions.sort().join(',') 
                : correctOption;

            const payload = {
                id: initialData?.id,
                folder_id: folderId,
                question_text: processedQuestionText,
                options: optionsForApi,
                correct_option: finalCorrectOption,
                question_type: questionType,
                points,
                scoring_strategy: scoringStrategy,
                scoring_metadata: questionType === 'essay' ? { keywords: keywords.split(',').map(k => k.trim()).filter(k => k) } : null
            };

            const res = await fetch('/api/bank/questions', {
                method: initialData ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Soal berhasil disimpan ke bank');
                onSave();
            } else {
                throw new Error('Gagal menyimpan ke bank');
            }
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const questionTypesAvailable = questionType === 'multiple_choice_complex' || questionType === 'essay'
        ? SCORING_OPTIONS[questionType]
        : null;

    const missingQuestion = !hasContent(questionText);
    const missingOptions = questionType !== 'essay' && questionType !== 'matching' && options.some(o => !hasContent(o.value));
    const missingPairs = questionType === 'matching' && pairs.some(p => !hasContent(p.p) || !hasContent(p.r));
    const hasError = missingQuestion || missingOptions || missingPairs;

    const StepHeader = ({ n, title, hint }) => (
        <div className="flex items-baseline gap-2.5 mb-3">
            <span className="shrink-0 w-5 h-5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold flex items-center justify-center tabular-nums">
                {n}
            </span>
            <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
                {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="pb-2">
            {/* ============ 1. Tipe Soal ============ */}
            <section className="mb-8">
                <StepHeader n={1} title="Pilih tipe soal" hint="Menentukan forme soal dan cara penilaiannya." />

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {QUESTION_TYPES.map(t => {
                        const active = questionType === t.value;
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => handleTypeChange(t.value)}
                                aria-pressed={active}
                                className={`text-left p-3 rounded-xl border transition-colors ${active
                                    ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-900'
                                    }`}
                            >
                                <Icon size={17} className={active ? '' : 'text-slate-400'} />
                                <p className="mt-1.5 text-[13px] font-semibold leading-tight">{t.label}</p>
                                <p className={`text-[11px] leading-tight mt-0.5 ${active ? 'opacity-70' : 'text-slate-400'}`}>{t.desc}</p>
                            </button>
                        );
                    })}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ============ Kolom utama ============ */}
                <div className="lg:col-span-2 space-y-8 min-w-0">
                    {/* 2. Pertanyaan */}
                    <section>
                        <StepHeader n={2} title="Tulis pertanyaannya" hint="Boleh ketik teks biasa, sisipkan gambar, rumus, atau tabel." />
                        <div className={`rounded-xl border bg-white dark:bg-slate-900 transition-colors ${missingQuestion && hasError ? 'border-rose-300 dark:border-rose-500/40' : 'border-slate-200 dark:border-slate-800'}`}>
                            <JoditEditorWithUpload
                                value={questionText}
                                placeholder="Tulis pertanyaan di sini…"
                                onBlur={newContent => setQuestionText(newContent)}
                            />
                        </div>
                        {missingQuestion && hasError && (
                            <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">Pertanyaan masih kosong.</p>
                        )}
                    </section>

                    {/* 3. Pilihan jawaban (PG / B-S) */}
                    {questionType !== 'essay' && questionType !== 'matching' && (
                        <section>
                            <StepHeader
                                n={3}
                                title="Buat pilihan jawaban"
                                hint={
                                    questionType === 'multiple_choice_complex'
                                        ? 'Centang kunci di sebelah kanan. Boleh lebih dari satu.'
                                        : 'Pilih satu kunci di sebelah kanan setiap opsi.'
                                }
                            />

                            <div className="space-y-2">
                                {options.map(opt => {
                                    const checked = questionType === 'multiple_choice_complex'
                                        ? correctOptions.includes(opt.key)
                                        : correctOption === opt.key;
                                    const isKey = checked;

                                    return (
                                        <div
                                            key={opt.id}
                                            className={`group flex items-start gap-3 p-3 rounded-xl border transition-colors ${isKey
                                                ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5'
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                                                }`}
                                        >
                                            {/* Tandai kunci */}
                                            <label
                                                className="shrink-0 cursor-pointer select-none pt-1 flex flex-col items-center gap-1"
                                                title={questionType === 'multiple_choice_complex' ? 'Centang sebagai kunci' : 'Jadikan kunci jawaban'}
                                            >
                                                <input
                                                    type={questionType === 'multiple_choice_complex' ? 'checkbox' : 'radio'}
                                                    name="correct-answer"
                                                    className="sr-only"
                                                    checked={checked}
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
                                                    {isKey
                                                        ? <CheckCircle2 size={15} />
                                                        : <span className="text-xs font-bold">{opt.key}</span>}
                                                </span>
                                                <span className={`text-[9px] font-semibold ${isKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                    {isKey ? 'Kunci' : 'Kunci?'}
                                                </span>
                                            </label>

                                            {/* Isi opsi */}
                                            <div className="flex-1 min-w-0">
                                                {questionType === 'true_false' ? (
                                                    <div className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200">
                                                        {opt.value}
                                                    </div>
                                                ) : (
                                                    <JoditEditorWithUpload
                                                        value={opt.value}
                                                        placeholder={`Pilihan ${opt.key}…`}
                                                        onBlur={newContent => handleOptionChange(opt.id, newContent)}
                                                    />
                                                )}
                                            </div>

                                            {options.length > 2 && questionType !== 'true_false' && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeOption(opt.id)}
                                                    aria-label={`Hapus opsi ${opt.key}`}
                                                    className="shrink-0 p-1.5 mt-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                >
                                                    <Trash size={15} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {questionType !== 'true_false' && (
                                <button
                                    type="button"
                                    onClick={addOption}
                                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 transition-colors"
                                >
                                    <Plus size={14} />
                                    Tambah pilihan
                                </button>
                            )}

                            {missingOptions && hasError && (
                                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Ada pilihan yang masih kosong.</p>
                            )}
                        </section>
                    )}

                    {/* 3. Pasangan (matching) */}
                    {questionType === 'matching' && (
                        <section>
                            <StepHeader n={3} title="Buat pasangan" hint="Tulis sisi kiri, lalu isi sisi kanan yang tepat." />

                            <div className="space-y-2">
                                {pairs.map((pair, idx) => (
                                    <div
                                        key={pair.id}
                                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                                                Pasangan {idx + 1}
                                            </span>
                                            {pairs.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePair(pair.id)}
                                                    aria-label={`Hapus pasangan ${idx + 1}`}
                                                    className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
                                            <JoditEditorWithUpload
                                                value={pair.p}
                                                placeholder="Sisi kiri…"
                                                onBlur={newContent => handlePairChange(pair.id, 'p', newContent)}
                                            />
                                            <span className="hidden sm:flex items-center justify-center text-slate-300 dark:text-slate-600">
                                                <GitCompareArrows size={16} />
                                            </span>
                                            <JoditEditorWithUpload
                                                value={pair.r}
                                                placeholder="Sisi kanan…"
                                                onBlur={newContent => handlePairChange(pair.id, 'r', newContent)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addPair}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 transition-colors"
                            >
                                <Plus size={14} />
                                Tambah pasangan
                            </button>

                            {missingPairs && hasError && (
                                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Ada pasangan yang belum lengkap.</p>
                            )}
                        </section>
                    )}
                </div>

                {/* ============ Kolom pengaturan ============ */}
                <aside className="space-y-5">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <label htmlFor="bank-points" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Poin
                        </label>
                        <p className="text-[11px] text-slate-400 mb-2">Bobot soal ini saat penilaian.</p>
                        <input
                            id="bank-points"
                            type="number"
                            min="0"
                            step="any"
                            value={points}
                            onChange={(e) => setPoints(parseFloat(e.target.value))}
                            className={INPUT_CLASS}
                        />
                    </div>

                    {questionType === 'essay' && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <label htmlFor="bank-keywords" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Kata kunci
                            </label>
                            <p className="text-[11px] text-slate-400 mb-2">
                                Pisahkan dengan koma. Dipakai jika penilaian otomatis aktif.
                            </p>
                            <input
                                id="bank-keywords"
                                type="text"
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                placeholder="misal: fotosintesis, klorofil"
                                className={INPUT_CLASS}
                            />
                        </div>
                    )}

                    {questionTypesAvailable && (
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cara menghitung nilai</p>
                            <p className="text-[11px] text-slate-400 mb-3">
                                {questionType === 'essay' ? 'Esai' : 'Pilihan ganda kompleks'} — pilih cara penilaian.
                            </p>

                            <div className="space-y-1.5">
                                {questionTypesAvailable.map(opt => {
                                    const active = scoringStrategy === opt.value;
                                    return (
                                        <label
                                            key={opt.value}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${active
                                                ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="scoring-strategy"
                                                className="sr-only"
                                                checked={active}
                                                onChange={() => setScoringStrategy(opt.value)}
                                            />
                                            <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${active
                                                ? 'border-slate-900 dark:border-white'
                                                : 'border-slate-300 dark:border-slate-600'
                                                }`}>
                                                {active && <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white" />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">{opt.label}</span>
                                                <span className="block text-[11px] text-slate-400 leading-snug">{opt.desc}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tersimpan ke</p>
                        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 mt-0.5 truncate">
                            {folderId ? 'Folder saat ini' : 'Bank Soal (Root)'}
                        </p>
                    </div>
                </aside>
            </div>

            {/* ============ Error + Aksi ============ */}
            {error && (
                <div className="mt-6 flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                    <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                    <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                </div>
            )}

            <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 mt-6 px-5 sm:px-6 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400 hidden sm:block">
                    {hasError ? 'Lengkapi bagian yang masih kosong.' : 'Siap disimpan ke Bank Soal.'}
                </p>
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-[0.98]"
                    >
                        {loading ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Menyimpan
                            </>
                        ) : (
                            <>
                                <Save size={15} />
                                {initialData ? 'Simpan Perubahan' : 'Simpan ke Bank Soal'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}

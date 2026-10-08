'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { uploadBase64Images, htmlHasContent } from '@/app/lib/utils';
import { 
    ArrowLeft, Database, DownloadCloud, Plus, Search, Pencil, Trash2, GripVertical, 
    Check, X, ChevronRight, AlertTriangle, Eye, Upload, FileText, Library, Sparkles, 
    Scale, GitCompareArrows, CheckCircle2, HelpCircle, FileCheck, Layers, Award, Info, Table2
} from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import BankPickerModal from '@/app/components/bank/BankPickerModal';
import MatrixEditor from '@/app/components/exam/MatrixEditor';
import { MATRIX_TYPE, MATRIX_SENTINEL, DEFAULT_MATRIX_COLUMNS, normalizeMatrixColumns, normalizeMatrixItems, normalizeMatrixKeys, getMatrixKeys, unlabeledColumnError } from '@/app/lib/matrix';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

// --- Palette Object (Source of Truth untuk Tema AGENTS.md) ---
const TONE = {
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-900/60',
        text: 'text-blue-700 dark:text-blue-300',
        iconBg: 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
        accent: 'from-blue-500 to-cyan-500',
    },
    indigo: {
        bg: 'bg-indigo-50 dark:bg-indigo-950/30',
        border: 'border-indigo-200 dark:border-indigo-900/60',
        text: 'text-indigo-700 dark:text-indigo-300',
        iconBg: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400',
        accent: 'from-indigo-500 to-purple-500',
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        border: 'border-purple-200 dark:border-purple-900/60',
        text: 'text-purple-700 dark:text-purple-300',
        iconBg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400',
        accent: 'from-purple-500 to-pink-500',
    },
    emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-900/60',
        text: 'text-emerald-700 dark:text-emerald-300',
        iconBg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
        accent: 'from-emerald-500 to-teal-500',
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-900/60',
        text: 'text-amber-700 dark:text-amber-300',
        iconBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
        accent: 'from-amber-500 to-orange-500',
    },
    rose: {
        bg: 'bg-rose-50 dark:bg-rose-950/30',
        border: 'border-rose-200 dark:border-rose-900/60',
        text: 'text-rose-700 dark:text-rose-300',
        iconBg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
        accent: 'from-rose-500 to-red-500',
    },
    slate: {
        bg: 'bg-slate-50 dark:bg-slate-900/50',
        border: 'border-slate-200 dark:border-slate-800',
        text: 'text-slate-700 dark:text-slate-300',
        iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
        accent: 'from-slate-400 to-slate-600',
    },
    cyan: {
        bg: 'bg-cyan-50 dark:bg-cyan-950/30',
        border: 'border-cyan-200 dark:border-cyan-900/60',
        text: 'text-cyan-700 dark:text-cyan-300',
        iconBg: 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400',
        accent: 'from-cyan-500 to-sky-500',
    }
};

// --- Labels & TONE per Tipe Soal ---
const QUESTION_TYPE_META = {
    multiple_choice: { label: 'Pilihan Ganda', hint: 'Satu jawaban benar', toneKey: 'blue', icon: FileCheck },
    multiple_choice_complex: { label: 'Pilihan Ganda Kompleks', hint: 'Bisa lebih dari satu benar', toneKey: 'purple', icon: Layers },
    true_false: { label: 'Benar / Salah', hint: 'Hanya dua pilihan', toneKey: 'emerald', icon: CheckCircle2 },
    [MATRIX_TYPE]: { label: 'Tabel Pilihan Kompleks', hint: 'Tabel pernyataan, kolom custom', toneKey: 'cyan', icon: Table2 },
    matching: { label: 'Menjodohkan', hint: 'Pasangkan kiri ke kanan', toneKey: 'amber', icon: GitCompareArrows },
    essay: { label: 'Esai', hint: 'Jawaban panjang, dinilai guru', toneKey: 'indigo', icon: FileText }
};

const QUESTION_TYPE_LABEL = {
    multiple_choice: 'Pilihan Ganda',
    multiple_choice_complex: 'Pilihan Ganda Kompleks',
    true_false: 'Benar / Salah',
    [MATRIX_TYPE]: 'Tabel Pilihan Kompleks',
    matching: 'Menjodohkan',
    essay: 'Esai'
};

const QUESTION_TYPE_HINT = {
    multiple_choice: 'Satu jawaban benar',
    multiple_choice_complex: 'Bisa lebih dari satu benar',
    true_false: 'Hanya dua pilihan',
    [MATRIX_TYPE]: 'Tabel pernyataan, kolom custom',
    matching: 'Pasangkan kiri ke kanan',
    essay: 'Jawaban panjang, dinilai guru'
};

const SCORING_LABELS = {
    pgk_partial: { label: 'Ada penalti', desc: 'Jawaban salah mengurangi poin. Paling umum.' },
    pgk_strict: { label: 'Wajib semua benar', desc: 'Poin penuh hanya jika semua benar dan tidak ada yang salah.' },
    pgk_any: { label: 'Minimal satu benar', desc: 'Poin penuh jika minimal satu benar dan tidak ada yang salah.' },
    pgk_additive: { label: 'Tanpa penalti', desc: 'Setiap jawaban benar menambah poin, yang salah tidak mengurangi.' },
    essay_manual: { label: 'Dinilai guru', desc: 'Anda yang menilai sendiri setelah ujian selesai.' },
    essay_keywords: { label: 'Kata kunci (proporsional)', desc: 'Semakin banyak kata kunci cocok, semakin tinggi nilainya.' },
    essay_any_keyword: { label: 'Minimal satu kata kunci', desc: 'Poin penuh hanya jika satu kata kunci saja sudah cocok.' },
    essay_strict_keywords: { label: 'Semua kata kunci', desc: 'Poin penuh hanya jika semua kata kunci ditemukan.' },
    matrix_partial: { label: 'Proporsional per baris', desc: 'Nilai dibagi rata sesuai jumlah pernyataan yang dijawab benar.' },
    matrix_strict: { label: 'Wajib semua benar', desc: 'Poin penuh hanya jika seluruh pernyataan dijawab benar.' }
};

const LETTER_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Opsi soal datang dalam beberapa bentuk depending sumbernya:
 * - object map dari DB : { "A": "<p>benar</p>" }
 * - array dari API     : [{ originalKey: "A", text: "<p>benar</p>" }]
 * - nilai legacy       : { "A": { text: "<p>benar</p>" } }
 * Semuanya dinormalkan ke [{ key, value }] (string) supaya form edit tidak
 * pernah menerima objek mentah - objek itulah yang bikin hasContent() meledak
 * dan editor menampilkan kosong.
 */
const toOptionList = (rawOptions) => {
    let parsed = rawOptions;
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed || '{}'); } catch { parsed = {}; }
    }
    if (!parsed) return [];

    const readValue = (value) => {
        if (value && typeof value === 'object') {
            return String(value.text ?? value.label ?? value.value ?? '');
        }
        return String(value ?? '');
    };

    if (Array.isArray(parsed)) {
        return parsed
            .map((opt, index) => {
                const key = String(
                    (opt && typeof opt === 'object')
                        ? (opt.originalKey ?? opt.key ?? LETTER_KEYS[index])
                        : LETTER_KEYS[index]
                );
                return { key, value: readValue(opt) };
            })
            .filter(opt => /^[A-Za-z0-9_-]+$/.test(opt.key));
    }

    if (typeof parsed !== 'object') return [];

    return Object.entries(parsed)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => ({ key: String(key), value: readValue(value) }));
};

// Soal berisi gambar saja tetap sah, jadi embed (gambar/video/iframe) ikut
// dihitung sebagai isi - bukan cuma teks. htmlHasContent juga aman menerima
// objek, jadi opsi yang salah bentuk tidak meledak di sini.
const hasContent = (html) => htmlHasContent(html);

const EDIT_INPUT_CLASS =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all';

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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className={`relative w-full ${sizeCls} sm:max-h-[90vh] h-full sm:h-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/5`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
                <div className="flex items-start justify-between gap-4 px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h2>
                        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Tutup"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">{children}</div>

                {footer && (
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

const useJoditConfig = (placeholder) => {
    return useMemo(() => ({
        readonly: false,
        height: 'auto',
        minHeight: 140,
        insertImageAsBase64URL: true,
        hidePoweredByJodit: true,
        ...(placeholder ? { placeholder } : {}),
        buttons: 'bold,italic,underline,strikethrough,|,ul,ol,|,outdent,indent,|,font,fontsize,brush,paragraph,|,image,video,table,link,|,align,undo,redo,\n,cut,hr,eraser,copyformat,|,symbol,fullsize,print,about'
    }), [placeholder]);
};

const JoditEditorWithUpload = ({ value = '', onChange, onBlur, placeholder }) => {
    const editor = useRef(null);
    const editorConfig = useJoditConfig(placeholder);

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

    // WAJIB listen ke 'change', bukan hanya 'blur':
    // 'blur' baru kepicu saat user pindah fokus, jadi selama masih mengetik
    // state React masih kosong dan form sempat_report "pertanyaan/pilihan
    // jawaban masih kosong" padahal editor sudah berisi.
    const syncValue = (newContent) => {
        if (onChange) onChange(newContent);
        else if (onBlur) onBlur(newContent);
    };

    return (
        <div className="space-y-2">
            <JoditEditor
                ref={editor}
                value={value}
                config={editorConfig}
                onChange={syncValue}
                onBlur={syncValue}
            />
            <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shadow-xs">
                    <Upload size={14} />
                    Upload Gambar Ke Editor
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

// --- Kartu pilihan cara menghitung nilai (PGK / esai / tabel matrix) ---
const STRATEGY_GROUPS = {
    pgk: ['pgk_partial', 'pgk_strict', 'pgk_any', 'pgk_additive'],
    essay: ['essay_manual', 'essay_keywords', 'essay_any_keyword', 'essay_strict_keywords'],
    matrix: ['matrix_partial', 'matrix_strict'],
};

const strategyGroupFor = (questionType) => {
    if (questionType === MATRIX_TYPE) return 'matrix';
    if (questionType === 'essay') return 'essay';
    return 'pgk';
};

const ScoringStrategyCard = ({ questionType, scoringStrategy, onChange, namePrefix = 'strategy' }) => {
    const group = strategyGroupFor(questionType);
    const options = STRATEGY_GROUPS[group];

    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Cara Menghitung Nilai</p>
            <div className="space-y-2">
                {options.map(value => {
                    const meta = SCORING_LABELS[value];
                    const active = scoringStrategy === value;
                    return (
                        <label
                            key={value}
                            className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${active
                                ? 'border-blue-500 dark:border-blue-400 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-500/20'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                }`}
                        >
                            <input
                                type="radio"
                                name={`${namePrefix}_scoring_strategy`}
                                className="sr-only"
                                checked={active}
                                onChange={() => onChange(value)}
                            />
                            <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${active
                                ? 'border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500'
                                : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-xs font-bold text-slate-900 dark:text-white">{meta.label}</span>
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{meta.desc}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
};

// --- Section Baris + Kolom untuk tipe true_false_matrix ---
const MatrixSection = ({ columns, items, keys, onColumnsChange, onItemsChange, onKeysChange }) => (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-4">
        <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-cyan-500 to-sky-500" aria-hidden="true" />
        <div className="flex items-start gap-2 pt-1">
            <span className="grid place-items-center w-6 h-6 rounded-lg bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 text-xs font-extrabold tabular-nums shrink-0">
                3
            </span>
            <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Tabel Pernyataan & Kunci</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Nama kolom bebas (misal Benar/Salah, Ya/Tidak/Tidak Tahu). Tiap pernyataan hanya boleh memilih satu kolom.
                </p>
            </div>
        </div>

        <MatrixEditor
            columns={columns}
            onColumnsChange={onColumnsChange}
            items={items}
            onItemsChange={onItemsChange}
            correctKeys={keys}
            onCorrectKeysChange={onKeysChange}
            Editor={JoditEditorWithUpload}
            isEmptyStatement={(text) => !hasContent(text)}
        />
    </section>
);

// --- Modal Sunting Soal (UI/UX "Mahal" & Sangat Nyaman) ---
const EditQuestionForm = ({ question, onSave, onCancel }) => {
    const [questionText, setQuestionText] = useState(question.question_text || '');

    const initialOptions = useMemo(() => {
        if (question.question_type === 'matching') return [];

        return toOptionList(question.options).map((opt, index) => ({
            id: index + 1,
            key: opt.key,
            value: opt.value
        }));
    }, [question.options, question.question_type]);

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

    const initialPairs = useMemo(() => {
        if (question.question_type !== 'matching') return [{ id: 1, p: '', r: '' }];
        try {
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

    const isMatrix = questionType === MATRIX_TYPE;

    const initialMatrix = useMemo(() => {
        // Sama seperti di bank: kolom hanya diambil dari options kalau tipe
        // soalnya memang tabel. Untuk PG biasa, options = teks pilihan jawaban
        // dan sama sekali tidak layak jadi nama kolom.
        const fromQuestion = question.question_type === MATRIX_TYPE;
        const columns = fromQuestion
            ? normalizeMatrixColumns(question.options)
            : normalizeMatrixColumns(DEFAULT_MATRIX_COLUMNS);
        const items = fromQuestion ? normalizeMatrixItems(question.matrix_items) : [];
        return {
            columns,
            items,
            keys: normalizeMatrixKeys(getMatrixKeys(question.scoring_metadata), items.length, columns),
        };
    }, [question.options, question.matrix_items, question.scoring_metadata, question.question_type]);

    const [matrixColumns, setMatrixColumns] = useState(initialMatrix.columns);
    const [matrixItems, setMatrixItems] = useState(initialMatrix.items);
    const [matrixKeys, setMatrixKeys] = useState(initialMatrix.keys);

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
        // Kunci harus dialihkan ke pilihan yang BENAR-BENAR tersisa. Kalau
        // masih memakai array lama, kunci bisa menunjuk opsi yang sudah dihapus
        // lalu validasi sempat mengeluh "pilihan jawaban masih kosong".
        const remaining = options.filter(opt => opt.id !== id);
        const fallbackKey = remaining[0]?.key || '';

        if (optionToRemove) {
            if (correctOption === optionToRemove.key) setCorrectOption(fallbackKey);
            setCorrectOptions(prev => {
                const kept = prev.filter(k => k !== optionToRemove.key);
                return kept.length > 0 ? kept : [fallbackKey];
            });
        }
        setOptions(remaining);
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
        } else if (type === MATRIX_TYPE) {
            setOptions([]);
            setCorrectOption(MATRIX_SENTINEL);
            setCorrectOptions([MATRIX_SENTINEL]);
            setScoringStrategy('matrix_partial');
            if (matrixItems.length === 0) {
                const freshItems = [
                    { id: 'r1', text: '' },
                    { id: 'r2', text: '' },
                    { id: 'r3', text: '' },
                    { id: 'r4', text: '' },
                ];
                setMatrixItems(freshItems);
                setMatrixKeys(freshItems.map(() => 'A'));
            }
            if (matrixColumns.length === 0) setMatrixColumns(normalizeMatrixColumns(DEFAULT_MATRIX_COLUMNS));
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
        } else if (questionType === MATRIX_TYPE) {
            if (matrixColumns.some(c => !c.label.trim())) {
                setError(unlabeledColumnError(matrixColumns));
                return;
            }
            if (matrixItems.length === 0 || matrixItems.some(item => !hasContent(item.text))) {
                setError('Ada pernyataan yang masih kosong.');
                return;
            }
        } else if (questionType !== 'essay' && options.some(o => !hasContent(o.value))) {
            setError('Ada pilihan jawaban yang masih kosong.');
            return;
        }

        // Kunci yang menunjuk opsi yang SUDAH DIHAPUS diperbaiki diam-diam ke opsi
        // pertama yang berisi teks. Yang benar-benar kosong (masih ada di form) tetap
        // jadi error, karena itu memang perlu diperbaiki user.
        const keyedOption = options.find(o => o.key === correctOption);
        let resolvedCorrectOption = correctOption;
        if (!keyedOption && questionType !== 'essay' && questionType !== 'matching' && questionType !== MATRIX_TYPE) {
            resolvedCorrectOption = options.find(o => hasContent(o.value))?.key || correctOption;
            setCorrectOption(resolvedCorrectOption);
        } else if (questionType === 'multiple_choice' && !hasContent(keyedOption?.value)) {
            setError('Kunci jawaban menunjuk ke pilihan yang masih kosong.');
            return;
        }

        setLoading(true);
        setError('');

        try {
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
            } else if (questionType === MATRIX_TYPE) {
                optionsForApi = matrixColumns.reduce((acc, col) => {
                    acc[col.key] = col.label.trim();
                    return acc;
                }, {});
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

            const processedMatrixItems = questionType === MATRIX_TYPE
                ? await Promise.all(matrixItems.map(async (item) => ({
                    id: item.id,
                    text: await uploadBase64Images(item.text),
                })))
                : null;

            const finalCorrectOption = questionType === 'multiple_choice_complex' 
                ? [...new Set(correctOptions.filter(k => options.some(o => o.key === k)))].sort().join(',') 
                : (questionType === 'matching' ? 'MATCHING' : (questionType === MATRIX_TYPE ? MATRIX_SENTINEL : resolvedCorrectOption));

            await onSave({
                id: question.id,
                questionText: processedQuestionText,
                options: optionsForApi,
                matrixItems: processedMatrixItems,
                correctOption: finalCorrectOption,
                questionType,
                points,
                scoringStrategy,
                scoringMetadata: questionType === 'essay'
                    ? { keywords: keywords.split(',').map(k => k.trim()).filter(k => k) }
                    : (questionType === MATRIX_TYPE ? { matrixKeys: normalizeMatrixKeys(matrixKeys, matrixItems.length, matrixColumns) } : null)
            });
        } catch (err) {
            setError('Terjadi kesalahan saat menyimpan: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const hasError = !hasContent(questionText)
        || (questionType === 'matching' && matchingPairs.some(p => !hasContent(p.p) || !hasContent(p.r)))
        || (questionType === MATRIX_TYPE && (
            matrixColumns.some(c => !c.label.trim())
            || matrixItems.length === 0
            || matrixItems.some(item => !hasContent(item.text))
        ))
        || (questionType !== 'essay' && questionType !== 'matching' && questionType !== MATRIX_TYPE && options.some(o => !hasContent(o.value)));

    const typeMeta = QUESTION_TYPE_META[questionType] || QUESTION_TYPE_META.multiple_choice;
    const tone = TONE[typeMeta.toneKey];

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-6xl h-[94vh] sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl shadow-slate-950/30 overflow-hidden flex flex-col border border-slate-200/80 dark:border-slate-800 ring-1 ring-slate-900/5 dark:ring-slate-100/5">
                <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shrink-0" />
                
                {/* Mobile Handle */}
                <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
                    <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                </div>

                {/* Header Modal */}
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="grid place-items-center w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-extrabold shadow-xs shrink-0">
                            <Pencil size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Sunting Soal</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wide border ${tone.bg} ${tone.text} ${tone.border}`}>
                                    {QUESTION_TYPE_LABEL[questionType] || questionType}
                                </span>
                                <span className="text-xs font-semibold text-slate-400 tabular-nums">· {points} poin</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        aria-label="Tutup"
                        className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content Scrollable */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/30">
                    {/* Langkah 1: Pilihan Tipe Soal */}
                    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="grid place-items-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                                1
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pilih Tipe Soal</h3>
                            <span className="text-xs text-slate-400 font-medium hidden sm:inline">— Menyesuaikan bentuk soal & cara penilaian</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                            {Object.keys(QUESTION_TYPE_LABEL).map(type => {
                                const active = questionType === type;
                                const meta = QUESTION_TYPE_META[type];
                                const typeTone = TONE[meta.toneKey];
                                const Icon = meta.icon;

                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleTypeChange(type)}
                                        aria-pressed={active}
                                        className={`relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all duration-200 ${active
                                            ? `border-blue-500 dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-md`
                                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 shadow-xs'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between w-full mb-1.5">
                                            <div className={`grid place-items-center w-7 h-7 rounded-xl text-xs ${active ? 'bg-blue-600 text-white' : typeTone.iconBg}`}>
                                                <Icon size={14} />
                                            </div>
                                            {active && <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />}
                                        </div>
                                        <p className={`text-xs font-extrabold ${active ? 'text-blue-900 dark:text-blue-100' : 'text-slate-900 dark:text-white'}`}>
                                            {QUESTION_TYPE_LABEL[type]}
                                        </p>
                                        <p className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-400'}`}>
                                            {QUESTION_TYPE_HINT[type]}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Main Layout (2 Kolom) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Kolom Kiri Utama */}
                        <div className="lg:col-span-2 space-y-6 min-w-0">
                            {/* Langkah 2: Pertanyaan Editor */}
                            <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="grid place-items-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                                        2
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Isi Pertanyaan</h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Tulis teks pertanyaan, sisipkan gambar, tabel, atau rumus HTML.</p>
                                    </div>
                                </div>

                                <JoditEditorWithUpload
                                    value={questionText}
                                    placeholder="Tulis pertanyaan di sini…"
                                    onChange={newContent => setQuestionText(newContent)}
                                />
                                {!hasContent(questionText) && hasError && (
                                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Pertanyaan masih kosong.</p>
                                )}
                            </section>

                            {/* Langkah 3: Opsi & Kunci Jawaban (Lifted Option Cards) */}
                            {questionType !== 'essay' && questionType !== 'matching' && questionType !== MATRIX_TYPE && (
                                <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="grid place-items-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                                                3
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pilihan Jawaban & Kunci</h3>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    {questionType === 'multiple_choice_complex'
                                                        ? 'Centang penanda kunci di sebelah kiri opsi. Boleh lebih dari satu.'
                                                        : 'Tentukan kunci jawaban pada salah satu pilihan.'}
                                                </p>
                                            </div>
                                        </div>

                                        {questionType !== 'true_false' && (
                                            <button
                                                type="button"
                                                onClick={addOption}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 text-xs font-extrabold text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 transition-all shadow-xs shrink-0"
                                            >
                                                <Plus size={14} />
                                                Tambah Opsi
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {options.map(opt => {
                                            const isKey = questionType === 'multiple_choice_complex'
                                                ? correctOptions.includes(opt.key)
                                                : correctOption === opt.key;

                                            return (
                                                <div
                                                    key={opt.id}
                                                    className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 shadow-sm ${
                                                        isKey
                                                            ? 'border-emerald-400 dark:border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-500/5'
                                                            : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3.5">
                                                        {/* Toggle Kunci */}
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
                                                            <span className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                                                                isKey
                                                                    ? 'bg-emerald-600 border-emerald-600 text-white font-extrabold shadow-sm'
                                                                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 hover:border-emerald-400'
                                                            }`}>
                                                                {isKey ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-bold">{opt.key}</span>}
                                                            </span>
                                                            <span className={`text-[10px] font-extrabold ${isKey ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                                                                {isKey ? 'KUNCI' : 'Kunci?'}
                                                            </span>
                                                        </label>

                                                        {/* Editor isi opsi */}
                                                        <div className="flex-1 min-w-0 space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">Pilihan {opt.key}</span>
                                                                {isKey && (
                                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] uppercase">
                                                                        Kunci Jawaban Benar
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {questionType === 'true_false' ? (
                                                                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100">
                                                                    {opt.value}
                                                                </div>
                                                            ) : (
                                                                <JoditEditorWithUpload value={opt.value || ''} placeholder={`Isi pilihan ${opt.key}`} onChange={newContent => handleOptionChange(opt.id, newContent)} />
                                                            )}
                                                        </div>

                                                        {/* Tombol Hapus Opsi */}
                                                        {options.length > 2 && questionType !== 'true_false' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeOption(opt.id)}
                                                                aria-label={`Hapus opsi ${opt.key}`}
                                                                className="shrink-0 p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Langkah 3: Menjodohkan (Matching) */}
                            {questionType === 'matching' && (
                                <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="grid place-items-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                                                3
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pasangan Menjodohkan</h3>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">Tulis pernyataan di sisi kiri, dan pasangan yang tepat di sisi kanan.</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addPair}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 text-xs font-extrabold text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 transition-all shadow-xs shrink-0"
                                        >
                                            <Plus size={14} />
                                            Tambah Pasangan
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {matchingPairs.map((pair, index) => (
                                            <div key={pair.id} className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 tabular-nums">
                                                        Pasangan {index + 1}
                                                    </span>
                                                    {matchingPairs.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removePair(pair.id)}
                                                            aria-label={`Hapus pasangan ${index + 1}`}
                                                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
                                                    <JoditEditorWithUpload value={pair.p || ''} placeholder="Pernyataan" onChange={newContent => handlePairChange(pair.id, 'p', newContent)} />
                                                    <span className="hidden sm:grid place-items-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                                                        <GitCompareArrows size={16} />
                                                    </span>
                                                    <JoditEditorWithUpload value={pair.r || ''} placeholder="Pasangannya" onChange={newContent => handlePairChange(pair.id, 'r', newContent)} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Langkah 3: Tabel Pernyataan (true_false_matrix) */}
                            {isMatrix && (
                                <MatrixSection
                                    columns={matrixColumns}
                                    items={matrixItems}
                                    keys={matrixKeys}
                                    onColumnsChange={setMatrixColumns}
                                    onItemsChange={setMatrixItems}
                                    onKeysChange={setMatrixKeys}
                                />
                            )}
                        </div>

                        {/* Sidebar Pengaturan Modal (Kolom Kanan) */}
                        <aside className="space-y-4">
                            {/* Card Bobot Poin */}
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-2">
                                <label htmlFor="edit-points" className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                                    Bobot Poin Soal
                                </label>
                                <input
                                    id="edit-points"
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={points}
                                    onChange={(e) => setPoints(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">Poin soal ini saat dihitung nilainya.</p>
                            </div>

                            {/* Card Kata Kunci (Esai) */}
                            {questionType === 'essay' && (
                                <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-2">
                                    <label htmlFor="edit-keywords" className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                                        Kata Kunci Jawaban
                                    </label>
                                    <input
                                        id="edit-keywords"
                                        type="text"
                                        placeholder="misal: sel, membran, inti"
                                        value={keywords}
                                        onChange={(e) => setKeywords(e.target.value)}
                                        className={EDIT_INPUT_CLASS}
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Pisahkan beberapa kata kunci dengan tanda koma.</p>
                                </div>
                            )}

{/* Card Cara Menghitung Nilai */}
                            {(questionType === 'multiple_choice_complex' || questionType === 'essay' || questionType === MATRIX_TYPE) && (
                                <ScoringStrategyCard
                                    questionType={questionType}
                                    scoringStrategy={scoringStrategy}
                                    onChange={setScoringStrategy}
                                    namePrefix="edit"
                                />
                            )}

                            {/* Live Summary Card */}
                            <div className="relative overflow-hidden rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-4.5 shadow-sm space-y-1">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">Ringkasan Soal Ini</p>
                                <p className="text-2xl font-extrabold text-blue-900 dark:text-blue-100 tabular-nums">
                                    {points} <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">poin</span>
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                    Tipe: <strong>{QUESTION_TYPE_LABEL[questionType]}</strong>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Penilaian: <strong>{SCORING_LABELS[scoringStrategy]?.label || scoringStrategy}</strong>
                                </p>
                            </div>
                        </aside>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
                            <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
                            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                        {hasError ? 'Lengkapi pertanyaan atau opsi yang masih kosong.' : 'Siap menyimpan perubahan ke soal.'}
                    </p>
                    <div className="flex items-center gap-2.5 ml-auto">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Form Input Manual ---
const ManualInputForm = ({ examId, onQuestionAdded }) => {
    const [questionText, setQuestionText] = useState('');
    const [options, setOptions] = useState([
        { id: 1, key: 'A', value: '' },
        { id: 2, key: 'B', value: '' },
    ]);
    const [correctOption, setCorrectOption] = useState('A');
    const [questionType, setQuestionType] = useState('multiple_choice');
    const [correctOptions, setCorrectOptions] = useState(['A']);
    const [points, setPoints] = useState(1);
    const [scoringStrategy, setScoringStrategy] = useState('standard');
    const [keywords, setKeywords] = useState('');
    const [matchingPairs, setMatchingPairs] = useState([{ id: 1, p: '', r: '' }]);
    const [matrixColumns, setMatrixColumns] = useState(normalizeMatrixColumns(DEFAULT_MATRIX_COLUMNS));
    const [matrixItems, setMatrixItems] = useState([
        { id: 'r1', text: '' }, { id: 'r2', text: '' }, { id: 'r3', text: '' }, { id: 'r4', text: '' },
    ]);
    const [matrixKeys, setMatrixKeys] = useState(['A', 'A', 'A', 'A']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const nextOptionId = useRef(3);
    const nextPairId = useRef(2);

    const isMatrix = questionType === MATRIX_TYPE;

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
        // Sama seperti di form sunting: kunci pindah ke opsi yang tersisa,
        // bukan ke opsi yang barusan dihapus.
        const remaining = options.filter(opt => opt.id !== id);
        if (optionToRemove && correctOption === optionToRemove.key) {
            setCorrectOption(remaining[0]?.key || '');
        }
        if (optionToRemove) {
            setCorrectOptions(prev => {
                const kept = prev.filter(k => k !== optionToRemove.key);
                return kept.length > 0 ? kept : [remaining[0]?.key || ''];
            });
        }
        setOptions(remaining);
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
        setMatrixColumns(normalizeMatrixColumns(DEFAULT_MATRIX_COLUMNS));
        setMatrixItems([{ id: 'r1', text: '' }, { id: 'r2', text: '' }, { id: 'r3', text: '' }, { id: 'r4', text: '' }]);
        setMatrixKeys(['A', 'A', 'A', 'A']);
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
        } else if (type === MATRIX_TYPE) {
            setOptions([]);
            setCorrectOption(MATRIX_SENTINEL);
            setCorrectOptions([MATRIX_SENTINEL]);
            setScoringStrategy('matrix_partial');
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
        } else if (questionType === MATRIX_TYPE) {
            if (matrixColumns.some(c => !c.label.trim())) {
                setError(unlabeledColumnError(matrixColumns));
                return;
            }
            if (matrixItems.length === 0 || matrixItems.some(item => !hasContent(item.text))) {
                setError('Ada pernyataan yang masih kosong.');
                return;
            }
        } else if (questionType !== 'essay' && options.some(o => !hasContent(o.value))) {
            setError('Ada pilihan jawaban yang masih kosong.');
            return;
        }

        // Kunci yang menunjuk opsi yang SUDAH DIHAPUS diperbaiki diam-diam ke opsi
        // pertama yang berisi teks. Yang benar-benar kosong (masih ada di form) tetap
        // jadi error, karena itu memang perlu diperbaiki user.
        const keyedOption = options.find(o => o.key === correctOption);
        let resolvedCorrectOption = correctOption;
        if (!keyedOption && questionType !== 'essay' && questionType !== 'matching' && questionType !== MATRIX_TYPE) {
            resolvedCorrectOption = options.find(o => hasContent(o.value))?.key || correctOption;
            setCorrectOption(resolvedCorrectOption);
        } else if (questionType === 'multiple_choice' && !hasContent(keyedOption?.value)) {
            setError('Kunci jawaban menunjuk ke pilihan yang masih kosong.');
            return;
        }

        setError('');
        setLoading(true);

        try {
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
            } else if (questionType === MATRIX_TYPE) {
                optionsForApi = matrixColumns.reduce((acc, col) => {
                    acc[col.key] = col.label.trim();
                    return acc;
                }, {});
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

            const processedMatrixItems = questionType === MATRIX_TYPE
                ? await Promise.all(matrixItems.map(async (item) => ({
                    id: item.id,
                    text: await uploadBase64Images(item.text),
                })))
                : null;

            const finalCorrectOption = questionType === 'multiple_choice_complex' 
                ? [...new Set(correctOptions.filter(k => options.some(o => o.key === k)))].sort().join(',') 
                : (questionType === 'matching' ? 'MATCHING' : (questionType === MATRIX_TYPE ? MATRIX_SENTINEL : resolvedCorrectOption));

            const res = await fetch('/api/exams/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    examId, 
                    questionText: processedQuestionText, 
                    options: optionsForApi, 
                    matrixItems: processedMatrixItems,
                    correctOption: finalCorrectOption,
                    questionType,
                    points,
                    scoringStrategy,
                    scoringMetadata: questionType === 'essay'
                        ? { keywords: keywords.split(',').map(k => k.trim()).filter(k => k) }
                        : (questionType === MATRIX_TYPE ? { matrixKeys: normalizeMatrixKeys(matrixKeys, matrixItems.length, matrixColumns) } : null)
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
        || (questionType === MATRIX_TYPE && (
            matrixColumns.some(c => !c.label.trim())
            || matrixItems.length === 0
            || matrixItems.some(item => !hasContent(item.text))
        ))
        || (questionType !== 'essay' && questionType !== 'matching' && questionType !== MATRIX_TYPE && options.some(o => !hasContent(o.value)));

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Tipe soal */}
            <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                    <span className="grid place-items-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                        1
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pilih Tipe Soal</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {Object.keys(QUESTION_TYPE_LABEL).map(type => {
                        const active = questionType === type;
                        const meta = QUESTION_TYPE_META[type];
                        const typeTone = TONE[meta.toneKey];
                        const Icon = meta.icon;

                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => handleTypeChange(type)}
                                aria-pressed={active}
                                className={`relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all duration-200 ${active
                                    ? `border-blue-500 dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-md`
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                    }`}
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <div className={`grid place-items-center w-6 h-6 rounded-lg text-xs ${active ? 'bg-blue-600 text-white' : typeTone.iconBg}`}>
                                        <Icon size={13} />
                                    </div>
                                    {active && <CheckCircle2 size={15} className="text-blue-600 dark:text-blue-400" />}
                                </div>
                                <p className={`text-xs font-extrabold ${active ? 'text-blue-900 dark:text-blue-100' : 'text-slate-900 dark:text-white'}`}>
                                    {QUESTION_TYPE_LABEL[type]}
                                </p>
                                <p className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-400'}`}>
                                    {QUESTION_TYPE_HINT[type]}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6 min-w-0">
                    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="grid place-items-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                                2
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pertanyaan</h3>
                        </div>
                        <JoditEditorWithUpload
                            value={questionText}
                            placeholder="Tulis pertanyaan di sini…"
                            onChange={newContent => setQuestionText(newContent)}
                        />
                        {!hasContent(questionText) && hasError && (
                            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Pertanyaan masih kosong.</p>
                        )}
                    </section>

                    {questionType !== 'essay' && questionType !== 'matching' && questionType !== MATRIX_TYPE && (
                        <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="grid place-items-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                                        3
                                    </span>
                                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pilihan Jawaban</h3>
                                </div>
                                {questionType !== 'true_false' && (
                                    <button
                                        type="button"
                                        onClick={addOption}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 text-xs font-extrabold text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 transition-all shadow-xs"
                                    >
                                        <Plus size={14} />
                                        Tambah Opsi
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {options.map(opt => {
                                    const isKey = questionType === 'multiple_choice_complex'
                                        ? correctOptions.includes(opt.key)
                                        : correctOption === opt.key;

                                    return (
                                        <div
                                            key={opt.id}
                                            className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 shadow-sm ${
                                                isKey
                                                    ? 'border-emerald-400 dark:border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-500/5'
                                                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3.5">
                                                <label className="shrink-0 cursor-pointer select-none pt-1 flex flex-col items-center gap-1">
                                                    <input
                                                        type={questionType === 'multiple_choice_complex' ? 'checkbox' : 'radio'}
                                                        name="manual_correct_choice"
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
                                                    <span className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                                                        isKey
                                                            ? 'bg-emerald-600 border-emerald-600 text-white font-extrabold shadow-sm'
                                                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 hover:border-emerald-400'
                                                    }`}>
                                                        {isKey ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-bold">{opt.key}</span>}
                                                    </span>
                                                    <span className={`text-[10px] font-extrabold ${isKey ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                                                        {isKey ? 'KUNCI' : 'Kunci?'}
                                                    </span>
                                                </label>

                                                <div className="flex-1 min-w-0 space-y-1">
                                                    {questionType === 'true_false' ? (
                                                        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100">
                                                            {opt.value}
                                                        </div>
                                                    ) : (
                                                        <JoditEditorWithUpload value={opt.value || ''} placeholder={`Isi pilihan ${opt.key}`} onChange={newContent => handleOptionChange(opt.id, newContent)} />
                                                    )}
                                                </div>

                                                {options.length > 2 && questionType !== 'true_false' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeOption(opt.id)}
                                                        aria-label={`Hapus opsi ${opt.key}`}
                                                        className="shrink-0 p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {questionType === 'matching' && (
                        <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="grid place-items-center w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                                        3
                                    </span>
                                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pasangan Menjodohkan</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={addPair}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 text-xs font-extrabold text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 transition-all shadow-xs"
                                >
                                    <Plus size={14} />
                                    Tambah Pasangan
                                </button>
                            </div>

                            <div className="space-y-3">
                                {matchingPairs.map((pair, index) => (
                                    <div key={pair.id} className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 tabular-nums">
                                                Pasangan {index + 1}
                                            </span>
                                            {matchingPairs.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePair(pair.id)}
                                                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
                                            <JoditEditorWithUpload value={pair.p || ''} placeholder="Pernyataan" onChange={newContent => handlePairChange(pair.id, 'p', newContent)} />
                                            <span className="hidden sm:grid place-items-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                                                <GitCompareArrows size={16} />
                                            </span>
                                            <JoditEditorWithUpload value={pair.r || ''} placeholder="Pasangannya" onChange={newContent => handlePairChange(pair.id, 'r', newContent)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {isMatrix && (
                        <MatrixSection
                            columns={matrixColumns}
                            items={matrixItems}
                            keys={matrixKeys}
                            onColumnsChange={setMatrixColumns}
                            onItemsChange={setMatrixItems}
                            onKeysChange={setMatrixKeys}
                        />
                    )}
                </div>

                <aside className="space-y-4">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-2">
                        <label htmlFor="manual-points" className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                            Bobot Poin Soal
                        </label>
                        <input
                            id="manual-points"
                            type="number"
                            step="any"
                            min="0"
                            value={points}
                            onChange={(e) => setPoints(parseFloat(e.target.value) || 0)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>

                    {questionType === 'essay' && (
                        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-sm space-y-2">
                            <label htmlFor="manual-keywords" className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                                Kata Kunci Jawaban
                            </label>
                            <input
                                id="manual-keywords"
                                type="text"
                                placeholder="misal: sel, membran, inti"
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                className={EDIT_INPUT_CLASS}
                            />
                        <ScoringStrategyCard
                                questionType={questionType}
                                scoringStrategy={scoringStrategy}
                                onChange={setScoringStrategy}
                                namePrefix="manual"
                            />
                        </div>
                    )}
                </aside>
            </div>

            {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
                    <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>
                </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                    {hasError ? 'Lengkapi pertanyaan atau opsi yang masih kosong.' : 'Siap disimpan ke daftar soal.'}
                </p>
                <button
                    type="submit"
                    disabled={loading}
                    className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    <Plus size={15} />
                    {loading ? 'Menyimpan...' : 'Simpan Soal'}
                </button>
            </div>
        </form>
    );
};

// --- Import Word / ZIP Form ---
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
            setError('Pilih file berformat .zip atau .docx');
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
            setError('Belum ada file yang dipilih.');
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
                throw new Error(data.message || 'Gagal mengimpor file.');
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/30 p-4">
                <div className="min-w-0">
                    <p className="text-sm font-extrabold text-blue-900 dark:text-blue-100">Format File Word</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                        Unduh template untuk melihat contoh penulisan soal & kunci jawaban.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href="/dashboard/exams/questions/panduan"
                        target="_blank"
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-slate-800/80 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 transition-colors"
                    >
                        Buka Panduan
                    </Link>
                    <a
                        href="/Template Soal Rushless.docx"
                        download
                        className="px-3.5 py-2 text-xs font-extrabold rounded-xl bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                    >
                        Unduh Template
                    </a>
                </div>
            </div>

            <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Pilih file (.docx atau .zip)</p>
                <label className="flex flex-col items-center justify-center w-full px-4 py-10 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/20 transition-all">
                    <span className="grid place-items-center w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-2">
                        <Upload size={20} />
                    </span>
                    <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 text-center break-all px-2">
                        {file ? file.name : 'Klik untuk memilih file dari komputer'}
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
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>
                </div>
            )}
            {success && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                    <Check size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{success}</p>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {file ? 'Anda bisa melihat pratinjau terlebih dahulu.' : 'Pilih file terlebih dahulu.'}
                </p>
                <div className="flex items-center gap-2">
                    {file && (
                        <button
                            type="button"
                            disabled={previewLoading || loading}
                            onClick={handlePreview}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            {previewLoading ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <Eye size={15} />}
                            {previewLoading ? 'Memuat...' : 'Lihat Pratinjau'}
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={!file || loading || previewLoading}
                        className="inline-flex items-center gap-2 px-5 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                        {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                        {loading ? 'Mengimpor...' : 'Impor Soal'}
                    </button>
                </div>
            </div>

            {showPreviewModal && (
                <ModalShell
                    title="Pratinjau Dokumen Word"
                    description={file?.name}
                    onClose={() => setShowPreviewModal(false)}
                    size="xl"
                    footer={(
                        <>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Pastikan isi soal dan kuncinya sudah sesuai.</p>
                            <button
                                type="button"
                                onClick={() => setShowPreviewModal(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                Tutup
                            </button>
                        </>
                    )}
                >
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 prose prose-slate dark:prose-invert max-w-none">
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                        {questionCount} soal akan dihapus dari ujian ini.
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                            Batal
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-500/20 transition-all disabled:opacity-50"
                        >
                            {loading && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                            {loading ? 'Menghapus...' : 'Ya, Hapus Semua'}
                        </button>
                    </div>
                </>
            )}
        >
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
                <AlertTriangle size={20} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <p className="text-xs sm:text-sm font-semibold text-rose-800 dark:text-rose-300 leading-relaxed">
                    Seluruh isi soal beserta pilihan jawaban dan kunci akan dihapus permanen. Ujian akan kembali kosong tanpa soal.
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
        { value: 'questions_and_answers', label: 'Soal + Kunci Jawaban', desc: 'Soal lengkap dengan penanda jawaban benar.' },
        { value: 'questions_only', label: 'Soal Saja', desc: 'Soal tanpa menandai kunci jawaban. Cocok untuk dicetak.' },
        { value: 'answers_only', label: 'Kunci Jawaban Saja', desc: 'Hanya ringkasan kunci jawaban per nomor.' }
    ];

    return (
        <ModalShell
            title="Export Soal ke Word"
            description="Unduh soal ujian ini dalam file Word (.docx)."
            onClose={onClose}
            footer={(
                <>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Format: {exportFormat === 'standard' ? 'Standar' : 'Rushless (dapat di-import)'}
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                            Batal
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                        >
                            {loading ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <DownloadCloud size={15} />}
                            {loading ? 'Menyiapkan...' : 'Unduh Word'}
                        </button>
                    </div>
                </>
            )}
        >
            <div className="space-y-2.5">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilih isi file</p>
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
                            className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${isActive
                                ? 'border-blue-500 dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/30 shadow-xs'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'}`}
                        >
                            <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-xs font-bold text-slate-900 dark:text-white">{m.label}</span>
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {exportMode === 'questions_and_answers' && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Format Penulisan</p>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { value: 'standard', label: 'Standar', desc: 'Kunci jawaban ditulis di akhir soal.' },
                            { value: 'rushless', label: 'Rushless (Re-import)', desc: 'Bertanda bintang, bisa di-import balik.' }
                        ].map(f => {
                            const isActive = exportFormat === f.value;
                            return (
                                <button
                                    key={f.value}
                                    type="button"
                                    onClick={() => setExportFormat(f.value)}
                                    aria-pressed={isActive}
                                    className={`p-3 rounded-xl border text-left transition-all ${isActive
                                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/30'
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900'}`}
                                >
                                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{f.label}</span>
                                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{f.desc}</span>
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
    const [refreshing, setRefreshing] = useState(false);
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

    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [deleteAllLoading, setDeleteAllLoading] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);

    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showGuide, setShowGuide] = useState(true);
    const [addModal, setAddModal] = useState(null);

    /**
     * `silent: true` dipakai untuk refresh setelah edit/hapus/reorder.
     *
     * Kalau pakai mode biasa, `loading` mengganti seluruh daftar soal dengan
     * skeleton dan tinggi halaman mendadak menyusut. Browser langsung clamp
     * scroll ke atas, jadi user yang sedang di soal nomor 50 tiba-tiba
     * terdarat di soal nomor 1. Mode ini membuat daftar lama tetap di tempat
     * (halaman tidak pernah menyusut) dan posisi scroll dipulihkan.
     */
    const fetchQuestions = useCallback(async ({ silent = false } = {}) => {
        const scrollBefore = silent && typeof window !== 'undefined' ? window.scrollY : 0;

        if (silent) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await fetch(`/api/exams/questions?examId=${examId}`);
            const examRes = await fetch(`/api/exams/settings?examId=${examId}`);

            if (!res.ok) throw new Error('Gagal mengambil daftar soal');

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

// MenjoDohkan & tabel pernyataan sudah punya "key" yang bermakna
                // (id pasangan / huruf kolom) - jangan di-re-key ke A/B/C.
                if (q.question_type === 'matching' || q.question_type === MATRIX_TYPE) {
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
                if (q.correct_option && /^\d+$/.test(String(q.correct_option))) {
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
            if (silent) {
                setRefreshing(false);
                // Pengaman kedua: kalau tinggi halaman sempat berubah (mis. soal
                // yang diedit jadi jauh lebih pendek atau lebih panjang),
                // kembalikan user ke posisi scroll yang sama.
                if (typeof window !== 'undefined' && window.scrollY !== scrollBefore) {
                    requestAnimationFrame(() => window.scrollTo({ top: scrollBefore, behavior: 'auto' }));
                }
            } else {
                setLoading(false);
            }
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
            fetchQuestions({ silent: true });
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
            fetchQuestions({ silent: true });
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
            fetchQuestions({ silent: true });
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
            fetchQuestions({ silent: true });
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
            fetchQuestions({ silent: true });
        } catch (err) {
            toast.error('Gagal menyimpan perubahan: ' + err.message);
        }
    };

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

        try {
            const orderedIds = reordered.map(q => q.id);
            await fetch('/api/exams/questions/reorder', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds }),
            });
        } catch (err) {
            console.error('Failed to save order:', err);
            fetchQuestions({ silent: true });
        }
    };

    return (
        <div className="space-y-5">
            {/* Header dengan Latar Gradien & Akses Cepat */}
            <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-5 sm:p-6 backdrop-blur-sm shadow-sm ring-1 ring-blue-500/10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
                    <div className="min-w-0">
                        <Link
                            href={`/dashboard/exams/manage/${examId}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 transition-colors mb-2 px-2.5 py-1 rounded-lg bg-blue-100/70 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/50"
                        >
                            <ArrowLeft size={14} />
                            Pengaturan Ujian
                        </Link>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white break-words tracking-tight">
                            {examName ? `Kelola Soal: ${examName}` : 'Kelola Soal Ujian'}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Susun soal ujian, tentukan kunci jawaban, serta atur pembobotan poin secara terstruktur.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <Link
                            href={`/dashboard/exams/results/${examId}`}
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                        >
                            <Library size={14} className="text-purple-500" />
                            Lihat Hasil
                        </Link>
                        <Link
                            href={`/dashboard/exams/preview/${examId}`}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20"
                        >
                            <Eye size={14} />
                            Preview Soal
                        </Link>
                    </div>
                </div>
            </div>

            {/* Langkah kerja (StepCards) */}
            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StepCard step="1" title="1. Tambah Soal" description="Tulis manual, import Word, atau dari Bank." active={questions.length === 0} done={questions.length > 0} />
                <StepCard step="2" title="2. Atur Poin" description="Pastikan total poin sesuai target skor." active={pointsMismatch} done={!pointsMismatch && questions.length > 0} />
                <StepCard step="3" title="3. Cek & Terbitkan" description="Preview tampilan siswa, lalu buka sesi ujian." />
            </ol>

            {/* Panduan */}
            {showGuide && (
                <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-4.5 shadow-sm">
                    <div className="flex items-start gap-3.5">
                        <div className="grid place-items-center w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                            <Sparkles size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-extrabold text-blue-900 dark:text-blue-100 uppercase tracking-wider">Panduan Cepat</p>
                            <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                                <GuideItem text="Tambah soal lewat panel Tambah Soal di sebelah kiri. Tersedia 5 tipe soal." />
                                <GuideItem text="Tentukan kunci jawaban. Untuk Pilihan Ganda Kompleks boleh lebih dari satu jawaban benar." />
                                <GuideItem text="Total poin idealnya sama dengan Target Skor di Penyekoran & Poin. Gunakan Bagi Rata bila perlu." />
                                <GuideItem text="Geser baris soal untuk mengubah urutan, atau klik baris untuk menyunting isi soal." />
                            </ul>
                        </div>
                        <button
                            onClick={() => setShowGuide(false)}
                            aria-label="Tutup panduan"
                            className="shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Warning Total Poin */}
            {pointsMismatch && (
                <div className="relative overflow-hidden rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4.5 py-3.5 shadow-sm flex flex-wrap items-center gap-3">
                    <div className="grid place-items-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                        <AlertTriangle size={18} />
                    </div>
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex-1 min-w-[200px] leading-relaxed">
                        Total poin soal saat ini <strong className="tabular-nums font-bold">{formatPoints(totalPoints)}</strong>, target skor <strong className="tabular-nums font-bold">{formatPoints(targetPoints)}</strong>. Nilai akhir siswa dihitung relatif terhadap total poin ini.
                    </p>
                    <button
                        onClick={handleNormalizePoints}
                        disabled={normalizeLoading}
                        className="px-3.5 py-1.5 text-xs font-extrabold rounded-xl border border-amber-300 dark:border-amber-800 bg-white/80 dark:bg-slate-800 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all shadow-xs disabled:opacity-50"
                    >
                        {normalizeLoading ? 'Memproses...' : 'Bagi Poin Rata'}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Panel Kiri: Tambah Soal + Penyekoran */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-100/5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                        <div className="px-4.5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Tambah Soal Baru</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih metode input untuk menambahkan soal.</p>
                        </div>

                        <div className="p-3 space-y-2">
                            <AddTabButton
                                active={addModal === 'manual'}
                                onClick={() => setAddModal('manual')}
                                icon={<Plus size={16} />}
                                title="Input Manual"
                                description="Tulis satu per satu dengan editor lengkap."
                            />
                            <AddTabButton
                                active={addModal === 'import'}
                                onClick={() => setAddModal('import')}
                                icon={<Upload size={16} />}
                                title="Import Word / ZIP"
                                description="Impor banyak soal sekaligus dari dokumen."
                            />
                            <AddTabButton
                                active={isBankPickerOpen}
                                onClick={() => setIsBankPickerOpen(true)}
                                icon={<Library size={16} />}
                                title="Ambil dari Bank Soal"
                                description="Gunakan soal dari koleksi Bank Soal."
                            />
                        </div>
                    </div>

                    {/* Accordion Penyekoran */}
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-100/5">
                        <button
                            onClick={() => setShowScoringSettings(!showScoringSettings)}
                            aria-expanded={showScoringSettings}
                            className="w-full px-4.5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <span className="grid place-items-center w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                                <Scale size={18} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">Penyekoran & Poin</span>
                                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                    Total {formatPoints(totalPoints)} dari target {formatPoints(targetPoints)} poin
                                </span>
                            </span>
                            <ChevronRight size={16} className={`shrink-0 text-slate-400 transition-transform ${showScoringSettings ? 'rotate-90' : ''}`} />
                        </button>

                        {showScoringSettings && (
                            <div className="px-4.5 pb-4 pt-1 space-y-4 border-t border-slate-200 dark:border-slate-800">
                                <div>
                                    <label htmlFor="targetScore" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">Target Total Skor</label>
                                    <input
                                        id="targetScore"
                                        type="number"
                                        min="0"
                                        value={totalTargetScore}
                                        onChange={(e) => setTotalTargetScore(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 font-extrabold tabular-nums outline-none focus:border-purple-400 transition-all"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                        Target nilai siswa jika menjawab semua benar (misal: 100).
                                    </p>
                                </div>

                                <label className="flex items-start justify-between gap-4 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                    <span className="min-w-0">
                                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Otomatis Bagi Poin</span>
                                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Poin tiap soal dihitung otomatis dari target skor.</span>
                                    </span>
                                    <span className="relative shrink-0 mt-0.5">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={autoDistribute}
                                            onChange={() => setAutoDistribute(!autoDistribute)}
                                        />
                                        <span className="block w-11 h-6 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors peer-checked:bg-purple-600" />
                                        <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                                    </span>
                                </label>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={handleSaveScoringSettings}
                                        disabled={savingSettings}
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold bg-purple-600 dark:bg-purple-500 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-md shadow-purple-500/20"
                                    >
                                        {savingSettings && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                                        {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                                    </button>
                                    <button
                                        onClick={handleNormalizePoints}
                                        disabled={normalizeLoading || questions.length === 0}
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        <Scale size={14} />
                                        {normalizeLoading ? 'Memproses...' : 'Bagi Poin Rata ke Semua Soal'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Kanan: Daftar Soal */}
                <div className="lg:col-span-2">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-100/5">
                        <div className="px-4.5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Daftar Soal</h2>
                                <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50 text-xs font-extrabold tabular-nums">
                                    {questions.length} soal
                                </span>
                                {refreshing && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/50 text-[11px] font-extrabold">
                                        <span className="w-3 h-3 rounded-full border-2 border-amber-500/30 border-t-amber-600 dark:border-t-amber-400 animate-spin" />
                                        Menyegarkan
                                    </span>
                                )}
                            </div>

                            {questions.length > 0 && (
                                <div className="sm:ml-auto flex items-center gap-2">
                                    <button
                                        onClick={() => setShowExportModal(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    >
                                        <DownloadCloud size={14} />
                                        Export
                                    </button>
                                    <button
                                        onClick={() => setIsBankExportOpen(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    >
                                        <Database size={14} />
                                        Ke Bank
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteAllModal(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={14} />
                                        Hapus Semua
                                    </button>
                                </div>
                            )}
                        </div>

                        {questions.length > 0 && (
                            <div className="px-4.5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row gap-2.5">
                                <div className="relative flex-1">
                                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Cari isi soal..."
                                        aria-label="Cari soal"
                                        className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition-all"
                                    />
                                </div>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    aria-label="Filter tipe soal"
                                    className="px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-blue-400 transition-all"
                                >
                                    <option value="all">Semua Tipe ({questions.length})</option>
                                    {typeOptions.map(t => (
                                        <option key={t.value} value={t.value}>{t.label} ({t.count})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="p-3.5 space-y-3" aria-busy={refreshing}>
                            {error && (
                                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3.5 py-2.5 rounded-xl">{error}</p>
                            )}

                            {loading ? (
                                <div className="space-y-3">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/80 animate-pulse" />
                                    ))}
                                </div>
                            ) : questions.length === 0 ? (
                                <div className="py-12 text-center">
                                    <div className="grid place-items-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mx-auto mb-3">
                                        <FileText size={22} />
                                    </div>
                                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">Belum ada soal</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                        Mulai dari panel <strong>Tambah Soal</strong> di sebelah kiri: tulis manual, import Word, atau dari Bank Soal.
                                    </p>
                                    <button
                                        onClick={() => setAddModal('manual')}
                                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all"
                                    >
                                        <Plus size={14} />
                                        Tambah soal pertama
                                    </button>
                                </div>
                            ) : filteredQuestions.length === 0 ? (
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center py-12">
                                    Tidak ada soal yang cocok dengan pencarian atau filter.
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
                            <p className="px-4.5 py-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                                Geser ikon titik untuk mengurutkan posisi soal. Klik baris soal untuk menyunting.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <BankPickerModal
                isOpen={isBankPickerOpen}
                onClose={() => setIsBankPickerOpen(false)}
                examId={examId}
                onSelect={() => fetchQuestions({ silent: true })}
            />

            {addModal === 'manual' && (
                <ModalShell
                    title="Tambah Soal Baru"
                    description="Isi pertanyaan, pilihan jawaban, serta bobot poinnya."
                    size="xl"
                    onClose={() => setAddModal(null)}
                >
                    <ManualInputForm
                        examId={examId}
                        onQuestionAdded={() => {
                            toast.success('Soal berhasil ditambahkan.');
                            fetchQuestions({ silent: true });
                            setAddModal(null);
                        }}
                    />
                </ModalShell>
            )}

            {addModal === 'import' && (
                <ModalShell
                    title="Import Soal dari Dokumen"
                    description="Unggah file Word (.docx) atau file .zip hasil ekspor Word."
                    size="lg"
                    onClose={() => setAddModal(null)}
                >
<ImportWordForm
                    examId={examId}
                    onQuestionAdded={() => {
                        fetchQuestions({ silent: true });
                    }}
                />
                </ModalShell>
            )}

            {editingQuestion && (
                <EditQuestionForm
                    question={editingQuestion}
                    onSave={handleUpdateQuestion}
                    onCancel={() => setEditingQuestion(null)}
                />
            )}

            {isBankExportOpen && (
                <BankSelectorModal
                    isOpen={isBankExportOpen}
                    onClose={() => setIsBankExportOpen(false)}
                    onSelect={async (folderId) => {
                        try {
                            const res = await fetch('/api/bank/export-exam', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ exam_id: examId, folder_id: folderId }),
                            });
                            if (!res.ok) throw new Error((await res.json()).message || 'Export to bank failed');
                            toast.success('Seluruh soal berhasil disimpan ke Bank Soal.');
                            setIsBankExportOpen(false);
                        } catch (err) {
                            toast.error('Gagal menyimpan: ' + err.message);
                        }
                    }}
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
        </div>
    );
}

function StepCard({ step, title, description, active, done }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200 ${
            active 
                ? 'border-blue-400 dark:border-blue-500/60 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-500/30' 
                : done 
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}>
            {active && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />}
            {done && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />}
            <div className="flex items-start gap-3">
                <span className={`grid place-items-center w-7 h-7 rounded-xl text-xs font-bold shrink-0 ${
                    done 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : active 
                            ? 'bg-blue-600 text-white font-extrabold' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                    {done ? <Check size={14} strokeWidth={3} /> : step}
                </span>
                <div className="min-w-0">
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">{title}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{description}</p>
                </div>
            </div>
        </div>
    );
}

function GuideItem({ text }) {
    return (
        <li className="flex items-start gap-2">
            <Check size={14} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
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
            className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 ${active
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/30 shadow-xs'
                : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
        >
            <span className={`grid place-items-center w-8 h-8 rounded-xl shrink-0 mt-0.5 ${
                active 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
                {icon}
            </span>
            <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-900 dark:text-white">{title}</span>
                <span className={`block text-[11px] mt-0.5 ${active ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>{description}</span>
            </span>
        </button>
    );
}

function QuestionListItem({ question, number, onEdit, onDelete, onDragStart, onDragOver, onDragEnd, isDragging, isDragOver }) {
    const q = question;
    const meta = QUESTION_TYPE_META[q.question_type] || QUESTION_TYPE_META.multiple_choice;
    const typeTone = TONE[meta.toneKey];

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
            className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 cursor-grab active:cursor-grabbing shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-100/5 ${isDragging
                ? 'opacity-50 border-blue-400'
                : isDragOver
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-300 dark:hover:border-slate-700'}`}
        >
            <div className="flex items-start gap-3.5">
                <span className="shrink-0 mt-1 text-slate-300 dark:text-slate-600 hover:text-slate-500 transition-colors" title="Geser untuk mengurutkan">
                    <GripVertical size={18} />
                </span>

                <span className="grid place-items-center shrink-0 w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold tabular-nums">
                    {number}
                </span>

                <span className="flex-1 min-w-0 space-y-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wide border ${typeTone.bg} ${typeTone.text} ${typeTone.border}`}>
                            {QUESTION_TYPE_LABEL[q.question_type] || q.question_type}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold tabular-nums">
                            {formatPoints(q.points)} poin
                        </span>
                        {q.scoring_strategy && q.scoring_strategy !== 'standard' && (
                            <span className="px-2 py-0.5 rounded-lg text-[11px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                                {q.scoring_strategy.replace(/_/g, ' ')}
                            </span>
                        )}
                    </span>

                    <div 
                        className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed overflow-hidden max-w-full [&_img]:max-w-full [&_img]:h-auto [&_img]:max-h-96 [&_img]:rounded-xl [&_img]:my-2 [&_img]:block"
                        dangerouslySetInnerHTML={{ __html: q.question_text || '(kosong)' }}
                    />

                    <QuestionAnswerPreview question={q} />
                </span>

                <span className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={onEdit}
                        aria-label={`Sunting soal nomor ${number}`}
                        title="Sunting soal"
                        className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    >
                        <Pencil size={15} />
                    </button>
                    <button
                        onClick={onDelete}
                        aria-label={`Hapus soal nomor ${number}`}
                        title="Hapus soal"
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                        <Trash2 size={15} />
                    </button>
                </span>
            </div>
        </div>
    );
}

function QuestionAnswerPreview({ question }) {
    const q = question;

    if (q.question_type === 'essay') {
        return (
            <span className="block text-xs text-slate-400 font-medium">
                Tipe esai — siswa menjawab bebas, penilaian oleh pengawas.
            </span>
        );
    }

    if (q.question_type === MATRIX_TYPE) {
        const items = normalizeMatrixItems(q.matrix_items);
        const columns = normalizeMatrixColumns(q.options);
        return (
            <span className="block text-xs text-cyan-700 dark:text-cyan-300 font-semibold">
                {items.length} pernyataan &middot; kolom: {columns.map(c => c.label).join(' / ')}
            </span>
        );
    }

    if (q.question_type === 'matching') {
        const pairs = q.options?.pairs || [];
        return (
            <span className="block text-xs text-amber-700 dark:text-amber-300 font-semibold">
                {pairs.length} pasangan menjodohkan
            </span>
        );
    }

    const correctOptions = q.correct_option ? String(q.correct_option).split(',').map(s => s.trim()).filter(Boolean) : [];

    return (
        <span className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(q.options || {}).map(([key, value]) => {
                const isCorrect = correctOptions.includes(key);
                return (
                    <span
                        key={key}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs max-w-full border transition-all ${
                            isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50 font-bold shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        <span className="font-extrabold shrink-0">{key}.</span>
                        <span 
                            className="max-w-full overflow-hidden [&_img]:max-h-28 [&_img]:w-auto [&_img]:rounded-md [&_img]:inline-block [&_img]:my-1"
                            dangerouslySetInnerHTML={{ __html: value || '' }}
                        />
                        {isCorrect && <Check size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400 ml-auto" strokeWidth={3} />}
                    </span>
                );
            })}
        </span>
    );
}

function stripHtml(html) {
    const text = String(html || '')
        .replace(/<img[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > 320 ? `${text.slice(0, 320)}...` : (text || '(kosong)');
}

function formatPoints(val) {
    const n = Number(val) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

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
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Soal akan disalin ke Bank Soal.
                    </p>
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        Batal
                    </button>
                </>
            )}
        >
            <div className="flex flex-wrap items-center gap-1 mb-3.5 text-xs">
                <button
                    onClick={() => setCurrentFolderId(null)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${currentFolderId === null
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    Bank Soal
                </button>
                {breadcrumb.map((folder, i) => (
                    <span key={folder.id} className="flex items-center gap-1">
                        <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />
                        <button
                            onClick={() => setCurrentFolderId(folder.id)}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${i === breadcrumb.length - 1
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            {folder.name}
                        </button>
                    </span>
                ))}
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        ))}
                    </div>
                ) : currentFolders.length === 0 ? (
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center py-8">
                        {currentFolderId ? 'Folder ini tidak memiliki subfolder. Pilih folder ini sebagai tujuan.' : 'Belum ada folder di Bank Soal.'}
                    </p>
                ) : (
                    currentFolders.map(folder => (
                        <div key={folder.id} className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentFolderId(folder.id)}
                                className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors"
                            >
                                <FileText size={16} className="shrink-0 text-blue-500" />
                                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{folder.name}</span>
                                <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-slate-600 ml-auto" />
                            </button>
                            <button
                                onClick={() => onSelect(folder.id)}
                                className="shrink-0 px-3.5 py-2.5 text-xs font-extrabold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs"
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
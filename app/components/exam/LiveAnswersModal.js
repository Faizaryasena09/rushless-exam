'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Eye, EyeOff, ChevronLeft, Search, CheckCircle2, CircleDashed } from 'lucide-react';
import { calculateQuestionScore } from '@/app/lib/scoring';

/**
 * Modal "Jawaban" realtime untuk guru supervising.
 *
 * Data jawaban sudah dikirim oleh SSE ControlPanel sebagai `liveAnswers`
 * (array per siswa), sedangkan metadata soal diambil per ujian lewat
 * /api/control/live-questions.
 *
 * Kunci jawaban TIDAK dikirim server sampai guru menekan tombol "Buka kunci".
 * Setelah dibuka, skor dihitung dengan calculateQuestionScore() yang sama
 * dengan penilaian resmi, jadi angka yang tampil tidak pernah menyimpang.
 *
 * Komponen ini stateless terhadap "buka/tutup": parent yang melakukan
 * render bersyarat, sehingga state bersih setiap kali modal dibuka lagi.
 */

const MATRIX_TYPE = 'true_false_matrix';
const TYPE_LABEL = {
    multiple_choice: 'Pilihan Ganda',
    multiple_choice_complex: 'Pilihan Kompleks',
    true_false: 'Benar / Salah',
    [MATRIX_TYPE]: 'Tabel Pilihan Kompleks',
    matching: 'Menjodohkan',
    essay: 'Esai',
};

const MATRIX_TONE = [
    'emerald', 'rose', 'amber', 'indigo', 'violet', 'sky',
];
const CHIP_TONE = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60',
    rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60',
    violet: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/60',
    sky: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60',
};

const stripHtml = (html) => String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Sisa waktu dalam HH:MM:SS.
 *
 * Sengaja didefinisikan ulang di sini: helper versi sama milik ControlPanel
 * tidak di-export, dan mengimpor dari sana akan menarik seluruh panel kontrol
 * (1200+ baris) hanya untuk satu fungsi.
 */
function formatTime(seconds) {
    if (seconds === null || seconds === undefined || seconds < 0) return '--:--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Skor satu soal.
 *
 * Sengaja TIDAK menyalin logika penilaian ke sini.oija Server mengirim
 * `question.score_info` dengan bentuk yang sama persis dengan qInfo milik
 * app/lib/scoring.js, jadi kita cukup memanggil calculateQuestionScore().
 * Kalau suatu saat strategi penilaian berubah, angka yang dilihat guru otomatis
 * ikut berubah dan tidak akan pernah menyimpang dari penilaian resmi.
 *
 * Return null = tidak bisa dinilai (belum dijawab, atau kunci belum dibuka).
 */
function scoreQuestion(question, rawAnswer) {
    if (!question.score_info) return null;
    if (rawAnswer === undefined || rawAnswer === null || rawAnswer === '') return null;
    // Esai dinilai manual, jadi angkanya tidak boleh dikarang di sini.
    if (question.question_type === 'essay') return null;

    const earned = calculateQuestionScore(question.score_info, rawAnswer);
    return Number.isFinite(earned) ? earned : null;
}

function MatrixAnswerView({ question, rawAnswer, revealed }) {
    const columns = question.options || [];
    const items = question.matrix_items || [];

    let choices = {};
    try {
        choices = typeof rawAnswer === 'string' ? JSON.parse(rawAnswer) : (rawAnswer || {});
        if (typeof choices === 'string') choices = JSON.parse(choices);
    } catch { choices = {}; }
    if (!choices || typeof choices !== 'object' || Array.isArray(choices)) choices = {};

    return (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                            Pernyataan
                        </th>
                        {columns.map((col, i) => (
                            <th key={col.key} className="px-2 py-2.5 text-center border-b border-slate-200 dark:border-slate-700">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${CHIP_TONE[MATRIX_TONE[i % MATRIX_TONE.length]]}`}>
                                    {col.label}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                            <th scope="row" className="px-3 py-2.5 text-sm font-normal text-slate-700 dark:text-slate-200">
                                <span className="mr-1.5 font-mono text-xs tabular-nums text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                                <span className="custom-content-wrapper" dangerouslySetInnerHTML={{ __html: item.text }} />
                            </th>
                            {columns.map(col => {
                                const picked = choices[item.id] === col.key;
                                const isKey = revealed && question.matrix_keys?.[idx] === col.key;                                const wrong = revealed && picked && !isKey;
                                return (
                                    <td key={col.key} className={`px-2 py-2.5 text-center ${wrong ? 'bg-rose-50/70 dark:bg-rose-950/30' : ''}`}>
                                        {picked ? (
                                            <span className={`inline-block h-3.5 w-3.5 rounded-full ${wrong ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                        ) : isKey ? (
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">&#10003;</span>
                                        ) : (
                                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AnswerCard({ question, rawAnswer, revealed }) {
    const isMatrix = question.question_type === MATRIX_TYPE;
    const isMatching = question.question_type === 'matching';
    const isEssay = question.question_type === 'essay';

    // Kunci benar hanya tersedia setelah guru menekan tombol buka kunci.
    const correctSet = revealed && question.score_info?.correct
        ? new Set(String(question.score_info.correct).split(',').map(k => k.trim()).filter(Boolean))
        : null;

    const pickedSet = rawAnswer && !isMatrix && !isMatching && !isEssay
        ? new Set(String(rawAnswer).split(',').map(k => k.trim()).filter(Boolean))
        : null;

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex items-start gap-3 px-3.5 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                <span className="shrink-0 grid place-items-center w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold tabular-nums">
                    {question.id}
                </span>
                <div className="flex-1 min-w-0">
                    <div
                        className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed custom-content-wrapper"
                        dangerouslySetInnerHTML={{ __html: question.question_text }}
                    />
                    <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        {TYPE_LABEL[question.question_type] || question.question_type}
                        {question.scoring_strategy && question.scoring_strategy !== 'standard'
                            ? ` · ${question.scoring_strategy.replace(/_/g, ' ')}`
                            : ''}
                    </p>
                </div>
            </div>

            <div className="px-3.5 py-3 space-y-2">
                {isMatrix ? (
                    <MatrixAnswerView question={question} rawAnswer={rawAnswer} revealed={revealed} />
                ) : isMatching ? (
                    <div className="space-y-1.5">
                        {(() => {
                            let parsed = {};
                            try {
                                parsed = typeof rawAnswer === 'string' ? JSON.parse(rawAnswer) : (rawAnswer || {});
                                if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                            } catch { parsed = {}; }
                            return (question.options?.pairs || []).map((pair, idx) => {
                                const picked = parsed[pair.id];
                                const label = (question.options.responses || []).find(r => r === picked);
                                // Kunci per baris sudah dihitung server (pair_keys), jadi client tidak
                                // perlu mengurai string "1-y,2-x" yang rapuh.
                                const isKey = revealed && question.pair_keys?.[idx] === picked;
                                return (
                                    <div key={pair.id} className={`flex items-center gap-2 text-sm rounded-xl border px-2.5 py-1.5 ${picked ? (isKey ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20' : 'border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20') : 'border-slate-200 dark:border-slate-800'}`}>
                                        <span className="font-mono text-xs tabular-nums text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                                        <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: pair.p }} />
                                        <span className="shrink-0 text-xs font-bold text-slate-600 dark:text-slate-300">
                                            {label ? stripHtml(label) : <span className="text-slate-400 font-normal">(kosong)</span>}
                                        </span>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                ) : isEssay ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 custom-content-wrapper"
                        dangerouslySetInnerHTML={{ __html: rawAnswer || '<em class="text-slate-400">(belum dijawab)</em>' }} />
                ) : rawAnswer ? (
                    <div className="flex flex-wrap gap-1.5">
                        {(question.options || []).map(opt => {
                            const picked = pickedSet?.has(opt.key);
                            const isKey = revealed && correctSet?.has(opt.key);
                            return (
                                <span
                                    key={opt.key}
                                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs transition-all ${
                                        isKey
                                            ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/25 font-bold text-emerald-800 dark:text-emerald-200'
                                            : picked
                                                ? 'border-indigo-300 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/25 text-indigo-800 dark:text-indigo-200'
                                                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                                    }`}
                                >
                                    <span className="font-extrabold">{opt.key}.</span>
                                    <span className="custom-content-wrapper" dangerouslySetInnerHTML={{ __html: opt.text }} />
                                    {isKey && <CheckCircle2 size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
                                    {!isKey && picked && revealed && <X size={12} className="shrink-0 text-rose-500" />}
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm italic text-slate-400">Belum dijawab.</p>
                )}
            </div>
        </div>
    );
}

export default function LiveAnswersModal({ onClose, students, liveAnswers }) {
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [revealKeys, setRevealKeys] = useState(false);
    const [search, setSearch] = useState('');
    // Hasil fetch disimpan bersama "key" permintaan supaya status loading bisa
    // DITURUNKAN dari perbandingan key, bukan dari setState di dalam effect.
    const [qState, setQState] = useState({ key: null, data: null, error: '' });

    // Hanya siswa yang benar-benar sedang mengerjakan ujian yang punya jawaban.
    const activeStudents = useMemo(
        () => students.filter(s => s.attempt_id && s.exam_id),
        [students]
    );

    const answerByUser = useMemo(() => {
        const map = new Map();
        (liveAnswers || []).forEach(entry => map.set(entry.userId, entry));
        return map;
    }, [liveAnswers]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return activeStudents;
        return activeStudents.filter(s =>
            (s.name || '').toLowerCase().includes(term) ||
            (s.username || '').toLowerCase().includes(term) ||
            (s.class_name || '').toLowerCase().includes(term)
        );
    }, [activeStudents, search]);

    const selected = useMemo(
        () => activeStudents.find(s => String(s.id) === String(selectedUserId)) || null,
        [activeStudents, selectedUserId]
    );

    const selectedEntry = selected ? answerByUser.get(selected.id) : null;
    const selectedAnswers = useMemo(
        () => selectedEntry?.answers || {},
        [selectedEntry]
    );

    // Kunci permintaan berubah kalau siswa pindah ujian atau guru membuka kunci.
    const requestKey = selected?.exam_id ? `${selected.exam_id}:${revealKeys ? 1 : 0}` : null;

    useEffect(() => {
        if (!requestKey || !selected?.exam_id) return;
        let cancelled = false;

        const url = `/api/control/live-questions?exam_id=${selected.exam_id}${revealKeys ? '&reveal=1' : ''}`;
        fetch(url)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Gagal memuat soal');
                return data;
            })
            .then(data => {
                if (!cancelled) setQState({ key: requestKey, data: data.questions || [], error: '' });
            })
            .catch(err => {
                if (!cancelled) setQState({ key: requestKey, data: null, error: err.message });
            });

        return () => { cancelled = true; };
    }, [requestKey, selected?.exam_id, revealKeys]);

    const questions = qState.key === requestKey ? qState.data : null;
    const questionError = qState.key === requestKey ? qState.error : '';
    const loadingQuestions = requestKey !== null && qState.key !== requestKey;

    const scoreSummary = useMemo(() => {
        if (!revealKeys || !questions || !selected) return null;
        let earned = 0;
        let max = 0;
        let gradable = 0;
        questions.forEach(q => {
            if (q.question_type === 'essay') return; // butuh nilai manual
            max += Number(q.points) || 0;
            const value = scoreQuestion(q, selectedAnswers[String(q.id)]);
            if (value !== null) {
                earned += value;
                gradable += 1;
            }
        });
        return { earned, max, gradable, total: questions.length };
    }, [revealKeys, questions, selected, selectedAnswers]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    const detail = () => {
        if (!selected) {
            return (
                <div className="grid place-items-center h-full text-center px-6 py-16">
                    <div>
                        <CircleDashed size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">Pilih salah satu siswa</p>
                        <p className="mt-1 text-xs text-slate-400">Jawaban yang diklik akan muncul di sini, diperbarui otomatis tiap 3 detik.</p>
                    </div>
                </div>
            );
        }

        if (loadingQuestions && !questions) {
            return <div className="grid place-items-center h-full py-16 text-sm text-slate-400">Memuat soal ujian…</div>;
        }

        if (questionError) {
            return (
                <div className="grid place-items-center h-full text-center px-6 py-16">
                    <div>
                        <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{questionError}</p>
                        <button onClick={onClose} className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Tutup</button>
                    </div>
                </div>
            );
        }

        return (
            <div className="h-full flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setSelectedUserId(null)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Kembali ke daftar siswa"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{selected.name || selected.username}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                            {selected.class_name || '-'} · {selected.current_exam || '-'} · {Object.keys(selectedAnswers).length} dijawab
                        </p>
                    </div>
                    {scoreSummary && (
                        <div className="ml-auto flex items-center gap-2">
                            <div className="text-right">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Perkiraan Skor</p>
                                <p className="text-base font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                                    {scoreSummary.earned % 1 === 0 ? scoreSummary.earned : scoreSummary.earned.toFixed(2)}
                                    <span className="text-xs text-slate-400"> / {scoreSummary.max}</span>
                                </p>
                            </div>
                            <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold tabular-nums">
                                {scoreSummary.gradable}/{scoreSummary.total} dinilai
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {(questions || []).map(q => (
                        <AnswerCard
                            key={q.id}
                            question={q}
                            rawAnswer={selectedAnswers[String(q.id)]}
                            revealed={revealKeys}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className="relative w-full sm:max-w-5xl h-[92vh] sm:h-[86vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/5"
            >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-500" />

                {/* Kolom kiri: daftar siswa */}
                <aside className="w-full sm:w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/60 dark:bg-slate-950/30">
                    <div className="px-4 pt-4 pb-3 space-y-2.5">
                        <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Jawaban Siswa</p>
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                                {activeStudents.length} sedang mengerjakan
                            </p>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Search size={14} />
                            </div>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari siswa..."
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20"
                            />
                        </div>
                        <button
                            onClick={() => setRevealKeys(v => !v)}
                            aria-pressed={revealKeys}
                            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                                revealKeys
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            {revealKeys ? <EyeOff size={15} /> : <Eye size={15} />}
                            {revealKeys ? 'Sembunyikan Kunci' : 'Buka Kunci & Hitung Skor'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-1.5 custom-scrollbar">
                        {filtered.length === 0 && (
                            <p className="px-2 py-6 text-center text-xs italic text-slate-400">
                                {activeStudents.length === 0 ? 'Belum ada siswa yang sedang mengerjakan ujian.' : 'Tidak ada siswa yang cocok.'}
                            </p>
                        )}
                        {filtered.map(s => {
                            const entry = answerByUser.get(s.id);
                            const count = entry?.answeredCount || 0;
                            const active = String(s.id) === String(selectedUserId);
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedUserId(s.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                                        active
                                            ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-500/20'
                                            : 'border-transparent hover:bg-white dark:hover:bg-slate-800/70'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`shrink-0 w-2 h-2 rounded-full ${s.is_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                        <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {s.name || s.username}
                                        </span>
                                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold tabular-nums">
                                            {count}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 pl-4 text-[11px] text-slate-400 truncate">
                                        {s.class_name || '-'} · {formatTime(s.seconds_left)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Kolom kanan: isi */}
                <div className="hidden sm:block flex-1 min-w-0">{detail()}</div>
                <div className="sm:hidden absolute inset-0 bg-white dark:bg-slate-900">{selected ? detail() : null}</div>
            </div>

            <button
                onClick={onClose}
                aria-label="Tutup"
                className="absolute top-5 right-5 p-2 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <X size={20} />
            </button>
        </div>
    );
}
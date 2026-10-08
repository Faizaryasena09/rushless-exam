'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
    ChevronUp, ChevronDown, ChevronsUpDown, ArrowLeft, Search, Download, Trash2, Settings, 
    X, Check, CheckCircle2, XCircle, MinusCircle, AlertCircle, ShieldAlert, PencilLine, 
    Flag, Send, Navigation, PlayCircle, Circle, ScrollText, Trophy, Clock, ChevronRight, Info,
    Users, BarChart3, FileSpreadsheet, UserCheck, UserX, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';
import { wallClockToEpochMs } from '@/app/lib/timezone';
import MatrixTable from '@/app/components/exam/MatrixTable';
import { MATRIX_TYPE, normalizeMatrixColumns, parseMatrixAnswer } from '@/app/lib/matrix';

// --- Palette Object (Source of Truth untuk Tema & Status) ---
const TONE = {
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        border: 'border-purple-200 dark:border-purple-900/60',
        text: 'text-purple-700 dark:text-purple-300',
        iconBg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400',
        accent: 'from-purple-500 to-indigo-500',
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
    }
};

export default function ExamResultsPage() {
    const router = useRouter();
    const { fmt } = useLanguage();
    const params = useParams();
    const examId = params.id;

    const [resultsData, setResultsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [nameFilter, setNameFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [showExportModal, setShowExportModal] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchResults = useCallback(async () => {
        try {
            setLoading(true);
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
    }, [examId]);

    // Export Handler
    const handleExport = (attemptMode) => {
        const url = `/api/exams/export?exam_id=${examId}&class_id=${classFilter}&attempt_mode=${attemptMode}`;
        window.location.href = url;
        setShowExportModal(false);
    };

    useEffect(() => {
        if (!examId) return;
        fetchResults();
    }, [examId, fetchResults]);

    const classOptions = useMemo(() => {
        if (!resultsData) return [];
        const classes = new Set(resultsData.results.map(r => r.className));
        return ['all', ...Array.from(classes)];
    }, [resultsData]);

    const filteredResults = useMemo(() => {
        if (!resultsData) return [];
        const query = nameFilter.trim().toLowerCase();
        return resultsData.results.filter(student => {
            const nameMatch = !query
                || student.studentName.toLowerCase().includes(query)
                || (student.username || '').toLowerCase().includes(query);
            const classMatch = classFilter === 'all' || student.className === classFilter;
            const statusMatch = statusFilter === 'all'
                || (statusFilter === 'completed' && student.status === 'Completed')
                || (statusFilter === 'notTaken' && student.status !== 'Completed');
            return nameMatch && classMatch && statusMatch;
        });
    }, [resultsData, nameFilter, classFilter, statusFilter]);

    const toggleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) {
            return <ChevronsUpDown size={13} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />;
        }
        return sortConfig.direction === 'asc'
            ? <ChevronUp size={13} className="text-purple-600 dark:text-purple-400" />
            : <ChevronDown size={13} className="text-purple-600 dark:text-purple-400" />;
    };

    const sortedResults = useMemo(() => {
        const data = [...filteredResults];
        const { key, direction } = sortConfig;
        const dir = direction === 'asc' ? 1 : -1;

        data.sort((a, b) => {
            if (key === 'score') {
                const aDone = a.status === 'Completed';
                const bDone = b.status === 'Completed';
                if (aDone !== bDone) return aDone ? -1 : 1;
                return (Number(a.bestScore) - Number(b.bestScore)) * dir;
            }
            if (key === 'attempts') {
                return (a.attempts.length - b.attempts.length) * dir;
            }
            const valA = a.studentName.toLowerCase();
            const valB = b.studentName.toLowerCase();
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });

        return data;
    }, [filteredResults, sortConfig]);

    const summary = useMemo(() => {
        if (!resultsData) return { total: 0, done: 0, pending: 0, average: null };
        const list = resultsData.results;
        const done = list.filter(s => s.status === 'Completed');
        const scores = done.map(s => Number(s.bestScore) || 0);
        return {
            total: list.length,
            done: done.length,
            pending: list.length - done.length,
            average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
        };
    }, [resultsData]);

    const hasActiveFilter = nameFilter.trim() !== '' || classFilter !== 'all' || statusFilter !== 'all';

    const resetFilters = () => {
        setNameFilter('');
        setClassFilter('all');
        setStatusFilter('all');
    };

    const handleRowClick = (student) => {
        if (student.status !== 'Completed') return;
        setSelectedStudent(student);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-3 border-purple-200 dark:border-purple-900 border-t-purple-600 rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Memuat data hasil ujian...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="relative overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 p-8 text-center my-8">
                <div className="grid place-items-center w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto mb-3">
                    <AlertCircle size={24} />
                </div>
                <h3 className="text-base font-extrabold text-rose-900 dark:text-rose-200">Gagal memuat hasil ujian</h3>
                <p className="text-xs text-rose-700 dark:text-rose-300 max-w-sm mx-auto mt-1">{error}</p>
                <button 
                    onClick={fetchResults} 
                    className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
                >
                    Coba lagi
                </button>
            </div>
        );
    }

    const avgToneKey = summary.average === null ? 'slate' : summary.average >= 75 ? 'emerald' : summary.average >= 60 ? 'amber' : 'rose';

    return (
        <div className="space-y-5">
            {/* Header dengan latar bertema Laporan */}
            <div className="relative overflow-hidden rounded-2xl border border-purple-200/80 dark:border-purple-900/40 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent p-5 sm:p-6 backdrop-blur-sm shadow-sm ring-1 ring-purple-500/10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500" />
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
                    <div className="min-w-0">
                        <Link 
                            href="/dashboard/exams" 
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 transition-colors mb-2 px-2.5 py-1 rounded-lg bg-purple-100/70 dark:bg-purple-950/50 border border-purple-200/60 dark:border-purple-900/50"
                        >
                            <ArrowLeft size={14} />
                            Kembali ke Daftar Ujian
                        </Link>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white break-words tracking-tight">
                            {resultsData.examName}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Ringkasan nilai dan analisis jawaban siswa. Klik nama siswa untuk melihat riwayat attempt.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <Link
                            href={`/dashboard/exams/manage/${examId}`}
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                        >
                            <Settings size={14} className="text-slate-500 dark:text-slate-400" />
                            Kelola Ujian
                        </Link>
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 transition-all shadow-md shadow-purple-500/20"
                        >
                            <Download size={14} />
                            Export Data
                        </button>
                    </div>
                </div>
            </div>

            {/* Ringkasan (Card Lifted dengan Chip Berwarna & Garis Aksen) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <SummaryCard label="Total Siswa" value={summary.total} icon={Users} toneKey="purple" subtext="Terdaftar di ujian" />
                <SummaryCard label="Sudah Mengerjakan" value={summary.done} icon={UserCheck} toneKey="emerald" subtext={`${summary.total ? Math.round((summary.done / summary.total) * 100) : 0}% selesai`} />
                <SummaryCard label="Belum Mengerjakan" value={summary.pending} icon={UserX} toneKey="amber" subtext="Belum mulai/selesai" />
                <SummaryCard
                    label="Rata-rata Nilai"
                    value={summary.average === null ? '—' : formatNumber(Math.round(summary.average * 100) / 100)}
                    icon={BarChart3}
                    toneKey={avgToneKey}
                    subtext="Dari peserta selesai"
                />
            </div>

            {/* Toolbar Filter (Lifted Panel) */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-100/5 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1 min-w-0">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Cari nama atau username siswa..."
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        aria-label="Cari siswa"
                        className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all"
                    />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-2">
                    <SelectControl
                        value={classFilter}
                        onChange={setClassFilter}
                        ariaLabel="Filter kelas"
                        title="Filter kelas"
                        options={classOptions.map(c => ({ value: c, label: c === 'all' ? 'Semua Kelas' : c }))}
                    />
                    <SelectControl
                        value={statusFilter}
                        onChange={setStatusFilter}
                        ariaLabel="Filter status"
                        title="Filter status pengerjaan"
                        options={[
                            { value: 'all', label: 'Semua Status' },
                            { value: 'completed', label: 'Sudah Mengerjakan' },
                            { value: 'notTaken', label: 'Belum Mengerjakan' }
                        ]}
                    />
                    <SelectControl
                        value={`${sortConfig.key}:${sortConfig.direction}`}
                        onChange={(v) => {
                            const [key, direction] = v.split(':');
                            setSortConfig({ key, direction });
                        }}
                        ariaLabel="Urutkan"
                        title="Urutkan daftar"
                        options={[
                            { value: 'name:asc', label: 'Nama (A-Z)' },
                            { value: 'name:desc', label: 'Nama (Z-A)' },
                            { value: 'score:desc', label: 'Nilai (Tertinggi)' },
                            { value: 'score:asc', label: 'Nilai (Terendah)' },
                            { value: 'attempts:desc', label: 'Attempt (Terbanyak)' },
                            { value: 'attempts:asc', label: 'Attempt (Terkecil)' }
                        ]}
                    />
                </div>

                {hasActiveFilter && (
                    <button
                        onClick={resetFilters}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors"
                    >
                        <X size={14} />
                        Reset
                    </button>
                )}
            </div>

            {/* Keterangan Status */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 px-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Keterangan:</span>
                <LegendItem className="text-emerald-600 dark:text-emerald-400" icon={<Check size={12} />} text="jawaban benar" />
                <LegendItem className="text-rose-600 dark:text-rose-400" icon={<X size={12} />} text="jawaban salah" />
                <LegendItem className="text-slate-400" icon={<MinusCircle size={12} />} text="tidak dijawab" />
                <span className="ml-auto font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                    Menampilkan <strong className="text-slate-900 dark:text-white font-bold">{sortedResults.length}</strong> dari {resultsData.results.length} siswa
                </span>
            </div>

            {/* Daftar Siswa (Card Lifted Table) */}
            {sortedResults.length === 0 ? (
                <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
                    <div className="grid place-items-center w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 mx-auto mb-3">
                        <Search size={22} />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Tidak ada siswa yang cocok</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">Ubah kata kunci pencarian atau sesuaikan filter yang aktif.</p>
                    {hasActiveFilter && (
                        <button 
                            onClick={resetFilters} 
                            className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            Reset filter
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop View */}
                    <div className="hidden lg:block relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-100/5">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="group px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                                        <span className="inline-flex items-center gap-1.5">
                                            Siswa
                                            <SortIcon columnKey="name" />
                                        </span>
                                    </th>
                                    <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Status</th>
                                    <th className="group px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center cursor-pointer select-none" onClick={() => toggleSort('attempts')}>
                                        <span className="inline-flex items-center gap-1.5">
                                            Attempt
                                            <SortIcon columnKey="attempts" />
                                        </span>
                                    </th>
                                    <th className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Ringkasan Jawaban</th>
                                    <th className="group px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right cursor-pointer select-none" onClick={() => toggleSort('score')}>
                                        <span className="inline-flex items-center gap-1.5">
                                            Nilai Terbaik
                                            <SortIcon columnKey="score" />
                                        </span>
                                    </th>
                                    <th className="px-4 py-3.5" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {sortedResults.map(student => (
                                    <StudentRow
                                        key={student.studentId}
                                        student={student}
                                        onOpen={() => handleRowClick(student)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="lg:hidden space-y-2.5">
                        {sortedResults.map(student => (
                            <StudentRow
                                key={student.studentId}
                                student={student}
                                onOpen={() => handleRowClick(student)}
                                compact
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Detail View / Attempt History Modal */}
            {selectedStudent && (
                <StudentAnalysisDetail
                    student={selectedStudent}
                    scoringMode={resultsData?.scoringMode}
                    totalQuestions={resultsData?.totalQuestions}
                    onClose={() => setSelectedStudent(null)}
                    refresh={fetchResults}
                />
            )}

            {/* Export Modal */}
            {showExportModal && (
                <ExportOptionsModal
                    onClose={() => setShowExportModal(false)}
                    onExport={handleExport}
                />
            )}
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, toneKey = 'purple', subtext }) {
    const tone = TONE[toneKey] || TONE.purple;
    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 ring-1 ring-slate-900/5 dark:ring-slate-100/5 shadow-sm hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-slate-950/50 transition-all duration-200 group">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tone.accent} opacity-70 group-hover:opacity-100 transition-opacity`} />
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{label}</div>
                    <div className={`text-2xl font-extrabold mt-1 tabular-nums ${tone.text}`}>
                        {value}
                    </div>
                    {subtext && <div className="text-[11px] text-slate-400 mt-0.5">{subtext}</div>}
                </div>
                <div className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 ${tone.iconBg}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
}

function SelectControl({ value, onChange, options, title, ariaLabel }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            title={title}
            aria-label={ariaLabel}
            className="w-full lg:w-auto px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-purple-400 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all"
        >
            {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

function StudentRow({ student, onOpen, compact = false }) {
    const isCompleted = student.status === 'Completed';
    const score = Number(student.bestScore) || 0;
    const answered = student.correctCount + student.incorrectCount;
    const accuracy = answered > 0 ? Math.round((student.correctCount / answered) * 100) : 0;

    const scoreTone = score >= 80
        ? TONE.emerald
        : score >= 60
            ? TONE.amber
            : TONE.rose;

    if (compact) {
        return (
            <button
                onClick={onOpen}
                disabled={!isCompleted}
                className={`w-full text-left relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 p-4 ring-1 ring-slate-900/5 dark:ring-slate-100/5 shadow-sm transition-all duration-200 ${
                    isCompleted 
                        ? 'border-slate-200/80 dark:border-slate-800 hover:-translate-y-0.5 hover:shadow-md cursor-pointer' 
                        : 'border-slate-200/60 dark:border-slate-800/60 opacity-60 cursor-not-allowed'
                }`}
            >
                {isCompleted && <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${scoreTone.accent}`} />}
                <div className="flex items-center gap-3">
                    <Avatar name={student.studentName} completed={isCompleted} />
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{student.studentName}</div>
                        <div className="text-xs text-slate-400 truncate">{student.className} · @{student.username || 'user'}</div>
                    </div>
                    <div className="text-right shrink-0">
                        {isCompleted ? (
                            <>
                                <div className={`px-2.5 py-1 rounded-xl text-sm font-extrabold tabular-nums border ${scoreTone.bg} ${scoreTone.text} ${scoreTone.border}`}>
                                    {formatNumber(score)}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400 mt-1 tabular-nums">{student.attempts.length} attempt</div>
                            </>
                        ) : (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                                Belum
                            </span>
                        )}
                    </div>
                    {isCompleted && <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                </div>
            </button>
        );
    }

    return (
        <tr
            onClick={onOpen}
            title={isCompleted ? 'Klik untuk melihat riwayat attempt' : 'Siswa belum mengerjakan ujian'}
            className={`group transition-all ${isCompleted ? 'cursor-pointer hover:bg-purple-50/40 dark:hover:bg-purple-950/20' : 'opacity-60'}`}
        >
            <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                    <Avatar name={student.studentName} completed={isCompleted} />
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {student.studentName}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{student.className} · @{student.username || 'user'}</div>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3.5 text-center">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                }`}>
                    {isCompleted ? 'Selesai' : 'Belum'}
                </span>
            </td>
            <td className="px-4 py-3.5 text-center text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                {isCompleted ? student.attempts.length : '—'}
            </td>
            <td className="px-4 py-3.5">
                {isCompleted ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold tabular-nums">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">{student.correctCount} benar</span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40">{student.incorrectCount} salah</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{student.notAnsweredCount} kosong</span>
                    </div>
                ) : (
                    <span className="block text-center text-slate-400 font-semibold">—</span>
                )}
            </td>
            <td className="px-4 py-3.5">
                {isCompleted ? (
                    <div className="flex items-center justify-end gap-3">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" title={`Akurasi jawaban: ${accuracy}%`}>
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${accuracy}%` }} />
                        </div>
                        <span className={`px-2.5 py-1 rounded-xl text-sm font-extrabold tabular-nums border ${scoreTone.bg} ${scoreTone.text} ${scoreTone.border}`}>
                            {formatNumber(score)}
                        </span>
                    </div>
                ) : (
                    <span className="block text-right text-slate-400 font-semibold">—</span>
                )}
            </td>
            <td className="px-4 py-3.5 text-right">
                {isCompleted && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-all">
                        Analisis
                        <ChevronRight size={14} />
                    </span>
                )}
            </td>
        </tr>
    );
}

function Avatar({ name, completed }) {
    const initial = (name || '?').trim().charAt(0).toUpperCase();
    const tone = completed ? TONE.purple : TONE.slate;
    return (
        <span className={`grid place-items-center w-9 h-9 rounded-xl text-sm font-extrabold shrink-0 ${tone.iconBg}`}>
            {initial}
        </span>
    );
}

function StudentAnalysisDetail({ student, scoringMode, totalQuestions, onClose, refresh }) {
    const { fmt, timezone } = useLanguage();
    const [selectedAttemptId, setSelectedAttemptId] = useState(null);
    const [attemptIdForLog, setAttemptIdForLog] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmId, setConfirmId] = useState(null);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (confirmId) { setConfirmId(null); return; }
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose, confirmId]);

    const attempts = useMemo(() => {
        const list = [...(student.attempts || [])];
        list.sort((a, b) => {
            const aTime = wallClockToEpochMs(a.startTime || a.endTime, timezone) ?? 0;
            const bTime = wallClockToEpochMs(b.startTime || b.endTime, timezone) ?? 0;
            if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
            if (Number.isNaN(aTime)) return 1;
            if (Number.isNaN(bTime)) return -1;
            return bTime - aTime;
        });
        return list;
    }, [student, timezone]);

    const formatScore = (value) => scoringMode === 'raw' ? formatNumber(value) : Math.round(Number(value));

    const stats = useMemo(() => {
        if (attempts.length === 0) return { total: 0, best: null, average: null, bestAttemptId: null };
        const scores = attempts.map(a => Number(a.score) || 0);
        const bestScore = Math.max(...scores);
        const bestAttempt = attempts[scores.indexOf(bestScore)];
        return {
            total: attempts.length,
            best: bestScore,
            average: scores.reduce((a, b) => a + b, 0) / scores.length,
            bestAttemptId: bestAttempt?.attemptId ?? null
        };
    }, [attempts]);

    const handleDeleteAttempt = async (attemptId) => {
        setConfirmId(null);
        try {
            setDeletingId(attemptId);
            const res = await fetch('/api/control/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_attempt',
                    attemptId: attemptId
                })
            });

            if (!res.ok) throw new Error('Gagal menghapus attempt');

            toast.success('Attempt berhasil dihapus');
            onClose();
            if (refresh) refresh();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    if (selectedAttemptId) {
        return <AttemptAnalysisDetail attemptId={selectedAttemptId} onClose={() => setSelectedAttemptId(null)} studentName={student.studentName} />;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Riwayat attempt ${student.studentName}`}
                className="relative w-full sm:max-w-2xl sm:max-h-[85vh] h-full sm:h-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500" />
                
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-transparent">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate tracking-tight">Riwayat Attempt</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {student.studentName} · {student.className} · @{student.username}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Tutup"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {attempts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                        <div className="grid place-items-center w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 mb-3">
                            <ScrollText size={22} />
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">Belum ada attempt</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Siswa ini belum memiliki attempt yang selesai.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 divide-x divide-slate-200 dark:divide-slate-800">
                            <StatCell label="Attempt" value={stats.total} />
                            <StatCell label="Tertinggi" value={stats.best} tone="best" />
                            <StatCell label="Rata-rata" value={stats.average} />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 px-1 pb-1">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Keterangan:</span>
                                <span>klik baris = lihat analisis jawaban</span>
                                <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium"><ScrollText size={12} /> log aktivitas</span>
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium"><Trash2 size={12} /> hapus attempt</span>
                            </div>

                            {attempts.map((attempt, index) => (
                                <AttemptRow
                                    key={attempt.attemptId}
                                    attempt={attempt}
                                    number={index + 1}
                                    isBest={attempt.attemptId === stats.bestAttemptId}
                                    formatScore={formatScore}
                                    totalQuestions={totalQuestions}
                                    isDeleting={deletingId === attempt.attemptId}
                                    isConfirming={confirmId === attempt.attemptId}
                                    onOpen={() => setSelectedAttemptId(attempt.attemptId)}
                                    onShowLogs={() => setAttemptIdForLog(attempt.attemptId)}
                                    onRequestDelete={() => setConfirmId(attempt.attemptId)}
                                    onCancelDelete={() => setConfirmId(null)}
                                    onConfirmDelete={() => handleDeleteAttempt(attempt.attemptId)}
                                />
                            ))}
                        </div>
                    </>
                )}
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

function StatCell({ label, value, tone }) {
    const display = value === null || value === undefined ? '—' : formatNumber(Math.round(Number(value) * 100) / 100);
    const color = tone === 'best'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-slate-900 dark:text-white';
    return (
        <div className="px-4 py-3 text-center">
            <div className={`text-xl font-extrabold leading-none tabular-nums ${color}`}>{display}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold mt-1">{label}</div>
        </div>
    );
}

function AttemptRow({ attempt, number, isBest, formatScore, totalQuestions, isDeleting, isConfirming, onOpen, onShowLogs, onRequestDelete, onCancelDelete, onConfirmDelete }) {
    const { fmt, timezone } = useLanguage();
    const score = Number(attempt.score) || 0;
    const scoreTone = score >= 80
        ? TONE.emerald
        : score >= 60
            ? TONE.amber
            : TONE.rose;

    const startMs = attempt.startTime ? wallClockToEpochMs(attempt.startTime, timezone) : null;
    const endMs = attempt.endTime ? wallClockToEpochMs(attempt.endTime, timezone) : null;
    const duration = startMs !== null && endMs !== null && endMs >= startMs ? formatDuration(endMs - startMs) : null;

    const answered = attempt.answeredCount ?? (attempt.correctCount + attempt.incorrectCount);
    const accuracy = answered > 0 ? Math.round((attempt.correctCount / answered) * 100) : 0;

    return (
        <div className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
            isConfirming 
                ? 'border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20' 
                : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800/60 shadow-sm hover:shadow-md'
        }`}>
            {isBest && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400" />}
            <div className="flex items-center gap-3 px-4 py-3.5">
                <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="grid place-items-center shrink-0 w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-extrabold tabular-nums">
                        {number}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                {attempt.startTime ? fmt.dateTime(attempt.startTime) : 'Waktu tidak tersedia'}
                            </span>
                            {isBest && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 text-[10px] font-extrabold uppercase">
                                    <Trophy size={11} /> Tertinggi
                                </span>
                            )}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                            {duration && (
                                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><Clock size={12} />{duration}</span>
                            )}
                            <span className="text-emerald-600 dark:text-emerald-400">{attempt.correctCount} benar</span>
                            <span className="text-rose-600 dark:text-rose-400">{attempt.incorrectCount} salah</span>
                            {attempt.notAnsweredCount !== undefined && (
                                <span>{attempt.notAnsweredCount} kosong</span>
                            )}
                            {totalQuestions ? <span>{answered}/{totalQuestions} dijawab</span> : null}
                        </span>
                    </span>
                </button>

                <div className="shrink-0 flex items-center gap-2">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className={`px-2.5 py-1 rounded-xl text-sm font-extrabold tabular-nums border ${scoreTone.bg} ${scoreTone.text} ${scoreTone.border}`}>
                            {formatScore(score)}
                        </span>
                        <div className="w-20 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${accuracy}%` }} />
                        </div>
                    </div>
                    <span className={`sm:hidden px-2.5 py-1 rounded-xl text-sm font-extrabold tabular-nums border ${scoreTone.bg} ${scoreTone.text} ${scoreTone.border}`}>
                        {formatScore(score)}
                    </span>

                    <button
                        onClick={onShowLogs}
                        aria-label="Lihat log aktivitas"
                        title="Log aktivitas"
                        className="p-2 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-100/70 dark:hover:bg-purple-950/60 transition-colors"
                    >
                        <ScrollText size={16} />
                    </button>
                    <button
                        onClick={onRequestDelete}
                        disabled={isDeleting}
                        aria-label="Hapus attempt"
                        title="Hapus attempt"
                        className="p-2 rounded-xl text-rose-500 dark:text-rose-400 hover:bg-rose-100/70 dark:hover:bg-rose-950/60 transition-colors disabled:opacity-50"
                    >
                        <Trash2 size={16} />
                    </button>
                    <ChevronRight size={16} className="text-slate-400 hidden sm:block" />
                </div>
            </div>

            {isConfirming && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-rose-200 dark:border-rose-900/60 bg-rose-100/40 dark:bg-rose-950/40">
                    <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">Hapus attempt ini? Jawaban & nilai akan hilang permanen.</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={onCancelDelete} className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors">
                            Batal
                        </button>
                        <button
                            onClick={onConfirmDelete}
                            disabled={isDeleting}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {isDeleting ? 'Menghapus...' : 'Hapus'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const LOG_TYPE_META = {
    START: {
        label: 'Mulai', icon: PlayCircle, hint: 'Siswa membuka dan memulai sesi ujian.',
        badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50',
        card: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20',
        dot: 'bg-emerald-500'
    },
    SUBMIT: {
        label: 'Dikumpulkan', icon: Send, hint: 'Jawaban dikumpulkan, manual oleh siswa atau otomatis karena waktu habis.',
        badge: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50',
        card: 'border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20',
        dot: 'bg-purple-500'
    },
    ANSWER: {
        label: 'Jawaban', icon: PencilLine, hint: 'Siswa memilih, mengubah, atau menghapus jawaban.',
        badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        card: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
        dot: 'bg-purple-400'
    },
    NAVIGATE: {
        label: 'Navigasi', icon: Navigation, hint: 'Siswa berpindah halaman soal.',
        badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        card: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
        dot: 'bg-slate-400'
    },
    FLAG: {
        label: 'Tanda ragu', icon: Flag, hint: 'Siswa menandai atau menghapus tanda soal ragu-ragu.',
        badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50',
        card: 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20',
        dot: 'bg-amber-500'
    },
    SECURITY: {
        label: 'Keamanan', icon: ShieldAlert, hint: 'Pelanggaran: keluar halaman, minimize, kehilangan fokus, copy, atau paste.',
        badge: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60',
        card: 'border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20',
        dot: 'bg-rose-500'
    }
};

const GENERIC_LOG_META = {
    label: 'Lainnya', icon: Circle, hint: 'Jenis aktivitas lain yang belum dikelompokkan.',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    card: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
    dot: 'bg-slate-400'
};

function getLogMeta(actionType) {
    return LOG_TYPE_META[actionType] || { ...GENERIC_LOG_META, label: actionType || GENERIC_LOG_META.label };
}

function LogViewerModal({ attemptId, studentName, onClose }) {
    const { fmt, timezone } = useLanguage();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [showLegend, setShowLegend] = useState(false);

    useEffect(() => {
        let active = true;
        async function fetchLogs() {
            try {
                const res = await fetch(`/api/exams/logs?attempt_id=${attemptId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (active) setLogs(data.logs || []);
                } else {
                    const data = await res.json().catch(() => ({}));
                    if (active) setError(data.message || 'Gagal memuat log');
                }
            } catch (e) {
                if (active) setError('Gagal memuat log');
            } finally {
                if (active) setLoading(false);
            }
        }
        fetchLogs();
        return () => { active = false; };
    }, [attemptId]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const types = useMemo(() => {
        const map = new Map();
        logs.forEach(log => {
            const key = log.action_type || 'OTHER';
            map.set(key, (map.get(key) || 0) + 1);
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    }, [logs]);

    const visibleLogs = useMemo(() => {
        if (filter === 'all') return logs;
        return logs.filter(log => (log.action_type || 'OTHER') === filter);
    }, [logs, filter]);

    const groupedLogs = useMemo(() => {
        const groups = [];
        visibleLogs.forEach(log => {
            const label = fmt.date(log.created_at);
            const key = label;
            const last = groups[groups.length - 1];
            if (last && last.key === key) last.items.push(log);
            else groups.push({ key, label, items: [log] });
        });
        return groups;
    }, [visibleLogs, fmt]);

    const securityCount = types.find(([key]) => key === 'SECURITY')?.[1] || 0;
    const first = logs[0]?.created_at;
    const last = logs[logs.length - 1]?.created_at;
    const firstMs = first ? wallClockToEpochMs(first, timezone) : null;
    const lastMs = last ? wallClockToEpochMs(last, timezone) : null;
    const durationText = firstMs !== null && lastMs !== null && lastMs >= firstMs
        ? formatDuration(lastMs - firstMs)
        : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Log aktivitas ${studentName}`}
                className="relative w-full sm:max-w-2xl sm:max-h-[85vh] h-full sm:h-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500" />
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-transparent">
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Log Aktivitas</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{studentName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Tutup"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-8 h-8 border-3 border-purple-200 dark:border-purple-900 border-t-purple-600 rounded-full animate-spin" />
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Memuat log...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-10 text-center">
                        <div className="max-w-xs">
                            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto mb-3">
                                <AlertCircle size={24} />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Gagal memuat log</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
                        </div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                        <div className="grid place-items-center w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 mb-3">
                            <ScrollText size={22} />
                        </div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">Tidak ada aktivitas</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Belum ada aktivitas tercatat pada sesi ini.</p>
                    </div>
                ) : (
                    <>
                        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mr-1 tabular-nums">
                                {logs.length} catatan{durationText ? ` · ${durationText}` : ''}
                            </span>
                            {securityCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60" title="Aktivitas yang melanggar aturan keamanan saat ujian">
                                    <ShieldAlert size={13} /> {securityCount} pelanggaran keamanan
                                </span>
                            )}
                            <span className="flex-1" />
                            <FilterPills types={types} filter={filter} onChange={setFilter} />
                        </div>

                        <div className="border-b border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setShowLegend(v => !v)}
                                aria-expanded={showLegend}
                                className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <Info size={14} className="text-purple-600 dark:text-purple-400" />
                                Apa arti setiap jenis log?
                                <ChevronDown size={14} className={`ml-auto transition-transform ${showLegend ? 'rotate-180' : ''}`} />
                            </button>
                            {showLegend && (
                                <ul className="px-5 pb-3.5 grid gap-2 bg-slate-50/50 dark:bg-slate-800/30 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    {types.map(([key, count]) => {
                                        const meta = getLogMeta(key);
                                        const Icon = meta.icon;
                                        return (
                                            <li key={key} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${meta.badge}`}>
                                                    <Icon size={11} /> {meta.label}
                                                </span>
                                                <span className="flex-1">{meta.hint}</span>
                                                <span className="shrink-0 tabular-nums font-bold text-slate-400">({count})</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {groupedLogs.map(group => (
                                <div key={group.key} className="space-y-2">
                                    <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm py-1">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">{group.label}</span>
                                    </div>
                                    <ol className="space-y-2">
                                        {group.items.map((log, i) => (
                                            <LogRow key={log.id ?? `${log.created_at}-${i}`} log={log} isLast={i === group.items.length - 1} />
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function FilterPills({ types, filter, onChange }) {
    const pills = [
        { key: 'all', label: 'Semua', hint: 'Tampilkan seluruh aktivitas' },
        ...types.map(([key, count]) => ({ key, label: getLogMeta(key).label, count, hint: getLogMeta(key).hint }))
    ];
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {pills.map(pill => {
                const isActive = filter === pill.key;
                return (
                    <button
                        key={pill.key}
                        onClick={() => onChange(pill.key)}
                        title={pill.hint}
                        aria-label={pill.hint}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${isActive
                            ? 'bg-purple-600 dark:bg-purple-500 text-white border-transparent shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-800'
                        }`}
                    >
                        {pill.label}
                        {pill.count !== undefined && <span className={`tabular-nums ${isActive ? 'opacity-80' : 'text-slate-400'}`}>{pill.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

function LogRow({ log, isLast }) {
    const meta = getLogMeta(log.action_type);
    const Icon = meta.icon;
    const { fmt } = useLanguage();
    const time = fmt.clock(log.created_at);

    return (
        <li className="flex items-start gap-3">
            <span className="shrink-0 w-14 pt-2 text-right text-xs font-bold tabular-nums text-slate-400">{time}</span>
            <span className="shrink-0 flex flex-col items-center w-3 self-stretch">
                <span className={`mt-2.5 w-2.5 h-2.5 rounded-full ${meta.dot} ring-2 ring-white dark:ring-slate-900`} />
                {!isLast && <span className="flex-1 w-0.5 bg-slate-200 dark:bg-slate-800 my-1" />}
            </span>
            <div className={`flex-1 min-w-0 rounded-2xl border p-3.5 ${meta.card} shadow-sm`} title={meta.hint}>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${meta.badge}`}>
                    <Icon size={12} />
                    {meta.label}
                </span>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed break-words">{log.description}</p>
            </div>
        </li>
    );
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return null;
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes} menit`;
    return `${hours} jam ${minutes} menit`;
}

const STATUS_META = {
    correct: { label: 'Benar', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50', dot: 'bg-emerald-500' },
    partial: { label: 'Sebagian', text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50', dot: 'bg-amber-500' },
    wrong: { label: 'Salah', text: 'text-rose-600 dark:text-rose-400', chip: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50', dot: 'bg-rose-500' },
    empty: { label: 'Kosong', text: 'text-slate-500 dark:text-slate-400', chip: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' }
};

function getAnswerStatus(ans) {
    if (ans.isCorrect) return 'correct';
    if (!ans.studentAnswer) return 'empty';
    if (Number(ans.scoreEarned) > 0) return 'partial';
    return 'wrong';
}

function formatNumber(value) {
    const num = Number(value);
    return Number.isInteger(num) ? num : num.toFixed(2);
}

function AttemptAnalysisDetail({ attemptId, onClose, studentName }) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const contentRef = useRef(null);
    const cardRefs = useRef({});

    useEffect(() => {
        if (!attemptId) return;
        let active = true;
        async function fetchAnalysis() {
            try {
                setLoading(true);
                const res = await fetch(`/api/exams/analysis?attempt_id=${attemptId}`);
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Failed to fetch attempt details');
                }
                const data = await res.json();
                if (active) setAnalysis(data);
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        }
        fetchAnalysis();
        return () => { active = false; };
    }, [attemptId]);

    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const items = useMemo(() => {
        return (analysis?.analysis || []).map((ans, i) => ({
            ...ans,
            number: i + 1,
            status: getAnswerStatus(ans)
        }));
    }, [analysis]);

    const counts = useMemo(() => {
        return items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
        }, { correct: 0, partial: 0, wrong: 0, empty: 0 });
    }, [items]);

    const visibleItems = useMemo(() => {
        if (filter === 'all') return items;
        return items.filter(item => item.status === filter);
    }, [items, filter]);

    const score = analysis?.score;
    const scoreToneKey = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'rose';
    const scoreTone = TONE[scoreToneKey];

    const filters = [
        { key: 'all', label: 'Semua', count: items.length },
        { key: 'correct', label: 'Benar', count: counts.correct },
        { key: 'wrong', label: 'Salah', count: counts.wrong },
        { key: 'partial', label: 'Sebagian', count: counts.partial },
        { key: 'empty', label: 'Kosong', count: counts.empty }
    ];

    const jumpTo = (number) => {
        const el = cardRefs.current[number];
        if (!el || !contentRef.current) return;
        const top = el.offsetTop - 12;
        contentRef.current.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Analisis jawaban ${studentName}`}
                className="relative w-full sm:max-w-3xl sm:max-h-[88vh] h-full sm:h-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500" />
                
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-transparent">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate tracking-tight">Analisis Jawaban</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{studentName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {score !== undefined && score !== null && (
                            <div className="text-right">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Nilai</div>
                                <div className={`text-xl font-extrabold leading-none tabular-nums ${scoreTone.text}`}>
                                    {analysis?.scoringMode === 'raw' ? formatNumber(score) : Math.round(score)}
                                </div>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            aria-label="Tutup"
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-8 h-8 border-3 border-purple-200 dark:border-purple-900 border-t-purple-600 rounded-full animate-spin" />
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Memuat analisis...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-10 text-center">
                        <div className="max-w-xs">
                            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto mb-3">
                                <AlertCircle size={24} />
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Gagal memuat analisis</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Summary & Filters */}
                        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                                <span className="font-bold text-slate-800 dark:text-white">Ringkasan:</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{counts.correct} benar</span>
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">{counts.wrong} salah</span>
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">{counts.partial} sebagian</span>
                                <span className="text-slate-500 dark:text-slate-400">{counts.empty} kosong</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {filters.map(f => {
                                    const isActive = filter === f.key;
                                    const isZero = f.count === 0 && f.key !== 'all';
                                    return (
                                        <button
                                            key={f.key}
                                            onClick={() => setFilter(f.key)}
                                            disabled={isZero}
                                            title={`Tampilkan ${f.label.toLowerCase()}`}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isActive
                                                ? 'bg-purple-600 dark:bg-purple-500 text-white border-transparent shadow-sm'
                                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-800'
                                            }`}
                                        >
                                            {f.label}
                                            <span className={`tabular-nums ${isActive ? 'opacity-80' : 'text-slate-400'}`}>{f.count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {items.length > 0 && (
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                    {items.map(item => (
                                        <button
                                            key={item.questionId}
                                            onClick={() => jumpTo(item.number)}
                                            title={`Soal ${item.number} - ${STATUS_META[item.status].label}`}
                                            className={`shrink-0 w-7 h-7 rounded-lg text-xs font-bold text-white ${STATUS_META[item.status].dot} hover:opacity-80 transition-opacity shadow-xs`}
                                        >
                                            {item.number}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Questions Review */}
                        <div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {visibleItems.length === 0 && (
                                <p className="text-xs font-semibold text-slate-400 text-center py-12">Tidak ada soal pada filter ini.</p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Keterangan:</span>
                                <LegendItem className="text-emerald-600 dark:text-emerald-400" icon={<Check size={12} />} text="hijau = kunci jawaban / jawaban benar" />
                                <LegendItem className="text-rose-600 dark:text-rose-400" icon={<X size={12} />} text="merah = jawaban siswa yang salah" />
                                <LegendItem className="text-slate-400" icon={<MinusCircle size={12} />} text="abu-abu = tidak dijawab" />
                                <LegendItem className="text-amber-600 dark:text-amber-400" icon={<AlertCircle size={12} />} text="kuning = sebagian benar" />
                            </div>

                            {visibleItems.map(item => (
                                <QuestionReviewCard key={item.questionId} item={item} innerRef={(el) => { cardRefs.current[item.number] = el; }} />
                            ))}

                            <style jsx global>{`
                                .custom-content-wrapper img {
                                    max-width: 100% !important;
                                    height: auto !important;
                                    border-radius: 8px;
                                }
                                .custom-content-wrapper table {
                                    width: 100% !important;
                                    border-collapse: collapse !important;
                                }
                                .custom-content-wrapper table td,
                                .custom-content-wrapper table th {
                                    border: 1px solid #e2e8f0;
                                    padding: 6px 10px;
                                    text-align: left;
                                }
                                .dark .custom-content-wrapper table td,
                                .dark .custom-content-wrapper table th {
                                    border-color: #334155;
                                }
                            `}</style>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function LegendItem({ icon, text, className }) {
    return (
        <span className={`inline-flex items-center gap-1 font-medium ${className}`}>
            <span className="shrink-0">{icon}</span>
            {text}
        </span>
    );
}

function QuestionReviewCard({ item, innerRef }) {
    const meta = STATUS_META[item.status];
    const isEssay = item.questionType === 'essay';
    const isMatching = item.questionType === 'matching';
    const isMatrix = item.questionType === MATRIX_TYPE;

    let studentChoices = [];
    if (!isMatching && !isMatrix && item.studentAnswer) {
        studentChoices = String(item.studentAnswer).split(',').map(s => s.trim()).filter(Boolean);
    }
    let correctChoices = [];
    if (!isMatching && !isMatrix && item.correctAnswer) {
        correctChoices = String(item.correctAnswer).split(',').map(s => s.trim()).filter(Boolean);
    }

    return (
        <article
            ref={innerRef}
            className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm scroll-mt-2"
        >
            <div className="flex items-start gap-3 px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800">
                <div className="shrink-0 w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-extrabold flex items-center justify-center tabular-nums">
                    {item.number}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="prose dark:prose-invert prose-sm max-w-none text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 custom-content-wrapper" dangerouslySetInnerHTML={{ __html: item.questionText }} />
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                        <span className="uppercase tracking-wider">{(item.questionType || 'multiple choice').replace(/_/g, ' ')}</span>
                        <span>·</span>
                        <span className="tabular-nums">{formatNumber(item.scoreEarned)} / {formatNumber(item.points)} poin</span>
                    </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${meta.chip}`}>
                    {item.status === 'correct' && <Check size={13} />}
                    {item.status === 'wrong' && <X size={13} />}
                    {item.status === 'empty' && <MinusCircle size={13} />}
                    {item.status === 'partial' && <AlertCircle size={13} />}
                    {meta.label}
                </span>
            </div>

            <div className="px-4 py-3.5 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/40">
                {isMatrix && Array.isArray(item.matrixItems) ? (
                    <MatrixTable
                        groupId={`review-${item.questionId}`}
                        disabled
                        columns={normalizeMatrixColumns(item.options)}
                        items={item.matrixItems}
                        value={parseMatrixAnswer(item.studentAnswer)}
                        correctKeys={Array.isArray(item.matrixKeys) ? item.matrixKeys : null}
                    />
                ) : isMatching ? (
                    <MatchingReview item={item} />
                ) : isEssay ? (
                    <div className="space-y-2.5">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Jawaban siswa</div>
                            {item.studentAnswer ? (
                                <div className="prose dark:prose-invert prose-sm max-w-none text-xs sm:text-sm text-slate-700 dark:text-slate-200 custom-content-wrapper" dangerouslySetInnerHTML={{ __html: item.studentAnswer }} />
                            ) : (
                                <p className="text-xs text-slate-400 italic">Tidak dijawab</p>
                            )}
                        </div>
                        {item.correctAnswer && (
                            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 shadow-xs">
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Kunci jawaban</div>
                                <div className="prose dark:prose-invert prose-sm max-w-none text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 custom-content-wrapper" dangerouslySetInnerHTML={{ __html: item.correctAnswer }} />
                            </div>
                        )}
                    </div>
                ) : item.options && Object.keys(item.options).length > 0 ? (
                    Object.entries(item.options).map(([key, value]) => {
                        const isCorrectOption = correctChoices.includes(key);
                        const isSelected = studentChoices.includes(key);

                        let tone = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300';
                        let badge = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
                        let mark = null;

                        if (isCorrectOption) {
                            tone = 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium';
                            badge = 'bg-emerald-600 text-white';
                            mark = <CheckCircle2 size={16} className="text-emerald-500" />;
                        } else if (isSelected) {
                            tone = 'border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200';
                            badge = 'bg-rose-600 text-white';
                            mark = <XCircle size={16} className="text-rose-500" />;
                        }

                        return (
                            <div key={key} className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${tone}`}>
                                <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-lg text-xs font-bold flex items-center justify-center ${badge}`}>{key}</span>
                                <div className="flex-1 min-w-0 prose dark:prose-invert prose-sm max-w-none text-xs sm:text-sm custom-content-wrapper" dangerouslySetInnerHTML={{ __html: value }} />
                                <span className="shrink-0 mt-0.5">{mark}</span>
                            </div>
                        );
                    })
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs sm:text-sm">
                        <p className={item.studentAnswer ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 italic'}>
                            {item.studentAnswer || 'Tidak dijawab'}
                        </p>
                        {item.correctAnswer && (
                            <p className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-emerald-700 dark:text-emerald-300 font-semibold">
                                Kunci: {item.correctAnswer}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}

function MatchingReview({ item }) {
    let choices = {};
    try {
        choices = typeof item.studentAnswer === 'string' ? JSON.parse(item.studentAnswer) : (item.studentAnswer || {});
    } catch (e) {
        choices = {};
    }

    const pairs = item.options?.pairs || [];

    if (pairs.length === 0) {
        return <p className="text-xs text-slate-400 italic">Tidak ada pasangan yang tersedia.</p>;
    }

    return (
        <div className="space-y-2">
            {pairs.map(pair => {
                const studentMatch = choices[pair.id];
                const isPairCorrect = studentMatch === pair.r;

                return (
                    <div key={pair.id} className={`rounded-xl border px-3.5 py-2.5 ${isPairCorrect
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20'
                        : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20'}`}>
                        <div className="flex items-start gap-3">
                            <span className="shrink-0 mt-0.5">
                                {isPairCorrect
                                    ? <CheckCircle2 size={16} className="text-emerald-500" />
                                    : <XCircle size={16} className="text-rose-500" />}
                            </span>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 prose dark:prose-invert prose-sm max-w-none custom-content-wrapper" dangerouslySetInnerHTML={{ __html: pair.p }} />
                                <div className="text-xs prose dark:prose-invert prose-sm max-w-none custom-content-wrapper">
                                    <span className="text-slate-400 font-medium">Dijawab: </span>
                                    <span className={isPairCorrect ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-rose-700 dark:text-rose-300 font-bold'}>
                                        {studentMatch ? <span dangerouslySetInnerHTML={{ __html: studentMatch }} /> : <em className="text-slate-400 font-normal">tidak diisi</em>}
                                    </span>
                                </div>
                                {!isPairCorrect && (
                                    <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold prose dark:prose-invert prose-sm max-w-none custom-content-wrapper">
                                        <span className="text-slate-400 font-medium">Kunci: </span>
                                        <span dangerouslySetInnerHTML={{ __html: pair.r }} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ExportOptionsModal({ onClose, onExport }) {
    const [mode, setMode] = useState('all');

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex justify-center items-center p-3 sm:p-6" onClick={onClose}>
            <div 
                role="dialog"
                aria-modal="true"
                aria-label="Export Data Ujian"
                className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/5"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500" />
                <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-transparent">
                    <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Export Data Ujian</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih format pengelompokan data untuk di-download dalam Excel (.xlsx)</p>
                    </div>
                    <button 
                        onClick={onClose}
                        aria-label="Tutup"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 sm:p-6 space-y-3">
                    {[
                        { id: 'all', title: 'Semua Attempt', desc: 'Ekspor seluruh riwayat percobaan yang dilakukan oleh semua siswa', icon: FileSpreadsheet, tone: 'purple' },
                        { id: 'best', title: 'Attempt Nilai Tertinggi', desc: 'Hanya mengambil 1 nilai tertinggi dari tiap siswa', icon: Trophy, tone: 'emerald' },
                        { id: 'latest', title: 'Attempt Terakhir', desc: 'Hanya mengambil percobaan yang paling baru dikumpulkan', icon: Clock, tone: 'amber' }
                    ].map((opt) => {
                        const isSelected = mode === opt.id;
                        const tone = TONE[opt.tone];
                        const Icon = opt.icon;
                        return (
                            <label
                                key={opt.id}
                                className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                                    isSelected 
                                        ? `${tone.border} ${tone.bg} ring-2 ring-purple-500/30 shadow-md` 
                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800/60'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="exportMode"
                                    value={opt.id}
                                    checked={isSelected}
                                    onChange={() => setMode(opt.id)}
                                    className="sr-only"
                                />
                                <div className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 mt-0.5 mr-3 ${tone.iconBg}`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm text-slate-900 dark:text-white">{opt.title}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                                </div>
                                <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${
                                    isSelected ? 'border-purple-600 bg-purple-600 dark:border-purple-500 dark:bg-purple-500' : 'border-slate-300 dark:border-slate-600'
                                }`}>
                                    {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                            </label>
                        );
                    })}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2.5">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={() => onExport(mode)} 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-500/20 transition-all"
                    >
                        <Download size={14} />
                        Download Excel
                    </button>
                </div>
            </div>
        </div>
    );
}

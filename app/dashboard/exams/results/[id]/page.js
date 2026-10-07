'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronUp, ChevronDown, ChevronsUpDown, ArrowLeft, Search, Download, Trash2, Settings, X, Check, CheckCircle2, XCircle, MinusCircle, AlertCircle, ShieldAlert, PencilLine, Flag, Send, Navigation, PlayCircle, Circle, ScrollText, Trophy, Clock, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';
import { wallClockToEpochMs } from '@/app/lib/timezone';

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

    const fetchResults = async () => {
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
    };

    // Export Handler
    const handleExport = (attemptMode) => {
        // Construct detailed filename date part
        const dateStr = new Date().toISOString().split('T')[0];

        // Build URL
        const url = `/api/exams/export?exam_id=${examId}&class_id=${classFilter}&attempt_mode=${attemptMode}`;

        // Trigger download
        window.location.href = url;
        setShowExportModal(false);
    };

    useEffect(() => {
        if (!examId) return;
        fetchResults();
    }, [examId]);

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
            ? <ChevronUp size={13} className="text-slate-700 dark:text-slate-200" />
            : <ChevronDown size={13} className="text-slate-700 dark:text-slate-200" />;
    };

    const sortedResults = useMemo(() => {
        const data = [...filteredResults];
        const { key, direction } = sortConfig;
        const dir = direction === 'asc' ? 1 : -1;

        data.sort((a, b) => {
            if (key === 'score') {
                // Yang belum mengerjakan selalu di akhir
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
                <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-slate-600 rounded-full animate-spin" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Memuat data hasil ujian...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="text-red-400"><AlertCircle size={32} /></div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">Gagal memuat hasil ujian</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{error}</p>
                <button onClick={fetchResults} className="mt-1 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    Coba lagi
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                    <Link href="/dashboard/exams" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                        <ArrowLeft size={14} />
                        Kembali ke Daftar Ujian
                    </Link>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5 break-words">
                        {resultsData.examName}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Ringkasan nilai dan analisis jawaban siswa. Klik nama siswa untuk melihat riwayat attempt.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                        href={`/dashboard/exams/manage/${examId}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <Settings size={14} />
                        Kelola Ujian
                    </Link>
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                    >
                        <Download size={14} />
                        Export Data
                    </button>
                </div>
            </div>

            {/* Ringkasan */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard label="Total Siswa" value={summary.total} />
                <SummaryCard label="Sudah Mengerjakan" value={summary.done} tone={summary.total ? 'text-emerald-600 dark:text-emerald-400' : ''} />
                <SummaryCard label="Belum Mengerjakan" value={summary.pending} tone={summary.pending ? 'text-amber-600 dark:text-amber-400' : ''} />
                <SummaryCard
                    label="Rata-rata Nilai"
                    value={summary.average === null ? '—' : formatNumber(Math.round(summary.average * 100) / 100)}
                    tone={summary.average === null ? '' : summary.average >= 75 ? 'text-emerald-600 dark:text-emerald-400' : summary.average >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
                />
            </div>

            {/* Toolbar */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col lg:flex-row lg:items-center gap-2">
                <div className="relative flex-1 min-w-0">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Cari nama atau username siswa..."
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        aria-label="Cari siswa"
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
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
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={14} />
                        Reset
                    </button>
                )}
            </div>

            {/* Keterangan */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Keterangan:</span>
                <LegendItem className="text-emerald-600 dark:text-emerald-400" icon={<Check size={11} />} text="hijau = jawaban benar" />
                <LegendItem className="text-red-600 dark:text-red-400" icon={<X size={11} />} text="merah = jawaban salah" />
                <LegendItem className="text-slate-400" icon={<MinusCircle size={11} />} text="abu-abu = tidak dijawab" />
                <span className="ml-auto">{sortedResults.length} dari {resultsData.results.length} siswa ditampilkan</span>
            </div>

            {/* Daftar siswa */}
            {sortedResults.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                        <Search size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Tidak ada siswa yang cocok</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ubah kata kunci atau reset filter yang aktif.</p>
                    {hasActiveFilter && (
                        <button onClick={resetFilters} className="mt-4 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            Reset filter
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop */}
                    <div className="hidden lg:block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/60">
                                <tr>
                                    <th className="group px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                                        <span className="inline-flex items-center gap-1.5">
                                            Siswa
                                            <SortIcon columnKey="name" />
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">Status</th>
                                    <th className="group px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center cursor-pointer select-none" onClick={() => toggleSort('attempts')}>
                                        <span className="inline-flex items-center gap-1.5">
                                            Attempt
                                            <SortIcon columnKey="attempts" />
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">Jawaban</th>
                                    <th className="group px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right cursor-pointer select-none" onClick={() => toggleSort('score')}>
                                        <span className="inline-flex items-center gap-1.5">
                                            Nilai Terbaik
                                            <SortIcon columnKey="score" />
                                        </span>
                                    </th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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

                    {/* Mobile */}
                    <div className="lg:hidden space-y-2">
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

            {/* Detail View */}
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

function SummaryCard({ label, value, tone = '' }) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
            <div className={`text-xl font-bold mt-0.5 tabular-nums ${tone || 'text-slate-900 dark:text-white'}`}>{value}</div>
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
            className="w-full lg:w-auto px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
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
        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
        : score >= 60
            ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
            : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';

    if (compact) {
        return (
            <button
                onClick={onOpen}
                disabled={!isCompleted}
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-3 disabled:opacity-60 enabled:hover:border-slate-300 dark:enabled:hover:border-slate-700 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Avatar name={student.studentName} completed={isCompleted} />
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{student.studentName}</div>
                        <div className="text-[11px] text-slate-400 truncate">{student.className} · @{student.username || 'user'}</div>
                    </div>
                    <div className="text-right shrink-0">
                        {isCompleted ? (
                            <>
                                <div className={`px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums ${scoreTone}`}>{formatNumber(score)}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{student.attempts.length} attempt</div>
                            </>
                        ) : (
                            <span className="text-[11px] font-semibold text-slate-400">Belum</span>
                        )}
                    </div>
                    {isCompleted && <ChevronRight size={15} className="text-slate-300 dark:text-slate-600 shrink-0" />}
                </div>
            </button>
        );
    }

    return (
        <tr
            onClick={onOpen}
            title={isCompleted ? 'Klik untuk melihat riwayat attempt' : 'Siswa belum mengerjakan ujian'}
            className={`group transition-colors ${isCompleted ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60' : 'opacity-60'}`}
        >
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <Avatar name={student.studentName} completed={isCompleted} />
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{student.studentName}</div>
                        <div className="text-[11px] text-slate-400 truncate">{student.className} · @{student.username || 'user'}</div>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${isCompleted
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                    {isCompleted ? 'Selesai' : 'Belum'}
                </span>
            </td>
            <td className="px-4 py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                {isCompleted ? student.attempts.length : '—'}
            </td>
            <td className="px-4 py-3">
                {isCompleted ? (
                    <div className="flex items-center justify-center gap-2 text-xs tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">{student.correctCount} benar</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-red-600 dark:text-red-400">{student.incorrectCount} salah</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-slate-500 dark:text-slate-400">{student.notAnsweredCount} kosong</span>
                    </div>
                ) : (
                    <span className="block text-center text-slate-300 dark:text-slate-600">—</span>
                )}
            </td>
            <td className="px-4 py-3">
                {isCompleted ? (
                    <div className="flex items-center justify-end gap-2.5">
                        <span className="w-16 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" title={`Akurasi jawaban: ${accuracy}%`}>
                            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${accuracy}%` }} />
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums ${scoreTone}`}>{formatNumber(score)}</span>
                    </div>
                ) : (
                    <span className="block text-right text-slate-300 dark:text-slate-600">—</span>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                {isCompleted && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
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
    return (
        <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${completed
            ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}>
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
        // Paling baru di atas: berdasarkan waktu mulai, fallback ke waktu selesai
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Riwayat attempt ${student.studentName}`}
                className="relative w-full sm:max-w-2xl sm:max-h-[85vh] h-full sm:h-auto bg-white dark:bg-slate-900 sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">Riwayat Attempt</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {student.studentName} · {student.className} · @{student.username}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Tutup"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {attempts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <ScrollText size={20} />
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">Siswa ini belum memiliki attempt yang selesai.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                            <StatCell label="Attempt" value={stats.total} />
                            <StatCell label="Tertinggi" value={stats.best} tone="best" />
                            <StatCell label="Rata-rata" value={stats.average} />
                        </div>

<div className="flex-1 overflow-y-auto p-4 space-y-2">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 px-1 pb-1">
                                <span className="font-semibold">Keterangan:</span>
                                <span>klik baris = lihat analisis jawaban</span>
                                <span className="inline-flex items-center gap-1"><ScrollText size={11} /> log aktivitas</span>
                                <span className="inline-flex items-center gap-1"><Trash2 size={11} /> hapus attempt</span>
<span className="w-full">Urut dari yang paling baru (teratas).</span>
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
        <div className="px-4 py-3 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0">
            <div className={`text-lg font-bold leading-none ${color}`}>{display}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mt-1">{label}</div>
        </div>
    );
}

function AttemptRow({ attempt, number, isBest, formatScore, totalQuestions, isDeleting, isConfirming, onOpen, onShowLogs, onRequestDelete, onCancelDelete, onConfirmDelete }) {
    const { fmt } = useLanguage();
    const score = Number(attempt.score) || 0;
    const scoreTone = score >= 80
        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
        : score >= 60
            ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
            : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';

    // startTime/endTime adalah DATETIME naive dari MySQL. new Date() akan
    // memakainya sebagai waktu lokal browser lalu diformat ulang ke zona
    // aplikasi, sehingga jamnya bergeser.(fmt.dateTime sudah menangani string
    // naive sebagai identity, jadi cukup kirim string aslinya.)
    const startMs = attempt.startTime ? wallClockToEpochMs(attempt.startTime, timezone) : null;
    const endMs = attempt.endTime ? wallClockToEpochMs(attempt.endTime, timezone) : null;
    const duration = startMs !== null && endMs !== null && endMs >= startMs ? formatDuration(endMs - startMs) : null;

    const answered = attempt.answeredCount ?? (attempt.correctCount + attempt.incorrectCount);
    const accuracy = answered > 0 ? Math.round((attempt.correctCount / answered) * 100) : 0;

    return (
        <div className={`rounded-xl border transition-colors ${isConfirming ? 'border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}>
            <div className="flex items-center gap-3 px-3 py-3">
                <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                        {number}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {attempt.startTime ? fmt.dateTime(attempt.startTime) : 'Waktu tidak tersedia'}
                            </span>
                            {isBest && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
                                    <Trophy size={10} /> Tertinggi
                                </span>
                            )}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {duration && (
                                <span className="inline-flex items-center gap-1"><Clock size={11} />{duration}</span>
                            )}
                            <span className="text-emerald-600 dark:text-emerald-400">{attempt.correctCount} benar</span>
                            <span className="text-red-600 dark:text-red-400">{attempt.incorrectCount} salah</span>
                            {attempt.notAnsweredCount !== undefined && (
                                <span>{attempt.notAnsweredCount} kosong</span>
                            )}
                            {totalQuestions ? <span>{answered}/{totalQuestions} dijawab</span> : null}
                        </span>
                    </span>
                </button>

                <div className="shrink-0 flex items-center gap-2">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className={`px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums ${scoreTone}`}>{formatScore(score)}</span>
                        <span className="w-20 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${accuracy}%` }} />
                        </span>
                    </div>
                    <span className={`sm:hidden px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums ${scoreTone}`}>{formatScore(score)}</span>

                    <button
                        onClick={onShowLogs}
                        aria-label="Lihat log aktivitas"
                        title="Log aktivitas"
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                        <ScrollText size={16} />
                    </button>
                    <button
                        onClick={onRequestDelete}
                        disabled={isDeleting}
                        aria-label="Hapus attempt"
                        title="Hapus attempt"
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    >
                        <Trash2 size={16} />
                    </button>
                    <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 hidden sm:block" />
                </div>
            </div>

            {isConfirming && (
                <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-red-200 dark:border-red-900">
                    <p className="text-xs text-red-700 dark:text-red-300">Hapus attempt ini? Jawaban & nilai akan hilang permanen.</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={onCancelDelete} className="px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            Batal
                        </button>
                        <button
                            onClick={onConfirmDelete}
                            disabled={isDeleting}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
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
        badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
        card: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10',
        dot: 'bg-emerald-500'
    },
    SUBMIT: {
        label: 'Dikumpulkan', icon: Send, hint: 'Jawaban dikumpulkan, manual oleh siswa atau otomatis karena waktu habis.',
        badge: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
        card: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10',
        dot: 'bg-indigo-500'
    },
    ANSWER: {
        label: 'Jawaban', icon: PencilLine, hint: 'Siswa memilih, mengubah, atau menghapus jawaban.',
        badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
        card: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',
        dot: 'bg-slate-400'
    },
    NAVIGATE: {
        label: 'Navigasi', icon: Navigation, hint: 'Siswa berpindah halaman soal.',
        badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
        card: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',
        dot: 'bg-slate-300 dark:bg-slate-600'
    },
    FLAG: {
        label: 'Tanda ragu', icon: Flag, hint: 'Siswa menandai atau menghapus tanda soal ragu-ragu.',
        badge: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
        card: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10',
        dot: 'bg-amber-500'
    },
    SECURITY: {
        label: 'Keamanan', icon: ShieldAlert, hint: 'Pelanggaran: keluar halaman, minimize, kehilangan fokus, copy, atau paste.',
        badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
        card: 'border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-900/10',
        dot: 'bg-red-500'
    }
};

const GENERIC_LOG_META = {
    label: 'Lainnya', icon: Circle, hint: 'Jenis aktivitas lain yang belum dikelompokkan.',
    badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    card: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Log aktivitas ${studentName}`}
                className="relative w-full sm:max-w-2xl sm:max-h-[85vh] h-full sm:h-auto bg-white dark:bg-slate-900 sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Log Aktivitas</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{studentName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Tutup"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-xs font-medium text-slate-400">Memuat log...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-10 text-center">
                        <div className="max-w-xs">
                            <div className="text-red-400 mb-3 flex justify-center"><AlertCircle size={32} /></div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Gagal memuat log</h3>
                            <p className="text-sm text-slate-500">{error}</p>
                        </div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                        <ClipboardListIcon />
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">Belum ada aktivitas tercatat pada sesi ini.</p>
                    </div>
                ) : (
                    <>
<div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">
                                {logs.length} catatan{durationText ? ` · ${durationText}` : ''}
                            </span>
                            {securityCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" title="Aktivitas yang melanggar aturan keamanan saat ujian">
                                    <ShieldAlert size={12} /> {securityCount} pelanggaran keamanan
                                </span>
                            )}
                            <span className="flex-1" />
                            <FilterPills types={types} filter={filter} onChange={setFilter} />
                        </div>

                        <div className="border-b border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setShowLegend(v => !v)}
                                aria-expanded={showLegend}
                                className="w-full flex items-center gap-2 px-5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                <Info size={13} />
                                Apa arti setiap jenis log?
                                <ChevronDown size={14} className={`ml-auto transition-transform ${showLegend ? 'rotate-180' : ''}`} />
                            </button>
                            {showLegend && (
                                <ul className="px-5 pb-3 grid gap-1.5">
                                    {types.map(([key, count]) => {
                                        const meta = getLogMeta(key);
                                        const Icon = meta.icon;
                                        return (
                                            <li key={key} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${meta.badge}`}>
                                                    <Icon size={10} /> {meta.label}
                                                </span>
                                                <span className="flex-1">{meta.hint}</span>
                                                <span className="shrink-0 tabular-nums text-slate-400">({count})</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {groupedLogs.map(group => (
                                <div key={group.key} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur py-1 mb-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</span>
                                    </div>
                                    <ol className="space-y-0">
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
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${isActive
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                    >
                        {pill.label}
                        {pill.count !== undefined && <span className={isActive ? 'opacity-70' : 'text-slate-400'}>{pill.count}</span>}
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
            <span className="shrink-0 w-14 pt-1 text-right text-xs font-semibold tabular-nums text-slate-400">{time}</span>
            <span className="shrink-0 flex flex-col items-center w-3 self-stretch">
                <span className={`mt-1.5 w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                {!isLast && <span className="flex-1 w-px bg-slate-200 dark:bg-slate-700 my-1" />}
            </span>
<div className={`flex-1 min-w-0 mb-2 rounded-lg border px-3 py-2 ${meta.card}`} title={meta.hint}>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}>
                    <Icon size={11} />
                    {meta.label}
                </span>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 leading-snug break-words">{log.description}</p>
            </div>
        </li>
    );
}

function ClipboardListIcon() {
    return (
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
        </div>
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
    correct: { label: 'Benar', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
    partial: { label: 'Sebagian', text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
    wrong: { label: 'Salah', text: 'text-red-600 dark:text-red-400', chip: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' },
    empty: { label: 'Kosong', text: 'text-slate-500 dark:text-slate-400', chip: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' }
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
    const scoreTone = score >= 80
        ? 'text-emerald-600 dark:text-emerald-400'
        : score >= 60
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-red-600 dark:text-red-400';

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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`Analisis jawaban ${studentName}`}
                className="relative w-full sm:max-w-3xl sm:max-h-[88vh] h-full sm:h-auto bg-white dark:bg-slate-900 sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">Analisis Jawaban</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{studentName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {score !== undefined && score !== null && (
                            <div className="text-right">
                                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Nilai</div>
                                <div className={`text-xl font-bold leading-none ${scoreTone}`}>
                                    {analysis?.scoringMode === 'raw' ? formatNumber(score) : Math.round(score)}
                                </div>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            aria-label="Tutup"
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-xs font-medium text-slate-400">Memuat analisis...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-10 text-center">
                        <div className="max-w-xs">
                            <div className="text-red-400 mb-3 flex justify-center"><AlertCircle size={32} /></div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Gagal memuat analisis</h3>
                            <p className="text-sm text-slate-500">{error}</p>
                        </div>
                    </div>
                ) : (
                    <>
{/* Summary + Filters */}
                        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                                <span className="font-semibold">Ringkasan:</span>
                                <span>{counts.correct} benar</span>
                                <span>{counts.wrong} salah</span>
                                <span>{counts.partial} sebagian</span>
                                <span>{counts.empty} kosong</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {filters.map(f => {
                                    const isActive = filter === f.key;
                                    const isZero = f.count === 0 && f.key !== 'all';
                                    return (
                                        <button
                                            key={f.key}
                                            onClick={() => setFilter(f.key)}
                                            disabled={isZero}
                                            title={`Tampilkan ${f.label.toLowerCase()}`}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isActive
                                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                            }`}
                                        >
                                            {f.label}
                                            <span className={isActive ? 'opacity-70' : 'text-slate-400'}>{f.count}</span>
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
                                            className={`shrink-0 w-7 h-7 rounded-md text-[11px] font-bold text-white ${STATUS_META[item.status].dot} hover:opacity-80 transition-opacity`}
                                        >
                                            {item.number}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Questions */}
<div ref={contentRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                            {visibleItems.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-12">Tidak ada soal pada filter ini.</p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-semibold">Keterangan:</span>
                                <LegendItem className="text-emerald-600 dark:text-emerald-400" icon={<Check size={11} />} text="hijau = kunci jawaban / jawaban benar" />
                                <LegendItem className="text-red-600 dark:text-red-400" icon={<X size={11} />} text="merah = jawaban siswa yang salah" />
                                <LegendItem className="text-slate-400" icon={<MinusCircle size={11} />} text="abu-abu = tidak dijawab" />
                                <LegendItem className="text-amber-600 dark:text-amber-400" icon={<AlertCircle size={11} />} text="kuning = sebagian benar (pola penilaian sebagian)" />
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
        <span className={`inline-flex items-center gap-1 ${className}`}>
            <span className="shrink-0">{icon}</span>
            {text}
        </span>
    );
}

function QuestionReviewCard({ item, innerRef }) {
    const meta = STATUS_META[item.status];
    const isEssay = item.questionType === 'essay';
    const isMatching = item.questionType === 'matching';

    let studentChoices = [];
    if (!isMatching && item.studentAnswer) {
        studentChoices = String(item.studentAnswer).split(',').map(s => s.trim()).filter(Boolean);
    }
    let correctChoices = [];
    if (!isMatching && item.correctAnswer) {
        correctChoices = String(item.correctAnswer).split(',').map(s => s.trim()).filter(Boolean);
    }

    return (
        <article
            ref={innerRef}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden scroll-mt-2"
        >
            <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
                <div className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                    {item.number}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="prose dark:prose-invert prose-sm max-w-none text-sm font-medium text-slate-800 dark:text-slate-100 custom-content-wrapper" dangerouslySetInnerHTML={{ __html: item.questionText }} />
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="uppercase tracking-wide">{(item.questionType || 'multiple choice').replace(/_/g, ' ')}</span>
                        <span>·</span>
                        <span>{formatNumber(item.scoreEarned)} / {formatNumber(item.points)} poin</span>
                    </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${meta.chip}`}>
                    {item.status === 'correct' && <Check size={12} />}
                    {item.status === 'wrong' && <X size={12} />}
                    {item.status === 'empty' && <MinusCircle size={12} />}
                    {item.status === 'partial' && <AlertCircle size={12} />}
                    {meta.label}
                </span>
            </div>

            <div className="px-4 py-3 space-y-2 bg-slate-50/60 dark:bg-slate-900/40">
                {isMatching ? (
                    <MatchingReview item={item} />
                ) : isEssay ? (
                    <div className="space-y-2">
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Jawaban siswa</div>
                            {item.studentAnswer ? (
                                <div className="prose dark:prose-invert prose-sm max-w-none text-sm text-slate-700 dark:text-slate-200 custom-content-wrapper" dangerouslySetInnerHTML={{ __html: item.studentAnswer }} />
                            ) : (
                                <p className="text-sm text-slate-400 italic">Tidak dijawab</p>
                            )}
                        </div>
                        {item.correctAnswer && (
                            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">Kunci jawaban</div>
                                <div className="prose dark:prose-invert prose-sm max-w-none text-sm text-emerald-800 dark:text-emerald-200 custom-content-wrapper" dangerouslySetInnerHTML={{ __html: item.correctAnswer }} />
                            </div>
                        )}
                    </div>
                ) : item.options && Object.keys(item.options).length > 0 ? (
                    Object.entries(item.options).map(([key, value]) => {
                        const isCorrectOption = correctChoices.includes(key);
                        const isSelected = studentChoices.includes(key);

                        let tone = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300';
                        let badge = 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300';
                        let mark = null;

                        if (isCorrectOption) {
                            tone = 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/15 text-emerald-900 dark:text-emerald-200';
                            badge = 'bg-emerald-500 text-white';
                            mark = <CheckCircle2 size={16} className="text-emerald-500" />;
                        } else if (isSelected) {
                            tone = 'border-red-300 dark:border-red-900 bg-red-50/70 dark:bg-red-900/15 text-red-900 dark:text-red-200';
                            badge = 'bg-red-500 text-white';
                            mark = <XCircle size={16} className="text-red-500" />;
                        }

                        return (
                            <div key={key} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${tone}`}>
                                <span className={`mt-0.5 shrink-0 w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center ${badge}`}>{key}</span>
                                <div className="flex-1 min-w-0 prose dark:prose-invert prose-sm max-w-none text-sm custom-content-wrapper" dangerouslySetInnerHTML={{ __html: value }} />
                                <span className="shrink-0 mt-0.5">{mark}</span>
                            </div>
                        );
                    })
                ) : (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm">
                        <p className={item.studentAnswer ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 italic'}>
                            {item.studentAnswer || 'Tidak dijawab'}
                        </p>
                        {item.correctAnswer && (
                            <p className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-emerald-700 dark:text-emerald-300">
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
        return <p className="text-sm text-slate-400">Tidak ada pasangan yang tersedia.</p>;
    }

    return (
        <div className="space-y-2">
            {pairs.map(pair => {
                const studentMatch = choices[pair.id];
                const isPairCorrect = studentMatch === pair.r;

                return (
                    <div key={pair.id} className={`rounded-lg border px-3 py-2 ${isPairCorrect
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10'
                        : 'border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-900/10'}`}>
                        <div className="flex items-start gap-2.5">
                            <span className="shrink-0 mt-0.5">
                                {isPairCorrect
                                    ? <CheckCircle2 size={16} className="text-emerald-500" />
                                    : <XCircle size={16} className="text-red-500" />}
                            </span>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-sm text-slate-700 dark:text-slate-200 prose dark:prose-invert prose-sm max-w-none custom-content-wrapper" dangerouslySetInnerHTML={{ __html: pair.p }} />
                                <div className="text-sm prose dark:prose-invert prose-sm max-w-none custom-content-wrapper">
                                    <span className="text-slate-400">Dijawab: </span>
                                    <span className={isPairCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
                                        {studentMatch ? <span dangerouslySetInnerHTML={{ __html: studentMatch }} /> : <em className="text-slate-400">tidak diisi</em>}
                                    </span>
                                </div>
                                {!isPairCorrect && (
                                    <div className="text-sm text-emerald-700 dark:text-emerald-300 prose dark:prose-invert prose-sm max-w-none custom-content-wrapper">
                                        <span className="text-slate-400">Kunci: </span>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Export Results</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Select how you want to export the exam data to Excel.</p>

                <div className="space-y-3 mb-8">
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${mode === 'all' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'}`}>
                        <input type="radio" name="exportMode" value="all" checked={mode === 'all'} onChange={() => setMode('all')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <div className="ml-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">All Attempts</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Export every single attempt made by users</div>
                        </div>
                    </label>
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${mode === 'best' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'}`}>
                        <input type="radio" name="exportMode" value="best" checked={mode === 'best'} onChange={() => setMode('best')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <div className="ml-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">Best Attempt Only</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Export only the highest score per user</div>
                        </div>
                    </label>
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${mode === 'latest' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'}`}>
                        <input type="radio" name="exportMode" value="latest" checked={mode === 'latest'} onChange={() => setMode('latest')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        <div className="ml-3">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">Latest Attempt Only</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Export only the most recent submission</div>
                        </div>
                    </label>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                    <button onClick={() => onExport(mode)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-medium rounded-lg shadow-sm transition-colors">
                        Download Excel
                    </button>
                </div>
            </div>
        </div>
    );
}

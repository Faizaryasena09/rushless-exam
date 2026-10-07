'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { formatTimestamp } from '@/app/lib/timezone';

const LIMITS = [25, 50, 100, 200, 500];

// Level log = tingkat keparahan, jadi warna dipilih berdasarkan itu: info
// netral, warn amber, error rose. Semua turunan (badge, titik, border kiri,
// kartu filter, kartu tabel) memakai satu objek ini supaya tidak pernah beda.
const LEVEL_META = {
    info: {
        label: 'Info',
        badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400',
        border: 'border-l-slate-300 dark:border-l-slate-600',
        stat: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700/50',
        statActive: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white',
        row: 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
    },
    warn: {
        label: 'Warning',
        badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60',
        dot: 'bg-amber-500',
        border: 'border-l-amber-400',
        stat: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60 hover:bg-amber-100/70 dark:hover:bg-amber-900/40',
        statActive: 'bg-amber-500 text-white border-amber-500',
        row: 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20',
    },
    error: {
        label: 'Error',
        badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60',
        dot: 'bg-rose-500',
        border: 'border-l-rose-500',
        stat: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100/70 dark:hover:bg-rose-900/40',
        statActive: 'bg-rose-600 text-white border-rose-600',
        row: 'hover:bg-rose-50/50 dark:hover:bg-rose-950/20',
    }
};

// Label ramah untuk action agar tidak hanya menampilkan kode mentah
const ACTION_LABELS = {
    LOGIN_SUCCESS: 'Login berhasil',
    LOGIN_FAILED: 'Login gagal (password salah)',
    LOGIN_ERROR: 'Error saat proses login',
    LOGIN_LOCKED: 'Login ditolak (akun terkunci)',
    LOGIN_DENIED: 'Login ditolak (sesi ganda / duplikasi)',
    LOGIN_BRUTEFORCE_TRIGGERED: 'Brute force terdeteksi',
    LOGIN_BRUTEFORCE_LOCKED: 'Akun dikunci karena brute force',
    LOGOUT: 'Logout',
    USER_CREATE: 'User dibuat',
    USER_UPDATE: 'User diperbarui',
    USER_DELETE: 'User dihapus',
    USER_DELETE_BY_CLASS: 'User dihapus per kelas',
    USER_LOCK: 'User dikunci',
    USER_UNLOCK: 'User dibuka kunci',
    USER_BRUTEFORCE_UNLOCK: 'Buka kunci brute force',
    USER_BRUTEFORCE_UNLOCK_ALL: 'Buka kunci brute force (semua)',
    USER_UNLOCK_ALL: 'Buka kunci semua user',
    SESSION_RESTART_ALL: 'Restart semua sesi',
    SESSION_RESET_UNLOCK: 'Reset sesi + buka kunci',
    SESSION_RESET_ALL: 'Reset semua sesi',
    SESSION_RESET_FAILED: 'Reset sesi gagal',
    SESSION_RESET_LOCKED: 'Reset sesi ditolak (terkunci)',
    SESSION_PURGE_CACHE: 'Pembersihan cache sesi',
    SETTING_CHANGE: 'Pengaturan diubah',
    BRANDING_CHANGE: 'Branding diubah',
    ARCHIVE_EXPORT_CSV: 'Ekspor arsip (CSV)',
    EXAM_SUBMIT: 'Ujian dikumpulkan',
    EXAM_SUBMIT_MERGED: 'Jawaban digabung saat submit',
    REFRESH_ACTION: 'Refresh peserta',
    REFRESH_ALL_ACTION: 'Refresh semua peserta',
    ANSWER_RESTORE: 'Jawaban dipulihkan',
    ANSWER_RESTORE_RECREATE: 'Jawaban dipulihkan (attempt baru)',
    ANSWER_RESTORE_UNDO: 'Pemulihan jawaban dibatalkan',
    SYSTEM_REQUEST_ERROR: 'Unhandled error pada request',
    SYSTEM_LOGIN_FAILED: 'Error sistem saat login',
    SYSTEM_ACTIVITY_LOGS_READ_FAILED: 'Gagal membaca activity log',
    SYSTEM_EXAM_LOG_READ_FAILED: 'Gagal membaca log ujian',
    SYSTEM_EXAM_LOG_WRITE_FAILED: 'Gagal menyimpan log ujian',
    SYSTEM_ERROR: 'Error sistem'
};

const FIELD_LABELS = {
    message: 'Pesan', context: 'Konteks', runtime: 'Runtime', at: 'Waktu (server)',
    status: 'Status', source: 'Sumber', username: 'Username', exam: 'Ujian',
    class_name: 'Kelas', role: 'Peran', target: 'Target', count: 'Jumlah',
    reason: 'Alasan', route: 'Route', endpoint: 'Endpoint', pathname: 'Pathname',
    search: 'Pencarian', searchParams: 'Search params', routerKind: 'Router kind',
    routeType: 'Tipe route', renderSource: 'Render source', revalidateReason: 'Alasan revalidate',
    oldValue: 'Nilai lama', newValue: 'Nilai baru', changes: 'Perubahan', fields: 'Field',
    ip: 'IP', userAgent: 'User agent', duration: 'Durasi', note: 'Catatan'
};

function formatTime(dateStr, timeZone) {
      if (!dateStr) return '-';
      return formatTimestamp(dateStr, { locale: 'id-ID', timeZone, seconds: true });
    }

function parseDetails(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return str; }
}

function prettyDetails(str) {
    const parsed = parseDetails(str);
    if (parsed === null) return null;
    if (typeof parsed === 'string') return parsed;
    return JSON.stringify(parsed, null, 2);
}

function formatValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export default function ActivityLogsPage() {
    const { timezone: appTimezone, fmt } = useLanguage();
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [levelCounts, setLevelCounts] = useState({ info: 0, warn: 0, error: 0 });
    const [actions, setActions] = useState([]);

    // Filters
    const [level, setLevel] = useState('');
    const [action, setAction] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Detail drawer
    const [selected, setSelected] = useState(null);
    const [copied, setCopied] = useState('');
    const [exporting, setExporting] = useState(false);

    // Real-time
    const [live, setLive] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const intervalRef = useRef(null);

    // Health-check infrastruktur (DB / Redis / fallback log)
    const [health, setHealth] = useState(null);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch('/api/system-health');
            if (!res.ok) return;
            setHealth(await res.json());
        } catch {
            // diam saja: banner tidak boleh mengganggu
        }
    }, []);

    useEffect(() => { fetchHealth(); }, [fetchHealth]);

    const hasFilters = !!(level || action || search || dateFrom || dateTo);

    const fetchLogs = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page);
            params.set('limit', limit);
            if (level) params.set('level', level);
            if (action) params.set('action', action);
            if (search) params.set('search', search);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);

            const res = await fetch(`/api/activity-logs?${params}`);
            if (!res.ok) {
                if (res.status === 401) { setError('Anda tidak memiliki akses ke halaman ini.'); setLoading(false); return; }
                throw new Error('Gagal memuat data log.');
            }
            const data = await res.json();
            setLogs(data.logs || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setLevelCounts(data.levelCounts || { info: 0, warn: 0, error: 0 });
            if (Array.isArray(data.actions)) setActions(data.actions);
            setLastUpdated(new Date());
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [page, limit, level, action, search, dateFrom, dateTo]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (live && page === 1) {
            intervalRef.current = setInterval(() => fetchLogs(true), 5000);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [live, page, fetchLogs]);

    // Pantau kondisi infrastruktur (DB/Redis/fallback) setiap 15 detik
    useEffect(() => {
        const id = setInterval(fetchHealth, 15000);
        return () => clearInterval(id);
    }, [fetchHealth]);

    // Tutup detail dengan tombol Escape
    useEffect(() => {
        if (!selected) return;
        const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        setSearch(searchInput);
    };

    const handleClearFilters = () => {
        setLevel('');
        setAction('');
        setSearch('');
        setSearchInput('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            params.set('format', 'csv');
            params.set('limit', '2000');
            if (level) params.set('level', level);
            if (action) params.set('action', action);
            if (search) params.set('search', search);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);

            const res = await fetch(`/api/activity-logs?${params}`);
            if (!res.ok) throw new Error('Gagal mengekspor data.');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message);
        } finally {
            setExporting(false);
        }
    };

    const copyText = async (text, key) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(key);
            setTimeout(() => setCopied(''), 1500);
        } catch {
            setError('Browser tidak mendukung copy ke clipboard.');
        }
    };

    const selectedDetails = useMemo(() => parseDetails(selected?.details), [selected]);
    const selectedRawDetails = useMemo(() => prettyDetails(selected?.details), [selected]);

    const infraAlert = !!health && (
        !health.mysql?.ok || !health.redis?.ok || (health.logFallback?.pending || 0) > 0
    );

    // Kartu filter memakai LEVEL_META yang sama dengan baris tabel, jadi kartu
    // "Error" bewarna persis sama dengan badge Error di daftar log.
    const statCards = [
        { key: 'all', label: 'Total log', value: total, active: !level, idle: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700/50', activeCls: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' },
        { key: 'info', label: 'Info', value: levelCounts.info, active: level === 'info', idle: LEVEL_META.info.stat, activeCls: LEVEL_META.info.statActive },
        { key: 'warn', label: 'Warning', value: levelCounts.warn, active: level === 'warn', idle: LEVEL_META.warn.stat, activeCls: LEVEL_META.warn.statActive },
        { key: 'error', label: 'Error', value: levelCounts.error, active: level === 'error', idle: LEVEL_META.error.stat, activeCls: LEVEL_META.error.statActive }
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/70 dark:from-slate-800 dark:via-slate-900 dark:to-indigo-950/20" />
                <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500" />

                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-5">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <span className="shrink-0 grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Activity Logs</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {total.toLocaleString('id-ID')} record
                                {lastUpdated && !loading && ` � diperbarui ${fmt.clock(lastUpdated)}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setLive((v) => !v)}
                            aria-pressed={live}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${live
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                {live && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />}
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${live ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                            </span>
                            {live ? 'Live' : 'Paused'}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-sky-200 dark:border-sky-900/60 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                            {exporting ? 'Menyiapkan...' : 'Export CSV'}
                        </button>
                        <button
                            onClick={() => fetchLogs()}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-sm shadow-indigo-300/50 dark:shadow-indigo-950/40 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Ringkasan level */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {statCards.map((card) => (
                    <button
                        key={card.key}
                        onClick={() => { card.key === 'all' ? setLevel('') : setLevel(card.key); setPage(1); }}
                        aria-pressed={card.active}
                        className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${card.active ? card.activeCls : card.idle}`}
                    >
                        <p className={`text-[11px] font-bold uppercase tracking-wide ${card.active ? 'opacity-70' : 'opacity-70'}`}>{card.label}</p>
                        <p className="text-xl font-bold tabular-nums mt-0.5">
                            {(card.key === 'all' ? total : levelCounts[card.key] || 0).toLocaleString('id-ID')}
                        </p>
                    </button>
                ))}
            </div>

            {/* Filter */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 p-3 space-y-2.5">
                <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-70" />
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Cari username, action, IP, route, request ID, pesan error..."
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                        />
                    </div>
                    <button type="submit" className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white shadow-sm shadow-indigo-300/50 dark:shadow-indigo-950/40 hover:bg-indigo-700 transition-all active:scale-95">
                        Cari
                    </button>
                </form>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <select
                        value={level}
                        onChange={(e) => { setLevel(e.target.value); setPage(1); }}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                    >
                        <option value="">Semua level</option>
                        <option value="info">Info</option>
                        <option value="warn">Warning</option>
                        <option value="error">Error</option>
                    </select>

                    <select
                        value={action}
                        onChange={(e) => { setAction(e.target.value); setPage(1); }}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                    >
                        <option value="">Semua aksi</option>
                        {actions.map((a) => (
                            <option key={a} value={a}>{ACTION_LABELS[a] ? `${ACTION_LABELS[a]} (${a})` : a}</option>
                        ))}
                    </select>

                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                    />
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                    />
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Tampilkan</span>
                        <select
                            value={limit}
                            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                            className="px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 transition-colors"
                        >
                            {LIMITS.map((l) => <option key={l} value={l}>{l} baris</option>)}
                        </select>
                    </div>
                    {hasFilters && (
                        <button onClick={handleClearFilters} className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                            Reset filter
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-3">
                    <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                </div>
            )}

            {/* Status infrastruktur */}
            {health && (
                <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 ring-1 ring-slate-200/70 dark:ring-slate-800/70 ${infraAlert ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/25' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
                >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        <StatusDot ok={health.mysql?.ok} label="MySQL" extra={health.mysql?.latencyMs != null ? `${health.mysql.latencyMs}ms` : null} />
                        <StatusDot ok={health.redis?.ok} label="Redis" extra={health.redis?.latencyMs != null ? `${health.redis.latencyMs}ms` : null} />
                        <StatusDot ok={health.logFallback?.pending === 0} label="Log fallback" extra={health.logFallback?.pending ? `${health.logFallback.pending} tertunda` : null} />

                        <button onClick={fetchHealth} className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                            Periksa ulang
                        </button>
                    </div>

                    {infraAlert && (
                        <div className="mt-2.5 pt-2.5 border-t border-amber-200/70 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                            {!health.mysql?.ok && (
                                <p>MySQL tidak dapat diakses: {health.mysql?.error?.message || 'tidak diketahui'}. Log disimpan ke file sementara dan dikirim ulang otomatis setelah koneksi pulih.</p>
                            )}
                            {!health.redis?.ok && (
                                <p>Redis tidak aktif — sistem berjalan tanpa buffer, log ditulis langsung ke MySQL.</p>
                            )}
                            {health.logFallback?.pending > 0 && (
                                <p>
                                    {health.logFallback.pending} log menunggu dikirim ke database
                                    {health.logFallback.pendingActivity > 0 && ` (${health.logFallback.pendingActivity} aktivitas)`}
                                    {health.logFallback.pendingExam > 0 && ` (${health.logFallback.pendingExam} ujian)`}.
                                    {health.logFallback.dropped > 0 && ` ${health.logFallback.dropped} log tidak tertampung dan tersimpan di file.`}
                                </p>
                            )}
                            {health.logFallback?.file?.file && (
                                <p className="font-mono break-all text-amber-700/80 dark:text-amber-400/80">
                                    Backup log: {health.logFallback.file.file} ({health.logFallback.file.lines} baris)
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Tabel desktop */}
            <div className="hidden lg:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-indigo-50/60 dark:from-slate-800/60 dark:to-indigo-950/20">
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Waktu</th>
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Level</th>
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Aksi</th>
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Pelaku</th>
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Request</th>
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">IP</th>
                            <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && Array.from({ length: 8 }).map((_, i) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                                {Array.from({ length: 7 }).map((__, j) => (
                                    <td key={j} className="px-4 py-3"><div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" /></td>
                                ))}
                            </tr>
                        ))}
                        {!loading && logs.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tidak ada log ditemukan</p>
                                    <p className="text-xs text-slate-400 mt-1">Coba ubah atau reset filter yang aktif.</p>
                                </td>
                            </tr>
                        )}
                        {!loading && logs.map((log) => {
                            const meta = LEVEL_META[log.level] || LEVEL_META.info;
                            return (
                                <tr
                                    key={log.id}
                                    onClick={() => setSelected(log)}
                                    className={`border-b border-slate-100 dark:border-slate-800 border-l-4 ${meta.border} ${meta.row} cursor-pointer transition-colors`}
                                >
                                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                                        {formatTime(log.created_at, appTimezone)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wide ${meta.badge}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                            {meta.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{ACTION_LABELS[log.action] || log.action}</p>
                                        <p className="text-[11px] text-slate-400 font-mono">{log.action} � #{log.id}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.username ? (
                                            <>
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{log.username}</p>
                                                <p className="text-[11px] text-slate-400">ID user: {log.user_id ?? '-'}</p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">sistem{log.user_id ? ` � ID ${log.user_id}` : ''}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.path ? (
                                            <>
                                                <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate max-w-[220px]" title={log.path}>
                                                    <span className="text-slate-400">{log.method || 'GET'}</span> {log.path}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {log.status_code ? `HTTP ${log.status_code} � ` : ''}{log.duration_ms ? `${log.duration_ms}ms` : ''}
                                                    {log.request_id ? ` � req ${String(log.request_id).slice(0, 8)}` : ''}
                                                </p>
                                            </>
                                        ) : (
                                            <span className="text-[11px] text-slate-300 dark:text-slate-600">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">{log.ip_address || '-'}</td>
                                    <td className="px-4 py-3 text-slate-400">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Kartu mobile/tablet */}
            <div className="lg:hidden space-y-2">
                {loading && Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse mt-3" />
                    </div>
                ))}
                {!loading && logs.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-10 text-center">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tidak ada log ditemukan</p>
                        <p className="text-xs text-slate-400 mt-1">Coba ubah atau reset filter yang aktif.</p>
                    </div>
                )}
                {!loading && logs.map((log) => {
                    const meta = LEVEL_META[log.level] || LEVEL_META.info;
                    return (
                        <button
                            key={log.id}
                            onClick={() => setSelected(log)}
                            className={`w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 border-l-4 ${meta.border} bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 p-4 transition-colors ${meta.row}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ACTION_LABELS[log.action] || log.action}</p>
                                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wide ${meta.badge}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                    {meta.label}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 font-mono">{log.action} � #{log.id} � {formatTime(log.created_at, appTimezone)}</p>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <span>{log.username ? `${log.username} (ID ${log.user_id ?? '-'})` : 'sistem'}</span>
                                <span className="font-mono">{log.ip_address || '-'}</span>
                                {log.path && <span className="font-mono truncate max-w-full">{log.method} {log.path}</span>}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Halaman {page} dari {totalPages} � {total.toLocaleString('id-ID')} log
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setPage(1)} disabled={page === 1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-slate-800 transition-colors">First</button>
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-slate-800 transition-colors">Prev</button>
                        <span className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm shadow-indigo-300/50 dark:shadow-indigo-950/40">{page}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-slate-800 transition-colors">Next</button>
                        <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-slate-800 transition-colors">Last</button>
                    </div>
                </div>
            )}

            {/* Detail drawer */}
            {selected && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />

                    <aside className="relative w-full sm:w-[520px] max-w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
                        {/* Strip warna level: rose untuk error, amber untuk
                            warning, slate untuk info - jadi level log kelihatan
                            dari drawer saja. */}
                        <div aria-hidden className={`h-1 w-full shrink-0 bg-gradient-to-r ${
                            selected.level === 'error' ? 'from-rose-500 to-pink-500'
                                : selected.level === 'warn' ? 'from-amber-500 to-orange-500'
                                    : 'from-slate-400 to-slate-300'
                        }`} />
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {ACTION_LABELS[selected.action] || selected.action}
                                </h2>
                                <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{selected.action} � log #{selected.id}</p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                aria-label="Tutup detail"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {/* Ringkasan */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <Meta label="Waktu" value={formatTime(selected.created_at, appTimezone)} />
                                <Meta label="Level" value={(LEVEL_META[selected.level] || LEVEL_META.info).label} />
                                <Meta label="Username" value={selected.username || 'sistem'} />
                                <Meta label="User ID" value={selected.user_id ?? '-'} />
                                <Meta label="IP Address" value={selected.ip_address || '-'} />
                                <Meta label="HTTP Method" value={selected.method || '-'} />
                                <Meta label="Status Code" value={selected.status_code ?? '-'} />
                                <Meta label="Durasi" value={selected.duration_ms ? `${selected.duration_ms} ms` : '-'} />
                                <div className="col-span-2">
                                    <Meta label="Request ID" value={selected.request_id || '-'} mono />
                                </div>
                                <div className="col-span-2">
                                    <Meta label="Route / Path" value={selected.path || '-'} mono />
                                </div>
                                <div className="col-span-2">
                                    <Meta label="User Agent" value={selected.user_agent || '-'} mono />
                                </div>
                                {selected.error_name && (
                                    <div className="col-span-2">
                                        <Meta label="Nama Error" value={selected.error_name} mono />
                                    </div>
                                )}
                            </div>

                            {/* Detail */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Detail</h3>
                                    {selectedRawDetails && (
                                        <button
                                            onClick={() => copyText(selectedRawDetails, 'details')}
                                            className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                                        >
                                            {copied === 'details' ? 'Tersalin' : 'Copy JSON'}
                                        </button>
                                    )}
                                </div>

                                {selectedDetails === null || selectedDetails === undefined ? (
                                    <p className="text-xs text-slate-400 italic">Tidak ada detail.</p>
                                ) : typeof selectedDetails === 'object' ? (
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                                        {Object.entries(selectedDetails).map(([key, value]) => (
                                            <div key={key} className="px-3 py-2 flex flex-col sm:flex-row sm:gap-3">
                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:w-40 shrink-0">{FIELD_LABELS[key] || key}</span>
                                                <span className="text-xs text-slate-800 dark:text-slate-200 break-words font-mono">{formatValue(value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                                        {selectedDetails}
                                    </p>
                                )}
                            </div>

                            {/* Stack trace */}
                            {selected.stack_trace && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Stack Trace</h3>
                                        <button
                                            onClick={() => copyText(selected.stack_trace, 'stack')}
                                            className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                                        >
                                            {copied === 'stack' ? 'Tersalin' : 'Copy'}
                                        </button>
                                    </div>
                                    <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl px-3 py-2.5 overflow-x-auto">
                                        {selected.stack_trace}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex gap-2">
                            <button
                                onClick={() => { setAction(selected.action); setPage(1); setSelected(null); }}
                                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Filter aksi ini
                            </button>
                            <button
                                onClick={() => setSelected(null)}
                                className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-sm shadow-indigo-300/50 dark:shadow-indigo-950/40 hover:bg-indigo-700 transition-all"
                            >
                                Tutup
                            </button>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

function StatusDot({ ok, label, extra }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
            <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="font-medium">{label}</span>
            <span className="text-slate-400">{ok ? (extra || 'normal') : 'bermasalah'}</span>
        </span>
    );
}

function Meta({ label, value, mono = false }) {
    return (
        <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
            <p className={`text-xs text-slate-800 dark:text-slate-200 break-words mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
        </div>
    );
}
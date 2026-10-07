'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';
import { formatTimestamp } from '@/app/lib/timezone';
import {
    Archive, Search, RefreshCw, Trash2, ChevronDown, ChevronUp,
    Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, FileText, Users,
    RotateCcw, History, Download
} from 'lucide-react';

const SOURCE_BADGE = {
    submit: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    auto_submit: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    reset_exam: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    delete_attempt: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    safeguard: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
};

const CHANGE_BADGE = {
    missing: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    changed: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    same: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    removed: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
};

function formatDateTime(value, timeZone) {
        if (!value) return '-';
        return formatTimestamp(value, { locale: 'id-ID', timeZone });
    }

/** Buang tag HTML + panjangkan/motong teks soal agar aman ditampilkan */
function questionPreview(html, max = 90) {
    if (!html) return '';
    const text = String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max) + '…' : text;
}

function answerPreview(value, max = 140) {
    if (value === null || value === undefined || value === '') return '—';
    let text = String(value);
    // Jawaban matching berupa JSON
    if (text.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(text);
            text = Object.values(parsed).join(' • ');
        } catch (e) { /* biarkan mentah */ }
    }
    text = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max) + '…' : text;
}

export default function ArchiveAnswersPage() {
    const { t, timezone: appTimezone } = useLanguage();

    const [groups, setGroups] = useState([]);
    const [stats, setStats] = useState({ total: 0, attempts: 0, oldest: null, newest: null });
    const [sources, setSources] = useState([]);
    const [retentionDays, setRetentionDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const [expanded, setExpanded] = useState(null);       // attemptId yang dibuka
    const [details, setDetails] = useState({});           // attemptId -> jawaban[]
    const [detailLoading, setDetailLoading] = useState(false);

    const [purgeOpen, setPurgeOpen] = useState(false);
    const [purgePreview, setPurgePreview] = useState(null);
    const [purgeLoading, setPurgeLoading] = useState(false);

    // Modal pemulihan
    const [restoreTarget, setRestoreTarget] = useState(null);   // group yang dipilih
    const [restorePreview, setRestorePreview] = useState(null);
    const [restoreMode, setRestoreMode] = useState('rescore');
    const [restoreHistory, setRestoreHistory] = useState([]);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [restoreBusy, setRestoreBusy] = useState(false);

    const fetchList = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page);
            params.set('limit', limit);
            if (search) params.set('search', search);
            if (sourceFilter) params.set('source', sourceFilter);
            if (from) params.set('from', from);
            if (to) params.set('to', to);

            const res = await fetch(`/api/archive-answers?${params.toString()}`);
            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = '/?redirect=' + encodeURIComponent('/dashboard/archive-answers');
                    return;
                }
                throw new Error('Gagal memuat arsip');
            }
            const data = await res.json();
            setGroups(data.groups || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setStats(data.stats || {});
            setSources(data.sources || []);
            if (data.retentionDays) setRetentionDays(data.retentionDays);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, sourceFilter, from, to]);

    useEffect(() => { fetchList(); }, [fetchList]);

    // Reset ke halaman 1 saat filter berubah
    useEffect(() => { setPage(1); }, [search, sourceFilter, from, to, limit]);

    const loadDetail = useCallback(async (attemptId, withPreview = false) => {
        if (!withPreview && details[attemptId]) return;
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/archive-answers?attempt_id=${attemptId}${withPreview ? '&preview=1' : ''}`);
            const data = await res.json();
            setDetails(prev => ({ ...prev, [attemptId]: data.answers || [] }));
            if (withPreview) {
                setRestorePreview(data.preview || null);
                setRestoreHistory(data.history || []);
            }
        } catch (err) {
            toast.error(err.message);
        } finally {
            setDetailLoading(false);
        }
    }, [details]);

    const openRestore = async (group) => {
        if (group.exam_exists === false) {
            toast.info(t('aa_restore_blocked'));
            return;
        }
        setRestoreTarget(group);
        setRestorePreview(null);
        setRestoreMode('rescore');
        setRestoreHistory([]);
        setRestoreLoading(true);
        try {
            const res = await fetch(`/api/archive-answers?attempt_id=${group.attempt_id}&preview=1`);
            const data = await res.json();
            setRestorePreview(data.preview || null);
            setRestoreHistory(data.history || []);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setRestoreLoading(false);
        }
    };

    const exportCsv = () => {
        const params = new URLSearchParams();
        params.set('export', 'csv');
        if (expanded) params.set('attempt_id', expanded);
        else if (search) params.set('search', search);
        window.location.href = `/api/archive-answers?${params.toString()}`;
        toast.success(t('aa_export_started'));
    };

    const doRestore = async () => {
        if (!restoreTarget) return;
        setRestoreBusy(true);
        try {
            const res = await fetch('/api/archive-answers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restore', attemptId: restoreTarget.attempt_id, mode: restoreMode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal memulihkan');
            toast.success(data.message);
            setRestoreTarget(null);
            setDetails(prev => { const n = { ...prev }; delete n[restoreTarget.attempt_id]; return n; });
            if (expanded === restoreTarget.attempt_id) loadDetail(restoreTarget.attempt_id, true);
            fetchList(true);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setRestoreBusy(false);
        }
    };

    const doUndo = async (attemptId) => {
        setRestoreBusy(true);
        try {
            const res = await fetch('/api/archive-answers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'undo', attemptId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal membatalkan pemulihan');
            toast.success(data.message);
            setRestoreTarget(null);
            setDetails(prev => { const n = { ...prev }; delete n[attemptId]; return n; });
            fetchList(true);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setRestoreBusy(false);
        }
    };

    const doRecalculate = async (attemptId, exists = true) => {
        if (!exists) {
            toast.info(t('aa_recalculate_blocked'));
            return;
        }
        setRestoreBusy(true);
        try {
            const res = await fetch('/api/archive-answers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'recalculate', attemptId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal menghitung ulang');
            toast.success(data.message);
            fetchList(true);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setRestoreBusy(false);
        }
    };

    const toggleExpand = (attemptId) => {
        if (expanded === attemptId) {
            setExpanded(null);
            return;
        }
        setExpanded(attemptId);
        loadDetail(attemptId);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
    };

    const clearFilters = () => {
        setSearchInput('');
        setSearch('');
        setSourceFilter('');
        setFrom('');
        setTo('');
        setPage(1);
    };

    const openPurge = async () => {
        setPurgeOpen(true);
        setPurgePreview(null);
        try {
            const res = await fetch('/api/archive-answers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'purge', dryRun: true })
            });
            const data = await res.json();
            setPurgePreview(data);
        } catch (err) {
            setPurgePreview({ error: err.message });
        }
    };

    const confirmPurge = async () => {
        setPurgeLoading(true);
        try {
            const res = await fetch('/api/archive-answers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'purge' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal membersihkan');
            toast.success(data.message);
            setPurgeOpen(false);
            setDetails({});
            setExpanded(null);
            fetchList(true);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setPurgeLoading(false);
        }
    };

    const sourceLabel = (value) => {
        const found = sources.find(s => s.value === value);
        return found?.label || value;
    };

    const hasFilters = !!(search || sourceFilter || from || to);

    return (
        <div className="space-y-5">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeInDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-down { animation: fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
            ` }} />

            {/* Header */}
            <div className="animate-fade-in-down flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/web-settings" className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div className="p-2.5 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl shadow-lg shadow-slate-500/20">
                        <Archive className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('aa_title')}</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('aa_subtitle')}</p>
                    </div>
                </div>

<div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => exportCsv()}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        >
                            <Download size={14} />
                            {t('aa_export_csv')}
                        </button>
                        <button
                            onClick={() => fetchList()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        {t('aa_refresh')}
                    </button>
                    <button
                        onClick={openPurge}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 dark:shadow-rose-900/20 transition-all"
                    >
                        <Trash2 size={14} />
                        {t('aa_purge_now')}
                    </button>
                </div>
            </div>

            {/* Statistik + retensi */}
            <div className="animate-fade-in-up grid grid-cols-1 md:grid-cols-3 gap-3" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50">
                        <FileText size={20} className="text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-slate-800 dark:text-white">{Number(stats.total || 0).toLocaleString()}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('aa_total_archived')}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                        <Users size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-slate-800 dark:text-white">{Number(stats.attempts || 0).toLocaleString()}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('aa_stat_attempts')}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                        <Clock size={20} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{formatDateTime(stats.oldest, appTimezone)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('aa_oldest')}</p>
                    </div>
                </div>
            </div>

            <div className="animate-fade-in-up flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50" style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}>
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    {t('aa_retention_notice')} <span className="font-bold">({retentionDays} hari)</span>
                </p>
            </div>

            {/* Filter */}
            <div className="animate-fade-in-up bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('aa_search_placeholder')}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                    </div>
                    <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 transition-colors">
                        {t('aa_search')}
                    </button>
                    <button type="button" onClick={clearFilters} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        {t('aa_clear_filters')}
                    </button>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                        <option value="">{t('aa_all_sources')}</option>
                        {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">{t('aa_from')}</label>
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">{t('aa_to')}</label>
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                    </div>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(parseInt(e.target.value))}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                        {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/50 text-sm text-rose-700 dark:text-rose-300">
                    <XCircle size={16} />
                    {error}
                </div>
            )}

            {/* Tabel */}
            <div className="animate-fade-in-up bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
                {loading ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400">
                        <Loader2 className="animate-spin w-6 h-6" />
                        <p className="text-sm">{t('layout_loading')}</p>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Archive className="w-8 h-8 opacity-50" />
                        <p className="text-sm">{hasFilters ? t('aa_no_match') : t('aa_empty')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">{t('aa_col_student')}</th>
                                    <th className="px-4 py-3 text-left font-semibold">{t('aa_col_exam')}</th>
                                    <th className="px-4 py-3 text-left font-semibold">{t('aa_col_answers')}</th>
                                    <th className="px-4 py-3 text-left font-semibold">{t('aa_col_source')}</th>
                                    <th className="px-4 py-3 text-left font-semibold">{t('aa_col_archived_at')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('aa_col_action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                                {groups.map(g => (
                                    <Fragment key={g.attempt_id}>
                                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors align-top">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-800 dark:text-white">{g.student_name || g.username || '-'}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    @{g.username || '-'}
                                                    {g.class_name ? ` • ${g.class_name}` : ''}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[220px] truncate">{g.exam_name || '-'}</div>
                                                <div className="text-[11px] text-slate-400">{t('aa_attempt_id')} #{g.attempt_id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    <FileText size={13} className="text-slate-400" />
                                                    {g.answer_count}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${SOURCE_BADGE[g.answer_source] || SOURCE_BADGE.safeguard}`}>
                                                    {sourceLabel(g.answer_source)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                                {formatDateTime(g.archived_at, appTimezone)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {g.attempt_exists ? (
                                                        <button
                                                            onClick={() => doRecalculate(g.attempt_id, g.attempt_exists)}
                                                            disabled={restoreBusy || !g.attempt_exists}
                                                            title={t('aa_recalculate')}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
                                                        >
                                                            <RefreshCw size={13} className={restoreBusy ? 'animate-spin' : ''} />
                                                            <span className="hidden md:inline">{t('aa_recalculate')}</span>
                                                        </button>
                                                    ) : (
<span
                                                                title={t('aa_recalculate_blocked')}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                                            >
                                                            <RefreshCw size={13} />
                                                            <span className="hidden md:inline">{t('aa_recalculate')}</span>
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => toggleExpand(g.attempt_id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
                                                    >
                                                        {expanded === g.attempt_id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                        <span className="hidden lg:inline">{expanded === g.attempt_id ? t('aa_hide_answers') : t('aa_view_answers')}</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {expanded === g.attempt_id && (
                                            <tr>
                                                <td colSpan={6} className="px-4 pb-4 bg-slate-50/60 dark:bg-slate-900/30">
                                                    {/* Status percobaan + aksi pemulihan */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {g.attempt_exists ? (
                                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                                    {t('aa_restore_status')}: {g.attempt_status} • {t('aa_restore_current_score')}: {g.attempt_score ?? '-'}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                                                    <AlertTriangle size={12} />
                                                                    {t('aa_attempt_missing')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => openRestore(g)}
                                                            disabled={g.exam_exists === false}
                                                            title={g.exam_exists === false ? t('aa_restore_blocked') : t('aa_restore')}
                                                            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-lg transition-all ${
                                                                g.exam_exists === false
                                                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-600 cursor-not-allowed'
                                                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 dark:shadow-none'
                                                            }`}
                                                        >
                                                            <RotateCcw size={13} />
                                                            {t('aa_restore')}
                                                        </button>
                                                    </div>
                                                    {detailLoading && !details[g.attempt_id] ? (
                                                        <div className="py-6 flex items-center justify-center gap-2 text-sm text-slate-400">
                                                            <Loader2 size={16} className="animate-spin" />
                                                            {t('aa_loading_detail')}
                                                        </div>
                                                    ) : (details[g.attempt_id] || []).length === 0 ? (
                                                        <p className="py-6 text-center text-sm text-slate-400">{t('aa_no_detail')}</p>
                                                    ) : (
                                                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-white dark:bg-slate-800 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                                                                        <th className="px-3 py-2 text-left font-semibold">{t('aa_col_question')}</th>
                                                                        <th className="px-3 py-2 text-left font-semibold">{t('aa_col_answer')}</th>
                                                                        <th className="px-3 py-2 text-left font-semibold">{t('aa_col_final')}</th>
                                                                        <th className="px-3 py-2 text-left font-semibold">{t('aa_col_score')}</th>
                                                                        <th className="px-3 py-2 text-left font-semibold">{t('aa_col_correct')}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/70">
                                                                    {(details[g.attempt_id] || []).map(row => (
                                                                        <tr key={row.id} className="align-top">
                                                                            <td className="px-3 py-2 font-mono text-slate-400">{row.question_id}</td>
                                                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-[220px]">
                                                                                {row.question_text
                                                                                    ? questionPreview(row.question_text)
                                                                                    : <span className="text-slate-400 italic">{t('aa_question_missing')}</span>}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-slate-800 dark:text-slate-100 font-medium max-w-[260px] break-words">
                                                                                {answerPreview(row.selected_option)}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[200px]">
                                                                                {row.final_answer !== null && row.final_answer !== undefined
                                                                                    ? answerPreview(row.final_answer)
                                                                                    : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                                                                {row.score_earned !== null && row.score_earned !== undefined ? row.score_earned : '—'}
                                                                            </td>
                                                                            <td className="px-3 py-2">
                                                                                {row.is_correct === null || row.is_correct === undefined ? (
                                                                                    <span className="inline-flex items-center gap-1 text-slate-400">
                                                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                                                        {t('aa_correct_unknown')}
                                                                                    </span>
                                                                                ) : row.is_correct ? (
                                                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                        <CheckCircle2 size={13} />
                                                                                        {t('aa_correct_yes')}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                                                                        <XCircle size={13} />
                                                                                        {t('aa_correct_no')}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {groups.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {total} {t('aa_total_attempts').toLowerCase()} •{' '}
                        {t('aa_page_info').replace('{page}', page).replace('{total}', totalPages)}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('aa_page_prev')}
                        </button>
                        <span className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300">{page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('aa_page_next')}
                        </button>
                    </div>
                </div>
            )}

            {/* Modal pemulihan jawaban */}
            {restoreTarget && (
                <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !restoreBusy && setRestoreTarget(null)} />
                    <div className="relative bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex max-h-[88vh] flex-col">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-start gap-4">
                            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <RotateCcw size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('aa_restore_title')}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                                    {restoreTarget.student_name || restoreTarget.username} — {restoreTarget.exam_name} ({t('aa_attempt_id')} #{restoreTarget.attempt_id})
                                </p>
                            </div>
                            <button onClick={() => !restoreBusy && setRestoreTarget(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                {t('aa_restore_desc')}
                            </p>

                            {restorePreview && !restorePreview.attemptExists ? (
                                <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/60">
                                    <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                                        {t('aa_recreate_warning')}
                                    </p>
                                </div>
                            ) : null}

                            {restoreLoading ? (
                                <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-400">
                                    <Loader2 size={16} className="animate-spin" />
                                    {t('aa_loading_detail')}
                                </div>
                            ) : !restorePreview ? (
                                <p className="text-sm text-rose-600 dark:text-rose-400">{t('aa_restore_none')}</p>
                            ) : (
                                <>
                                    {/* Ringkasan */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">{t('aa_restore_status')}</p>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{restorePreview.status}</p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">{t('aa_restore_current_score')}</p>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{restorePreview.score ?? '-'}</p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">{t('aa_col_answers')}</p>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{restorePreview.archivedCount}</p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">{t('aa_restore_changed')}</p>
                                            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">{restorePreview.summary.changed + restorePreview.summary.missing}</p>
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {t('aa_restore_summary')
                                            .replace('{missing}', restorePreview.summary.missing)
                                            .replace('{changed}', restorePreview.summary.changed)
                                            .replace('{removed}', restorePreview.summary.removed)
                                            .replace('{same}', restorePreview.summary.same)}
                                    </p>

                                    {/* Mode pemulihan */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">{t('aa_restore_mode')}</p>
                                        <div className="space-y-2">
                                            {[
                                                { value: 'rescore', title: t('aa_restore_mode_rescore'), desc: t('aa_restore_mode_rescore_desc') },
                                                { value: 'reopen', title: t('aa_restore_mode_reopen'), desc: t('aa_restore_mode_reopen_desc') },
                                            ].map(mode => (
                                                <label
                                                    key={mode.value}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${restoreMode === mode.value
                                                        ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/15'
                                                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40'}`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="restoreMode"
                                                        value={mode.value}
                                                        checked={restoreMode === mode.value}
                                                        onChange={() => setRestoreMode(mode.value)}
                                                        className="mt-0.5 accent-emerald-600"
                                                    />
                                                    <span>
                                                        <span className="block text-sm font-bold text-slate-800 dark:text-white">{mode.title}</span>
                                                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{mode.desc}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pratinjau perubahan */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">{t('aa_restore_preview')}</p>
                                        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-semibold w-10">#</th>
                                                        <th className="px-3 py-2 text-left font-semibold">{t('aa_restore_before')}</th>
                                                        <th className="px-3 py-2 text-left font-semibold">{t('aa_restore_after')}</th>
                                                        <th className="px-3 py-2 text-left font-semibold w-24">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70 bg-white dark:bg-slate-800">
                                                    {restorePreview.diff.map(d => (
                                                        <tr key={d.question_id}>
                                                            <td className="px-3 py-2 font-mono text-slate-400">{d.question_id}</td>
                                                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                                                                {d.current ? answerPreview(d.current, 60) : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-slate-800 dark:text-slate-100 font-medium max-w-[180px] truncate">
                                                                {d.archived ? answerPreview(d.archived, 60) : '—'}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${CHANGE_BADGE[d.change] || CHANGE_BADGE.same}`}>
                                                                    {t(`aa_restore_${d.change}`)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Riwayat pemulihan */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                                                            <History size={13} />
                                                            {t('aa_restore_history')}
                                        </p>
                                        {restoreHistory.length === 0 ? (
                                            <p className="text-xs text-slate-400">{t('aa_restore_none')}</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {restoreHistory.map(h => (
                                                    <div key={h.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-xs">
                                                        <span className="text-slate-600 dark:text-slate-300">
                                                            #{h.id} • {h.restored_by || '-'} • {h.restore_mode} • {formatDateTime(h.created_at, appTimezone)}
                                                        </span>
                                                        {h.is_undone ? (
                                                            <span className="text-slate-400">{t('aa_restore_undone')}</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => doUndo(restoreTarget.attempt_id)}
                                                                disabled={restoreBusy}
                                                                className="px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50"
                                                            >
                                                                {t('aa_undo_restore')}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                            <button
                                onClick={() => setRestoreTarget(null)}
                                disabled={restoreBusy}
                                className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                            >
                                {t('users_btn_cancel')}
                            </button>
                            <button
                                onClick={doRestore}
                                disabled={restoreBusy || restoreLoading || !restorePreview || restorePreview.archivedCount === 0}
                                className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {restoreBusy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                {restoreBusy ? t('aa_restoring') : t('aa_restore_confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal purge */}
            {purgeOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !purgeLoading && setPurgeOpen(false)} />
                    <div className="relative bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-8 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 mb-6">
                                <Trash2 size={30} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('aa_purge_title')}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                                {t('aa_purge_desc')}
                            </p>

                            <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-4">
                                {purgePreview === null ? (
                                    <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
                                        <Loader2 size={14} className="animate-spin" />
                                        {t('aa_purge_checking')}
                                    </p>
                                ) : purgePreview.error ? (
                                    <p className="text-sm text-rose-600 dark:text-rose-400">{purgePreview.error}</p>
                                ) : (
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                        <span className="text-xl font-black text-rose-600 dark:text-rose-400">{purgePreview.wouldDelete}</span>
                                        {' baris akan dihapus '}
                                        <span className="text-xs text-slate-400">({purgePreview.retentionDays} hari)</span>
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setPurgeOpen(false)}
                                    disabled={purgeLoading}
                                    className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                >
                                    {t('users_btn_cancel')}
                                </button>
                                <button
                                    onClick={confirmPurge}
                                    disabled={purgeLoading || !purgePreview || purgePreview.error || purgePreview.wouldDelete === 0}
                                    className="flex-1 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-all shadow-lg shadow-rose-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {purgeLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    {purgeLoading ? t('aa_purging') : t('aa_purge_confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

const LEVELS = [
    { value: '', label: 'All Levels' },
    { value: 'info', label: '🟢 Info' },
    { value: 'warn', label: '🟡 Warning' },
    { value: 'error', label: '🔴 Error' },
];

const LIMITS = [10, 30, 50, 100, 200, 500, 1000];

const levelBadge = {
    info: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    warn: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const levelDot = {
    info: 'bg-emerald-500',
    warn: 'bg-amber-500',
    error: 'bg-red-500',
};

function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function tryParseJSON(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return str; }
}

export default function ActivityLogsPage() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [level, setLevel] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Expanded row
    const [expandedId, setExpandedId] = useState(null);

    // Real-time
    const [live, setLive] = useState(true);
    const intervalRef = useRef(null);

    const fetchLogs = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page);
            params.set('limit', limit);
            if (level) params.set('level', level);
            if (search) params.set('search', search);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);

            const res = await fetch(`/api/activity-logs?${params}`);
            if (!res.ok) {
                if (res.status === 401) { setError('Unauthorized'); return; }
                throw new Error('Failed');
            }
            const data = await res.json();
            setLogs(data.logs);
            setTotal(data.total);
            setTotalPages(data.totalPages);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [page, limit, level, search, dateFrom, dateTo]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // Auto-refresh interval
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (live && page === 1) {
            intervalRef.current = setInterval(() => fetchLogs(true), 3000);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [live, page, fetchLogs]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        setSearch(searchInput);
    };

    const handleClearFilters = () => {
        setLevel('');
        setSearch('');
        setSearchInput('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/web-settings" className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Activity Logs</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{total.toLocaleString()} total records</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setLive(l => !l)}
                        className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${live
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                            }`}
                    >
                        <span className={`relative flex h-2 w-2 ${live ? '' : 'opacity-40'}`}>
                            {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${live ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        </span>
                        {live ? 'LIVE' : 'PAUSED'}
                    </button>
                    <button onClick={() => fetchLogs(false)} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-3">
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full lg:w-auto">
                        <input
                            type="text"
                            placeholder="Cari username, action, IP..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                        />
                        <button type="submit" className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-md shadow-indigo-100 dark:shadow-none active:scale-95">
                            Cari
                        </button>
                    </form>
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                        <select
                            value={limit}
                            onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                            className="flex-1 lg:flex-none px-3 py-2.5 text-sm font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                        >
                            {LIMITS.map(lim => <option key={lim} value={lim}>{lim} Logs</option>)}
                        </select>
                        <select
                            value={level}
                            onChange={(e) => { setLevel(e.target.value); setPage(1); }}
                            className="flex-1 lg:flex-none px-3 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        >
                            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                        <div className="flex gap-2 w-full sm:w-auto flex-1">
                            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="flex-1 lg:w-36 px-3 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="flex-1 lg:w-36 px-3 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                        {(level || search || dateFrom || dateTo) && (
                            <button onClick={handleClearFilters} className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg transition-all active:scale-95">
                                Reset Filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="px-4 py-3 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            {/* Table / List Container */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {/* Desktop View (Table) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                                <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Level</th>
                                <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                                <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IP Address</th>
                                <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
                                <th className="text-left py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50">
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="py-4 px-4"><div className="h-4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse w-full max-w-[100px]" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-slate-400 dark:text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full">
                                                <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            </div>
                                            <p className="font-medium">Tidak ada log ditemukan</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.map((log) => {
                                const details = tryParseJSON(log.details);
                                const isExpanded = expandedId === log.id;

                                return (
                                    <tr
                                        key={log.id}
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                        className={`border-b border-slate-50 dark:border-slate-700/50 cursor-pointer transition-all ${isExpanded ? 'bg-indigo-50/70 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                                    >
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">{formatTime(log.created_at)}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${levelBadge[log.level]}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${levelDot[log.level]}`} />
                                                {log.level}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-100">{log.username || <span className="text-slate-400 font-normal italic">system</span>}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{log.ip_address || '-'}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-[10px] font-bold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded uppercase border border-indigo-100 dark:border-indigo-800/50">{log.action}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="max-w-[250px]">
                                                {details && typeof details === 'object' ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Object.entries(details).slice(0, isExpanded ? undefined : 2).map(([k, v]) => (
                                                            <span key={k} className="text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-600/50">
                                                                {k}: <span className="text-slate-900 dark:text-white">{String(v)}</span>
                                                            </span>
                                                        ))}
                                                        {!isExpanded && Object.keys(details).length > 2 && (
                                                            <span className="text-[10px] font-bold text-indigo-500">+{Object.keys(details).length - 2} more</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">{details || '-'}</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View (Card List) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-4 space-y-3 animate-pulse">
                                <div className="flex justify-between"><div className="h-3 w-20 bg-slate-100 dark:bg-slate-700 rounded" /><div className="h-3 w-16 bg-slate-100 dark:bg-slate-700 rounded" /></div>
                                <div className="h-4 w-1/3 bg-slate-100 dark:bg-slate-700 rounded" />
                                <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-700 rounded" />
                            </div>
                        ))
                    ) : logs.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 px-6">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="font-semibold text-sm">Tidak ada log aktivitas</p>
                        </div>
                    ) : logs.map((log) => {
                        const details = tryParseJSON(log.details);
                        const isExpanded = expandedId === log.id;

                        return (
                            <div 
                                key={log.id} 
                                onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                className={`p-4 transition-all active:bg-slate-50 dark:active:bg-slate-700/50 ${isExpanded ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase">
                                            {formatTime(log.created_at)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-800 dark:text-white">
                                                {log.username || 'System'}
                                            </span>
                                            {log.ip_address && (
                                                <span className="text-[9px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-900 px-1 rounded border border-slate-100 dark:border-slate-800">
                                                    {log.ip_address}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${levelBadge[log.level]}`}>
                                        {log.level}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-[10px] font-black font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-1 rounded uppercase border border-indigo-100/50 dark:border-indigo-800/30">
                                        {log.action}
                                    </span>
                                    <button className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                </div>
                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="bg-white dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Detail Informasi</p>
                                            {details && typeof details === 'object' ? (
                                                <div className="grid grid-cols-1 gap-2">
                                                    {Object.entries(details).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between items-start text-xs border-b border-slate-50 dark:border-slate-800/60 pb-1.5 last:border-0">
                                                            <span className="text-slate-500 dark:text-slate-400 font-medium">{k}</span>
                                                            <span className="text-right font-bold text-slate-800 dark:text-slate-100 break-all ml-4">{String(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{details || '-'}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 gap-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 order-2 sm:order-1">
                            Halaman {page} dari {totalPages} ({total.toLocaleString()} log)
                        </span>
                        <div className="flex flex-wrap justify-center gap-1.5 order-1 sm:order-2">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page <= 1}
                                className="px-3 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-30 transition-all uppercase tracking-tighter"
                            >
                                First
                            </button>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-30 transition-all"
                            >
                                ← Prev
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-30 transition-all"
                            >
                                Next →
                            </button>
                            <button
                                onClick={() => setPage(totalPages)}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-30 transition-all uppercase tracking-tighter"
                            >
                                Last
                            </button>
                        </div>
                    </div>
                )}
            </div>
    );
}

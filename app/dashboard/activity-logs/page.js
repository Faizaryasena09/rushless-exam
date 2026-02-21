'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

const LEVELS = [
    { value: '', label: 'All Levels' },
    { value: 'info', label: '🟢 Info' },
    { value: 'warn', label: '🟡 Warning' },
    { value: 'error', label: '🔴 Error' },
];

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
            params.set('limit', '30');
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
    }, [page, level, search, dateFrom, dateTo]);

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
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                        <input
                            type="text"
                            placeholder="Search username, action, IP..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
                            Search
                        </button>
                    </form>
                    <select
                        value={level}
                        onChange={(e) => { setLevel(e.target.value); setPage(1); }}
                        className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    {(level || search || dateFrom || dateTo) && (
                        <button onClick={handleClearFilters} className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="px-4 py-3 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Level</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IP Address</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50">
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="py-3 px-4"><div className="h-4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                        <svg className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        No logs found
                                    </td>
                                </tr>
                            ) : logs.map((log) => {
                                const details = tryParseJSON(log.details);
                                const isExpanded = expandedId === log.id;

                                return (
                                    <tr
                                        key={log.id}
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                        className={`border-b border-slate-50 dark:border-slate-700/50 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                                    >
                                        <td className="py-2.5 px-4 whitespace-nowrap">
                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{formatTime(log.created_at)}</span>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${levelBadge[log.level]}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${levelDot[log.level]}`} />
                                                {log.level.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{log.username || <span className="text-slate-400 italic">system</span>}</span>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{log.ip_address || '-'}</span>
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <span className="text-xs font-semibold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded">{log.action}</span>
                                        </td>
                                        <td className="py-2.5 px-4 max-w-xs">
                                            {details && typeof details === 'object' ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.entries(details).slice(0, isExpanded ? undefined : 2).map(([k, v]) => (
                                                        <span key={k} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                                            {k}: <span className="font-medium">{String(v)}</span>
                                                        </span>
                                                    ))}
                                                    {!isExpanded && Object.keys(details).length > 2 && (
                                                        <span className="text-xs text-slate-400">+{Object.keys(details).length - 2} more</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate block max-w-[200px]">{details || '-'}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Page {page} of {totalPages} ({total.toLocaleString()} records)
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page <= 1}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                First
                            </button>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                ← Prev
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next →
                            </button>
                            <button
                                onClick={() => setPage(totalPages)}
                                disabled={page >= totalPages}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Last
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

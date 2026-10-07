'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';
import {
    Activity,
    RefreshCw,
    Search,
    Power,
    KeyRound,
    Lock,
    Unlock,
    AlertTriangle,
    Loader2,
    Users,
    Wifi,
    ShieldAlert,
    Clock,
    CheckCircle2,
    XCircle,
    MonitorSmartphone,
    Filter
} from 'lucide-react';

const ROLE_FILTERS = [
    { value: '', label: 'Semua Role' },
    { value: 'student', label: 'Siswa' },
    { value: 'teacher', label: 'Guru' },
    { value: 'admin', label: 'Admin' },
];

const STATUS_FILTERS = [
    { value: '', label: 'Semua Status' },
    { value: 'online', label: 'Online' },
    { value: 'stuck', label: 'Sesi Nyangkut' },
    { value: 'locked', label: 'Terkunci' },
    { value: 'offline', label: 'Offline' },
];

function formatDateTime(value) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleString(localeForTz, {
            timeZone: appTimezone,
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return '-';
    const s = Math.max(0, Math.floor(seconds));
    if (s < 60) return `${s} detik lalu`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} menit lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return `${Math.floor(h / 24)} hari lalu`;
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, itemName, loading, confirmLabel, danger = true }) {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="relative p-8 text-center">
                    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-6 ${danger
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                        <AlertTriangle size={32} />
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                        {message}
                        {itemName && <span className="font-bold text-slate-800 dark:text-white mt-1 block">&quot;{itemName}&quot;</span>}
                    </p>

                    <div className="flex gap-3 mt-8">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                        >
                            {t('users_btn_cancel')}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 ${danger
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-red-900/20'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-indigo-900/20'}`}
                        >
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 size={18} />}
                            {loading ? t('layout_loading') : (confirmLabel || t('users_confirm_yes'))}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SessionControlPage() {
    const { t, timezone: appTimezone } = useLanguage();
    const [users, setUsers] = useState([]);
    const [summary, setSummary] = useState({ total: 0, online: 0, with_session: 0, stuck: 0, locked: 0 });
    const [redisReady, setRedisReady] = useState(true);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [live, setLive] = useState(true);

    const [roleFilter, setRoleFilter] = useState('student');
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');

    const [confirm, setConfirm] = useState(null); // { action, title, message, user?, all? }
    const [actionLoading, setActionLoading] = useState(false);

    const intervalRef = useRef(null);

    const fetchUsers = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams();
            if (roleFilter) params.set('role', roleFilter);
            if (search) params.set('search', search);

            const res = await fetch(`/api/session-control?${params.toString()}`);
            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = '/?redirect=' + encodeURIComponent('/dashboard/session-control');
                    return;
                }
                throw new Error('Gagal memuat data');
            }

            const data = await res.json();
            setUsers(data.users || []);
            setSummary(data.summary || {});
            setRedisReady(!!data.redis);
        } catch (err) {
            if (!silent) toast.error(err.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [roleFilter, search]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (live) {
            intervalRef.current = setInterval(() => fetchUsers(true), 5000);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [live, fetchUsers]);

    const filtered = useMemo(() => {
        return users.filter(u => {
            if (statusFilter === 'online' && !u.is_online) return false;
            if (statusFilter === 'stuck' && !u.is_stuck) return false;
            if (statusFilter === 'locked' && !(u.is_locked || u.is_brute_locked)) return false;
            if (statusFilter === 'offline' && u.is_online) return false;
            return true;
        });
    }, [users, statusFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
    };

    const runAction = async (action, user = null, all = false) => {
        setBusyId(all ? 'all' : user?.id ?? null);
        try {
            const res = await fetch('/api/session-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(all ? { action } : { action, userId: user.id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Aksi gagal');
            toast.success(data.message);
            fetchUsers(true);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const confirmAction = async () => {
        if (!confirm) return;
        setActionLoading(true);
        await runAction(confirm.action, confirm.user, confirm.all);
        setActionLoading(false);
        setConfirm(null);
    };

    const askRestart = (user) => setConfirm({
        action: 'restart_session',
        all: false,
        user,
        title: t('sc_confirm_restart_title'),
        message: t('sc_confirm_restart_desc'),
        itemName: `${user.name} (${user.username})`,
        confirmLabel: t('sc_action_restart')
    });

    const askUnlock = (user) => setConfirm({
        action: 'unlock',
        all: false,
        user,
        title: t('sc_confirm_unlock_title'),
        message: t('sc_confirm_unlock_desc'),
        itemName: `${user.name} (${user.username})`,
        confirmLabel: t('sc_action_unlock'),
        danger: false
    });

    const askClearStuck = (user) => setConfirm({
        action: 'clear_stuck',
        all: false,
        user,
        title: t('sc_confirm_stuck_title'),
        message: t('sc_confirm_stuck_desc'),
        itemName: `${user.name} (${user.username})`,
        confirmLabel: t('sc_action_clear_stuck')
    });

    const askRestartAll = () => setConfirm({
        action: 'restart_all',
        all: true,
        title: t('sc_confirm_restart_all_title'),
        message: t('sc_confirm_restart_all_desc'),
        confirmLabel: t('sc_action_restart_all')
    });

    const askUnlockAll = () => setConfirm({
        action: 'unlock_all',
        all: true,
        title: t('sc_confirm_unlock_all_title'),
        message: t('sc_confirm_unlock_all_desc'),
        confirmLabel: t('sc_action_unlock_all'),
        danger: false
    });

    const toggleLock = async (user) => {
        setBusyId(user.id);
        try {
            await runAction('toggle_lock', user);
        } finally {
            setBusyId(null);
        }
    };

    const stats = [
        { label: t('sc_stat_total'), value: summary.total || 0, icon: Users, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700/50' },
        { label: t('sc_stat_online'), value: summary.online || 0, icon: Wifi, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
        { label: t('sc_stat_session'), value: summary.with_session || 0, icon: MonitorSmartphone, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
        { label: t('sc_stat_stuck'), value: summary.stuck || 0, icon: ShieldAlert, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
        { label: t('sc_stat_locked'), value: summary.locked || 0, icon: KeyRound, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
    ];

    return (
        <div className="space-y-5">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeInUp {
                  from { opacity: 0; transform: translateY(15px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeInDown {
                  from { opacity: 0; transform: translateY(-15px); }
                  to { opacity: 1; transform: translateY(0); }
                }
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
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('sc_title')}</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('sc_subtitle')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {!redisReady && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle size={14} />
                            {t('sc_redis_offline')}
                        </span>
                    )}
                    <button
                        onClick={() => setLive(l => !l)}
                        className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${live
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'}`}
                    >
                        <span className={`relative flex h-2 w-2 ${live ? '' : 'opacity-40'}`}>
                            {live && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${live ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        </span>
                        {live ? 'LIVE' : 'PAUSED'}
                    </button>
                    <button
                        onClick={() => fetchUsers()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        {t('sc_refresh')}
                    </button>
                    <button
                        onClick={askUnlockAll}
                        disabled={busyId === 'all'}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all disabled:opacity-50"
                    >
                        <Unlock size={14} />
                        {t('sc_action_unlock_all')}
                    </button>
                    <button
                        onClick={askRestartAll}
                        disabled={busyId === 'all'}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 dark:shadow-rose-900/20 transition-all disabled:opacity-50"
                    >
                        <Power size={14} />
                        {t('sc_action_restart_all')}
                    </button>
                </div>
            </div>

            {/* Statistik */}
            <div className="animate-fade-in-up grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
                {stats.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${s.bg}`}>
                                <Icon size={20} className={s.color} />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-slate-800 dark:text-white leading-tight">{s.value}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filter */}
            <div className="animate-fade-in-up bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col lg:flex-row gap-3" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('sc_search_placeholder')}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                    </div>
                    <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 transition-colors">
                        {t('sc_search')}
                    </button>
                </form>

                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Filter size={14} />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                        {ROLE_FILTERS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                        {STATUS_FILTERS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Tabel */}
            <div className="animate-fade-in-up bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
                {loading ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400">
                        <Loader2 className="animate-spin w-6 h-6" />
                        <p className="text-sm">{t('layout_loading')}</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Users className="w-8 h-8 opacity-50" />
                        <p className="text-sm">{t('sc_empty')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">{t('sc_col_user')}</th>
                                    <th className="px-4 py-3 text-left font-semibold">{t('sc_col_status')}</th>
                                    <th className="px-4 py-3 text-left font-semibold">{t('sc_col_session')}</th>
                                    <th className="px-4 py-3 text-left font-semibold">{t('sc_col_last_login')}</th>
                                    <th className="px-4 py-3 text-left font-semibold">{t('sc_col_last_activity')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('sc_col_action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                                {filtered.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-slate-800 dark:text-white">{u.name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                @{u.username}
                                                {u.class_name ? ` • ${u.class_name}` : ''}
                                            </div>
                                            {u.current_exam && (
                                                <div className="mt-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                                    {u.current_exam}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {u.is_online ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        {t('sc_status_online')}
                                                    </span>
                                                ) : u.has_session ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                        <XCircle size={11} />
                                                        {t('sc_status_offline')}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                        {t('sc_status_no_session')}
                                                    </span>
                                                )}

                                                {u.is_stuck && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                                        <ShieldAlert size={11} />
                                                        {t('sc_status_stuck')}
                                                    </span>
                                                )}

                                                {u.is_locked && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                                                        <Lock size={11} />
                                                        {t('sc_status_locked_admin')}
                                                    </span>
                                                )}

                                                {u.is_brute_locked && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                                        <KeyRound size={11} />
                                                        {u.failed_attempts}x {t('sc_status_locked_bf')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3">
                                            {u.has_session ? (
                                                <div>
                                                    <div className="font-mono text-xs text-slate-600 dark:text-slate-300">{u.session_id_short}…</div>
                                                    <div className="text-[11px] text-slate-400">{t('sc_session_active')}</div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">{t('sc_status_no_session')}</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                            {formatDateTime(u.last_login)}
                                        </td>

                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                            {u.idle_seconds !== null ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock size={12} className="text-slate-400" />
                                                    {formatDuration(u.idle_seconds)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">{formatDateTime(u.last_activity)}</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                {u.is_locked || u.is_brute_locked || u.failed_attempts > 0 ? (
                                                    <button
                                                        onClick={() => askUnlock(u)}
                                                        disabled={busyId === u.id}
                                                        title={t('sc_action_unlock')}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all disabled:opacity-50"
                                                    >
                                                        <Unlock size={12} />
                                                        {t('sc_action_unlock')}
                                                    </button>
                                                ) : null}

                                                {u.is_stuck && (
                                                    <button
                                                        onClick={() => askClearStuck(u)}
                                                        disabled={busyId === u.id}
                                                        title={t('sc_action_clear_stuck')}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all disabled:opacity-50"
                                                    >
                                                        <RefreshCw size={12} />
                                                        {t('sc_action_clear_stuck')}
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => toggleLock(u)}
                                                    disabled={busyId === u.id}
                                                    title={u.is_locked ? t('sc_action_unlock_admin') : t('sc_action_lock_admin')}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-all disabled:opacity-50 ${u.is_locked
                                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                                                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'}`}
                                                >
                                                    {u.is_locked ? <Unlock size={12} /> : <Lock size={12} />}
                                                    {u.is_locked ? t('sc_action_unlock_admin') : t('sc_action_lock_admin')}
                                                </button>

                                                <button
                                                    onClick={() => askRestart(u)}
                                                    disabled={busyId === u.id}
                                                    title={t('sc_action_restart')}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200 dark:shadow-rose-900/20 transition-all disabled:opacity-50"
                                                >
                                                    <Power size={12} />
                                                    {t('sc_action_restart')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={confirmAction}
                title={confirm?.title}
                message={confirm?.message}
                itemName={confirm?.itemName}
                confirmLabel={confirm?.confirmLabel}
                danger={confirm?.danger !== false}
                loading={actionLoading}
            />
        </div>
    );
}
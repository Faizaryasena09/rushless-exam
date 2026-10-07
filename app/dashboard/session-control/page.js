'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';
import { formatTimestamp } from '@/app/lib/timezone';
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

// Palet warna untuk kartu statistik & chip status. Satu sumber supaya angka
// di header dan badge di tabel selalu warna yang sama untuk makna yang sama.
const TONE = {
    slate: { icon: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300', bar: 'from-slate-400 to-slate-300', value: 'text-slate-900 dark:text-white' },
    emerald: { icon: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400', bar: 'from-emerald-500 to-teal-500', value: 'text-emerald-600 dark:text-emerald-400' },
    indigo: { icon: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400', bar: 'from-indigo-500 to-violet-500', value: 'text-indigo-600 dark:text-indigo-400' },
    amber: { icon: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400', bar: 'from-amber-500 to-orange-500', value: 'text-amber-600 dark:text-amber-400' },
    rose: { icon: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400', bar: 'from-rose-500 to-pink-500', value: 'text-rose-600 dark:text-rose-400' },
};

function formatDateTime(value, timeZone) {
        if (!value) return '-';
        return formatTimestamp(value, { locale: 'id-ID', timeZone });
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
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Strip warna sesuai sifat aksi: merah = destruktif,
                    indigo = biasa. */}
                <div aria-hidden className={`h-1 w-full bg-gradient-to-r ${danger ? 'from-rose-500 to-pink-500' : 'from-indigo-500 to-violet-500'}`} />

                <div className="relative p-8 text-center">
                    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-6 ${danger
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'}`}>
                        {danger ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
                    </div>

                    <h3 className={`text-xl font-bold mb-2 ${danger ? 'text-rose-700 dark:text-rose-300' : 'text-indigo-700 dark:text-indigo-300'}`}>{title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                        {message}
                        {itemName && (
                            <span className={`font-bold mt-2 inline-flex items-center px-2.5 py-1 rounded-lg text-xs border ${danger
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60'}`}>
                                &quot;{itemName}&quot;
                            </span>
                        )}
                    </p>

                    <div className="flex gap-3 mt-8">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
                        >
                            {t('users_btn_cancel')}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${danger
                                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-300/50 dark:shadow-rose-950/50'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-300/50 dark:shadow-indigo-950/50'}`}
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

    // Warna kartu statistik = makna angkanya: total netral, online hijau,
    // sesi indigo, nyangkut amber, terkunci rose.
    const stats = [
        { label: t('sc_stat_total'), value: summary.total || 0, icon: Users, tone: 'slate' },
        { label: t('sc_stat_online'), value: summary.online || 0, icon: Wifi, tone: 'emerald' },
        { label: t('sc_stat_session'), value: summary.with_session || 0, icon: MonitorSmartphone, tone: 'indigo' },
        { label: t('sc_stat_stuck'), value: summary.stuck || 0, icon: ShieldAlert, tone: 'amber' },
        { label: t('sc_stat_locked'), value: summary.locked || 0, icon: KeyRound, tone: 'rose' },
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
            <div className="animate-fade-in-down relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/30 dark:via-slate-900 dark:to-violet-950/30" />
                <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

                <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 px-5 py-5">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link
                            href="/dashboard/web-settings"
                            aria-label="Kembali ke pengaturan"
                            className="shrink-0 grid place-items-center w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <span className="shrink-0 grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                            <Activity className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{t('sc_title')}</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('sc_subtitle')}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {!redisReady && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                                <AlertTriangle size={14} />
                                {t('sc_redis_offline')}
                            </span>
                        )}
                        <button
                            onClick={() => setLive(l => !l)}
                            aria-pressed={live}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95 ${live
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
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
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            {t('sc_refresh')}
                        </button>
                        <button
                            onClick={askUnlockAll}
                            disabled={busyId === 'all'}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Unlock size={14} />
                            {t('sc_action_unlock_all')}
                        </button>
                        <button
                            onClick={askRestartAll}
                            disabled={busyId === 'all'}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-300/50 dark:shadow-rose-950/50 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Power size={14} />
                            {t('sc_action_restart_all')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Statistik */}
            <div className="animate-fade-in-up grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
                {stats.map(s => {
                    const Icon = s.icon;
                    const c = TONE[s.tone] || TONE.slate;
                    return (
                        <div key={s.label} className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 p-4 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-slate-950/40">
                            <div aria-hidden className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${c.bar}`} />
                            <div className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl transition-transform duration-200 group-hover:scale-105 ${c.icon}`}>
                                <Icon size={20} />
                            </div>
                            <div className="min-w-0">
                                <p className={`text-xl font-bold tabular-nums leading-tight ${c.value}`}>{s.value}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filter */}
            <div className="animate-fade-in-up relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 p-4 flex flex-col lg:flex-row gap-3" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('sc_search_placeholder')}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                        />
                    </div>
                    <button type="submit" className="px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-300/50 dark:shadow-indigo-950/40 hover:bg-indigo-700 transition-all active:scale-95">
                        {t('sc_search')}
                    </button>
                </form>

                <div className="flex flex-wrap gap-2">
                    <div className="grid place-items-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                        <Filter size={14} />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                    >
                        {ROLE_FILTERS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 transition-colors"
                    >
                        {STATUS_FILTERS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Tabel */}
            <div className="animate-fade-in-up rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 overflow-hidden" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
                {loading ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-400">
                        <Loader2 className="animate-spin w-6 h-6" />
                        <p className="text-sm">{t('layout_loading')}</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white/50 dark:bg-slate-900/40">
                        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                            <Users className="w-6 h-6" />
                        </span>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('sc_empty')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gradient-to-r from-indigo-50 to-violet-50/60 dark:from-indigo-950/25 dark:to-violet-950/15 text-[11px] uppercase tracking-wider font-bold text-indigo-700 dark:text-indigo-300">
                                <tr>
                                    <th className="px-4 py-3 text-left font-bold">{t('sc_col_user')}</th>
                                    <th className="px-4 py-3 text-left font-bold">{t('sc_col_status')}</th>
                                    <th className="px-4 py-3 text-left font-bold">{t('sc_col_session')}</th>
                                    <th className="px-4 py-3 text-left font-bold">{t('sc_col_last_login')}</th>
                                    <th className="px-4 py-3 text-left font-bold">{t('sc_col_last_activity')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('sc_col_action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                                {filtered.map(u => (
                                    <tr key={u.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors">
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
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        {t('sc_status_online')}
                                                    </span>
                                                ) : u.has_session ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                        <XCircle size={11} />
                                                        {t('sc_status_offline')}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                                                        {t('sc_status_no_session')}
                                                    </span>
                                                )}

                                                {u.is_stuck && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                                                        <ShieldAlert size={11} />
                                                        {t('sc_status_stuck')}
                                                    </span>
                                                )}

                                                {u.is_locked && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                                                        <Lock size={11} />
                                                        {t('sc_status_locked_admin')}
                                                    </span>
                                                )}

                                                {u.is_brute_locked && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-900/60 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300">
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
                                            {formatDateTime(u.last_login, appTimezone)}
                                        </td>

                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                            {u.idle_seconds !== null ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock size={12} className="text-slate-400" />
                                                    {formatDuration(u.idle_seconds)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">{formatDateTime(u.last_activity, appTimezone)}</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                {u.is_locked || u.is_brute_locked || u.failed_attempts > 0 ? (
                                                    <button
                                                        onClick={() => askUnlock(u)}
                                                        disabled={busyId === u.id}
                                                        title={t('sc_action_unlock')}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all disabled:opacity-50"
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
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all disabled:opacity-50"
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
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-300/50 dark:shadow-rose-950/50 transition-all disabled:opacity-50"
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
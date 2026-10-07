'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/app/context/LanguageContext';
import {
    Copy,
    List,
    Users,
    GraduationCap,
    LogOut,
    ChevronRight
} from 'lucide-react';
import { useUser } from '@/app/context/UserContext';

// --- COMPONENTS ---

/**
 * Satu warna per kartu supaya halaman tidak terlihat kaku abu-abu. Tiap tone
 * menentukan warna ikon, warna judul saat hover, dan warna angka - jadi kartu
 * bisa dibedakan dari warnanya saja tanpa harus dibaca teksnya.
 */
const TONE = {
    indigo: {
        icon: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400',
        hoverText: 'group-hover:text-indigo-700 dark:group-hover:text-indigo-400',
        chevron: 'group-hover:text-indigo-500 dark:group-hover:text-indigo-400',
        value: 'text-indigo-600 dark:text-indigo-400',
        edge: 'hover:border-indigo-300 dark:hover:border-indigo-800',
        bar: 'from-indigo-500 to-violet-500',
    },
    sky: {
        icon: 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400',
        hoverText: 'group-hover:text-sky-700 dark:group-hover:text-sky-400',
        chevron: 'group-hover:text-sky-500 dark:group-hover:text-sky-400',
        value: 'text-sky-600 dark:text-sky-400',
        edge: 'hover:border-sky-300 dark:hover:border-sky-800',
        bar: 'from-sky-500 to-cyan-500',
    },
    violet: {
        icon: 'bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400',
        hoverText: 'group-hover:text-violet-700 dark:group-hover:text-violet-400',
        chevron: 'group-hover:text-violet-500 dark:group-hover:text-violet-400',
        value: 'text-violet-600 dark:text-violet-400',
        edge: 'hover:border-violet-300 dark:hover:border-violet-800',
        bar: 'from-violet-500 to-fuchsia-500',
    },
    emerald: {
        icon: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
        hoverText: 'group-hover:text-emerald-700 dark:group-hover:text-emerald-400',
        chevron: 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400',
        value: 'text-emerald-600 dark:text-emerald-400',
        edge: 'hover:border-emerald-300 dark:hover:border-emerald-800',
        bar: 'from-emerald-500 to-teal-500',
    },
    amber: {
        icon: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
        hoverText: 'group-hover:text-amber-700 dark:group-hover:text-amber-400',
        chevron: 'group-hover:text-amber-500 dark:group-hover:text-amber-400',
        value: 'text-amber-600 dark:text-amber-400',
        edge: 'hover:border-amber-300 dark:hover:border-amber-800',
        bar: 'from-amber-500 to-orange-500',
    },
    rose: {
        icon: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
        hoverText: 'group-hover:text-rose-700 dark:group-hover:text-rose-400',
        chevron: 'group-hover:text-rose-500 dark:group-hover:text-rose-400',
        value: 'text-rose-600 dark:text-rose-400',
        edge: 'hover:border-rose-300 dark:hover:border-rose-800',
        bar: 'from-rose-500 to-pink-500',
    },
    slate: {
        icon: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
        hoverText: 'group-hover:text-slate-900 dark:group-hover:text-white',
        chevron: 'group-hover:text-slate-500 dark:group-hover:text-slate-400',
        value: 'text-slate-900 dark:text-white',
        edge: 'hover:border-slate-300 dark:hover:border-slate-700',
        bar: 'from-slate-400 to-slate-300',
    },
};

function MenuCard({ href, title, description, icon, onClick, tone = 'indigo' }) {
    const c = TONE[tone] || TONE.indigo;

    const content = (
        <>
            <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${c.icon}`}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold text-slate-800 dark:text-white transition-colors ${c.hoverText}`}>
                    {title}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
            </span>
            <ChevronRight size={15} className={`shrink-0 mt-2.5 transition-all duration-200 group-hover:translate-x-0.5 ${c.chevron} text-slate-300 dark:text-slate-600`} />
        </>
    );

    const cls = `group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-slate-950/50 ${c.edge}`;

    const shell = (inner) => (
        <>
            <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${c.bar} opacity-0 transition-opacity duration-200 group-hover:opacity-100`} aria-hidden="true" />
            {inner}
        </>
    );

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`${cls} w-full`}>
                {shell(content)}
            </button>
        );
    }

    return (
        <Link href={href} className={cls}>
            {shell(content)}
        </Link>
    );
}

function StatCard({ title, value, icon, tone = 'slate', hint }) {
    const c = TONE[tone] || TONE.slate;

    return (
        <div className={`group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-slate-950/40 ${c.edge}`}>
            <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${c.bar} opacity-70`} aria-hidden="true" />
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
                <span className={`shrink-0 grid place-items-center w-6 h-6 rounded-lg transition-transform duration-200 group-hover:scale-110 ${c.icon}`}>
                    {icon}
                </span>
            </div>
            <p className={`mt-1 text-2xl font-bold tabular-nums truncate ${c.value}`} title={String(value)}>{value}</p>
            {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
    );
}

function SkeletonLoader() {
    return (
        <div className="space-y-5">
            <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
                ))}
            </div>
        </div>
    );
}

// --- MAIN PAGE ---

export default function DashboardPage() {
    const router = useRouter();
    const { t, timezone, fmt, dateLocale } = useLanguage();
    const { user, loading: loadingSession } = useUser();
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);
    // Dimulai null, bukan new Date(), supaya render SSR dan hydration sama.
    // Jam diisi setelah mount: kalau diisi di server, hasilnya ikut zona Node
    // lalu melompat saat hydration.
    const [time, setTime] = useState(null);

    useEffect(() => {
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 1000);

        async function fetchStats() {
            if (!user) return;
            try {
                if (user.roleName === 'admin') {
                    const statsRes = await fetch('/api/system-info?mode=full');
                    if (statsRes.ok) {
                        const statsData = await statsRes.json();
                        setStats(statsData.app);
                    }
                } else {
                    setStats({ totalExams: '...', totalUsers: '...', totalQuestions: '...' });
                }
            } catch (error) {
                console.error('Fetch stats failed:', error);
            } finally {
                setLoadingStats(false);
            }
        }

        if (user) {
            fetchStats();
        }

        return () => clearInterval(timer);
    }, [user]);

    // Jam diambil dari zona waktu aplikasi, supaya sapaan (pagi/siang/sore/malam)
    // sesuai waktu yang dilihat admin - bukan zona browser.
    const getGreeting = () => {
        if (!time) return t('dash_greeting_morning');
        const hour = Number(
            new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                hour12: false,
            }).format(time)
        );
        if (hour < 11) return t('dash_greeting_morning');
        if (hour < 15) return t('dash_greeting_noon');
        if (hour < 18) return t('dash_greeting_afternoon');
        return t('dash_greeting_evening');
    };

    if (loadingSession || (user && loadingStats)) return <SkeletonLoader />;
    if (!user) return null;

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        router.push('/');
    };

    const isStudent = user.roleName === 'student';
    const roleLabel = isStudent
        ? t('dash_role_student')
        : user.roleName === 'teacher'
            ? t('dash_role_teacher')
            : t('dash_role_admin');

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Latar gradien: lighten, bukan gambar/gradien warna-yang-keluar,
                    supaya teks tetap gelap dan kontras di mode terang. */}
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/30" />
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5 px-5 py-5">
                    <div className="flex items-start gap-4 min-w-0">
                        <span className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-500/25">
                            {(user.name || user.username || '?').trim().charAt(0).toUpperCase()}
                        </span>

                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{getGreeting()}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">
                                    {user.name || user.username}
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold">
                                    <GraduationCap size={12} />
                                    {roleLabel}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                                {isStudent ? t('dash_welcome_student') : t('dash_welcome_admin')}
                            </p>
                        </div>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-white/60 dark:border-slate-700 bg-white/70 dark:bg-slate-800/50 backdrop-blur px-4 py-3 lg:min-w-[230px]">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Waktu sekarang</span>
                            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                </span>
                                Live
                            </span>
                        </div>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white leading-none">
                            {time ? fmt.clock(time) : '--:--:--'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                            {time ? new Intl.DateTimeFormat(dateLocale, { timeZone: timezone, weekday: 'long' }).format(time) : ''}
                            ,{' '}
                            {time ? fmt.date(time) : '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Statistik */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {!isStudent && (
                    <>
                        <StatCard
                            title={t('dash_stat_exams')}
                            value={stats?.totalExams ?? 0}
                            icon={<Copy size={13} />}
                            tone="indigo"
                        />
                        <StatCard
                            title={t('dash_stat_users')}
                            value={stats?.totalUsers ?? 0}
                            icon={<Users size={13} />}
                            tone="sky"
                        />
                        <StatCard
                            title={t('dash_stat_questions')}
                            value={stats?.totalQuestions ?? 0}
                            icon={<List size={13} />}
                            tone="violet"
                        />
                    </>
                )}
                <StatCard
                    title={t('dash_stat_role')}
                    value={roleLabel}
                    icon={<GraduationCap size={13} />}
                    tone="emerald"
                />
            </div>

            {/* Menu utama */}
            <div>
                <div className="flex items-center gap-2 px-1 pb-2">
                    <span className="h-4 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white">Menu</h2>
                    <span className="text-[11px] text-slate-400 ml-auto">Pilih salah satu untuk mulai</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <MenuCard
                        href="/dashboard/exams"
                        title={isStudent ? t('dash_card_exam_list_title') : t('dash_card_manage_exams_title')}
                        description={isStudent ? t('dash_card_exam_list_desc') : t('dash_card_manage_exams_desc')}
                        icon={<Copy size={18} />}
                        tone="indigo"
                    />

                    {user.roleName === 'admin' && (
                        <>
                            <MenuCard
                                href="/dashboard/users"
                                title={t('dash_card_users_title')}
                                description={t('dash_card_users_desc')}
                                icon={<Users size={18} />}
                                tone="sky"
                            />
                            <MenuCard
                                href="/dashboard/web-settings"
                                title={t('dash_card_settings_title')}
                                description={t('dash_card_settings_desc')}
                                icon={<List size={18} />}
                                tone="violet"
                            />
                        </>
                    )}

                    <MenuCard
                        title={t('dash_btn_logout')}
                        description={t('dash_logout_desc')}
                        icon={<LogOut size={18} />}
                        onClick={handleLogout}
                        tone="rose"
                    />
                </div>
            </div>

            {/* Keterangan */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <span className="font-semibold">Keterangan:</span>
                {isStudent
                    ? <span>Klik daftar ujian untuk melihat ujian yang tersedia di kelas kamu.</span>
                    : <span>Statistik di atas berasal dari data sistem secara langsung.</span>}
            </div>
        </div>
    );
}
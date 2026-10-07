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

function MenuCard({ href, title, description, icon, onClick, danger = false }) {
    const content = (
        <>
            <span className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${danger
                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold ${danger ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                    {title}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-slate-300 dark:text-slate-600" />
        </>
    );

    const cls = `flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${danger
        ? 'border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/20'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'}`;

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`${cls} w-full`}>
                {content}
            </button>
        );
    }

    return (
        <Link href={href} className={cls}>
            {content}
        </Link>
    );
}

function StatCard({ title, value, icon, tone = 'default', hint }) {
    const toneCls = {
        default: 'text-slate-900 dark:text-white',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
        amber: 'text-amber-600 dark:text-amber-400'
    }[tone] || 'text-slate-900 dark:text-white';

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
                <span className="shrink-0 text-slate-400">{icon}</span>
            </div>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
            {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
    );
}

function SkeletonLoader() {
    return (
        <div className="space-y-5">
            <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
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
    const [time, setTime] = useState(new Date());

    useEffect(() => {
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
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 px-5 py-5">
                    <div className="flex items-start gap-4 min-w-0">
                        <span className="shrink-0 w-11 h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-base font-bold">
                            {(user.name || user.username || '?').trim().charAt(0).toUpperCase()}
                        </span>

                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-400">{getGreeting()}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">
                                    {user.name || user.username}
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                                    <GraduationCap size={12} />
                                    {roleLabel}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                                {isStudent ? t('dash_welcome_student') : t('dash_welcome_admin')}
                            </p>
                        </div>
                    </div>

                    <div className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 lg:min-w-[230px]">
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
                            {fmt.clock(time)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                            {new Intl.DateTimeFormat(dateLocale, { timeZone: timezone, weekday: 'long' }).format(time)}
                            ,{' '}
                            {fmt.date(time)}
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
                            icon={<Copy size={15} />}
                            tone="indigo"
                        />
                        <StatCard
                            title={t('dash_stat_users')}
                            value={stats?.totalUsers ?? 0}
                            icon={<Users size={15} />}
                        />
                        <StatCard
                            title={t('dash_stat_questions')}
                            value={stats?.totalQuestions ?? 0}
                            icon={<List size={15} />}
                        />
                    </>
                )}
                <StatCard
                    title={t('dash_stat_role')}
                    value={roleLabel}
                    icon={<GraduationCap size={15} />}
                    tone="emerald"
                />
            </div>

            {/* Menu utama */}
            <div>
                <div className="flex items-center justify-between px-1 pb-2">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white">Menu</h2>
                    <span className="text-[11px] text-slate-400">Pilih salah satu untuk mulai</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <MenuCard
                        href="/dashboard/exams"
                        title={isStudent ? t('dash_card_exam_list_title') : t('dash_card_manage_exams_title')}
                        description={isStudent ? t('dash_card_exam_list_desc') : t('dash_card_manage_exams_desc')}
                        icon={<Copy size={18} />}
                    />

                    {user.roleName === 'admin' && (
                        <>
                            <MenuCard
                                href="/dashboard/users"
                                title={t('dash_card_users_title')}
                                description={t('dash_card_users_desc')}
                                icon={<Users size={18} />}
                            />
                            <MenuCard
                                href="/dashboard/web-settings"
                                title={t('dash_card_settings_title')}
                                description={t('dash_card_settings_desc')}
                                icon={<List size={18} />}
                            />
                        </>
                    )}

                    <MenuCard
                        title={t('dash_btn_logout')}
                        description={t('dash_logout_desc')}
                        icon={<LogOut size={18} />}
                        onClick={handleLogout}
                        danger
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
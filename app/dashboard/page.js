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
    LogOut 
} from 'lucide-react';
import { useUser } from '@/app/context/UserContext';

// --- COMPONENTS ---

function DashboardCard({ href, title, description, icon, gradient }) {
    return (
        <Link href={href} className="group relative block transition-all duration-300 hover:-translate-y-1">
            <div className={`relative overflow-hidden rounded-2xl p-6 shadow-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all group-hover:shadow-xl`}>
                <div className="relative z-10 flex flex-col h-full">
                    <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-110 ${gradient}`}>
                        {icon}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                        {description}
                    </p>
                </div>
            </div>
        </Link>
    );
}

function StatCard({ title, value, icon, colorClass }) {
    const colorStyles = {
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    };
    
    const style = colorStyles[colorClass] || colorStyles.blue;

    return (
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 sm:gap-4 transition-all hover:shadow-md overflow-hidden">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.bg} ${style.text} flex-shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                <p className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight break-words">{value}</p>
            </div>
        </div>
    );
}

function SkeletonLoader() {
    return (
        <div className="p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
                <div className="flex justify-between items-center">
                    <div className="space-y-3">
                        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-64"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-200 dark:bg-slate-900 rounded-xl"></div>)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800"></div>)}
                </div>
            </div>
        </div>
    );
}

// --- MAIN PAGE ---

export default function DashboardPage() {
    const router = useRouter();
    const { t } = useLanguage();
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

    const getGreeting = () => {
        const hour = time.getHours();
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-10">
            <div className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
                
                {/* Header / Hero */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="text-center md:text-left min-w-0 w-full">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight break-words">
                            {getGreeting()}, <br />
                            <span className="text-indigo-600 dark:text-indigo-400 block sm:inline">
                                {user.name || user.username}
                            </span>
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
                            {user.roleName === 'student' 
                                ? t('dash_welcome_student') 
                                : t('dash_welcome_admin')}
                        </p>
                    </div>

                    <div className="text-center md:text-right bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl min-w-[200px]">
                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                            {time.toLocaleTimeString(t('dash_date_locale'), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                            {time.toLocaleDateString(t('dash_date_locale'), { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    </div>
                </div>

                {/* Statistik */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {user.roleName === 'admin' && (
                        <>
                            <StatCard 
                                title={t('dash_stat_exams')} 
                                value={stats?.totalExams || 0} 
                                icon={<Copy size={18} />} 
                                colorClass="blue" 
                            />
                            <StatCard 
                                title={t('dash_stat_users')} 
                                value={stats?.totalUsers || 0} 
                                icon={<Users size={18} />} 
                                colorClass="violet" 
                            />
                            <StatCard 
                                title={t('dash_stat_questions')} 
                                value={stats?.totalQuestions || 0} 
                                icon={<List size={18} />} 
                                colorClass="indigo" 
                            />
                        </>
                    )}
                    <StatCard 
                        title={t('dash_stat_role')} 
                        value={
                            user.roleName === 'student' ? t('dash_role_student') : 
                            user.roleName === 'teacher' ? t('dash_role_teacher') : 
                            t('dash_role_admin')
                        } 
                        icon={<GraduationCap size={18} />} 
                        colorClass="emerald" 
                    />
                </div>

                {/* Menu Utama */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <DashboardCard
                        title={user.roleName === 'student' ? t('dash_card_exam_list_title') : t('dash_card_manage_exams_title')}
                        description={user.roleName === 'student' ? t('dash_card_exam_list_desc') : t('dash_card_manage_exams_desc')}
                        icon={<Copy size={24} />}
                        href="/dashboard/exams"
                        gradient="bg-indigo-600"
                    />
                    
                    {user.roleName === 'admin' && (
                        <>
                            <DashboardCard
                                title={t('dash_card_users_title')}
                                description={t('dash_card_users_desc')}
                                icon={<Users size={24} />}
                                href="/dashboard/users"
                                gradient="bg-violet-600"
                            />
                            <DashboardCard
                                title={t('dash_card_settings_title')}
                                description={t('dash_card_settings_desc')}
                                icon={<List size={24} />}
                                href="/dashboard/web-settings"
                                gradient="bg-blue-600"
                            />
                        </>
                    )}

                    <button
                        onClick={handleLogout}
                        className="group flex flex-col p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-red-500/50 transition-all text-left"
                    >
                        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 transition-transform group-hover:scale-110">
                            <LogOut size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{t('dash_btn_logout')}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('dash_logout_desc')}
                        </p>
                    </button>
                </div>

            </div>
        </div>
    );
}
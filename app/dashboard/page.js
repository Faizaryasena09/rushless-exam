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
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.bg} ${style.text} flex-shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{title}</p>
                <p className="text-lg font-black text-slate-800 dark:text-white leading-tight">{value}</p>
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
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);

        async function initDashboard() {
            try {
                const sessionRes = await fetch('/api/user-session');
                if (!sessionRes.ok) throw new Error('Not authenticated');
                const sessionData = await sessionRes.json();
                if (!sessionData.user) throw new Error('User data not found');
                setUser(sessionData.user);

                if (sessionData.user.roleName === 'admin') {
                    const statsRes = await fetch('/api/system-info?mode=full');
                    if (statsRes.ok) {
                        const statsData = await statsRes.json();
                        setStats(statsData.app);
                    }
                } else {
                    setStats({ totalExams: '...', totalUsers: '...', totalQuestions: '...' });
                }
            } catch (error) {
                console.error('Fetch failed:', error);
                router.push('/');
            } finally {
                setLoading(false);
            }
        }
        initDashboard();
        return () => clearInterval(timer);
    }, [router]);

    const getGreeting = () => {
        const hour = time.getHours();
        if (hour < 11) return "Selamat Pagi";
        if (hour < 15) return "Selamat Siang";
        if (hour < 18) return "Selamat Sore";
        return "Selamat Malam";
    };

    if (loading) return <SkeletonLoader />;
    if (!user) return null;

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        router.push('/');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-10">
            <div className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
                
                {/* Header / Hero */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="text-center md:text-left">
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                            {getGreeting()}, <br />
                            <span className="text-indigo-600 dark:text-indigo-400">
                                {user.name || user.username}
                            </span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                            {user.roleName === 'student' 
                                ? "Selamat datang kembali! Pantau jadwal dan kerjakan ujianmu dengan teliti." 
                                : "Selamat datang kembali di panel kontrol utama Anda."}
                        </p>
                    </div>

                    <div className="text-center md:text-right bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl min-w-[200px]">
                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                            {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    </div>
                </div>

                {/* Statistik */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {user.roleName === 'admin' && (
                        <>
                            <StatCard 
                                title="Total Ujian" 
                                value={stats?.totalExams || 0} 
                                icon={<Copy size={18} />} 
                                colorClass="blue" 
                            />
                            <StatCard 
                                title="Pengguna" 
                                value={stats?.totalUsers || 0} 
                                icon={<Users size={18} />} 
                                colorClass="violet" 
                            />
                            <StatCard 
                                title="Pertanyaan" 
                                value={stats?.totalQuestions || 0} 
                                icon={<List size={18} />} 
                                colorClass="indigo" 
                            />
                        </>
                    )}
                    <StatCard 
                        title="Role Anda" 
                        value={
                            user.roleName === 'student' ? 'Murid' : 
                            user.roleName === 'teacher' ? 'Guru' : 
                            'Administrator'
                        } 
                        icon={<GraduationCap size={18} />} 
                        colorClass="emerald" 
                    />
                </div>

                {/* Menu Utama */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <DashboardCard
                        title={user.roleName === 'student' ? "Lihat Ujian" : "Kelola Ujian"}
                        description={user.roleName === 'student' ? "Lihat daftar ujian yang tersedia untuk Anda." : "Atur semua data ujian, soal, dan jadwal pelaksanaan."}
                        icon={<Copy size={24} />}
                        href="/dashboard/exams"
                        gradient="bg-indigo-600"
                    />
                    
                    {user.roleName === 'admin' && (
                        <>
                            <DashboardCard
                                title="Data Pengguna"
                                description="Kelola data siswa, pengajar, dan akun administrator."
                                icon={<Users size={24} />}
                                href="/dashboard/users"
                                gradient="bg-violet-600"
                            />
                            <DashboardCard
                                title="Pengaturan Web"
                                description="Atur konfigurasi sistem, nama web, dan preferensi lainnya."
                                icon={<List size={24} />}
                                href="/dashboard/settings"
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
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Keluar Aplikasi</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Selesaikan sesi Anda dan keluar dari dashboard dengan aman.
                        </p>
                    </button>
                </div>

            </div>
        </div>
    );
}
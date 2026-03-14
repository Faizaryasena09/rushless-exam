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

// --- ICONS (Lucide Wrappers) ---
const DocumentDuplicateIcon = ({ className }) => <Copy className={className} />;
const ViewListIcon = ({ className }) => <List className={className} />;
const UsersIcon = ({ className }) => <Users className={className} />;
const AcademicCapIcon = ({ className }) => <GraduationCap className={className} />;
const LogoutIcon = ({ className }) => <LogOut className={className} />;

// --- COMPONENTS ---

// Komponen Kartu Dashboard dengan efek Hover & Gradient
function DashboardCard({ href, title, description, icon, gradient }) {
    return (
        <Link href={href} className={`group relative overflow-hidden rounded-2xl p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${gradient}`}>
            {/* Dekorasi Background Circle */}
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white opacity-10 blur-2xl transition-all duration-500 group-hover:scale-150"></div>

            <div className="relative z-10 flex items-start justify-between">
                <div className="flex flex-col">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
                        {icon}
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1 tracking-tight">{title}</h2>
                    <p className="text-sm text-blue-50 font-medium opacity-90">{description}</p>
                </div>

                {/* Arrow Icon on Hover */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
            </div>
        </Link>
    );
}

// Skeleton Loader untuk UX yang lebih halus
function SkeletonLoader() {
    return (
        <div className="p-6 bg-gray-50 dark:bg-slate-900 min-h-screen animate-pulse">
            <div className="flex justify-between items-center mb-8">
                <div className="h-8 bg-gray-300 dark:bg-slate-700 rounded w-1/4"></div>
                <div className="h-8 w-8 bg-gray-300 dark:bg-slate-700 rounded-full"></div>
            </div>
            <div className="mb-8">
                <div className="h-10 bg-gray-300 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
                <div className="h-6 bg-gray-300 dark:bg-slate-700 rounded w-1/4"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 bg-gray-200 dark:bg-slate-800 rounded-2xl"></div>
                ))}
            </div>
        </div>
    );
}

// --- MAIN PAGE ---

export default function DashboardPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        // Timer untuk jam
        const timer = setInterval(() => setTime(new Date()), 1000);

        async function fetchUser() {
            try {
                // Simulasi delay jaringan agar skeleton terlihat (bisa dihapus nanti)
                // await new Promise(resolve => setTimeout(resolve, 800)); 

                const res = await fetch('/api/user-session');
                if (!res.ok) throw new Error('Not authenticated');
                const data = await res.json();

                if (!data.user) throw new Error('User data not found');
                setUser(data.user);
            } catch (error) {
                console.error('Session check failed:', error);
                router.push('/');
            } finally {
                setLoading(false);
            }
        }
        fetchUser();

        return () => clearInterval(timer);
    }, [router]);

    const handleLogout = async () => {
        // Logika logout disini (misal call API logout)
        // const res = await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/'); // Redirect ke login
    };

    // Fungsi Sapaan Berdasarkan Waktu
    const getGreeting = () => {
        const hour = time.getHours();
        if (hour < 12) return t('dash_greeting_morning');
        if (hour < 15) return t('dash_greeting_noon');
        if (hour < 18) return t('dash_greeting_afternoon');
        return t('dash_greeting_evening');
    };

    if (loading) return <SkeletonLoader />;
    if (!user) return null;

    const isAdmin = user.roleName === 'admin';
    const isTeacher = user.roleName === 'teacher';
    const isAdminOrTeacher = isAdmin || isTeacher;
    const isStudent = user.roleName === 'student';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-transparent text-gray-800 dark:text-slate-200 font-sans selection:bg-blue-100 dark:selection:bg-indigo-900">

            <main className="max-w-7xl mx-auto px-6 py-10">
                {/* Hero / Welcome Section */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="text-sm font-medium text-blue-600 mb-1">
                            {time.toLocaleDateString(t('dash_date_locale'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
                            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{user.name || user.username}</span>!
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 mt-2 max-w-xl">
                            {t('dash_welcome_back')}
                        </p>
                    </div>
                    {/* Jam Digital Simpel */}
                    <div className="text-3xl font-mono text-gray-300 dark:text-slate-600 font-bold select-none hidden md:block">
                        {time.toLocaleTimeString(t('dash_date_locale'), { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {isAdminOrTeacher && (
                        <>
                            <DashboardCard
                                href="/dashboard/exams"
                                title={t('dash_card_manage_exams_title')}
                                description={t('dash_card_manage_exams_desc')}
                                icon={<DocumentDuplicateIcon className="h-8 w-8 text-white" />}
                                gradient="bg-gradient-to-br from-blue-500 to-blue-700"
                            />
                            {isAdmin && (
                                <>
                                    <DashboardCard
                                        href="/dashboard/classes"
                                        title={t('dash_card_manage_classes_title')}
                                        description={t('dash_card_manage_classes_desc')}
                                        icon={<AcademicCapIcon className="h-8 w-8 text-white" />}
                                        gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
                                    />
                                    <DashboardCard
                                        href="/dashboard/users"
                                        title={t('dash_card_manage_users_title')}
                                        description={t('dash_card_manage_users_desc')}
                                        icon={<UsersIcon className="h-8 w-8 text-white" />}
                                        gradient="bg-gradient-to-br from-violet-500 to-violet-700"
                                    />
                                </>
                            )}
                        </>
                    )}

                    {isStudent && (
                        <DashboardCard
                            href="/dashboard/exams"
                            title={t('dash_card_exam_list_title')}
                            description={t('dash_card_exam_list_desc')}
                            icon={<ViewListIcon className="h-8 w-8 text-white" />}
                            gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
                        />
                    )}


                </div>
            </main>
        </div>
    );
}
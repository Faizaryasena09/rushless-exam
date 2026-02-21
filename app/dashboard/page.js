'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// --- ICONS ---
const DocumentDuplicateIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h4M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-6 4h.01M12 15h.01M16 11h.01M12 11h.01M16 15h.01M12 7h.01" />
    </svg>
);

const ViewListIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
);

const UsersIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A4.982 4.982 0 015 13a5 5 0 0110 0c0 .268-.01.533-.03.792m-9.74-.292A4.982 4.982 0 015 13" />
    </svg>
);

const AcademicCapIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
    </svg>
);

const LogoutIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

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
        if (hour < 12) return 'Selamat Pagi';
        if (hour < 15) return 'Selamat Siang';
        if (hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    };

    if (loading) return <SkeletonLoader />;
    if (!user) return null;

    const isAdminOrTeacher = user.roleName === 'admin' || user.roleName === 'teacher';
    const isStudent = user.roleName === 'student';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-transparent text-gray-800 dark:text-slate-200 font-sans selection:bg-blue-100 dark:selection:bg-indigo-900">

            <main className="max-w-7xl mx-auto px-6 py-10">
                {/* Hero / Welcome Section */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="text-sm font-medium text-blue-600 mb-1">
                            {time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
                            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{user.name || user.username}</span>!
                        </h1>
                        <p className="text-gray-500 dark:text-slate-400 mt-2 max-w-xl">
                            Selamat datang kembali di panel kontrol Anda. Berikut adalah ringkasan aktivitas dan menu pintas untuk hari ini.
                        </p>
                    </div>
                    {/* Jam Digital Simpel */}
                    <div className="text-3xl font-mono text-gray-300 dark:text-slate-600 font-bold select-none hidden md:block">
                        {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {isAdminOrTeacher && (
                        <>
                            <DashboardCard
                                href="/dashboard/exams"
                                title="Kelola Ujian"
                                description="Buat, edit, dan pantau ujian aktif."
                                icon={<DocumentDuplicateIcon className="h-8 w-8 text-white" />}
                                gradient="bg-gradient-to-br from-blue-500 to-blue-700"
                            />
                            <DashboardCard
                                href="/dashboard/classes"
                                title="Manajemen Kelas"
                                description="Atur siswa dan grup kelas."
                                icon={<AcademicCapIcon className="h-8 w-8 text-white" />}
                                gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
                            />
                            <DashboardCard
                                href="/dashboard/users"
                                title="Data Pengguna"
                                description="Tambah dan kelola akses user."
                                icon={<UsersIcon className="h-8 w-8 text-white" />}
                                gradient="bg-gradient-to-br from-violet-500 to-violet-700"
                            />
                        </>
                    )}

                    {isStudent && (
                        <DashboardCard
                            href="/dashboard/exams"
                            title="Daftar Ujian"
                            description="Lihat dan kerjakan ujian yang tersedia."
                            icon={<ViewListIcon className="h-8 w-8 text-white" />}
                            gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
                        />
                    )}


                </div>
            </main>
        </div>
    );
}
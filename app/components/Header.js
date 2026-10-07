'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useLanguage } from '@/app/context/LanguageContext';
import {
    Sun,
    Moon,
    Menu,
    ChevronDown,
    User as UserIcon,
    Download,
    LogOut
} from 'lucide-react';

// Label halaman untuk ditampilkan di header
const PAGE_TITLES = [
    { match: '/dashboard/exams/questions', label: 'Kelola Soal' },
    { match: '/dashboard/exams/questions', label: 'Panduan Soal' },
    { match: '/dashboard/exams/results', label: 'Hasil Ujian' },
    { match: '/dashboard/exams/manage', label: 'Pengaturan Ujian' },
    { match: '/dashboard/exams/preview', label: 'Preview Ujian' },
    { match: '/dashboard/exams', label: 'Ujian' },
    { match: '/dashboard/users', label: 'Pengguna' },
    { match: '/dashboard/classes', label: 'Kelas' },
    { match: '/dashboard/subjects', label: 'Mata Pelajaran' },
    { match: '/dashboard/web-settings', label: 'Pengaturan Website' },
    { match: '/dashboard/system-overview', label: 'Ringkasan Sistem' },
    { match: '/dashboard/activity-logs', label: 'Log Aktivitas' },
    { match: '/dashboard/session-control', label: 'Kontrol Sesi' },
    { match: '/dashboard/archive-answers', label: 'Arsip Jawaban' },
    { match: '/dashboard/bank-soal', label: 'Bank Soal' },
    { match: '/dashboard/profile', label: 'Profil Saya' },
    { match: '/dashboard/download-app', label: 'Download Aplikasi' },
    { match: '/dashboard/control', label: 'Kontrol Ujian' }
];

export default function Header({ user, isLoading, toggleSidebar, showToggleButton }) {
    const router = useRouter();
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
    const { t } = useLanguage();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [branding, setBranding] = useState({ site_name: 'Rushless Exam', site_logo: '/favicon.ico' });

    useEffect(() => {
        fetch('/api/web-settings?mode=branding')
            .then(res => res.json())
            .then(data => setBranding(data))
            .catch(err => console.error(err));
    }, []);

    // Tutup dropdown saat klik di luar
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Tutup dropdown dengan Escape
    useEffect(() => {
        function handleEscape(event) {
            if (event.key === 'Escape') setDropdownOpen(false);
        }
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    const handleLogout = async () => {
        setDropdownOpen(false);
        await fetch('/api/logout', { method: 'POST' });
        router.push('/');
    };

    const getInitials = (name) => (name ? name.trim().charAt(0).toUpperCase() : 'U');

    const roleLabel = !user
        ? ''
        : user.roleName === 'student'
            ? t('dash_role_student')
            : user.roleName === 'teacher'
                ? t('dash_role_teacher')
                : t('dash_role_admin');

    const currentPage = PAGE_TITLES.find(item => pathname?.startsWith(item.match))?.label;

return (
        <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
                {/* Kiri: toggle + logo */}
                <div className="flex items-center gap-3 min-w-0">
                    {showToggleButton && (
                        <button
                            onClick={toggleSidebar}
                            aria-label="Buka / tutup menu samping"
                            className="p-2 -ml-1 rounded-xl text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/50 transition-colors"
                        >
                            <Menu size={18} />
                        </button>
                    )}

                    <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 group">
                        <span className="shrink-0 grid place-items-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/60 dark:to-violet-950/60 border border-indigo-200 dark:border-indigo-900/60 overflow-hidden transition-transform duration-200 group-hover:scale-105">
                            <img
                                src={branding?.site_logo || '/favicon.ico'}
                                alt="Logo"
                                className="w-5 h-5 object-contain"
                            />
                        </span>
                        <span className="min-w-0">
                            <span
                                className="block max-w-[180px] sm:max-w-[260px] truncate text-sm font-bold text-slate-900 dark:text-white leading-tight transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300"
                                dangerouslySetInnerHTML={{ __html: branding?.site_name || 'Rushless Exam' }}
                            />
                            {currentPage && (
                                <span className="block text-[11px] text-slate-400 leading-tight truncate">{currentPage}</span>
                            )}
                        </span>
                    </Link>
                </div>

                {/* Kanan: aksi */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={toggleTheme}
                        aria-label={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
                        title={theme === 'dark' ? t('header_light_mode') : t('header_dark_mode')}
                        className="p-2 rounded-xl text-slate-500 hover:text-amber-700 hover:bg-amber-50 dark:text-slate-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/50 transition-colors"
                    >
                        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                    </button>

                    {isLoading ? (
                        <div className="flex items-center gap-2 animate-pulse pl-1">
                            <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                            <div className="hidden sm:block h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                        </div>
                    ) : user ? (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setDropdownOpen(v => !v)}
                                aria-expanded={dropdownOpen}
                                aria-haspopup="true"
                                aria-label="Menu pengguna"
                                className={`flex items-center gap-2 pl-1 pr-1.5 sm:pr-2 py-1 rounded-xl border transition-all duration-200 ${dropdownOpen
                                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800'
                                    : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <span className="hidden sm:block text-right leading-tight">
                                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                                        {user.name || user.username}
                                    </span>
                                    <span className="block text-[10px] text-indigo-600 dark:text-indigo-400">{roleLabel}</span>
                                </span>

                                <span className="relative shrink-0">
                                    <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-sm shadow-indigo-500/25">
                                        {getInitials(user.name || user.username)}
                                    </span>
                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                                </span>

                                <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown akun */}
                            <div
                                className={`absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70 overflow-hidden transition-all origin-top-right z-50 ${dropdownOpen
                                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                                    : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
                            >
                                <div aria-hidden className="h-0.5 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <span className="shrink-0 grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-sm shadow-indigo-500/25">
                                            {getInitials(user.name || user.username)}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{user.name || user.username}</p>
                                            <p className="text-xs text-slate-400 truncate">@{user.username} &middot; {roleLabel}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-1.5">
                                    <MenuItem
                                        href="/dashboard/profile"
                                        icon={<UserIcon size={16} />}
                                        label={t('header_my_profile')}
                                        onClick={() => setDropdownOpen(false)}
                                    />
                                    <MenuItem
                                        href="/dashboard/download-app"
                                        icon={<Download size={16} />}
                                        label="Download Aplikasi"
                                        onClick={() => setDropdownOpen(false)}
                                    />

                                    <div className="h-px bg-slate-100 dark:border-slate-800 my-1" />

                                    <button
                                        onClick={() => { setDropdownOpen(false); toggleTheme(); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                                    >
                                        {theme === 'dark' ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-indigo-500" />}
                                        <span className="font-medium">{theme === 'dark' ? t('header_light_mode') : t('header_dark_mode')}</span>
                                        <span className="ml-auto text-[11px] text-slate-400">{theme === 'dark' ? 'Terang' : 'Gelap'}</span>
                                    </button>

                                    <div className="h-px bg-slate-100 dark:border-slate-800 my-1" />

                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left"
                                    >
                                        <LogOut size={16} />
                                        <span className="font-medium">{t('header_logout')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">
                                {t('header_welcome_guest')}
                            </span>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-300/50 dark:shadow-indigo-950/40 transition-all active:scale-95"
                            >
                                {t('header_sign_in')}
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

function MenuItem({ href, icon, label, onClick }) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
            <span className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{icon}</span>
            <span>{label}</span>
        </Link>
    );
}


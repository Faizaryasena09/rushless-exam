'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Presentation, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { useUser } from '@/app/context/UserContext';

// Definisi Ikon Sederhana (SVG) agar kode tetap rapi
const Icons = {
  Dashboard: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Classes: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  Subjects: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Exams: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  TeacherClasses: () => (
    <Presentation className="w-5 h-5" />
  ),
  Control: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  SystemOverview: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Database: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  License: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Bank: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
};

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user } = useUser();
  const [branding, setBranding] = useState({ site_name: 'Rushless Exam', site_logo: '/favicon.ico' });
  // null = mengikuti status anak menu (terbuka otomatis bila anak aktif)
  const [sectionState, setSectionState] = useState({ academic: null, exams: null });
  
  const userRole = user?.roleName;


  useEffect(() => {
    // Fetch site branding
    fetch('/api/web-settings?mode=branding')
         .then(res => res.json())
         .then(data => setBranding(data))
         .catch(err => console.error(err));
  }, []);

  // Tutup otomatis hanya di layar kecil (mobile/tablet) setiap kali halaman berpindah
  useEffect(() => {
    if (window.innerWidth >= 1024) return;
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  // Tutup submenu dengan tombol Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setSectionState({ academic: false, exams: false });
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen && window.innerWidth < 1024 ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const mainLinks = [
    { href: '/dashboard', label: t('nav_dashboard'), icon: Icons.Dashboard, roles: ['admin', 'teacher', 'student'], exact: true },
    { href: '/dashboard/users', label: t('nav_manage_users'), icon: Icons.Users, roles: ['admin'] },
  ].filter(link => link.roles.includes(userRole));

  const academicLinks = [
    { href: '/dashboard/teachers-assignments', label: t('nav_teacher_assignments'), icon: Icons.TeacherClasses, roles: ['admin'] },
    { href: '/dashboard/subjects', label: t('nav_manage_subjects'), icon: Icons.Subjects, roles: ['admin'] },
    { href: '/dashboard/classes', label: t('nav_manage_classes'), icon: Icons.Classes, roles: ['admin'] },
    { href: '/dashboard/exams/bank-soal', label: 'Bank Soal', icon: Icons.Bank, roles: ['admin', 'teacher'] },
  ].filter(link => !link.roles || link.roles.includes(userRole));

  const examSubLinks = [
    { href: '/dashboard/exams', label: t('nav_exam_list'), icon: Icons.Exams, exact: true },
    { href: '/dashboard/exams/control', label: t('nav_exam_control'), icon: Icons.Control, roles: ['admin', 'teacher'] },
  ].filter(link => !link.roles || link.roles.includes(userRole));

  const adminLinks = [
    { href: '/dashboard/web-settings', label: t('nav_admin_tools'), icon: Icons.Settings, roles: ['admin'] },
    {
      href: '/dashboard/license',
      label: 'License',
      icon: Icons.License,
      roles: ['admin'],
    },
  ].filter(link => link.roles.includes(userRole));

  const isManager = userRole === 'admin' || userRole === 'teacher';

  const isLinkActive = (link) => {
    if (!pathname) return false;
    if (link.exact) return pathname === link.href;
    if (pathname === link.href) return true;
    // Jangan tandai aktif jika hanya prefix yang cocok (mis. /dashboard/exams vs /dashboard/exams/control)
    return !mainLinks.some(l => l.href === link.href) && pathname.startsWith(`${link.href}/`);
  };

  const hasActiveChild = (links) => links.some(l => isLinkActive(l));

  const academicOpen = sectionState.academic ?? hasActiveChild(academicLinks);
  const examsOpen = sectionState.exams ?? hasActiveChild(examSubLinks);

  const toggleSection = (key, fallback) => {
    setSectionState(prev => ({ ...prev, [key]: !(prev[key] ?? fallback) }));
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm lg:hidden rl-animate-in"
        />
      )}

      <aside
        aria-label="Menu navigasi utama"
        className={`fixed top-0 left-0 z-40 w-64 h-screen bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 transform transition-[width,transform] duration-300 ease-out shadow-2xl shadow-slate-900/10 dark:shadow-black/40 lg:shadow-none flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Header Sidebar */}
        <div className="flex-shrink-0 flex items-center justify-between gap-2 h-16 px-5 border-b border-slate-100 dark:border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 group">
            <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
              <img
                src={branding?.site_logo || '/favicon.ico'}
                alt="Logo"
                className="h-[18px] w-[18px] object-contain"
              />
            </span>
            <span
              className="min-w-0 text-sm font-bold tracking-tight text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors prose prose-sm prose-slate dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: branding?.site_name || 'Rushless Exam' }}
            />
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden shrink-0 p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
            aria-label="Tutup menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-grow flex flex-col gap-5 px-3 py-4 overflow-y-auto no-scrollbar rl-thin-scroll">
          <NavGroup label={t('nav_group_main')}>
            {mainLinks.map((link) => (
              <NavItem key={link.href} link={link} active={isLinkActive(link)} />
            ))}
          </NavGroup>

          {isManager && (
            <NavGroup label={t('nav_group_manage')}>
              <NavSection
                label={t('nav_academic_data')}
                icon={<Icons.Database />}
                open={academicOpen}
                onToggle={() => toggleSection('academic', hasActiveChild(academicLinks))}
              >
                {academicLinks.map((link) => (
                  <NavItem key={link.href} link={link} active={isLinkActive(link)} nested />
                ))}
              </NavSection>

              <NavSection
                label={t('nav_manage_exams')}
                icon={<Icons.Exams />}
                open={examsOpen}
                onToggle={() => toggleSection('exams', hasActiveChild(examSubLinks))}
              >
                {examSubLinks.map((link) => (
                  <NavItem key={link.href} link={link} active={isLinkActive(link)} nested />
                ))}
              </NavSection>
            </NavGroup>
          )}

          {!isManager && examSubLinks.map((link) => (
            <NavItem key={link.href} link={link} active={isLinkActive(link)} />
          ))}
        </nav>

        {/* Footer Sidebar */}
        <div className="flex-shrink-0 mt-auto">
          {adminLinks.length > 0 && (
            <div className="px-3 pb-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700/70 p-2 space-y-1">
                <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {t('nav_group_admin')}
                </p>
                {adminLinks.map((link) => (
                  <NavItem
                    key={link.href}
                    link={link}
                    active={isLinkActive(link)}
                    accent="rose"
                  />
                ))}
              </div>
            </div>
          )}
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-600 font-medium truncate">
              &copy; {new Date().getFullYear()} {branding?.site_name?.replace(/<[^>]*>?/gm, '') || 'Rushless Exam'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

const ACCENTS = {
  indigo: {
    active: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200/80 dark:ring-indigo-500/30',
    icon: 'text-indigo-600 dark:text-indigo-400',
    bar: 'bg-indigo-600 dark:bg-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-500/20',
  },
  rose: {
    active: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200/80 dark:ring-rose-500/30',
    icon: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500 dark:bg-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-500/20',
  },
};

function NavGroup({ label, children }) {
  return (
    <div>
      <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function NavItem({ link, active, nested = false, accent = 'indigo' }) {
  const c = ACCENTS[accent] || ACCENTS.indigo;
  const Icon = link.icon;

  return (
    <li>
      <Link
        href={link.href}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex items-center gap-3 rounded-xl transition-all duration-200 ${nested ? 'px-3 py-2 text-[13px]' : 'px-3 py-2.5 text-sm'} font-medium ${active
          ? c.active
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
      >
        {/* Bar penanda aktif */}
        <span
          aria-hidden
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full transition-all duration-200 ${active ? `opacity-100 scale-y-100 ${c.bar}` : 'opacity-0 scale-y-50'
            }`}
        />
        <span
          className={`shrink-0 flex items-center justify-center rounded-lg transition-colors duration-200 ${active
            ? `${c.icon} ${c.iconBg}`
            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
            }`}
        >
          <Icon />
        </span>
        <span className="truncate">{link.label}</span>
        {link.badge && (
          <span className={`ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-tighter ${link.badgeColor}`}>
            {link.badge}
          </span>
        )}
      </Link>
    </li>
  );
}

function NavSection({ label, icon, open, onToggle, hasActiveChild, children }) {
  return (
    <li>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${open || hasActiveChild
          ? 'text-slate-900 dark:text-slate-100 bg-slate-100/70 dark:bg-slate-800/70'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
      >
        <span className={`shrink-0 flex items-center justify-center rounded-lg transition-colors duration-200 ${open || hasActiveChild
          ? 'text-slate-700 dark:text-slate-200 bg-slate-200/70 dark:bg-slate-700/70'
          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
          }`}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
        <ChevronDown
          size={15}
          className={`ml-auto shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Submenu dengan animasi tinggi */}
      <div
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
      >
        <div className="overflow-hidden">
          {/* padding ekstra agar ring/frame item aktif tidak ikut terpotong */}
          <div className="-mx-1.5 px-1.5">
            <ul className="relative mt-1 ml-5 pl-4 space-y-0.5 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-slate-200 dark:before:bg-slate-700 before:transition-opacity before:duration-300 before:content-[''] ${open ? 'before:opacity-100' : 'before:opacity-0'}">
              {children}
            </ul>
          </div>
        </div>
      </div>
    </li>
  );
}

export default Sidebar;
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Presentation } from 'lucide-react';
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
  )
};

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user } = useUser();
  const [branding, setBranding] = useState({ site_name: 'Rushless Exam', site_logo: '/favicon.ico' });
  const [academicOpen, setAcademicOpen] = useState(false);
  const [examsOpen, setExamsOpen] = useState(false);
  
  const userRole = user?.roleName;


  useEffect(() => {
    // Fetch site branding
    fetch('/api/web-settings?mode=branding')
         .then(res => res.json())
         .then(data => setBranding(data))
         .catch(err => console.error(err));
  }, []);

  // Auto-open dropdown if child is active
  useEffect(() => {
    if (pathname.includes('/dashboard/teachers-assignments') || 
        pathname.includes('/dashboard/subjects') || 
        pathname.includes('/dashboard/classes')) {
      setAcademicOpen(true);
    }
    if (pathname.includes('/dashboard/exams')) {
      setExamsOpen(true);
    }
  }, [pathname]);

  const mainLinks = [
    { href: '/dashboard', label: t('nav_dashboard'), icon: Icons.Dashboard, roles: ['admin', 'teacher', 'student'] },
    { href: '/dashboard/users', label: t('nav_manage_users'), icon: Icons.Users, roles: ['admin'] },
  ].filter(link => link.roles.includes(userRole));

  const academicLinks = [
    { href: '/dashboard/teachers-assignments', label: t('nav_teacher_assignments'), icon: Icons.TeacherClasses },
    { href: '/dashboard/subjects', label: t('nav_manage_subjects'), icon: Icons.Subjects },
    { href: '/dashboard/classes', label: t('nav_manage_classes'), icon: Icons.Classes },
  ];

  const examSubLinks = [
    { href: '/dashboard/exams', label: t('nav_exam_list'), icon: Icons.Exams },
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

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 w-64 h-screen bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-out shadow-xl lg:shadow-none flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Header Sidebar */}
        <div className="flex-shrink-0 flex items-center justify-between h-16 px-6 border-b border-slate-100 dark:border-slate-700">
          <Link href="/" className="flex items-center gap-2 max-w-[80%] overflow-hidden">
            <span 
              className="text-lg font-bold tracking-tight text-slate-800 dark:text-white truncate prose prose-sm prose-slate dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: branding?.site_name || 'Rushless Exam' }}
            >
            </span>
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-grow p-4 mt-2 overflow-y-auto no-scrollbar">
          <ul className="space-y-1">
            {/* Main Section */}
            {mainLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-700'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                  >
                    <span className={`transition-colors duration-200 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}>
                      <Icon />
                    </span>
                    {link.label}
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>}
                  </Link>
                </li>
              );
            })}

            {/* Academic Data Dropdown (Admin Only) */}
            {userRole === 'admin' && (
              <li>
                <button
                  onClick={() => setAcademicOpen(!academicOpen)}
                  className={`w-full group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${academicOpen || academicLinks.some(l => pathname === l.href)
                    ? 'text-slate-900 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-700/30'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                  <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                    <Icons.Database />
                  </span>
                  {t('nav_academic_data')}
                  <svg className={`ml-auto w-4 h-4 transition-transform duration-200 ${academicOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {academicOpen && (
                  <ul className="mt-1 ml-4 pl-4 border-l border-slate-100 dark:border-slate-700 space-y-1">
                    {academicLinks.map((link) => {
                      const isActive = pathname === link.href;
                      const Icon = link.icon;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={`group flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${isActive
                              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                              }`}
                          >
                            <span className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600'}>
                              <Icon />
                            </span>
                            {link.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            )}

            {/* Exams Section Dropdown */}
            {(userRole === 'admin' || userRole === 'teacher') ? (
              <li>
                <button
                  onClick={() => setExamsOpen(!examsOpen)}
                  className={`w-full group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${examsOpen || examSubLinks.some(l => pathname === l.href)
                    ? 'text-slate-900 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-700/30'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                  <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                    <Icons.Exams />
                  </span>
                  {t('nav_manage_exams')}
                  <svg className={`ml-auto w-4 h-4 transition-transform duration-200 ${examsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {examsOpen && (
                  <ul className="mt-1 ml-4 pl-4 border-l border-slate-100 dark:border-slate-700 space-y-1">
                    {examSubLinks.map((link) => {
                      const isActive = pathname === link.href;
                      const Icon = link.icon;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={`group flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${isActive
                              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                              }`}
                          >
                            <span className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600'}>
                              <Icon />
                            </span>
                            {link.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ) : (
              // Student View (Single Link)
              examSubLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-700'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                      <span className={`transition-colors duration-200 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                        }`}>
                        <Icon />
                      </span>
                      {link.label}
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </nav>

        {/* Footer Sidebar */}
        <div className="mt-auto border-t border-slate-100 dark:border-slate-700">
          {adminLinks.length > 0 && (
            <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
              <ul className="space-y-1">
                {adminLinks.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={`group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                          ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-rose-200 dark:ring-rose-800'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-600'
                          }`}
                      >
                        <span className={`transition-colors duration-200 ${isActive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-rose-500 dark:group-hover:text-rose-400'
                          }`}>
                          <Icon />
                        </span>
                        {link.label}
                        {link.badge && (
                          <span className={`ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-tighter ${link.badgeColor}`}>
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="px-6 py-4">
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-600 font-medium">
              &copy; {new Date().getFullYear()} {branding?.site_name?.replace(/<[^>]*>?/gm, '') || 'Rushless Exam'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
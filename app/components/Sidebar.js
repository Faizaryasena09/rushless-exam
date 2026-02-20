'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Presentation } from 'lucide-react';

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
  Database: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  )
};

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    // Fetch user session to get the role
    const fetchUserSession = async () => {
      try {
        const response = await fetch('/api/user-session');
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.user?.roleName);
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error);
      }
    };

    fetchUserSession();
  }, []);

  const allNavLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: Icons.Dashboard, roles: ['admin', 'teacher', 'students'] },
    { href: '/dashboard/users', label: 'Manage Users', icon: Icons.Users, roles: ['admin'] },
    { href: '/dashboard/teachers-classes', label: 'Teacher Classes', icon: Icons.TeacherClasses, roles: ['admin'] },
    { href: '/dashboard/control', label: 'Exam Control', icon: Icons.Control, roles: ['admin'] },
    { href: '/dashboard/classes', label: 'Manage Classes', icon: Icons.Classes, roles: ['admin', 'teacher'] },
    { href: '/dashboard/exams', label: 'Manage Exams', icon: Icons.Exams, roles: ['admin', 'teacher', 'students'] },
    { href: '/dashboard/settings', label: 'Web Settings', icon: Icons.Settings, roles: ['admin'] },
    { href: '/dashboard/database', label: 'Database', icon: Icons.Database, roles: ['admin'] },
  ];

  const navLinks = allNavLinks.filter(link => link.roles.includes(userRole));

  return (
    <>
      {/* Mobile Backdrop (Optional UX improvement: close when clicking outside) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 w-64 h-screen bg-white border-r border-slate-200 transform transition-transform duration-300 ease-out shadow-xl lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Header Sidebar */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-800">
              Rushless<span className="text-indigo-600">Exam</span>
            </span>
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-grow p-4 mt-2 overflow-y-auto">
          <ul className="space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-200'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <span className={`transition-colors duration-200 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`}>
                      <Icon />
                    </span>
                    {link.label}

                    {/* Active Indicator Dot */}
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer Sidebar (Optional Space) */}
        <div className="p-4 border-t border-slate-100">
          <p className="text-xs text-center text-slate-400">
            v1.0.0 Dashboard
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header({ toggleSidebar }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUserSession = async () => {
    try {
      const res = await fetch('/api/user-session');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user session:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
  };

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <div className="flex items-center">
          <button onClick={toggleSidebar} className="text-gray-500 hover:text-gray-600 focus:outline-none focus:text-gray-600 mr-4" aria-label="Toggle sidebar">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* --- Logo Section --- */}
          <Link href="/" className="group flex items-center gap-2.5 outline-none">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
                RUSHLESS<span className="text-indigo-600">EXAM</span>
              </span>
            </div>
          </Link>
        </div>

        {/* --- Actions Section --- */}
        <div className="flex items-center">
          
          {isLoading ? (
            // Loading Skeleton
            <div className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 bg-slate-200 rounded-full"></div>
              <div className="hidden sm:block h-4 w-24 bg-slate-200 rounded"></div>
            </div>
          ) : user ? (
            // State: Logged In
            <div className="flex items-center gap-3 sm:gap-5">
              
              {/* User Profile Info */}
              <div className="flex items-center gap-3 pl-2 sm:pl-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700 leading-none mb-1">{user.username}</p>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Student Account</p>
                </div>
                
                <div className="relative group cursor-pointer">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-sm">
                    <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                       <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600">
                          {getInitials(user.username)}
                       </span>
                    </div>
                  </div>
                  {/* Active Indicator */}
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white transform translate-y-1/4 translate-x-1/4"></span>
                </div>
              </div>

              {/* Vertical Separator */}
              <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="relative group flex items-center justify-center sm:justify-start gap-2 p-2 sm:px-4 sm:py-2 text-sm font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200 ease-out"
                title="Sign out"
              >
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            // State: Guest
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm font-medium text-slate-500">
                Welcome, Guest
              </span>
              <Link 
                href="/login"
                className="group relative inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white transition-all duration-200 bg-indigo-600 rounded-lg hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
              >
                <span>Sign In</span>
                <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';

// Sun icon for light mode
const SunIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

// Moon icon for dark mode
const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

export default function Header({ user, isLoading, toggleSidebar, showToggleButton }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
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

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <div className="flex items-center">
          {showToggleButton && (
            <button onClick={toggleSidebar} className="text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 focus:outline-none mr-4" aria-label="Toggle sidebar">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          {/* --- Logo Section --- */}
          <Link href="/" className="group flex items-center gap-2.5 outline-none">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-transparent transition-transform duration-300 group-hover:scale-105">
              <img src="/favicon.ico" alt="Logo" className="w-8 h-8" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                RUSHLESS<span className="text-indigo-600 dark:text-indigo-400">EXAM</span>
              </span>
            </div>
          </Link>
        </div>

        {/* --- Actions Section --- */}
        <div className="flex items-center gap-2">

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            <div className="relative w-4 h-4">
              <div className={`absolute inset-0 transition-all duration-300 ${theme === 'dark' ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`}>
                <MoonIcon />
              </div>
              <div className={`absolute inset-0 transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`}>
                <SunIcon />
              </div>
            </div>
          </button>

          {isLoading ? (
            // Loading Skeleton
            <div className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
              <div className="hidden sm:block h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
          ) : user ? (
            // State: Logged In — Avatar with Dropdown
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 pl-2 sm:pl-0 focus:outline-none group"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-none mb-1">{user.name || user.username}</p>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400 dark:text-slate-500">{user.roleName || ''}</p>
                </div>

                <div className="relative">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-sm transition-transform duration-200 group-hover:scale-105">
                    <div className="h-full w-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                      <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600">
                        {getInitials(user.name || user.username)}
                      </span>
                    </div>
                  </div>
                  {/* Active Indicator */}
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800 transform translate-y-1/4 translate-x-1/4"></span>
                </div>

                {/* Dropdown Arrow */}
                <svg className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div
                className={`absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden transition-all duration-200 origin-top-right ${dropdownOpen
                  ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                  }`}
              >
                {/* User Info Section */}
                <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-700/50 dark:to-indigo-900/20 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] flex-shrink-0">
                      <div className="h-full w-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                        <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600">
                          {getInitials(user.name || user.username)}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user.name || user.username}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{user.username}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1.5">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-150"
                  >
                    <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="font-medium">Profil Saya</span>
                  </Link>

                  {/* Theme Toggle in Dropdown */}
                  <button
                    onClick={() => { toggleTheme(); }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150 w-full text-left"
                  >
                    <span className="text-slate-400 dark:text-slate-500">
                      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                    </span>
                    <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${theme === 'dark'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-slate-100 text-slate-500'
                      }`}>
                      {theme === 'dark' ? '🌙' : '☀️'}
                    </span>
                  </button>

                  <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-700"></div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 transition-colors duration-150 w-full text-left"
                  >
                    <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // State: Guest
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm font-medium text-slate-500 dark:text-slate-400">
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
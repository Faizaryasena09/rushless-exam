'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header({ user, isLoading, toggleSidebar, showToggleButton }) {
  const router = useRouter();
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
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-lg border-b border-slate-200/60 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <div className="flex items-center">
          {showToggleButton && (
            <button onClick={toggleSidebar} className="text-gray-500 hover:text-gray-600 focus:outline-none focus:text-gray-600 mr-4" aria-label="Toggle sidebar">
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
            // State: Logged In — Avatar with Dropdown
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 pl-2 sm:pl-0 focus:outline-none group"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700 leading-none mb-1">{user.name || user.username}</p>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">{user.roleName || ''}</p>
                </div>

                <div className="relative">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-sm transition-transform duration-200 group-hover:scale-105">
                    <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                      <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600">
                        {getInitials(user.name || user.username)}
                      </span>
                    </div>
                  </div>
                  {/* Active Indicator */}
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white transform translate-y-1/4 translate-x-1/4"></span>
                </div>

                {/* Dropdown Arrow */}
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div
                className={`absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden transition-all duration-200 origin-top-right ${dropdownOpen
                  ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                  }`}
              >
                {/* User Info Section */}
                <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] flex-shrink-0">
                      <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                        <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600">
                          {getInitials(user.name || user.username)}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{user.name || user.username}</p>
                      <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1.5">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="font-medium">Profil Saya</span>
                  </Link>

                  <div className="mx-3 my-1 border-t border-slate-100"></div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors duration-150 w-full text-left"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
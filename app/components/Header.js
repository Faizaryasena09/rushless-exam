'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header() {
  // HAPUS bagian <{ username: string } | null>
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

  // HAPUS bagian ": string" di parameter name
  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md transition-all">
      <div className="container mx-auto px-6 h-16 flex justify-between items-center">
        
        {/* Logo Section */}
        <Link href="/" className="group flex items-center gap-2">
          <div className="bg-indigo-600 rounded-lg p-1 group-hover:bg-indigo-700 transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            RUSHLESS<span className="text-gray-800">EXAM</span>
          </span>
        </Link>

        {/* User Actions Section */}
        <div className="flex items-center gap-4">
          
          {isLoading ? (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
            </div>
          ) : user ? (
            // Tampilan saat Login
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-700">{user.username}</p>
                  <p className="text-xs text-gray-400">Student</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white">
                  {getInitials(user.username)}
                </div>
              </div>

              <div className="h-6 w-px bg-gray-200 mx-1"></div>

              <button
                onClick={handleLogout}
                className="group flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                title="Sign out"
              >
                <span>Logout</span>
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            // Tampilan saat Guest
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 mr-2">Welcome, Guest</span>
              <Link 
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
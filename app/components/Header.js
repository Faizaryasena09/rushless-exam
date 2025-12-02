'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Function to fetch user session
    const fetchUserSession = async () => {
      try {
        const res = await fetch('/api/user-session');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error);
      }
    };

    fetchUserSession();

    // Optional: Listen for storage events to update header across tabs
    window.addEventListener('storage', fetchUserSession);
    return () => {
      window.removeEventListener('storage', fetchUserSession);
    };
  }, []);

  return (
    <header className="bg-gray-800 text-white p-4 w-full">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          RUSHLESSEXAM
        </Link>
        <div className="text-sm">
          {user ? (
            <span>
              Logged in as: <strong>{user.username}</strong>
            </span>
          ) : (
            <span>Welcome, Guest</span>
          )}
        </div>
      </div>
    </header>
  );
}

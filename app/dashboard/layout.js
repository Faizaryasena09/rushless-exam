"use client";
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function DashboardLayout({ children }) {
  // Default to false (closed), which is good for mobile first
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // On component mount, check screen size and set sidebar to open for large screens
    if (window.innerWidth >= 1024) { // 1024px is Tailwind's 'lg' breakpoint
      setSidebarOpen(true);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <div className="relative flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

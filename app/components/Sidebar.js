'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/users', label: 'Manage Users' },
    { href: '/dashboard/classes', label: 'Manage Classes' },
    { href: '/dashboard/exams', label: 'Manage Exams' },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 w-64 h-screen bg-gray-800 text-white transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between h-16 bg-gray-900 px-4">
        <span className="text-xl font-bold">Rushless Exam</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-gray-400 hover:text-white"
          aria-label="Close sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-grow p-4">
        <ul>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`flex items-center p-2 my-2 text-sm rounded-lg hover:bg-gray-700 ${
                  pathname === link.href ? 'bg-gray-700' : ''
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;

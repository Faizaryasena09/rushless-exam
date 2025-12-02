'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/users', label: 'Manage Users' },
    { href: '/dashboard/classes', label: 'Manage Classes' },
    { href: '/dashboard/exams', label: 'Manage Exams' },
  ];

  return (
    <div className="flex flex-col w-64 bg-gray-800 text-white">
      <div className="flex items-center justify-center h-16 bg-gray-900">
        <span className="text-xl font-bold">Rushless Exam</span>
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
    </div>
  );
};

export default Sidebar;

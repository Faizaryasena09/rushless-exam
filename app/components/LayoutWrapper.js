'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();

  // Pages where the header and footer should not be shown
  const noLayoutPages = ['/']; // The login page is at the root

  const showLayout = !noLayoutPages.includes(pathname);

  return (
    <div className="flex flex-col min-h-screen">
      {showLayout && <Header />}
      <main className="flex-grow container mx-auto p-4">
        {children}
      </main>
      {showLayout && <Footer />}
    </div>
  );
}

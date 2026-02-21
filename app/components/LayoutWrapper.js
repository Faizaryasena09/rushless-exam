'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();

  // Pages where the footer should not be shown
  const noFooterPages = ['/'];

  const showFooter = !noFooterPages.includes(pathname);

  return (
    <div className="flex flex-col min-h-screen dark:bg-slate-900">
      <main className="flex-grow">
        {children}
      </main>
      {showFooter && <Footer />}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
    </div>
  );
}

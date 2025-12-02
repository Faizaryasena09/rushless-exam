'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UjianPage() {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [errorExams, setErrorExams] = useState(null);

  // Session check logic (same as before)
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/user-session');
        if (!res.ok) {
          throw new Error('Not authenticated');
        }
        const data = await res.json();
        if (!data.user) {
          throw new Error('User data not found in session');
        }
      } catch (error) {
        console.error('Session check failed:', error);
        router.push('/'); // Redirect to login if not authenticated
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
  }, [router]);

  // Fetch exams logic
  useEffect(() => {
    if (!loadingSession) { // Only fetch exams if session check is complete
      async function fetchExams() {
        try {
          const res = await fetch('/api/exams');
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to fetch exams');
          }
          const data = await res.json();
          setExams(data.exams);
        } catch (err) {
          setErrorExams(err.message);
        } finally {
          setLoadingExams(false);
        }
      }
      fetchExams();
    }
  }, [loadingSession]); // Depend on loadingSession to ensure session check runs first

  if (loadingSession || loadingExams) {
    return <h1 className="text-2xl font-bold text-center mt-10">Loading...</h1>;
  }

  if (errorExams) {
    return <h1 className="text-2xl font-bold text-center mt-10 text-red-500">Error: {errorExams}</h1>;
  }

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Daftar Ujian</h1>
        <Link
          href="/dashboard/ujian/baru"
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          + Buat Ujian Baru
        </Link>
      </div>
      <div className="bg-white shadow-md rounded p-8">
        {exams.length === 0 ? (
          <p className="text-gray-600">Belum ada ujian yang dibuat. Klik "Buat Ujian Baru" untuk memulai!</p>
        ) : (
          <table className="min-w-full leading-normal mt-4">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Nama Ujian
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Dibuat Pada
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{exam.exam_name}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{exam.description || '-'}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{formatDate(exam.created_at)}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <a href="#" className="text-indigo-600 hover:text-indigo-900">Edit</a>
                    {/* Add other actions like View/Delete here */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

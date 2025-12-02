'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewUjianPage() {
  const router = useRouter();
  const [examName, setExamName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exam_name: examName, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create exam');
      }

      // Redirect to the exam list on success
      router.push('/dashboard/ujian');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Buat Ujian Baru</h1>
        <Link
          href="/dashboard/ujian"
          className="text-sm text-blue-500 hover:underline"
        >
          &larr; Kembali ke Daftar Ujian
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded p-8">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="examName">
            Nama Ujian
          </label>
          <input
            id="examName"
            type="text"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
            placeholder="e.g., Ujian Akhir Semester Matematika"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
            Deskripsi (Opsional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            rows="4"
            placeholder="e.g., Ujian ini mencakup materi dari bab 1 sampai 5."
          />
        </div>
        
        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}

        <div className="flex items-center">
          <button
            type="submit"
            disabled={loading}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
          >
            {loading ? 'Menyimpan...' : 'Simpan Ujian'}
          </button>
        </div>
      </form>
    </div>
  );
}

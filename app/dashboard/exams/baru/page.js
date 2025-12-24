'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Gunakan lucide-react untuk ikon (pastikan sudah install: npm install lucide-react)
import { ChevronLeft, Save, Loader2, AlertCircle, FileText } from 'lucide-react';

export default function NewExamPage() {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_name: examName, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal membuat ujian');
      }

      router.push('/dashboard/exams');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header Section */}
      <div className="flex flex-col gap-2 mb-8">
        <Link
          href="/dashboard/exams"
          className="flex items-center text-sm text-slate-500 hover:text-indigo-600 transition-colors w-fit"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Kembali ke Daftar Ujian
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <FileText className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">Buat Ujian Baru</h1>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg animate-in fade-in zoom-in duration-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Input Nama Ujian */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="examName">
              Nama Ujian <span className="text-red-500">*</span>
            </label>
            <input
              id="examName"
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400"
              required
              placeholder="Contoh: Ujian Akhir Semester Matematika"
            />
          </div>

          {/* Input Deskripsi */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="description">
              Deskripsi (Opsional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-400"
              rows="4"
              placeholder="Jelaskan detail ujian atau instruksi pengerjaan di sini..."
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg shadow-md shadow-indigo-100 transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Ujian
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
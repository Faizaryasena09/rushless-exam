'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/app/context/UserContext';
import { ChevronLeft, Save, Loader2, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewExamPage() {
  const router = useRouter();
  const { user, loading: loadingUser } = useUser();
  const [examName, setExamName] = useState('');
  const [description, setDescription] = useState('');
  const [requireSafeBrowser, setRequireSafeBrowser] = useState(false);
  const [requireSeb, setRequireSeb] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isTeacher = user?.roleName === 'teacher';

  useEffect(() => {
    async function fetchData() {
      try {
        const [subjectsRes, classesRes] = await Promise.all([
          fetch('/api/subjects'),
          fetch('/api/classes')
        ]);

        if (subjectsRes.ok) {
          const subjectsData = await subjectsRes.json();
          setSubjects(subjectsData);
          
          // Auto-select first subject if teacher and only one exists or just first one
          if (isTeacher && subjectsData.length > 0) {
            setSubjectId(subjectsData[0].id.toString());
          }
        }

        if (classesRes.ok) {
          const classesData = await classesRes.json();
          setClasses(classesData);
          
          // Auto-select all classes for teacher
          if (isTeacher && classesData.length > 0) {
            setSelectedClasses(classesData.map(c => c.id));
          }
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      }
    }
    
    if (!loadingUser) {
      fetchData();
    }
  }, [loadingUser, isTeacher]);

  const toggleClass = (classId) => {
    setSelectedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedClasses.length === 0) {
      setError('Pilih minimal satu kelas untuk ujian ini.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_name: examName,
          description,
          require_safe_browser: requireSafeBrowser,
          require_seb: requireSeb,
          subject_id: subjectId || null,
          allowed_classes: selectedClasses
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal membuat ujian');
      }

      toast.success('Ujian berhasil dibuat!');
      router.push('/dashboard/exams');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingUser) return null;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header Section */}
      <div className="flex flex-col gap-2 mb-8">
        <Link
          href="/dashboard/exams"
          className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-fit"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Kembali ke Daftar Ujian
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <FileText className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">Buat Ujian Baru</h1>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-6">

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg animate-in fade-in zoom-in duration-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Input Nama Ujian */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="examName">
              Nama Ujian <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              id="examName"
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              required
              placeholder="Contoh: Ujian Akhir Semester Matematika"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Mata Pelajaran */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="subjectId">
                Mata Pelajaran
              </label>
              <select
                id="subjectId"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              >
                <option value="">Pilih Mata Pelajaran...</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Kelas */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Target Kelas <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {classes.length > 0 ? (
                  classes.map(cls => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleClass(cls.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        selectedClasses.includes(cls.id)
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200'
                          : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
                      }`}
                    >
                      {selectedClasses.includes(cls.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {cls.class_name}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500 italic py-2">Belum ada kelas yang tersedia.</p>
                )}
              </div>
            </div>
          </div>

          {/* Input Deskripsi */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="description">
              Deskripsi (Opsional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              rows="4"
              placeholder="Jelaskan detail ujian atau instruksi pengerjaan di sini..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Toggle Safe Browser */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl transition-all hover:border-indigo-400 group">
              <div className="flex-1">
                <label htmlFor="safeBrowser" className="block text-sm font-bold text-slate-700 dark:text-slate-300">Rushless Safer</label>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Ujian hanya bisa diakses via aplikasi Rushless Safer.</p>
              </div>
              <input
                id="safeBrowser"
                type="checkbox"
                checked={requireSafeBrowser}
                onChange={(e) => setRequireSafeBrowser(e.target.checked)}
                className="w-5 h-5 text-indigo-600 dark:text-indigo-500 rounded-lg focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 dark:bg-slate-700 transition-all cursor-pointer"
              />
            </div>

            {/* Toggle SEB */}
            <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl transition-all hover:border-blue-400 group">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label htmlFor="requireSeb" className="block text-sm font-bold text-slate-700 dark:text-slate-300">Safe Exam Browser</label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Wajibkan pengerjaan via Safe Exam Browser.</p>
                </div>
                <input
                  id="requireSeb"
                  type="checkbox"
                  checked={requireSeb}
                  onChange={(e) => setRequireSeb(e.target.checked)}
                  className="w-5 h-5 text-blue-600 dark:text-blue-500 rounded-lg focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 dark:bg-slate-700 transition-all cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-400/50 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30 transition-all active:scale-95 flex-shrink-0"
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
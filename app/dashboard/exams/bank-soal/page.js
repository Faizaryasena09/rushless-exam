'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/context/UserContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { toast } from 'sonner';
import { 
  Folder, 
  ChevronRight, 
  Plus, 
  MoreVertical, 
  Trash, 
  Edit, 
  Search, 
  ArrowLeft, 
  FileText,
  Copy,
  Download,
  Upload,
  ChevronLeft,
  Home,
  X,
  Eye,
  Check,
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import dynamic from 'next/dynamic';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });
import BankQuestionForm from '@/app/components/bank/BankQuestionForm';

export default function BankSoalPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, loading: loadingSession } = useUser();
  const [folders, setFolders] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [path, setPath] = useState([]);

  // Modal states
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState('all'); // 'all', 'folder', 'selected'
  const [folderName, setFolderName] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);

  const userRole = user?.roleName;

  useEffect(() => {
    if (loadingSession) return;
    if (!user || (userRole !== 'admin' && userRole !== 'teacher')) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [loadingSession, user?.id, currentFolderId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Folders
      const foldersRes = await fetch('/api/bank/folders');
      const foldersData = await foldersRes.json();
      setFolders(foldersData);

      // Fetch Questions in current folder
      if (currentFolderId) {
        const questionsRes = await fetch(`/api/bank/questions?folder_id=${currentFolderId}`);
        const questionsData = await questionsRes.json();
        setQuestions(questionsData);
      } else {
        setQuestions([]);
      }
    } catch (error) {
      console.error('Failed to fetch bank data:', error);
      toast.error('Gagal mengambil data Bank Soal');
    } finally {
      setLoading(false);
    }
  };

  // Build breadcrumbs path
  useEffect(() => {
    if (!currentFolderId) {
      setPath([]);
      return;
    }

    const newPath = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (folder) {
        newPath.unshift(folder);
        currentId = folder.parent_id;
      } else {
        break;
      }
    }
    setPath(newPath);
  }, [currentFolderId, folders]);

  const currentFolders = useMemo(() => {
    return folders.filter(f => f.parent_id === currentFolderId);
  }, [folders, currentFolderId]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q =>
      (q.question_text || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [questions, searchTerm]);

  const allSelected = filteredQuestions.length > 0 && selectedQuestionIds.length === filteredQuestions.length;

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    try {
      const res = await fetch('/api/bank/folders', {
        method: editingFolder ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingFolder?.id,
          name: folderName,
          parent_id: currentFolderId
        })
      });

      if (res.ok) {
        toast.success(editingFolder ? 'Folder berhasil diubah' : 'Folder berhasil dibuat');
        setFolderName('');
        setIsFolderModalOpen(false);
        setEditingFolder(null);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Gagal menyimpan folder');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    }
  };

  const handleDeleteFolder = async (id) => {
    if (!confirm('Hapus folder ini? Semua isi di dalamnya juga akan terhapus.')) return;

    try {
      const res = await fetch(`/api/bank/folders?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Folder dihapus');
        fetchData();
      }
    } catch (error) {
      toast.error('Gagal menghapus folder');
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Hapus soal ini dari bank?')) return;

    try {
      const res = await fetch(`/api/bank/questions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Soal dihapus');
        setSelectedQuestionIds(prev => prev.filter(item => item !== id));
        fetchData();
      }
    } catch (error) {
      toast.error('Gagal menghapus soal');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return;
    if (!confirm(`Hapus ${selectedQuestionIds.length} soal terpilih secara permanen?`)) return;

    try {
      const res = await fetch(`/api/bank/questions?id=${selectedQuestionIds.join(',')}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`${selectedQuestionIds.length} soal berhasil dihapus`);
        setSelectedQuestionIds([]);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Gagal menghapus soal');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat menghapus soal');
    }
  };

  const toggleSelectQuestion = (id) => {
    setSelectedQuestionIds(prev => 
      prev.includes(id) 
        ? prev.filter(qid => qid !== id) 
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedQuestionIds.length === filteredQuestions.length && filteredQuestions.length > 0) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(filteredQuestions.map(q => q.id));
    }
  };

  if (loadingSession) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      ` }} />

      {/* 1. Bagian Judul & Tombol */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <div className="animate-fade-in-down max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">
                  Bank Soal
                </h1>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-60">
                  Repositori soal mandiri Rushless Exam.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Impor Soal</span>
                <span className="sm:hidden">Impor</span>
              </button>
              <button
                onClick={() => {
                  setExportScope(currentFolderId ? 'folder' : 'all');
                  setIsExportModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                Ekspor
              </button>
              <button
                onClick={() => {
                   setEditingFolder(null);
                   setFolderName('');
                   setIsFolderModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Folder Baru
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigasi (Sticky) */}
      <div className="sticky top-16 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Breadcrumb + tombol kembali ke folder induk */}
            <div className="flex items-center gap-1.5 min-w-0">
              {currentFolderId && (
                <button
                  onClick={() => {
                    const parent = path.length > 1 ? path[path.length - 2] : null;
                    setCurrentFolderId(parent ? parent.id : null);
                  }}
                  aria-label="Kembali ke folder sebelumnya"
                  title="Kembali"
                  className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar min-w-0">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  aria-current={!currentFolderId ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${!currentFolderId
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Bank Soal
                </button>

                {path.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-0.5 shrink-0">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    <button
                      onClick={() => setCurrentFolderId(folder.id)}
                      aria-current={folder.id === currentFolderId ? 'page' : undefined}
                      className={`px-2.5 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors ${folder.id === currentFolderId
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                      {folder.name}
                    </button>
                  </div>
                ))}
              </nav>
            </div>

            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Cari soal..."
                aria-label="Cari soal di folder ini"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-900/60 border border-transparent focus:border-indigo-300 dark:focus:border-indigo-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  aria-label="Bersihkan pencarian"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-[3px] border-indigo-200 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin" />
            <p className="mt-4 text-sm text-slate-400 font-medium">Memuat data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Folders Grid */}
            {currentFolders.length > 0 && (
              <section className="animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-1 h-3 bg-indigo-500 rounded-full" />
                  Folders
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] tabular-nums">
                    {currentFolders.length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {currentFolders.map(folder => (
                    <div
                      key={folder.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setCurrentFolderId(folder.id);
                        }
                      }}
                      aria-label={`Buka folder ${folder.name}`}
                      className="group bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-100/60 dark:hover:shadow-none transition-all cursor-pointer relative focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      onClick={() => setCurrentFolderId(folder.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20">
                          <Folder className="w-5 h-5 fill-current" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-slate-800 dark:text-white truncate">{folder.name}</h3>
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {folder.question_count !== undefined ? `${folder.question_count} soal` : 'Klik untuk buka'}
                          </p>
                        </span>
                      </div>

                      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolder(folder);
                              setFolderName(folder.name);
                              setIsFolderModalOpen(true);
                            }}
                            aria-label={`Ubah folder ${folder.name}`}
                            title="Ubah Folder"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                         >
                            <Edit className="w-3.5 h-3.5" />
                         </button>
                         <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder.id);
                            }}
                            aria-label={`Hapus folder ${folder.name}`}
                            title="Hapus Folder"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                         >
                            <Trash className="w-3.5 h-3.5" />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Questions Section */}
            {currentFolderId && (
              <section className="animate-fade-in-up mt-8" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                      Butir Soal
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] tabular-nums">
                        {filteredQuestions.length}
                      </span>
                    </h2>

                    {filteredQuestions.length > 0 && (
                      <>
                        <button
                          onClick={toggleSelectAll}
                          aria-pressed={allSelected}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 transition-colors border border-slate-200 dark:border-slate-700"
                        >
                          <span className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center transition-colors ${allSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-transparent border-slate-300 dark:border-slate-600'}`}>
                            {allSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          </span>
                          {allSelected ? 'Lepas Semua' : 'Pilih Semua'}
                        </button>

                        {selectedQuestionIds.length > 0 && (
                          <button
                            onClick={() => setSelectedQuestionIds([])}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Batal pilih
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setEditingQuestion(null);
                      setIsQuestionModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Soal
                  </button>
                </div>

                {filteredQuestions.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full mb-4">
                      {searchTerm ? (
                        <Search className="w-8 h-8 text-slate-300" />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <h3 className="text-slate-800 dark:text-white font-bold">
                      {searchTerm ? 'Tidak ada soal yang cocok' : 'Folder Kosong'}
                    </h3>
                    <p className="text-sm text-slate-400 max-w-xs mt-1">
                      {searchTerm
                        ? `Tidak ditemukan soal dengan kata kunci "${searchTerm}".`
                        : 'Belum ada soal di folder ini. Kamu bisa tambah manual atau impor dari ujian yang sudah ada.'}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="mt-5 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
                      >
                        Bersihkan pencarian
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredQuestions.map((question, idx) => {
                      const isSelected = selectedQuestionIds.includes(question.id);
                      return (
                        <div
                          key={question.id}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setPreviewQuestion(question);
                            }
                          }}
                          onClick={() => setPreviewQuestion(question)}
                          className={`group relative bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isSelected
                            ? 'border-indigo-500 ring-1 ring-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-500/5'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
                            }`}
                        >
                          <div className="flex items-start gap-3.5">
                            {/* Checkbox */}
                            <span
                              role="checkbox"
                              aria-checked={isSelected}
                              aria-label={`Pilih soal nomor ${idx + 1}`}
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectQuestion(question.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleSelectQuestion(question.id);
                                }
                              }}
                              className={`shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent hover:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500'
                                }`}
                            >
                              <Check className="w-3 h-3 transition-transform duration-150" style={{ transform: isSelected ? 'scale(1)' : 'scale(0)' }} strokeWidth={3} />
                            </span>

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded text-[9px] font-bold uppercase tracking-wider leading-tight">
                                  {question.question_type?.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400 tabular-nums">#{idx + 1}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-[10px] font-semibold text-slate-400">{question.points} poin</span>
                                <span className="ml-auto hidden sm:flex items-center gap-1 text-[10px] font-semibold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="w-3.5 h-3.5" />
                                  Pratinjau
                                </span>
                              </div>

                              <div
                                className="text-slate-700 dark:text-slate-300 prose prose-sm max-w-none line-clamp-2 font-medium"
                                dangerouslySetInnerHTML={{ __html: question.question_text }}
                              />

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="text-[10px] font-medium text-slate-400 truncate">
                                  Ditambahkan {new Date(question.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingQuestion(question);
                                      setIsQuestionModalOpen(true);
                                    }}
                                    aria-label="Edit soal"
                                    title="Edit Soal"
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteQuestion(question.id);
                                    }}
                                    aria-label="Hapus soal"
                                    title="Hapus Soal"
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Empty State for Root */}
            {!currentFolderId && currentFolders.length === 0 && (
              <div className="animate-fade-in-up bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-16 sm:p-20 flex flex-col items-center justify-center text-center" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
                <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-full mb-5">
                  <Folder className="w-12 h-12 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Mulai Bangun Perpustakaanmu</h3>
                <p className="text-slate-400 max-w-sm mt-1.5 text-sm">Buat folder untuk merapikan soal-soal per mata pelajaran atau topik.</p>
                <button
                    onClick={() => {
                      setEditingFolder(null);
                      setFolderName('');
                      setIsFolderModalOpen(true);
                    }}
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow-md active:scale-95 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Buat Folder Pertama
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Folder Modal */}
      <Modal
        open={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        size="sm"
        icon={editingFolder ? Edit : Folder}
        iconClass="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        title={editingFolder ? 'Ubah Folder' : 'Buat Folder Baru'}
        subtitle={editingFolder ? 'Perbarui nama folder ini' : `Berisi di dalam ${currentFolderId ? 'folder ini' : 'Bank Soal'}`}
        footer={
          <div className="flex items-center justify-end gap-2">
            <ModalButton variant="ghost" onClick={() => setIsFolderModalOpen(false)}>
              Batal
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              form="bank-folder-form"
              disabled={!folderName.trim()}
            >
              {editingFolder ? 'Simpan Perubahan' : 'Buat Folder'}
            </ModalButton>
          </div>
        }
      >
        <form id="bank-folder-form" onSubmit={handleCreateFolder}>
          <label htmlFor="folder-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Nama Folder
          </label>
          <input
            id="folder-name"
            autoFocus
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Contoh: Matematika Kelas 10"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-colors"
          />
          <p className="mt-2 text-[11px] text-slate-400">
            Folder bisa berisi folder lain (sub-folder) dan butir soal.
          </p>
        </form>
      </Modal>

      {/* Import Modal */}
      {isImportModalOpen && (
        <BankImportModal 
          folderId={currentFolderId} 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchData();
          }}
        />
      )}

      {/* Question Modal */}
      <Modal
        open={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        size="xl"
        icon={editingQuestion ? Edit : Plus}
        iconClass="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        title={editingQuestion ? 'Sunting Butir Soal' : 'Tambah Soal ke Bank'}
        subtitle={path.length > 0 ? path.map(f => f.name).join(' / ') : 'Bank Soal'}
        bodyClassName="custom-scrollbar"
      >
        <BankQuestionForm
          folderId={currentFolderId}
          initialData={editingQuestion}
          onSave={() => {
              setIsQuestionModalOpen(false);
              fetchData();
          }}
          onCancel={() => setIsQuestionModalOpen(false)}
        />
      </Modal>

      {/* Export Modal */}
      {isExportModalOpen && (
        <BankExportModal 
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          currentFolderId={currentFolderId}
          selectedIds={selectedQuestionIds}
          initialScope={exportScope}
        />
      )}

      {/* Question Preview Modal */}
      <Modal
        open={!!previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        size="lg"
        icon={Eye}
        iconClass="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        title="Pratinjau Butir Soal"
        subtitle={path.length > 0 ? path.map(f => f.name).join(' / ') : 'Bank Soal'}
        badge={
          previewQuestion ? (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded text-[10px] font-semibold uppercase tracking-wide">
                {previewQuestion.question_type?.replace(/_/g, ' ')}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[10px] font-semibold tabular-nums">
                {previewQuestion.points} poin
              </span>
            </div>
          ) : null
        }
        bodyClassName="custom-scrollbar bg-slate-50/50 dark:bg-slate-950/40"
        footer={
          <div className="flex items-center justify-end gap-2">
            <ModalButton
              variant="secondary"
              onClick={() => {
                setPreviewQuestion(null);
                setEditingQuestion(previewQuestion);
                setIsQuestionModalOpen(true);
              }}
            >
              <Edit size={15} />
              Edit Soal
            </ModalButton>
            <ModalButton variant="primary" onClick={() => setPreviewQuestion(null)}>
              Tutup
            </ModalButton>
          </div>
        }
      >
        {previewQuestion && (
          <div className="space-y-5">
            {/* Question Text */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Pertanyaan</p>
              <div
                className="text-base text-slate-800 dark:text-slate-200 font-medium leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewQuestion.question_text }}
              />
            </div>

            {/* Options / Answer Area */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pilihan &amp; Kunci Jawaban</p>

              {/* Multiple Choice / Complex */}
              {(previewQuestion.question_type === 'multiple_choice' || previewQuestion.question_type === 'multiple_choice_complex') && (
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    let opts = {};
                    try {
                      opts = typeof previewQuestion.options === 'string'
                        ? JSON.parse(previewQuestion.options)
                        : (previewQuestion.options || {});
                    } catch (e) {
                      console.error('Parse Error', e);
                    }
                    return Object.entries(opts).map(([key, value]) => {
                      const isCorrect = previewQuestion.question_type === 'multiple_choice'
                        ? previewQuestion.correct_option === key
                        : previewQuestion.correct_option?.split(',').includes(key);

                      return (
                        <div
                          key={key}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                            }`}
                        >
                          <span className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold uppercase ${isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                            {key}
                          </span>
                          <div className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-300 prose prose-sm max-w-none">
                            <div dangerouslySetInnerHTML={{ __html: value }} />
                          </div>
                          {isCorrect && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[9px] font-bold uppercase tracking-wide">
                              <CheckSquare size={10} />
                              Kunci
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* True / False */}
              {previewQuestion.question_type === 'true_false' && (
                <div className="grid grid-cols-2 gap-3">
                  {['Benar', 'Salah'].map((val) => {
                    const isCorrect = previewQuestion.correct_option === val;
                    return (
                      <div
                        key={val}
                        className={`p-5 rounded-xl border flex flex-col items-center justify-center gap-2.5 transition-colors ${isCorrect
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          }`}
                      >
                        <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}>
                          {val === 'Benar' ? 'B' : 'S'}
                        </span>
                        <span className={`text-sm font-semibold ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {val}
                        </span>
                        {isCorrect && (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                            Kunci Jawaban
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Essay */}
              {previewQuestion.question_type === 'essay' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={14} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contoh Jawaban / Kunci</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {previewQuestion.correct_option || 'Tidak ada kunci jawaban spesifik untuk soal uraian.'}
                  </p>
                </div>
              )}

              {/* Matching */}
              {previewQuestion.question_type === 'matching' && (
                <div className="space-y-2.5">
                  {(() => {
                    let opts = {};
                    try {
                      opts = typeof previewQuestion.options === 'string' ? JSON.parse(previewQuestion.options) : (previewQuestion.options || {});
                    } catch (e) {
                      console.error('Parse Error', e);
                    }
                    const pairs = opts.pairs || [];
                    if (pairs.length === 0) return <p className="text-sm italic text-slate-400">Tidak ada pasangan yang didefinisikan.</p>;

                    return pairs.map((pair, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 prose prose-sm max-w-none">
                          <div dangerouslySetInnerHTML={{ __html: pair.p }} />
                        </div>
                        <span className="h-px w-6 bg-slate-300 dark:bg-slate-700 shrink-0" />
                        <div className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 prose prose-sm max-w-none">
                          <div dangerouslySetInnerHTML={{ __html: pair.r }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Floating Bulk Action Bar */}
      {selectedQuestionIds.length > 0 && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] animate-in slide-in-from-bottom-10 duration-500 flex items-center gap-4 sm:gap-5 px-4 sm:px-5 py-3 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white max-w-[calc(100vw-2rem)]">
            <div className="flex items-center gap-2.5 border-r border-white/10 pr-4 sm:pr-5">
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums shrink-0">
                  {selectedQuestionIds.length}
               </div>
               <div className="hidden sm:block">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 leading-none">Terpilih</p>
                  <p className="text-[11px] font-semibold text-white/80 leading-tight mt-0.5">Butir Soal</p>
               </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                 <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-semibold transition-all active:scale-95 whitespace-nowrap"
               >
                  <Trash className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hapus Massal</span>
                  <span className="sm:hidden">Hapus</span>
               </button>
               <button
                  onClick={() => {
                    setExportScope('selected');
                    setIsExportModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-semibold transition-all active:scale-95 whitespace-nowrap"
               >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ekspor Terpilih</span>
                  <span className="sm:hidden">Ekspor</span>
               </button>
               <button
                  onClick={() => setSelectedQuestionIds([])}
                  aria-label="Batalkan Pilihan"
                  className="shrink-0 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
               >
                  <X className="w-4 h-4" />
               </button>
            </div>
         </div>
      )}
    </div>
   );
}

/* ============================================================
   MODAL SHELL — tema konsisten dengan halaman dashboard lain
   (rounded-2xl, border slate, tombol slate-900/white)
   ============================================================ */
const MODAL_SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-4xl',
  xl: 'sm:max-w-5xl',
};

function Modal({ open, onClose, size = 'md', icon: Icon, iconClass = '', title, subtitle, badge, children, footer, bodyClassName = '' }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />

      <div
        className={`relative w-full sm:${MODAL_SIZES[size] || MODAL_SIZES.md} bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200`}
      >
        {/* Grip untuk mobile */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${iconClass || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'}`}>
                <Icon size={17} />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{title}</h2>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
            </div>
            {badge}
          </div>

          <button
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-5 sm:px-6 py-5 ${bodyClassName}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function ModalButton({ variant = 'ghost', loading = false, className = '', children, ...props }) {
  const styles = {
    primary: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90',
    accent: 'bg-indigo-600 text-white hover:bg-indigo-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    secondary: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
    ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
  };

  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${styles[variant]} ${className}`}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
      )}
      {children}
    </button>
  );
}

// Sub-component for Bank Export
function BankExportModal({ isOpen, onClose, currentFolderId, selectedIds, initialScope }) {
  const [scope, setScope] = useState(initialScope || 'all');
  const [mode, setMode] = useState('questions_and_answers');
  const [format, setFormat] = useState('standard');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialScope) setScope(initialScope);
  }, [initialScope]);

  const handleExport = async () => {
    setLoading(true);
    try {
      let url = `/api/bank/questions/export?mode=${mode}&format=${format}&scope=${scope}`;
      if (scope === 'folder') url += `&folder_id=${currentFolderId}`;
      if (scope === 'selected') url += `&question_ids=${selectedIds.join(',')}`;

      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Export failed');
      }
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Bank_Soal_Export_${new Date().getTime()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      onClose();
    } catch (err) {
      toast.error('Export gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const scopeOptions = [
    { value: 'all', label: 'Seluruh Bank Soal', desc: 'Semua folder dan butir soal', show: true },
    { value: 'folder', label: 'Folder Saat Ini', desc: 'Termasuk semua sub-folder', show: !!currentFolderId },
    { value: 'selected', label: `Soal Terpilih (${selectedIds.length})`, desc: 'Hanya soal yang Anda centang', show: selectedIds.length > 0 },
  ].filter(o => o.show);

  const modeOptions = [
    { value: 'questions_and_answers', label: 'Soal + Jawaban' },
    { value: 'questions_only', label: 'Soal Saja' },
    { value: 'answers_only', label: 'Jawaban Saja' },
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      icon={Download}
      iconClass="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
      title="Ekspor Bank Soal"
      subtitle="Unduh butir soal ke file .docx"
      footer={
        <div className="flex items-center justify-end gap-2">
          <ModalButton variant="ghost" onClick={onClose}>Batal</ModalButton>
          <ModalButton variant="primary" onClick={handleExport} loading={loading}>
            {loading ? 'Menyiapkan File' : 'Unduh File'}
          </ModalButton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Scope Selection */}
        <fieldset>
          <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Cakupan Ekspor</legend>
          <div className="space-y-2">
            {scopeOptions.map(opt => {
              const active = scope === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  aria-pressed={active}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${active
                    ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                >
                  <span className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${active
                    ? 'border-slate-900 dark:border-white'
                    : 'border-slate-300 dark:border-slate-600'
                    }`}>
                    {active && <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{opt.label}</span>
                    <span className="block text-[11px] text-slate-400 truncate">{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Mode */}
        <div>
          <label htmlFor="export-mode" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Tipe Data</label>
          <select
            id="export-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-colors"
          >
            {modeOptions.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Format */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Format Dokumen</span>
          <div className="grid grid-cols-2 gap-2">
            {[{ value: 'standard', label: 'Standard' }, { value: 'rushless', label: 'Rushless' }].map(f => {
              const active = format === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  aria-pressed={active}
                  className={`py-2.5 rounded-lg border text-sm font-semibold transition-colors ${active
                    ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400'
                    }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Sub-component for Import
function BankImportModal({ folderId, isOpen, onClose, onSuccess }) {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/exams');
      const data = await res.json();
      setExams(data.exams || []);
      setLoading(false);
    } catch (e) {
      toast.error('Gagal mengambil daftar ujian');
    }
  };

  const fetchExamQuestions = async (examId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/questions?examId=${examId}`);
      const data = await res.json();
      setExamQuestions(data);
      setLoading(false);
    } catch (e) {
      toast.error('Gagal mengambil soal ujian');
    }
  };

  const handleImport = async () => {
    if (!folderId) {
      toast.error('Tentukan folder tujuan dahulu (Buka folder di bank soal)');
      return;
    }
    if (selectedQuestionIds.length === 0) return;

    setTransferring(true);
    try {
      const res = await fetch('/api/bank/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'exam_to_bank',
          examId: selectedExamId,
          folderId: folderId,
          questionIds: selectedQuestionIds
        })
      });

      if (res.ok) {
        toast.success(`Berhasil mengimpor ${selectedQuestionIds.length} soal`);
        onSuccess();
      } else {
        toast.error('Gagal mentransfer soal');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan transfer');
    } finally {
      setTransferring(false);
    }
  };

  const allExamQuestionsSelected = examQuestions.length > 0 && selectedQuestionIds.length === examQuestions.length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Impor Soal ke Bank"
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} aria-hidden />

      <div className="relative w-full sm:max-w-4xl h-[92vh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Grip mobile */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Upload size={17} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Impor Soal ke Bank</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Salin butir soal dari ujian yang sudah ada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {!folderId && (
          <div className="flex-shrink-0 flex items-start gap-2.5 px-5 sm:px-6 py-3 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Buka folder tujuan terlebih dahulu sebelum melakukan impor soal.
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          {/* Exam List Sidebar */}
          <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto bg-slate-50 dark:bg-slate-950/40">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 px-1">Ujian Sumber</p>

            {loading && exams.length === 0 ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-slate-200/60 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            ) : exams.length === 0 ? (
              <p className="text-xs text-slate-400 px-1 py-4">Belum ada ujian yang bisa diimpor.</p>
            ) : (
              <div className="space-y-1">
                {exams.map(exam => {
                  const active = selectedExamId === exam.id;
                  return (
                    <button
                      key={exam.id}
                      onClick={() => {
                        setSelectedExamId(exam.id);
                        setSelectedQuestionIds([]);
                        fetchExamQuestions(exam.id);
                      }}
                      aria-pressed={active}
                      className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${active
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                      <p className="font-semibold truncate">{exam.exam_name}</p>
                      <p className={`text-[11px] truncate ${active ? 'text-white/70 dark:text-slate-900/70' : 'text-slate-400'}`}>
                        {exam.subject_name || 'Tanpa Pelajaran'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Questions Selection Area */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 min-h-0">
            {!selectedExamId ? (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center">
                <span className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <ArrowLeft size={20} className="text-slate-400" />
                </span>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Pilih ujian di samping</p>
                <p className="text-xs text-slate-400 mt-1">Butir soal akan tampil di sini</p>
              </div>
            ) : loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            ) : examQuestions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">Ujian ini belum memiliki butir soal.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 py-2 mb-1 z-10">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {examQuestions.length} butir soal ditemukan
                  </p>
                  <button
                    onClick={() => {
                      if (allExamQuestionsSelected) setSelectedQuestionIds([]);
                      else setSelectedQuestionIds(examQuestions.map(q => q.id));
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {allExamQuestionsSelected ? 'Batalkan Semua' : 'Pilih Semua'}
                  </button>
                </div>

                {examQuestions.map(q => {
                  const checked = selectedQuestionIds.includes(q.id);
                  return (
                    <label
                      key={q.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked
                        ? 'bg-slate-900 dark:bg-white border-transparent'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                        }`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Pilih soal`}
                        className="w-4 h-4 mt-0.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-900 focus:ring-0 shrink-0"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                          else setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== q.id));
                        }}
                      />
                      <div className="flex-1 min-w-0 pointer-events-none">
                        <div
                          className={`text-sm line-clamp-2 leading-relaxed prose prose-sm max-w-none ${checked ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
                          dangerouslySetInnerHTML={{ __html: q.question_text }}
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedQuestionIds.length}</span> soal terpilih
            {folderId ? ' siap diimpor' : ' · tentukan folder tujuan dulu'}
          </p>
          <div className="flex items-center gap-2">
            <ModalButton variant="ghost" onClick={onClose}>Batal</ModalButton>
            <ModalButton
              variant="success"
              onClick={handleImport}
              loading={transferring}
              disabled={selectedQuestionIds.length === 0 || !folderId}
            >
              {transferring ? 'Memproses' : 'Konfirmasi Impor'}
            </ModalButton>
          </div>
        </div>
      </div>
    </div>
  );
}

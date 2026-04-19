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
  CheckSquare
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
      q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [questions, searchTerm]);

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
      {/* 1. Bagian Judul & Tombol (Akan Tergulung Ke Atas) */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">
                  Bank Soal
                </h1>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-60">
                  Repositori soal mandiri Rushless Exam.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 dark:shadow-none active:scale-95"
              >
                <Download className="w-4 h-4" />
                Impor Soal
              </button>
              <button 
                onClick={() => {
                  setExportScope(currentFolderId ? 'folder' : 'all');
                  setIsExportModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95 border border-indigo-100 dark:border-indigo-800"
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
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Folder Baru
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bagian Navigasi (Akan Tetap Menempel/Sticky) */}
      <div className="sticky top-16 z-20 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full sm:w-auto">
              <button 
                onClick={() => setCurrentFolderId(null)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${!currentFolderId ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                <Home className="w-4 h-4" />
                Root
              </button>
              
              {path.map((folder, idx) => (
                <div key={folder.id} className="flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                  <button 
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${folder.id === currentFolderId ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  >
                    {folder.name}
                  </button>
                </div>
              ))}
            </nav>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Cari soal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold">Memuat data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Folders Grid */}
            {currentFolders.length > 0 && (
              <section>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                  Folders ({currentFolders.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentFolders.map(folder => (
                    <div 
                      key={folder.id}
                      className="group bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-transparent hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100 dark:hover:shadow-none transition-all cursor-pointer relative"
                      onClick={() => setCurrentFolderId(folder.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 transition-transform group-hover:scale-110">
                          <Folder className="w-6 h-6 fill-current" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 dark:text-white truncate">{folder.name}</h3>
                          <p className="text-[10px] text-slate-400 font-medium">Klik untuk buka</p>
                        </div>
                      </div>
                      
                      <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolder(folder);
                              setFolderName(folder.name);
                              setIsFolderModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                         >
                            <Edit className="w-4 h-4" />
                         </button>
                         <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                         >
                            <Trash className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Questions Section */}
            {currentFolderId && (
              <section className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                      Butir Soal ({filteredQuestions.length})
                    </h2>
                    
                    {filteredQuestions.length > 0 && (
                      <button 
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 transition-all border border-slate-200 dark:border-slate-700"
                      >
                        <div className={`w-3 h-3 border-2 rounded-sm transition-all flex items-center justify-center ${selectedQuestionIds.length === filteredQuestions.length ? 'bg-indigo-600 border-indigo-600' : 'bg-transparent border-slate-300'}`}>
                           {selectedQuestionIds.length === filteredQuestions.length && <div className="w-1.5 h-1.5 bg-white rounded-full scale-0 animate-in zoom-in-0 fill-mode-forwards duration-200"></div>}
                        </div>
                        {selectedQuestionIds.length === filteredQuestions.length ? 'Lepas Semua' : 'Pilih Semua'}
                      </button>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => {
                      setEditingQuestion(null);
                      setIsQuestionModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Soal
                  </button>
                </div>

                {filteredQuestions.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full mb-4">
                      <FileText className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-slate-800 dark:text-white font-black uppercase tracking-tight">Folder Kosong</h3>
                    <p className="text-sm text-slate-400 max-w-xs mt-1">Belum ada soal di folder ini. Kamu bisa tambah manual atau impor dari ujian yang sudah ada.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredQuestions.map((question, idx) => (
                      <div 
                        key={question.id}
                        onClick={() => setPreviewQuestion(question)}
                        className={`group relative bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 transition-all cursor-pointer ${selectedQuestionIds.includes(question.id) ? 'border-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-none' : 'border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-lg'}`}
                      >
                        {/* Selector Box */}
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectQuestion(question.id);
                          }}
                          className={`absolute top-6 left-6 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all z-10 ${selectedQuestionIds.includes(question.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-transparent hover:border-indigo-400'}`}
                        >
                          <Check className="w-5 h-5 transition-transform duration-200" style={{ transform: selectedQuestionIds.includes(question.id) ? 'scale(1)' : 'scale(0)' }} />
                        </div>

                        <div className="flex items-start gap-4 pl-12">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2">
                                 <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded text-[9px] font-black uppercase tracking-widest leading-tight">
                                    {question.question_type?.replace(/_/g, ' ')}
                                 </span>
                                 <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                 <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                               </div>
                               <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                                  <Eye className="w-3.5 h-3.5" />
                                  Klik untuk Pratinjau
                               </div>
                            </div>
                            <div 
                              className="text-slate-700 dark:text-slate-300 prose prose-sm max-w-none line-clamp-3 font-semibold"
                              dangerouslySetInnerHTML={{ __html: question.question_text }}
                            />
                            
                            <div className="mt-6 flex items-center justify-between border-t border-slate-50 dark:border-slate-700 pt-4">
                               <div className="text-[10px] font-bold text-slate-400">
                                  Poin: {question.points} | Ditambahkan: {new Date(question.created_at).toLocaleDateString()}
                               </div>
                               <div className="flex items-center gap-1">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingQuestion(question);
                                      setIsQuestionModalOpen(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                    title="Edit Soal"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteQuestion(question.id);
                                    }}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    title="Hapus Soal"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Empty State for Root */}
            {!currentFolderId && currentFolders.length === 0 && (
              <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-full mb-6">
                  <Folder className="w-16 h-16 text-slate-200" />
                </div>
                <h3 className="text-xl text-slate-800 dark:text-white font-black uppercase tracking-tight">Mulai Bangun Perpustakaanmu</h3>
                <p className="text-slate-400 max-w-sm mt-2">Buat folder untuk merapikan soal-soal per mata pelajaran atau topik.</p>
                <button 
                    onClick={() => {
                      setEditingFolder(null);
                      setFolderName('');
                      setIsFolderModalOpen(true);
                    }}
                    className="mt-6 flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Buat Folder Pertama
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsFolderModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">
              {editingFolder ? 'Ubah Folder' : 'Buat Folder Baru'}
            </h2>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Nama Folder</label>
                <input 
                  autoFocus
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full p-4 border-2 border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 dark:text-slate-100"
                  placeholder="Contoh: Matematika Kelas 10"
                />
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsQuestionModalOpen(false)}></div>
           <div className="relative bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-white/20">
              <div className="px-10 py-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        {editingQuestion ? 'Sunting Butir Soal' : 'Tambah Soal ke Bank'}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest opacity-60">Repositori Bank Soal Rushless</p>
                 </div>
                 <button onClick={() => setIsQuestionModalOpen(false)} className="p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all">
                    <X className="w-6 h-6" />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar">
                 <BankQuestionForm 
                    folderId={currentFolderId}
                    initialData={editingQuestion}
                    onSave={() => {
                        setIsQuestionModalOpen(false);
                        fetchData();
                    }}
                    onCancel={() => setIsQuestionModalOpen(false)}
                 />
              </div>
           </div>
        </div>
      )}

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
      {previewQuestion && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setPreviewQuestion(null)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/10 animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-10 py-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
                  <Eye className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Pratinjau Butir Soal</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                      {previewQuestion.question_type?.replace(/_/g, ' ')}
                    </span>
                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{previewQuestion.points} POIN</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setPreviewQuestion(null)} className="p-3 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 rounded-2xl text-slate-400 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar bg-white dark:bg-slate-900">
              <div className="space-y-10">
                {/* Question Text */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 p-8 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pertanyaan:</p>
                  <div 
                    className="text-lg md:text-xl text-slate-800 dark:text-slate-200 font-bold leading-relaxed prose prose-indigo dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewQuestion.question_text }}
                  />
                </div>

                {/* Options / Answer Area */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Editor Jawaban & Kunci:</p>
                  
                  {/* Multiple Choice / Complex */}
                  {(previewQuestion.question_type === 'multiple_choice' || previewQuestion.question_type === 'multiple_choice_complex') && (
                    <div className="grid grid-cols-1 gap-3">
                      {Object.entries(typeof previewQuestion.options === 'string' ? JSON.parse(previewQuestion.options) : (previewQuestion.options || {})).map(([key, value]) => {
                        const isCorrect = previewQuestion.question_type === 'multiple_choice' 
                          ? previewQuestion.correct_option === key
                          : previewQuestion.correct_option?.split(',').includes(key);

                        return (
                          <div 
                            key={key}
                            className={`flex items-start gap-4 p-5 rounded-2xl border-2 transition-all ${isCorrect ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500 ring-4 ring-emerald-500/5' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800'}`}
                          >
                            <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center font-black text-xs ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                              {key}
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                              <div className={`text-base font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`} dangerouslySetInnerHTML={{ __html: value }} />
                            </div>
                            {isCorrect && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                                <CheckSquare className="w-3 h-3" />
                                Kunci Jawaban
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True / False */}
                  {previewQuestion.question_type === 'true_false' && (
                     <div className="grid grid-cols-2 gap-4">
                        {['Benar', 'Salah'].map((val) => {
                           const isCorrect = previewQuestion.correct_option === val;
                           return (
                              <div key={val} className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center gap-4 transition-all ${isCorrect ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-500 ring-4 ring-emerald-500/5' : 'bg-slate-50 dark:bg-slate-800 border-transparent'}`}>
                                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${isCorrect ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-white dark:bg-slate-700 text-slate-400'}`}>
                                    {val === 'Benar' ? 'B' : 'S'}
                                 </div>
                                 <span className={`font-black uppercase tracking-widest ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 text-xs'}`}>{val}</span>
                                 {isCorrect && <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">KUNCI JAWABAN</span>}
                              </div>
                           );
                        })}
                     </div>
                  )}

                  {/* Essay */}
                  {previewQuestion.question_type === 'essay' && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Contoh Jawaban / Kunci:</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 font-bold leading-relaxed italic">
                        {previewQuestion.correct_option || 'Tidak ada kunci jawaban spesifik untuk uraian.'}
                      </div>
                    </div>
                  )}

                  {/* Matching */}
                  {previewQuestion.question_type === 'matching' && (
                    <div className="space-y-4">
                      {Object.entries(typeof previewQuestion.options === 'string' ? JSON.parse(previewQuestion.options) : (previewQuestion.options || {})).map(([left, right], i) => (
                        <div key={i} className="flex items-center gap-4">
                           <div className="flex-1 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                              {left}
                           </div>
                           <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-700 relative">
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 bg-slate-300 rounded-full"></div>
                           </div>
                           <div className="flex-1 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                              {right}
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-10 py-6 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setPreviewQuestion(null);
                  setEditingQuestion(previewQuestion);
                  setIsQuestionModalOpen(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95"
              >
                <Edit className="w-4 h-4" />
                Edit Soal
              </button>
              <button 
                onClick={() => setPreviewQuestion(null)}
                className="px-8 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedQuestionIds.length > 0 && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] animate-in slide-in-from-bottom-10 duration-500 flex items-center gap-6 px-8 py-4 bg-slate-900/90 dark:bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl text-white">
            <div className="flex items-center gap-3 border-r border-white/10 pr-6 mr-2">
               <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-black shadow-lg">
                  {selectedQuestionIds.length}
               </div>
               <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/40">Terpilih</p>
                  <p className="text-[10px] font-bold text-white/80 leading-none">Butir Soal</p>
               </div>
            </div>

            <div className="flex items-center gap-2">
                 <button 
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-900/20"
               >
                  <Trash className="w-4 h-4" />
                   Hapus Massal
               </button>
               <button 
                  onClick={() => {
                    setExportScope('selected');
                    setIsExportModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-900/20"
               >
                  <Download className="w-4 h-4" />
                  Ekspor Terpilih
               </button>
               <button 
                  onClick={() => setSelectedQuestionIds([])}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
               >
                  Batal
               </button>
            </div>
         </div>
      )}
    </div>
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Ekspor Bank Soal</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Scope Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cakupan Ekspor</label>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => setScope('all')}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${scope === 'all' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-slate-100 dark:border-slate-700 text-slate-500 hover:border-slate-200'}`}
              >
                <div className="flex flex-col items-start">
                  <span className="font-bold text-sm">Seluruh Bank Soal</span>
                  <span className="text-[10px] opacity-70">Semua folder dan butir soal</span>
                </div>
                {scope === 'all' && <Check className="w-5 h-5" />}
              </button>
              
              {currentFolderId && (
                <button 
                  onClick={() => setScope('folder')}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${scope === 'folder' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-slate-100 dark:border-slate-700 text-slate-500 hover:border-slate-200'}`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-sm">Folder Saat Ini</span>
                    <span className="text-[10px] opacity-70">Termasuk semua sub-folder</span>
                  </div>
                  {scope === 'folder' && <Check className="w-5 h-5" />}
                </button>
              )}

              {selectedIds.length > 0 && (
                <button 
                  onClick={() => setScope('selected')}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${scope === 'selected' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-slate-100 dark:border-slate-700 text-slate-500 hover:border-slate-200'}`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-sm">Soal Terpilih ({selectedIds.length})</span>
                    <span className="text-[10px] opacity-70">Hanya soal yang Anda centang</span>
                  </div>
                  {scope === 'selected' && <Check className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>

          {/* Mode & Format Selection Area */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
             <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe Data</label>
                <select 
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all dark:text-white"
                >
                  <option value="questions_and_answers">Soal + Jawaban</option>
                  <option value="questions_only">Soal Saja</option>
                  <option value="answers_only">Jawaban Saja</option>
                </select>
             </div>

             <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Format Dokumen</label>
                <div className="flex gap-2">
                   <button 
                      onClick={() => setFormat('standard')}
                      className={`flex-1 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-tight transition-all ${format === 'standard' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}
                   >
                      Standard
                   </button>
                   <button 
                      onClick={() => setFormat('rushless')}
                      className={`flex-1 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-tight transition-all ${format === 'rushless' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}
                   >
                      Rushless
                   </button>
                </div>
             </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
            >
              Batal
            </button>
            <button 
              onClick={handleExport}
              disabled={loading}
              className="flex-1 py-4 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-indigo-300"
            >
              {loading ? 'Exporting...' : 'Unduh File'}
            </button>
          </div>
        </div>
      </div>
    </div>
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Download className="w-6 h-6" />
               </div>
               <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Impor Soal ke Bank</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all active:scale-95"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Exam List Sidebar */}
            <div className="w-full md:w-80 border-r border-slate-100 dark:border-slate-800 p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50 no-scrollbar">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Pilih Ujian Sumber:</p>
                <div className="space-y-2">
                   {exams.map(exam => (
                      <button 
                        key={exam.id}
                        onClick={() => {
                          setSelectedExamId(exam.id);
                          setSelectedQuestionIds([]);
                          fetchExamQuestions(exam.id);
                        }}
                        className={`w-full text-left p-3 rounded-xl text-sm font-bold transition-all border-2 ${selectedExamId === exam.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                      >
                         <p className="truncate">{exam.exam_name}</p>
                         <p className={`text-[10px] opacity-70 ${selectedExamId === exam.id ? 'text-white' : 'text-slate-400'}`}>{exam.subject_name || 'Tanpa Pelajaran'}</p>
                      </button>
                   ))}
                </div>
            </div>

            {/* Questions Selection Area */}
            <div className="flex-1 p-6 overflow-y-auto no-scrollbar bg-white dark:bg-slate-950">
                {!selectedExamId ? (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                      <ArrowLeft className="w-12 h-12 mb-4 animate-bounce-x" />
                      <p className="font-bold">Pilih ujian di sebelah kiri</p>
                   </div>
                ) : loading ? (
                   <div className="h-full flex items-center justify-center font-bold text-slate-400 animate-pulse">Memuat soal...</div>
                ) : (
                   <div className="space-y-4">
                      <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-slate-950 py-2 z-10 border-b border-slate-50 dark:border-slate-900/50">
                         <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{examQuestions.length} Butir Soal Ditemukan</p>
                         <button 
                            onClick={() => {
                               if (selectedQuestionIds.length === examQuestions.length) setSelectedQuestionIds([]);
                               else setSelectedQuestionIds(examQuestions.map(q => q.id));
                            }}
                            className="text-[10px] font-bold text-indigo-600"
                         >
                            {selectedQuestionIds.length === examQuestions.length ? 'Batal Semua' : 'Pilih Semua'}
                         </button>
                      </div>
                      {examQuestions.map(q => (
                         <label key={q.id} className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedQuestionIds.includes(q.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-500 shadow-md ring-4 ring-indigo-500/5' : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 mt-1 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-0"
                              checked={selectedQuestionIds.includes(q.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                                else setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== q.id));
                              }}
                            />
                            <div className="flex-1 min-w-0 pointer-events-none">
                               <div className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-bold" dangerouslySetInnerHTML={{ __html: q.question_text }} />
                            </div>
                         </label>
                      ))}
                   </div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
            <div className="text-xs font-bold text-slate-400">
               {selectedQuestionIds.length} soal terpilih untuk dimasukkan ke folder ini.
            </div>
            <div className="flex gap-4">
               <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">Batal</button>
               <button 
                  disabled={selectedQuestionIds.length === 0 || transferring || !folderId}
                  onClick={handleImport}
                  className="px-8 py-2.5 bg-emerald-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
               >
                  {transferring ? 'Sedang Memproses...' : (
                    <>
                      <Plus className="w-4 h-4" />
                      Konfirmasi Impor
                    </>
                  )}
               </button>
            </div>
        </div>
      </div>
    </div>
  );
}

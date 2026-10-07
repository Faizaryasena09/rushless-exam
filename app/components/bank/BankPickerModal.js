'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Folder, 
  ChevronRight, 
  Plus, 
  Search, 
  FileText,
  Home,
  X,
  Check,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';

export default function BankPickerModal({ isOpen, onClose, onSelect, examId }) {
  const [folders, setFolders] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [path, setPath] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, currentFolderId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const foldersRes = await fetch('/api/bank/folders');
      const foldersData = await foldersRes.json();
      setFolders(foldersData);

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

  // Breadcrumbs logic
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

  const handleImport = async () => {
    if (selectedQuestionIds.length === 0) return;
    setTransferring(true);
    try {
      const res = await fetch('/api/bank/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bank_to_exam',
          examId: examId,
          questionIds: selectedQuestionIds
        })
      });

      if (res.ok) {
        toast.success(`Berhasil menambahkan ${selectedQuestionIds.length} soal ke ujian`);
        onSelect(); // Trigger refresh on parent
        onClose();
      } else {
        toast.error('Gagal mentransfer soal');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan transfer');
    } finally {
      setTransferring(false);
    }
  };

  if (!isOpen) return null;

return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white dark:bg-slate-900 w-full sm:max-w-5xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Ambil dari Bank Soal</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Centang soal yang ingin disalin ke ujian ini.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Explorer Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Folder Navigation Sidebar */}
            <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900/40 max-h-48 md:max-h-none">
                <div className="p-3">
                    <button
                       onClick={() => setCurrentFolderId(null)}
                       className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${!currentFolderId ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                       <Home className="w-4 h-4" />
                       Semua Folder
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
                    <div className="space-y-1">
                       {currentFolders.map(folder => (
                          <button 
                            key={folder.id}
                            onClick={() => setCurrentFolderId(folder.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${currentFolderId === folder.id ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                          >
                             <span className="flex items-center gap-2 min-w-0">
                                <Folder className="w-4 h-4 shrink-0 opacity-60" />
                                <span className="truncate">{folder.name}</span>
                             </span>
                             <ChevronRight className="w-4 h-4 shrink-0 opacity-40" />
                          </button>
                       ))}
                       {currentFolders.length === 0 && !loading && (
                          <p className="text-xs text-slate-400 py-6 text-center">Tidak ada sub-folder</p>
                       )}
                    </div>
                </div>
            </div>

            {/* Questions Selection Area */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 min-h-0">
               {/* Search & Path */}
               <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
                  <nav className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-0 overflow-x-auto no-scrollbar">
                     <button onClick={() => setCurrentFolderId(null)} className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">Bank Soal</button>
                     {path.map(p => (
                        <span key={p.id} className="flex items-center gap-1">
                           <ChevronRight className="w-3 h-3 shrink-0" />
                           <button onClick={() => setCurrentFolderId(p.id)} className="hover:text-slate-900 dark:hover:text-white transition-colors max-w-[120px] truncate whitespace-nowrap">{p.name}</button>
                        </span>
                     ))}
                  </nav>
                  <div className="relative w-full sm:w-60 shrink-0">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                       type="text" 
                       placeholder="Cari butir soal..."
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       aria-label="Cari soal di bank"
                       className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
                     />
                  </div>
               </div>

               {/* Questions List */}
               <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {!currentFolderId ? (
                     <div className="h-full flex flex-col items-center justify-center text-center py-16">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                           <Folder className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Pilih folder dulu</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">Pilih folder di sebelah kiri untuk melihat daftar soal yang tersedia.</p>
                     </div>
                  ) : loading ? (
                     <div className="space-y-2">
                        {[0, 1, 2].map(i => (
                           <div key={i} className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        ))}
                     </div>
                  ) : filteredQuestions.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-center py-16">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                           <FileText className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Folder ini belum memiliki soal{searchTerm ? ' yang cocok dengan pencarian' : ''}.</p>
                     </div>
                  ) : (
                     <div className="space-y-2">
                        {filteredQuestions.map(q => {
                           const isSelected = selectedQuestionIds.includes(q.id);
                           return (
                              <label 
                                key={q.id} 
                                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-slate-900 dark:bg-white border-transparent text-white dark:text-slate-900' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
                              >
                                 <span className={`shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'border-white dark:border-slate-900' : 'border-slate-300 dark:border-slate-600'}`}>
                                    {isSelected && <Check className="w-3 h-3" strokeWidth={4} />}
                                 </span>
                                 <input 
                                   type="checkbox" 
                                   className="hidden"
                                   checked={isSelected}
                                   onChange={(e) => {
                                     if (e.target.checked) setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                                     else setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== q.id));
                                   }}
                                 />
                                 <span className="flex-1 min-w-0">
                                    <span className={`block text-[10px] font-semibold uppercase tracking-wide mb-1 ${isSelected ? 'opacity-80' : 'text-slate-400'}`}>
                                       {q.question_type?.replace(/_/g, ' ')}
                                    </span>
                                    <span 
                                       className={`block text-sm leading-relaxed line-clamp-2 ${isSelected ? '' : 'text-slate-700 dark:text-slate-300'}`} 
                                       dangerouslySetInnerHTML={{ __html: q.question_text }} 
                                    />
                                 </span>
                              </label>
                           );
                        })}
                     </div>
                  )}
               </div>
            </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex flex-col">
               <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{selectedQuestionIds.length} soal dipilih</span>
               <span className="text-[11px] text-slate-400">Soal disalin dari bank, tidak berpindah.</span>
            </div>
            
            <div className="flex items-center gap-2">
               <button 
                  onClick={onClose} 
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
               >
                  Batal
               </button>
               <button 
                  disabled={selectedQuestionIds.length === 0 || transferring}
                  onClick={handleImport}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
               >
                  {transferring && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white dark:border-slate-900/40 dark:border-t-slate-900 rounded-full animate-spin" />}
                  {transferring ? 'Memproses...' : 'Tambahkan ke Ujian'}
               </button>
            </div>
        </div>
      </div>
    </div>
  );
};
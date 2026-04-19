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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-3xl overflow-hidden flex flex-col border border-white/20">
        {/* Header */}
        <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
           <div>
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                    <FileText className="w-6 h-6" />
                 </div>
                 <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Ambil dari Bank Soal</h2>
              </div>
              <p className="text-sm text-slate-400 font-bold mt-1 ml-14 uppercase tracking-widest opacity-60">Pilih soal untuk ditambahkan ke ujian ini</p>
           </div>
           <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-slate-400 transition-all">
              <X className="w-6 h-6" />
           </button>
        </div>

        {/* Content Explorer Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Folder Navigation Sidebar */}
            <div className="w-full md:w-80 border-r border-slate-100 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-900/30">
                <div className="p-6">
                    <button 
                       onClick={() => setCurrentFolderId(null)}
                       className={`w-full flex items-center gap-3 p-4 rounded-2xl font-black uppercase tracking-tight text-sm transition-all shadow-sm ${!currentFolderId ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50'}`}
                    >
                       <Home className="w-5 h-5" />
                       Semua Folder
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                    <div className="space-y-1">
                       {currentFolders.map(folder => (
                          <button 
                            key={folder.id}
                            onClick={() => setCurrentFolderId(folder.id)}
                            className="w-full flex items-center justify-between p-4 rounded-2xl text-slate-600 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border-2 border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all text-sm group"
                          >
                             <div className="flex items-center gap-3">
                                <Folder className="w-4 h-4 text-indigo-500 fill-current opacity-40 group-hover:opacity-100" />
                                <span className="truncate">{folder.name}</span>
                             </div>
                             <ChevronRight className="w-4 h-4 opacity-30" />
                          </button>
                       ))}
                       {currentFolders.length === 0 && !loading && (
                          <div className="py-10 text-center opacity-30 px-4">
                             <Folder className="w-10 h-10 mx-auto mb-2" />
                             <p className="text-[10px] font-black uppercase tracking-widest">Tidak ada sub-folder</p>
                          </div>
                       )}
                    </div>
                </div>
            </div>

            {/* Questions Selection Area */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-950">
                {/* Search & Path */}
                <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-950 sticky top-0 z-10">
                   <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                      <nav className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                         <button onClick={() => setCurrentFolderId(null)} className="hover:text-indigo-600 transition-colors">ROOT</button>
                         {path.map(p => (
                            <div key={p.id} className="flex items-center gap-1">
                               <ChevronRight className="w-3 h-3" />
                               <button onClick={() => setCurrentFolderId(p.id)} className="hover:text-indigo-600 transition-colors max-w-[100px] truncate">{p.name}</button>
                            </div>
                         ))}
                      </nav>
                   </div>
                   <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Cari butir soal..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-indigo-400 rounded-2xl text-xs font-bold outline-none transition-all"
                      />
                   </div>
                </div>

                {/* Questions List */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {!currentFolderId ? (
                       <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30">
                          <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-full mb-6 ring-4 ring-slate-100 dark:ring-slate-900">
                             <Folder className="w-16 h-16 text-slate-400" />
                          </div>
                          <h3 className="text-xl font-black uppercase tracking-tight mb-2">Pilih Folder</h3>
                          <p className="max-w-xs text-sm font-bold">Silakan pilih folder di sebelah kiri untuk melihat daftar soal yang tersedia.</p>
                       </div>
                    ) : loading ? (
                       <div className="h-full flex items-center justify-center gap-2 text-slate-400 font-black uppercase tracking-widest text-xs">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                       </div>
                    ) : filteredQuestions.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                          <FileText className="w-12 h-12 mb-4" />
                          <p className="font-bold">Folder ini belum memiliki soal</p>
                       </div>
                    ) : (
                       <div className="space-y-4">
                          {filteredQuestions.map(q => (
                             <label 
                               key={q.id} 
                               className={`flex items-start gap-6 p-6 rounded-[2rem] border-2 transition-all cursor-pointer relative group ${selectedQuestionIds.includes(q.id) ? 'bg-indigo-600 border-indigo-600 shadow-2xl shadow-indigo-200 ring-8 ring-indigo-500/5' : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                             >
                                <div className={`w-8 h-8 mt-1 flex-shrink-0 flex items-center justify-center rounded-xl border-2 transition-all ${selectedQuestionIds.includes(q.id) ? 'bg-white border-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                   {selectedQuestionIds.includes(q.id) ? (
                                      <Check className="w-5 h-5 text-indigo-600 stroke-[4px]" />
                                   ) : (
                                      <div className="w-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full group-hover:scale-150 transition-all"></div>
                                   )}
                                </div>
                                <input 
                                  type="checkbox" 
                                  className="hidden"
                                  checked={selectedQuestionIds.includes(q.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                                    else setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== q.id));
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                   <div className={`text-[9px] font-black uppercase tracking-[0.2em] mb-3 px-2 py-0.5 inline-block rounded ${selectedQuestionIds.includes(q.id) ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                                      {q.question_type?.replace(/_/g, ' ')}
                                   </div>
                                   <div 
                                      className={`text-sm leading-relaxed font-bold line-clamp-2 ${selectedQuestionIds.includes(q.id) ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`} 
                                      dangerouslySetInnerHTML={{ __html: q.question_text }} 
                                   />
                                </div>
                             </label>
                          ))}
                       </div>
                    )}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex flex-col">
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Terpilih ({selectedQuestionIds.length}) Butir</span>
               <p className="text-[10px] text-slate-400 font-bold max-w-[200px]">Soal akan diduplikasi dari bank ke ujian ini.</p>
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
               <button 
                  onClick={onClose} 
                  className="px-8 py-3 text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all rounded-2xl"
               >
                  Batal
               </button>
               <button 
                  disabled={selectedQuestionIds.length === 0 || transferring}
                  onClick={handleImport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-12 py-4 bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95"
               >
                  {transferring ? 'Sedang Memproses...' : 'Tambahkan Sekarang'}
               </button>
            </div>
        </div>
      </div>
    </div>
  );
}

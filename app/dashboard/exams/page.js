'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// --- Icons ---
const Icons = {
  Plus: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  ChevronRight: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>,
  Calendar: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  FileText: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Play: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ChartBar: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Cog: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Duplicate: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Folder: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  ChevronDown: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>,
  DotsVertical: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>,
  Eye: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
};

// --- Student Action Button Component ---
const StudentExamActions = ({ exam }) => {
// ...
// [Lines 21-135 unchanged, keep them as is and only match the start/end lines properly]
// ...
  return (
    <Link href={`/dashboard/exams/kerjakan/${exam.id}`} className="group w-full flex items-center justify-between text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors">
      <div className="flex items-center gap-2">
        <Icons.Play />
        <span>{exam.require_seb ? 'Mulai dengan SEB' : 'Mulai Kerjakan'}</span>
      </div>
      <Icons.ChevronRight className="transition-transform group-hover:translate-x-1" />
    </Link>
  );
};

// --- Exam Card Component ---
const ExamCard = ({ exam, isStudent, formatDate, openModal, categories, onToggleVisibility }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 flex flex-col">
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate flex items-center gap-2" title={exam.exam_name}>
          <span>{exam.exam_name}</span>
          {exam.exam_is_hidden && <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-700 rounded-full">Hidden</span>}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 h-10 overflow-hidden">{exam.description || 'No description provided.'}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icons.Calendar />
            <span>Created on {formatDate(exam.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="mt-auto border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-700/30 rounded-b-2xl">
        {isStudent ? (
          <StudentExamActions exam={exam} />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/dashboard/exams/manage/${exam.id}`} className="group flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 py-2 px-3 rounded-lg transition-colors">
                <Icons.Cog />
                <span>Manage</span>
              </Link>
              <Link href={`/dashboard/exams/results/${exam.id}`} className="group flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 py-2 px-3 rounded-lg transition-colors">
                <Icons.ChartBar />
                <span>Results</span>
              </Link>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-600/50 relative group/menu">
              <button onClick={() => openModal('duplicate', exam.id)} className="flex-1 flex items-center justify-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 py-1.5 px-2 rounded-lg transition-colors">
                <Icons.Duplicate />
                <span>Duplicate</span>
              </button>
              
              {/* Exam Actions Dropdown Trigger (Moves & Delete) */}
              <div className="flex-1 relative">
                  <button className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 py-1.5 px-2 rounded-lg transition-colors peer">
                      <Icons.DotsVertical />
                      <span>Lainnya</span>
                  </button>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 opacity-0 invisible scale-95 peer-hover:opacity-100 peer-hover:visible peer-hover:scale-100 hover:opacity-100 hover:visible hover:scale-100 transition-all origin-bottom-right z-10">
                      <div className="p-1">
                          <button 
                              onClick={() => onToggleVisibility && onToggleVisibility()}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                          >
                              {exam.exam_is_hidden ? <><Icons.Eye /><span>Tampilkan Ujian</span></> : <><Icons.EyeOff /><span>Sembunyikan Ujian</span></>}
                          </button>
                          <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2"></div>
                          <button 
                              onClick={() => openModal('moveExam', exam.id, exam.category_id || '')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                          >
                              <Icons.Folder />
                              <span>Pindahkan Kategori</span>
                          </button>
                          <div className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2"></div>
                          <button 
                              onClick={() => openModal('delete', exam.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                          >
                              <Icons.Trash />
                              <span>Hapus Ujian</span>
                          </button>
                      </div>
                  </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Category Accordion Component ---
const CategoryAccordion = ({ id, name, exams, isOpen, toggleOpen, isStudent, formatDate, openModal, categories, onEdit, onDelete, onToggleVisibility, isHidden, onToggleExamVisibility }) => {
    // Hide 'Tanpa Nama' (uncategorized) if there are no uncategorized exams AND user has categories
    if (id === 'uncategorized' && exams.length === 0 && categories.length > 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Accordion Header */}
            <div 
                className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors select-none"
                onClick={toggleOpen}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                        <Icons.ChevronDown />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            {name}
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                {exams.length}
                            </span>
                            {id !== 'uncategorized' && !isStudent && isHidden && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                                    Hidden
                                </span>
                            )}
                        </h2>
                    </div>
                </div>
                
                {/* Category Actions (Only show for custom categories, not 'Tanpa Nama') */}
                {id !== 'uncategorized' && !isStudent && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation() /* Prevent accordion toggle */}>
                        <button 
                            onClick={onToggleVisibility}
                            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title={isHidden ? "Tampilkan Kategori" : "Sembunyikan Kategori"}
                        >
                            {isHidden ? <Icons.Eye /> : <Icons.EyeOff />}
                        </button>
                        <button 
                            onClick={onEdit}
                            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="Ubah Nama"
                        >
                            <Icons.Cog />
                        </button>
                        <button 
                            onClick={onDelete}
                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Hapus Kategori"
                        >
                            <Icons.Trash />
                        </button>
                    </div>
                )}
            </div>

            {/* Accordion Body */}
            <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="p-6 pt-2 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/20">
                        {exams.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada ujian di kategori ini.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {exams.map((exam) => (
                                     <ExamCard 
                                         key={exam.id} 
                                         exam={exam} 
                                         isStudent={isStudent} 
                                         formatDate={formatDate} 
                                         openModal={openModal} 
                                         categories={categories} 
                                         onToggleVisibility={() => onToggleExamVisibility(exam.id, exam.exam_is_hidden)}
                                     />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function ExamsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  const [exams, setExams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [errorExams, setErrorExams] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // To trigger re-fetch

  // Accordion state
  const [openCategories, setOpenCategories] = useState({});

  // Modal State
  const [modalState, setModalState] = useState({
    type: null, // 'duplicate' | 'delete' | 'categoryManage' | 'categoryDelete' | 'moveExam'
    examId: null, // for duplicate/delete/move
    categoryId: null, // for categoryDelete/edit
    categoryName: '', // for categoryEdit
    isOpen: false
  });

  // Session check and role fetching logic
// ...
// [Lines 154-169 unchanged logic, we just need to place new methods above useEffect]
// ...
  const toggleCategory = (categoryId) => {
    setOpenCategories(prev => ({
        ...prev,
        [categoryId]: !prev[categoryId]
    }));
  };

  const openModal = (type, examId = null, categoryId = null, categoryName = '') => {
    setModalState({ type, examId, categoryId, categoryName, isOpen: true });
  };

  const closeModal = () => {
    setModalState({ type: null, examId: null, categoryId: null, categoryName: '', isOpen: false });
  };

  const handleToggleVisibility = async (type, id, currentState) => {
    try {
      const endpoint = type === 'exam' ? '/api/exams/toggle-visibility' : '/api/exams/categories/toggle-visibility';
      const body = type === 'exam' ? { examId: id, isHidden: !currentState } : { categoryId: id, isHidden: !currentState };
      
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) throw new Error((await res.json()).message);
      refreshData();
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/user-session');
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        if (!data.user) throw new Error('User data not found in session');
        console.log('Session data:', data);
        setUserRole(data.user.roleName); // Store user role
      } catch (error) {
        router.push('/');
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
  }, [router]);

  // Fetch exams logic with polling
  useEffect(() => {
    if (loadingSession) return;

    let isMounted = true;

    async function fetchData() {
      try {
        const [examsRes, categoriesRes] = await Promise.all([
            fetch('/api/exams'),
            (userRole !== 'student') ? fetch('/api/exams/categories') : Promise.resolve(null)
        ]);

        if (!examsRes.ok) {
          const data = await examsRes.json();
          throw new Error(data.message || 'Failed to fetch exams');
        }
        const examsData = await examsRes.json();
        
        let categoriesData = { categories: [] };
        if (categoriesRes && categoriesRes.ok) {
            categoriesData = await categoriesRes.json();
        }

        if (isMounted) {
          setExams(examsData.exams);
          
          let fetchedCategories = categoriesData.categories;

          if (userRole === 'student') {
              // Extract unique categories from exams
              const studentCategoriesMap = new Map();
              examsData.exams.forEach(e => {
                  if (e.category_id !== null) {
                      studentCategoriesMap.set(e.category_id, e.category_name);
                  }
              });
              fetchedCategories = Array.from(studentCategoriesMap.entries()).map(([id, name]) => ({ id, name }));
          } else {
              // Create a lookup for category is_hidden for teachers
              const catHiddenMap = fetchedCategories.reduce((acc, cat) => {
                  acc[cat.id] = cat.is_hidden ? 1 : 0;
                  return acc;
              }, {});
              
              // Map it back to the state so we can pass it to the accordions
              fetchedCategories = fetchedCategories.map(cat => ({
                  ...cat,
                  isHidden: !!catHiddenMap[cat.id]
              }));
          }

          setCategories(fetchedCategories);
          
          // Initialize accordion state: default open first category and 'Tanpa Nama'
          setOpenCategories(prev => {
              if (Object.keys(prev).length === 0) {
                  const initialOpen = { 'uncategorized': true };
                  if (fetchedCategories.length > 0) {
                      initialOpen[fetchedCategories[0].id] = true;
                  }
                  return initialOpen;
              }
              return prev;
          });

          setLoadingExams(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to fetch data:", err);
          if (loadingExams) {
            setErrorExams(err.message);
            setLoadingExams(false);
          }
        }
      }
    }

    fetchData(); // Initial fetch
    const intervalId = setInterval(fetchData, 5000); // Poll every 5 seconds

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [loadingSession, loadingExams, isRefreshing]);

  const refreshData = () => {
    setIsRefreshing(prev => !prev);
  };

  const executeAction = async () => {
    const { type, examId, categoryId, categoryName } = modalState;
    if (!type) return;

    try {
      let res;
      if (type === 'duplicate') {
        res = await fetch('/api/exams/duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examId })
        });
      } else if (type === 'delete') {
        res = await fetch(`/api/exams?id=${examId}`, {
          method: 'DELETE'
        });
      } else if (type === 'categoryManage') {
         if (categoryId) {
             // Rename Category
             res = await fetch(`/api/exams/categories`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ id: categoryId, name: categoryName })
             });
         } else {
             // Create Category
             res = await fetch(`/api/exams/categories`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ name: categoryName })
             });
         }
      } else if (type === 'categoryDelete') {
          res = await fetch(`/api/exams/categories?id=${categoryId}`, {
              method: 'DELETE'
          });
      } else if (type === 'moveExam') {
          res = await fetch(`/api/exams/move-category`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ examId, categoryId })
          });
      }

      if (!res.ok) throw new Error((await res.json()).message);

      refreshData();
      closeModal();
    } catch (e) {
      alert(e.message);
      closeModal();
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const isStudent = userRole === 'student';

  if (loadingSession || loadingExams) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold text-slate-600 dark:text-slate-400 animate-pulse">Loading Exams...</p>
      </div>
    );
  }

  if (errorExams) {
    return <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium text-center">Error: {errorExams}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{isStudent ? 'Available Exams' : 'Manage Exams'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            You have {exams.length} exams available.
          </p>
        </div>
        {!isStudent && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => openModal('categoryManage')}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-all border border-slate-200 dark:border-slate-700"
            >
              <Icons.Folder />
              <span className="hidden sm:inline">Kategori</span>
            </button>
            <Link
              href="/dashboard/exams/baru"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/30"
            >
              <Icons.Plus />
              <span className="hidden sm:inline">Buat Ujian</span>
            </Link>
          </div>
        )}
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          <Icons.FileText className="mx-auto w-12 h-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-white">No Exams Found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{isStudent ? 'There are no exams available for you at the moment.' : 'Click "Buat Ujian" to get started.'}</p>
        </div>
      ) : (
          <div className="space-y-6">
            {/* Tanpa Nama Category (Uncategorized) */}
            <CategoryAccordion
              id="uncategorized"
              name="Tanpa Nama"
              exams={exams.filter(e => e.category_id == null)}
              isOpen={openCategories['uncategorized']}
              toggleOpen={() => toggleCategory('uncategorized')}
              isStudent={isStudent}
              formatDate={formatDate}
              openModal={openModal}
              categories={categories}
              isHidden={false}
              onToggleExamVisibility={(id, current) => handleToggleVisibility('exam', id, current)}
            />

            {/* User Created Categories */}
            {categories.map(cat => (
              <CategoryAccordion
                key={cat.id}
                id={cat.id}
                name={cat.name}
                exams={exams.filter(e => e.category_id === cat.id)}
                isOpen={openCategories[cat.id]}
                toggleOpen={() => toggleCategory(cat.id)}
                isStudent={isStudent}
                formatDate={formatDate}
                openModal={openModal}
                categories={categories}
                isHidden={cat.isHidden}
                onToggleVisibility={(e) => { e.stopPropagation(); handleToggleVisibility('category', cat.id, cat.isHidden); }}
                onToggleExamVisibility={(id, current) => handleToggleVisibility('exam', id, current)}
                onEdit={(e) => { e.stopPropagation(); openModal('categoryManage', null, cat.id, cat.name); }}
                onDelete={(e) => { e.stopPropagation(); openModal('categoryDelete', null, cat.id); }}
              />
            ))}
          </div>
      )}

      {/* Modals */}
      {/* Category List & Create Modal */}
      {modalState.isOpen && modalState.type === 'categoryManage' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Icons.Folder />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {modalState.categoryId ? 'Ubah Nama Kategori' : 'Kategori Ujian'}
                </h3>
              </div>
              
              <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Kategori</label>
                  <input 
                      type="text" 
                      value={modalState.categoryName}
                      onChange={(e) => setModalState(prev => ({ ...prev, categoryName: e.target.value }))}
                      placeholder="Masukkan nama kategori baru"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                      autoFocus
                  />
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={closeModal} className="px-4 py-2 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  Batal
                </button>
                <button onClick={executeAction} disabled={!modalState.categoryName.trim()} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Exam Modal */}
      {modalState.isOpen && modalState.type === 'moveExam' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Icons.Folder />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pindahkan Ujian</h3>
              </div>
              
              <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pilih Kategori Tujuan</label>
                  <select 
                      value={modalState.categoryId || ''}
                      onChange={(e) => setModalState(prev => ({ ...prev, categoryId: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                      <option value="">Tanpa Nama</option>
                      {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={closeModal} className="px-4 py-2 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  Batal
                </button>
                <button onClick={executeAction} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-lg shadow-md transition-all">
                  Pindahkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={modalState.isOpen && modalState.type === 'categoryDelete'}
        onClose={closeModal}
        onConfirm={executeAction}
        title="Hapus Kategori"
        message="Apakah Anda yakin ingin menghapus kategori ini? Ujian di dalamnya tidak akan terhapus dan akan berpindah ke 'Tanpa Nama'."
        confirmText="Hapus"
        confirmColor="bg-red-600 hover:bg-red-700"
        icon={() => <Icons.Trash className="w-6 h-6" />}
      />
      <ConfirmationModal
        isOpen={modalState.isOpen && modalState.type === 'duplicate'}
        onClose={closeModal}
        onConfirm={executeAction}
        title="Duplicate Exam"
        message="Are you sure you want to duplicate this exam? All settings and questions will be copied to a new exam."
        confirmText="Duplicate"
        confirmColor="bg-amber-500 hover:bg-amber-600"
        icon={() => <Icons.Duplicate className="w-6 h-6" />}
      />

      <ConfirmationModal
        isOpen={modalState.isOpen && modalState.type === 'delete'}
        onClose={closeModal}
        onConfirm={executeAction}
        title="Delete Exam"
        message="Are you sure you want to delete this exam? This action CANNOT be undone and will delete all questions, results, and uploaded images associated with this exam."
        confirmText="Delete"
        confirmColor="bg-red-600 hover:bg-red-700"
        icon={() => <Icons.Trash className="w-6 h-6" />}
      />
    </div>
  );
}

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmColor = 'bg-indigo-600 hover:bg-indigo-700', icon: Icon }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            {Icon && (
              <div className={`p-3 rounded-full ${confirmColor.includes('red') ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                <Icon className="w-6 h-6" />
              </div>
            )}
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white font-semibold rounded-lg shadow-md transition-all active:scale-95 ${confirmColor}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

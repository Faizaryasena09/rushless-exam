'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import { toast } from 'sonner';

// --- Icons Component (Inline SVG) ---
const Icons = {
  Add: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Subject: () => (
    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Close: () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Search: () => (
    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
};

const SubjectsPage = () => {
  const router = useRouter();
  const { t } = useLanguage();
  
  // Data State
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [inputValue, setInputValue] = useState('');

  const curItemName = t('master_item_subject');

  // Role Protection
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/user-session');
        if (!res.ok) { router.push('/'); return; }
        const data = await res.json();
        if (!data.user || data.user.roleName !== 'admin') {
          router.push('/dashboard');
          return;
        }
        fetchSubjects();
      } catch {
        router.push('/');
      }
    }
    checkSession();
  }, [router]);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/subjects');
      if (!res.ok) throw new Error(t('master_error_fetch'));
      const data = await res.json();
      setSubjects(data);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [subjects, searchTerm]);

  const handleAddItem = () => {
    setSelectedItem(null);
    setInputValue('');
    setIsModalOpen(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setInputValue(item.name);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const method = selectedItem ? 'PUT' : 'POST';
    const endpoint = '/api/subjects';
    const body = selectedItem ? { id: selectedItem.id, name: inputValue } : { name: inputValue };

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t('master_error_save'));
      }

      toast.success(selectedItem ? t('master_success_update') : t('master_success_create'));
      setIsModalOpen(false);
      fetchSubjects();
    } catch (err) {
      toast.error(err.message || t('master_error_save'));
    }
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm(t('master_delete_confirm').replace('{item}', curItemName))) {
      try {
        const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || t('master_error_delete'));
        }
        toast.success(t('master_success_delete'));
        fetchSubjects();
      } catch (err) {
        toast.error(err.message || t('master_error_delete'));
      }
    }
  };

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-medium text-center">
        {t('master_error_generic')}: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* --- Page Header --- */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav_manage_subjects')}</h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
            {t('master_subtitle')}
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Icons.Search />
            </div>
            <input
              type="text"
              placeholder={t('master_search_placeholder').replace('{item}', curItemName)}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
          </div>
          <button 
            onClick={handleAddItem} 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-none whitespace-nowrap"
          >
            <Icons.Add />
            <span>{t('master_btn_add').replace('{item}', curItemName)}</span>
          </button>
        </div>
      </div>

      {/* --- Content Area --- */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="mt-2 text-slate-400 text-sm">{t('layout_loading')}</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3">
            <Icons.Subject />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
            {t('master_no_data').replace('{item}', curItemName)}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {searchTerm ? t('exams_search_placeholder') : t('master_no_data_desc').replace('{item}', curItemName)}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50/80 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('master_table_item_name').replace('{item}', curItemName)}
                </th>
                <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-48">{t('master_table_actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors">
                        <Icons.Subject />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEditItem(item)} 
                        className="flex items-center gap-1 px-3 py-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors text-xs font-medium"
                      >
                        <Icons.Edit /> {t('questions_btn_edit')}
                      </button>
                      <button 
                        onClick={() => handleDeleteItem(item.id)} 
                        className="flex items-center gap-1 px-3 py-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors text-xs font-medium"
                      >
                        <Icons.Trash /> {t('questions_btn_delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* --- Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedItem 
                  ? t('master_modal_title_edit').replace('{item}', curItemName)
                  : t('master_modal_title_new').replace('{item}', curItemName)}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <Icons.Close />
              </button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="p-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('master_label_name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg">
                  {t('master_btn_cancel')}
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50" disabled={!inputValue.trim()}>
                  {selectedItem ? t('master_btn_save') : t('master_btn_create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectsPage;

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, BookOpen, X, Search, Save, TriangleAlert, Info } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors';

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
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
      setSubjects(Array.isArray(data) ? data : (data.subjects || []));
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return subjects;
    return subjects.filter(s => (s.name || '').toLowerCase().includes(query));
  }, [subjects, searchTerm]);

  const duplicateName = useMemo(() => {
    const value = inputValue.trim().toLowerCase();
    if (!value) return null;
    return subjects.find(s => s.name.toLowerCase() === value && s.id !== selectedItem?.id) || null;
  }, [inputValue, subjects, selectedItem]);

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
    e?.preventDefault?.();
    const name = inputValue.trim();
    if (!name) return;
    if (duplicateName) return;

    setSaving(true);
    const method = selectedItem ? 'PUT' : 'POST';
    const body = selectedItem ? { id: selectedItem.id, name } : { name };

    try {
      const res = await fetch('/api/subjects', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t('master_error_save'));
      }

      toast.success(selectedItem ? t('master_success_update') : t('master_success_create'));
      setIsModalOpen(false);
      fetchSubjects();
    } catch (err) {
      toast.error(err.message || t('master_error_save'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/subjects?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t('master_error_delete'));
      }
      toast.success(t('master_success_delete'));
      setDeleteTarget(null);
      fetchSubjects();
    } catch (err) {
      toast.error(err.message || t('master_error_delete'));
    } finally {
      setDeleting(false);
    }
  };

  if (error && subjects.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
          <TriangleAlert size={18} />
        </div>
        <p className="text-sm font-bold text-slate-800 dark:text-white">{t('master_error_generic')}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{error}</p>
        <button
          onClick={fetchSubjects}
          className="mt-1 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('nav_manage_subjects')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('master_subtitle')}</p>
        </div>

        <button
          onClick={handleAddItem}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={15} />
          {t('master_btn_add').replace('{item}', curItemName)}
        </button>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('master_search_placeholder').replace('{item}', curItemName)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={t('master_search_placeholder').replace('{item}', curItemName)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              aria-label="Bersihkan pencarian"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
          {filteredData.length} dari {subjects.length} mata pelajaran
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 px-1">
        <span className="font-semibold">Keterangan:</span>
        <span className="inline-flex items-center gap-1"><Info size={12} /> mata pelajaran dipakai untuk mengelompokkan soal dan ujian</span>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <BookOpen size={18} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            {searchTerm
              ? `Tidak ada "${searchTerm}"`
              : t('master_no_data').replace('{item}', curItemName)}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {searchTerm
              ? 'Coba kata kunci lain atau bersihkan pencarian.'
              : t('master_no_data_desc').replace('{item}', curItemName)}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Reset pencarian
              </button>
            ) : (
              <button
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                {t('master_btn_add').replace('{item}', curItemName)}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredData.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold uppercase">
                {(item.name || '?').charAt(0)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{item.name}</p>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                <button
                  onClick={() => handleEditItem(item)}
                  aria-label={`Ubah ${item.name}`}
                  title={t('questions_btn_edit')}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  aria-label={`Hapus ${item.name}`}
                  title={t('questions_btn_delete')}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal tambah / ubah */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={() => setIsModalOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedItem
                    ? t('master_modal_title_edit').replace('{item}', curItemName)
                    : t('master_modal_title_new').replace('{item}', curItemName)}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedItem ? 'Perbaiki nama mata pelajaran lalu simpan.' : 'Nama harus unik dan tidak boleh sama dengan yang sudah ada.'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-3">
              <div>
                <label htmlFor="subjectName" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  {t('master_label_name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="subjectName"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Contoh: Matematika"
                  className={inputCls}
                  autoFocus
                />
                {duplicateName && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                    <TriangleAlert size={13} className="shrink-0 mt-0.5" />
                    Nama sudah dipakai oleh mata pelajaran lain. Gunakan nama yang berbeda.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {t('master_btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || saving || !!duplicateName}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Save size={15} />
                  {saving
                    ? 'Menyimpan...'
                    : (selectedItem ? t('master_btn_save') : t('master_btn_create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal konfirmasi hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={() => setDeleteTarget(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400">
                  <Trash2 size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('master_delete_confirm').replace('{item}', curItemName)}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    <span className="font-semibold text-slate-800 dark:text-white">{deleteTarget.name}</span> akan dihapus dan tidak bisa dibatalkan.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('master_btn_cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {deleting ? t('layout_loading') : t('questions_btn_delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectsPage;
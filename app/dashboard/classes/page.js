'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2, X, Search, Save, TriangleAlert, Info, Layers } from 'lucide-react';

const inputCls = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors';

// Warna destruktif: merah selalu berarti "hapus", bukan dekorasi.
const DANGER = {
  chip: 'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30',
  icon: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
  text: 'text-rose-700 dark:text-rose-300',
  btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-300/50 dark:shadow-rose-950/40',
};

const ClassesPage = () => {
  const router = useRouter();
  const { t } = useLanguage();

  // Data State
  const [classes, setClasses] = useState([]);
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

  const curItemName = t('master_item_class');

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
        fetchClasses();
      } catch {
        router.push('/');
      }
    }
    checkSession();
  }, [router]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/classes');
      if (!res.ok) throw new Error(t('master_error_fetch'));
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : (data.classes || []));
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter(c => (c.class_name || '').toLowerCase().includes(query));
  }, [classes, searchTerm]);

  const duplicateName = useMemo(() => {
    const value = inputValue.trim().toLowerCase();
    if (!value) return null;
    return classes.find(c => c.class_name.toLowerCase() === value && c.id !== selectedItem?.id) || null;
  }, [inputValue, classes, selectedItem]);

  const handleAddItem = () => {
    setSelectedItem(null);
    setInputValue('');
    setIsModalOpen(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setInputValue(item.class_name);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e?.preventDefault?.();
    const name = inputValue.trim();
    if (!name || duplicateName) return;

    setSaving(true);
    const method = selectedItem ? 'PUT' : 'POST';
    const body = selectedItem ? { id: selectedItem.id, className: name } : { className: name };

    try {
      const res = await fetch('/api/classes', {
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
      fetchClasses();
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
      const res = await fetch('/api/classes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t('master_error_delete'));
      }
      toast.success(t('master_success_delete'));
      setDeleteTarget(null);
      fetchClasses();
    } catch (err) {
      toast.error(err.message || t('master_error_delete'));
    } finally {
      setDeleting(false);
    }
  };

  if (error && classes.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <span className={`grid place-items-center w-12 h-12 rounded-2xl ${DANGER.icon}`}>
          <TriangleAlert size={20} />
        </span>
        <p className="text-sm font-bold text-slate-800 dark:text-white">{t('master_error_generic')}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{error}</p>
        <button
          onClick={fetchClasses}
          className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 dark:from-violet-950/30 dark:via-slate-900 dark:to-fuchsia-950/30" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="shrink-0 grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25">
              <Building2 size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('nav_manage_classes')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('master_subtitle')}</p>
            </div>
          </div>

          <button
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-300/50 dark:shadow-emerald-950/40 transition-all shrink-0"
          >
            <Plus size={15} />
            {t('master_btn_add').replace('{item}', curItemName)}
          </button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Kelas</p>
            <span className="shrink-0 grid place-items-center w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <Layers size={13} />
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">{classes.length}</p>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sedang Ditampilkan</p>
            <span className="shrink-0 grid place-items-center w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Search size={13} />
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{filteredData.length}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dipakai Untuk</p>
            <span className="shrink-0 grid place-items-center w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Info size={13} />
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Mengelompokkan siswa &amp; ujian</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 p-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-70" />
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('master_search_placeholder').replace('{item}', curItemName)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={t('master_search_placeholder').replace('{item}', curItemName)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
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
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 tabular-nums">
          {filteredData.length} dari {classes.length} kelas
        </span>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 p-12 text-center">
          <div className="mx-auto mb-3 grid place-items-center w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-500 dark:text-violet-400">
            <Building2 size={20} />
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
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Reset pencarian
              </button>
            ) : (
              <button
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-300/50 dark:shadow-emerald-950/40 transition-all"
              >
                <Plus size={14} />
                {t('master_btn_add').replace('{item}', curItemName)}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 ring-1 ring-slate-200/70 dark:ring-slate-800/70">
          {filteredData.map(item => (
            <div
              key={item.id}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-violet-50/60 dark:hover:bg-violet-950/20 transition-colors"
            >
              <span className="shrink-0 grid place-items-center w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 text-xs font-bold uppercase">
                {(item.class_name || '?').charAt(0)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{item.class_name}</p>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                <button
                  onClick={() => handleEditItem(item)}
                  aria-label={`Ubah ${item.class_name}`}
                  title={t('questions_btn_edit')}
                  className="p-2 rounded-xl text-slate-400 hover:text-violet-700 hover:bg-violet-50 dark:hover:text-violet-300 dark:hover:bg-violet-950/40 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  aria-label={`Hapus ${item.class_name}`}
                  title={t('questions_btn_delete')}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={() => setIsModalOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hijau saat menambah, amber saat mengubah - tombol submit di bawah
                memakai warna yang sama persis. */}
            <div aria-hidden="true" className={`h-1 w-full bg-gradient-to-r ${selectedItem ? 'from-amber-500 to-orange-500' : 'from-emerald-500 to-teal-500'}`} />

            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-3 min-w-0">
                <span className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${selectedItem
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}`}>
                  {selectedItem ? <Pencil size={18} /> : <Plus size={18} />}
                </span>
                <div className="min-w-0">
                  <h2 className={`text-base font-bold ${selectedItem ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                    {selectedItem
                      ? t('master_modal_title_edit').replace('{item}', curItemName)
                      : t('master_modal_title_new').replace('{item}', curItemName)}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedItem ? 'Perbaiki nama kelas lalu simpan.' : 'Nama harus unik dan tidak boleh sama dengan yang sudah ada.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-3">
              <div>
                <label htmlFor="className" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  {t('master_label_name')} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="className"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Contoh: XII IPA 1"
                  className={inputCls}
                  autoFocus
                />
                {duplicateName && (
                  <p className="mt-1.5 flex items-start gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300">
                    <TriangleAlert size={13} className="shrink-0 mt-0.5" />
                    Nama sudah dipakai oleh kelas lain. Gunakan nama yang berbeda.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  {t('master_btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || saving || !!duplicateName}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${selectedItem
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-300/50 dark:shadow-amber-950/40'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-300/50 dark:shadow-emerald-950/40'}`}
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={() => setDeleteTarget(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl shadow-rose-500/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden="true" className="h-1 w-full bg-gradient-to-r from-rose-500 to-pink-500" />

            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${DANGER.icon}`}>
                  <Trash2 size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className={`text-base font-bold ${DANGER.text}`}>
                    {t('master_delete_confirm').replace('{item}', curItemName)}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border mt-1 ${DANGER.chip} ${DANGER.text}`}>
                      {deleteTarget.class_name}
                    </span>{' '}
                    akan dihapus dan tidak bisa dibatalkan.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
              >
                {t('master_btn_cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${DANGER.btn}`}
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

export default ClassesPage;
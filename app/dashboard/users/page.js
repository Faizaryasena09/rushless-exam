'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import UserModal from '../../components/UserModal';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useLanguage } from '@/app/context/LanguageContext';
import { 
  UserPlus, 
  UserMinus, 
  Trash2, 
  Edit3, 
  User, 
  Building2, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  X,
  AlertCircle,
  BookOpen,
  ShieldCheck,
  Users,
  FileSpreadsheet,
  GraduationCap
} from 'lucide-react';

// --- COMPONENTS ---

/**
 * Warna destruktif untuk modal & tombol hapus. Dipisah supaya merah tua tetap
 * berarti "hapus" di mana saja, bukan jadi dekorasi.
 */
const DANGER = {
  chip: 'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30',
  icon: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
  text: 'text-rose-700 dark:text-rose-300',
  btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-300/50 dark:shadow-rose-950/40',
};

// Modal Konfirmasi Hapus
function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title, message, itemName, loading }) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-md sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl shadow-rose-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Strip penanda destruktif di atas modal. */}
        <div aria-hidden="true" className="h-1 w-full bg-gradient-to-r from-rose-500 to-pink-500" />

        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${DANGER.icon}`}>
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0">
              <h3 className={`text-base font-bold ${DANGER.text}`}>{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {message}
                {itemName && (
                  <span className={`block mt-2 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${DANGER.chip} ${DANGER.text}`}>
                    {itemName}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            {t('users_btn_cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 ${DANGER.btn}`}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {loading ? t('layout_loading') : t('users_confirm_yes')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportResultsModal({ isOpen, onClose, results }) {
  const { t } = useLanguage();
  if (!isOpen || !results) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Strip emerald: import yang sukses adalah hasil baik, bukan error. */}
        <div aria-hidden="true" className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 shrink-0" />

        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('users_import_modal_title')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('users_import_modal_success')}: {results.successCount} &middot; {t('users_import_modal_failed')}: {results.failedCount}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 px-4 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                {t('users_import_modal_success')}
              </p>
              <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5">{results.successCount}</p>
            </div>
            <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 text-center ${results.failedCount > 0 ? DANGER.chip : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'}`}>
              <p className={`text-[11px] font-bold uppercase tracking-wide ${results.failedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                {t('users_import_modal_failed')}
              </p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${results.failedCount > 0 ? DANGER.text : 'text-slate-400 dark:text-slate-500'}`}>{results.failedCount}</p>
            </div>
          </div>

          {results.createdClasses && results.createdClasses.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 px-4 py-3">
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                {results.createdClasses.length} kelas baru dibuat otomatis
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {results.createdClasses.map((c, i) => (
                  <span key={`${c.name}-${i}`} className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {c.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-indigo-700/80 dark:text-indigo-300/70">
                Kelas ini otomatis dibuat karena belum ada di sistem. Cek kembali di menu Kelas.
              </p>
            </div>
          )}

          {results.errors && results.errors.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                {t('users_import_modal_errors_title')}
              </p>
              <ul className="space-y-1.5">
                {results.errors.map((err, i) => (
                  <li key={i} className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs border ${DANGER.chip} ${DANGER.text}`}>
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                    <span className="break-words">{typeof err === 'string' ? err : err.message || JSON.stringify(err)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-opacity"
          >
            {t('users_btn_cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

const ManageUsersPage = () => {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedRole, setSelectedRole] = useState('');
  const fileInputRef = useRef(null);

  // Modal states
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null, loading: false });
  const [deleteClassModal, setDeleteClassModal] = useState({ open: false, loading: false });
  const [importResults, setImportResults] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClass) params.append('classId', selectedClass);
      if (searchTerm) params.append('search', searchTerm);
      if (selectedRole) params.append('role', selectedRole);
      
      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error(t('users_error_fetch'));
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      if (!res.ok) throw new Error(t('users_error_fetch_classes'));
      const data = await res.json();
      setAllClasses(data);
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [selectedClass, searchTerm, selectedRole]);

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown size={13} className="text-sky-300 dark:text-sky-700/60 group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={13} className="text-sky-600 dark:text-sky-400" />
      : <ChevronDown size={13} className="text-sky-600 dark:text-sky-400" />;
  };

  const sortedUsers = useMemo(() => {
    const data = [...users];
    const { key, direction } = sortConfig;
    
    data.sort((a, b) => {
      let valA, valB;

      if (key === 'name') {
        valA = (a.name || a.username).toLowerCase();
        valB = (b.name || b.username).toLowerCase();
      } else if (key === 'class') {
        valA = (a.class_name || '').toLowerCase();
        valB = (b.class_name || '').toLowerCase();
      } else {
        valA = (a[key] || '').toLowerCase();
        valB = (b[key] || '').toLowerCase();
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return data;
  }, [users, sortConfig]);

  const roleCounts = useMemo(() => {
    const list = users || [];
    return {
      all: list.length,
      admin: list.filter(u => u.role === 'admin').length,
      teacher: list.filter(u => u.role === 'teacher').length,
      student: list.filter(u => u.role === 'student').length
    };
  }, [users]);
  const handleAddUser = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (userData) => {
    const method = userData.id ? 'PUT' : 'POST';
    try {
      const res = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t('users_error_save'));
      }

      setIsModalOpen(false);
      fetchUsers();
      toast.success(t('users_success_save'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const triggerDeleteUser = (user) => {
    setDeleteModal({ open: true, user, loading: false });
  };

  const confirmDeleteUser = async () => {
    const userId = deleteModal.user.id;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t('users_error_delete'));
      }
      fetchUsers();
      toast.success(t('users_success_delete'));
      setDeleteModal({ open: false, user: null, loading: false });
    } catch (err) {
      toast.error(err.message);
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const selectedClassObj = allClasses.find(c => String(c.id) === String(selectedClass));
  const confirmDeleteByClass = async () => {
    setDeleteClassModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t('users_btn_delete'));
      toast.success(data.message);
      setDeleteClassModal({ open: false, loading: false });
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
      setDeleteClassModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = () => {
    // Format export sengaja dibuat sama dengan template import,
    // sehingga file hasil export bisa langsung di-import kembali.
    const dataToExport = users.map(user => ({
      username: user.username,
      name: user.name || '',
      role: user.role,
      class_name: user.class_name || '',
      password: ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pengguna");
    XLSX.writeFile(wb, "data_pengguna.xlsx");
    toast.success(t('users_success_export'));
  };

  const handleDownloadTemplate = () => {
    // Template import: nama kolom WAJIB sama dengan yang dibaca /api/users/import
    // (username, name, password, role, class_name)
    const templateRows = [
      {
        username: 'budi.santoso',
        name: 'Budi Santoso',
        role: 'student',
        class_name: 'XII IPA 1',
        password: 'rahasia123'
      },
      {
        username: 'siti.rahma',
        name: 'Siti Rahma',
        role: 'student',
        class_name: 'XII IPA 2',
        password: 'rahasia123'
      },
      {
        username: 'guru.sekolah',
        name: 'Guru Sekolah',
        role: 'teacher',
        class_name: '',
        password: 'rahasia123'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];

    // Sheet panduan singkat
    const guideRows = [
      { kolom: 'username', keterangan: 'WAJIB. Dipakai untuk login. Tanpa spasi dan harus unik.' },
      { kolom: 'name', keterangan: 'WAJIB. Nama lengkap pengguna.' },
      { kolom: 'password', keterangan: 'WAJIB. Minimal 6 karakter.' },
      { kolom: 'role', keterangan: 'WAJIB. Isi student / teacher / admin (huruf kecil).' },
      { kolom: 'class_name', keterangan: 'WAJIB untuk role student. Kalau kelasnya belum ada di sistem, kelas akan dibuat otomatis.' }
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 16 }, { wch: 70 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pengguna');
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan');
    XLSX.writeFile(wb, 'template-import-pengguna.xlsx');

    toast.success('Template import berhasil diunduh. Isi sheet "Pengguna" lalu unggah kembali.');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const toastId = toast.loading(t('users_import_loading'));
        const res = await fetch('/api/users/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await res.json();
        if (res.ok) {
          fetchUsers();
          fetchClasses();

          if (result.createdClasses?.length > 0) {
            toast.success(
              `Import selesai. ${result.createdClasses.length} kelas baru dibuat otomatis: ${result.createdClasses.map(c => c.name).join(', ')}.`,
              { id: toastId }
            );
          }

          if (result.failedCount > 0) {
            if (result.createdClasses?.length === 0) toast.dismiss(toastId);
            setImportResults(result);
          } else if (result.createdClasses?.length === 0) {
            toast.success(
              t('users_import_success_count').replace('{count}', result.successCount),
              { id: toastId }
            );
          }
        } else {
          toast.error(result.message || t('users_error_import'), { id: toastId });
        }
      } catch (err) {
        toast.error(t('users_error_read_file') + err.message);
      } finally {
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-violet-50 dark:from-sky-950/30 dark:via-slate-900 dark:to-violet-950/30" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="shrink-0 grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/25">
              <Users size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('users_title')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('users_subtitle_count').replace('{count}', users.length)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />

            {/* Tiap tombol punya warna sesuai fungsinya: export = sky,
                import = indigo, template = slate, tambah = emerald. */}
            <button
              onClick={handleExport}
              disabled={users.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-900/40 transition-all disabled:opacity-50"
            >
              <Download size={15} />
              {t('users_btn_export')}
            </button>

            <button
              onClick={() => fileInputRef.current.click()}
              title="Unggah file .xlsx berisi data pengguna"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/40 transition-all"
            >
              <Upload size={15} />
              {t('users_btn_import')}
            </button>

            <button
              onClick={handleDownloadTemplate}
              title="Unduh template Excel untuk import pengguna"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white text-slate-600 hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
            >
              <FileSpreadsheet size={15} />
              Template
            </button>

            <button
              onClick={handleAddUser}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-300/50 dark:shadow-emerald-950/40 transition-all"
            >
              <UserPlus size={15} />
              {t('users_btn_add')}
            </button>
          </div>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label={t('users_filter_all_roles')} value={roleCounts.all} icon={<Users size={13} />} tone="slate" />
        <SummaryCard label={t('users_role_student')} value={roleCounts.student} icon={<GraduationCap size={13} />} tone="indigo" />
        <SummaryCard label={t('users_role_teacher')} value={roleCounts.teacher} icon={<BookOpen size={13} />} tone="amber" />
        <SummaryCard label={t('users_role_admin')} value={roleCounts.admin} icon={<ShieldCheck size={13} />} tone="rose" />
      </div>

      {/* Toolbar */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 p-3 flex flex-col lg:flex-row lg:items-center gap-2">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-500 to-indigo-500 opacity-70" />
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('users_search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={t('users_search_placeholder')}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-400 dark:focus:border-sky-600 transition-colors"
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

        <div className="relative flex flex-wrap items-center gap-2">
          <span className="shrink-0 grid place-items-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <Filter size={14} />
          </span>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            aria-label={t('users_table_header_role')}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-sky-400 dark:focus:border-sky-600 transition-colors"
          >
            <option value="">{t('users_filter_all_roles')}</option>
            <option value="student">{t('users_role_student')}</option>
            <option value="teacher">{t('users_role_teacher')}</option>
            <option value="admin">{t('users_role_admin')}</option>
          </select>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            aria-label={t('users_table_header_class')}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-sky-400 dark:focus:border-sky-600 transition-colors"
          >
            <option value="">{t('users_filter_all_classes')}</option>
            {allClasses.map(c => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>

          {(selectedRole || selectedClass || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedRole('');
                setSelectedClass('');
              }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            >
              <X size={13} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Aksi Based on filter kelas */}
      {selectedClass && (
        <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${DANGER.chip}`}>
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 grid place-items-center w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={16} />
            </span>
            <div>
              <p className={`text-sm font-bold ${DANGER.text}`}>
                Menampilkan pengguna kelas {selectedClassObj?.class_name || '-'}
              </p>
              <p className="text-xs text-rose-600/80 dark:text-rose-300/70">
                Hapus per kelas akan menghapus seluruh akun di kelas ini sekaligus.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDeleteClassModal({ open: true, loading: false })}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shrink-0 ${DANGER.btn}`}
          >
            <UserMinus size={15} />
            {t('users_btn_delete_class')}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 px-1">
        <span className="font-semibold">Keterangan:</span>
        <span>{sortedUsers.length} pengguna ditampilkan</span>
        <span>klik baris untuk mengubah data pengguna</span>
      </div>

      {/* Daftar pengguna */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : sortedUsers.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 p-12 text-center">
          <div className="mx-auto mb-3 grid place-items-center w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
            <User size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('users_no_users')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {(selectedRole || selectedClass || searchTerm)
              ? 'Tidak ada pengguna yang cocok dengan filter saat ini. Ubah atau reset filter untuk melihat semua pengguna.'
              : 'Belum ada pengguna. Tambahkan pengguna secara manual atau import dari file Excel.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {(selectedRole || selectedClass || searchTerm) ? (
              <button
                onClick={() => { setSearchTerm(''); setSelectedRole(''); setSelectedClass(''); }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Reset filter
              </button>
            ) : (
              <>
                <button
                  onClick={handleAddUser}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-300/50 dark:shadow-emerald-950/40 transition-all"
                >
                  <UserPlus size={14} />
                  {t('users_btn_add')}
                </button>
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/40 transition-all"
                >
                  <Upload size={14} />
                  {t('users_btn_import')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden lg:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden ring-1 ring-slate-200/70 dark:ring-slate-800/70">
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-sky-50/70 to-indigo-50/70 dark:from-sky-950/30 dark:to-indigo-950/30">
                <tr>
                  <th
                    onClick={() => toggleSort('name')}
                    className="group px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {t('users_table_header_name')}
                      <SortIcon columnKey="name" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort('role')}
                    className="group px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {t('users_table_header_role')}
                      <SortIcon columnKey="role" />
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort('class')}
                    className="group px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300 cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {t('users_table_header_class')}
                      <SortIcon columnKey="class" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-sky-800 dark:text-sky-300 text-right">
                    {t('users_table_header_action')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => handleEditUser(user)}
                    className="cursor-pointer hover:bg-sky-50/60 dark:hover:bg-sky-950/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{user.name || user.username}</p>
                          <p className="text-[11px] text-slate-400 truncate">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleChip role={user.role} t={t} />
                    </td>
                    <td className="px-4 py-3">
                      {user.class_name ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                          <span className="grid place-items-center w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            <Building2 size={11} />
                          </span>
                          {user.class_name}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEditUser(user)}
                          aria-label={t('users_btn_edit')}
                          title={t('users_btn_edit')}
                          className="p-2 rounded-xl text-slate-400 hover:text-sky-700 hover:bg-sky-50 dark:hover:text-sky-300 dark:hover:bg-sky-950/40 transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => triggerDeleteUser(user)}
                          aria-label={t('users_btn_delete')}
                          title={t('users_btn_delete')}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden space-y-2">
            {sortedUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => handleEditUser(user)}
                className="relative overflow-hidden flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 px-3.5 py-3 active:scale-[0.99] transition-all"
              >
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${user.role === 'admin' ? 'bg-rose-500' : user.role === 'teacher' ? 'bg-amber-500' : user.role === 'student' ? 'bg-sky-500' : 'bg-slate-400'}`} />
                <UserAvatar user={user} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{user.name || user.username}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    @{user.username}
                    {user.class_name ? ` · ${user.class_name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <RoleChip role={user.role} t={t} />
                  <button
                    onClick={() => triggerDeleteUser(user)}
                    aria-label={t('users_btn_delete')}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isModalOpen && (
        <UserModal user={selectedUser} onClose={() => setIsModalOpen(false)} onSave={handleSaveUser} />
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, user: null, loading: false })}
        onConfirm={confirmDeleteUser}
        loading={deleteModal.loading}
        title={t('users_delete_confirm_title')}
        message={t('users_delete_confirm_msg')}
        itemName={deleteModal.user?.name || deleteModal.user?.username}
      />

      <ConfirmDeleteModal
        isOpen={deleteClassModal.open}
        onClose={() => setDeleteClassModal({ open: false, loading: false })}
        onConfirm={confirmDeleteByClass}
        loading={deleteClassModal.loading}
        title={t('users_btn_delete_class')}
        message={t('users_delete_class_warning').replace('{className}', selectedClassObj?.class_name || '')}
        itemName={t('users_subtitle_count').replace('{count}', users.length)}
      />

      <ImportResultsModal
        isOpen={!!importResults}
        onClose={() => setImportResults(null)}
        results={importResults}
      />
    </div>
  );
};

function SummaryCard({ label, value, icon, tone = 'slate' }) {
  // Warna kartu diturunkan dari peran yang dihitungnya: total = slate,
  // siswa = indigo, guru = amber, admin = rose. Jadi warnanya berarti.
  const toneCls = {
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
    indigo: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-300 dark:hover:border-indigo-800',
    amber: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60 hover:border-amber-300 dark:hover:border-amber-800',
    rose: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-800',
  }[tone];

  const valueCls = {
    slate: 'text-slate-900 dark:text-white',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }[tone];

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-slate-950/40 ${toneCls}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`shrink-0 grid place-items-center w-6 h-6 rounded-lg ${toneCls}`}>
          {icon}
        </span>
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueCls}`}>{value}</p>
    </div>
  );
}

function UserAvatar({ user }) {
  // Avatar memakai warna yang sama dengan chip peran, jadi peran pengguna
  // terbaca sekilas dari daftar tanpa harus fokus ke kolom Role.
  const cls = {
    admin: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
    teacher: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    student: 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
  }[user.role] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200';

  return (
    <span className={`shrink-0 grid place-items-center w-9 h-9 rounded-xl text-xs font-bold uppercase ${cls}`}>
      {(user.name || user.username).charAt(0)}
    </span>
  );
}

function RoleChip({ role, t }) {
  // Satu warna per peran, dipakai juga untuk avatar di tabel & kartu mobile
  // supaya peran pengguna bisa dibaca dari warna saja.
  const map = {
    admin: {
      label: t('users_role_admin'),
      cls: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
      avatar: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
    },
    teacher: {
      label: t('users_role_teacher'),
      cls: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
      avatar: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    },
    student: {
      label: t('users_role_student'),
      cls: 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
      avatar: 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
    },
  };
  const item = map[role] || {
    label: role,
    cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    avatar: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold ${item.cls}`}>
      {item.label}
    </span>
  );
}

export default ManageUsersPage;
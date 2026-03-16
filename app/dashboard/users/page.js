'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import UserModal from '../../components/UserModal';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
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
  ArrowUpDown
} from 'lucide-react';

// --- COMPONENTS ---

// Modal Konfirmasi Hapus yang lebih ramah
function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title, message, itemName, loading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="relative p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-6">
            <AlertTriangle size={32} />
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
            {message}
            {itemName && <span className="font-bold text-slate-800 dark:text-white mt-1 block">"{itemName}"</span>}
          </p>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-red-200 dark:shadow-red-900/20 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 size={18} />}
              {loading ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ManageUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const fileInputRef = useRef(null);

  // Modal states
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null, loading: false });
  const [deleteClassModal, setDeleteClassModal] = useState({ open: false, loading: false });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClass) params.append('classId', selectedClass);
      if (searchTerm) params.append('search', searchTerm);
      
      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal mengambil data pengguna');
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
      if (!res.ok) throw new Error('Gagal mengambil data kelas');
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
  }, [selectedClass, searchTerm]);

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />;
    
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 animate-in zoom-in-95 duration-200">
        {sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span className="text-[10px] font-black tracking-tighter uppercase whitespace-nowrap">
          {sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A'}
        </span>
      </div>
    );
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
        throw new Error(data.message || 'Gagal menyimpan user');
      }

      setIsModalOpen(false);
      fetchUsers();
      toast.success('User berhasil disimpan');
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
        throw new Error(data.message || 'Gagal menghapus user');
      }
      fetchUsers();
      toast.success('User berhasil dihapus');
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
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus');
      toast.success(data.message);
      setDeleteClassModal({ open: false, loading: false });
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
      setDeleteClassModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleExport = () => {
    const dataToExport = users.map(user => ({
      username: user.username,
      nama: user.name || '',
      peran: user.role,
      kelas: user.class_name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pengguna");
    XLSX.writeFile(wb, "data_pengguna.xlsx");
    toast.success('Export berhasil!');
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

        const toastId = toast.loading("Sedang mengimport data...");
        const res = await fetch('/api/users/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await res.json();
        if (res.ok) {
          toast.update(toastId, { render: result.message, type: "success", isLoading: false, autoClose: 3000 });
          fetchUsers();
        } else {
          toast.update(toastId, { render: result.message || 'Import gagal', type: "error", isLoading: false, autoClose: 3000 });
        }
      } catch (err) {
        toast.error('Gagal membaca file: ' + err.message);
      } finally {
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="relative min-h-screen space-y-8 pb-20 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 pt-10 space-y-8 relative z-10">
        
        {/* Header Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                <User size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">Kelola Pengguna</h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  {users.length} pengguna terdaftar
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-sm font-bold rounded-xl transition-all shadow-sm"
              >
                <Download size={18} />
                <span>Export</span>
              </button>
              <button
                onClick={() => fileInputRef.current.click()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-sm font-bold rounded-xl transition-all shadow-sm"
              >
                <Upload size={18} />
                <span>Import</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
              />

              {selectedClass && (
                <button
                  onClick={() => setDeleteClassModal({ open: true, loading: false })}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/50 text-sm font-bold rounded-xl transition-all shadow-sm"
                >
                  <UserMinus size={18} />
                  <span>Hapus Kelas</span>
                </button>
              )}

              <button
                onClick={handleAddUser}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/30"
              >
                <UserPlus size={18} />
                <span>Tambah Pengguna</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari user berdasarkan nama..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer font-medium"
              >
                <option value="">Semua Kelas</option>
                {allClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <Loader2 className="animate-spin text-indigo-600" size={40} />
             <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Memuat Data...</p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            {/* Desktop View */}
            <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th 
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group select-none hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                      onClick={() => toggleSort('name')}
                    >
                      <div className="flex items-center gap-3">
                        Nama & Akun
                        <SortIcon columnKey="name" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Peran
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Kelas
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedUsers.map((user) => (
                    <tr key={user.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold uppercase">
                            {user.name ? user.name.charAt(0) : user.username.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white leading-none">{user.name || user.username}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">@{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' 
                            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.class_name ? (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium text-sm">
                            <Building2 size={14} className="text-slate-400" />
                            {user.class_name}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEditUser(user)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"><Edit3 size={16} /></button>
                          <button onClick={() => triggerDeleteUser(user)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-slate-400 text-sm italic">Tidak ada pengguna ditemukan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
              {sortedUsers.map((user) => (
                <div key={user.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{user.name || user.username}</h3>
                        <p className="text-xs text-slate-500">@{user.username}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {user.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-4 text-sm font-medium">
                    <span className="text-slate-400">Kelas</span>
                    <span className="text-slate-800 dark:text-slate-200">{user.class_name || '-'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleEditUser(user)} className="flex items-center justify-center gap-2 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm transition-all active:scale-95"><Edit3 size={16} /> Edit</button>
                    <button onClick={() => triggerDeleteUser(user)} className="flex items-center justify-center gap-2 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm transition-all active:scale-95"><Trash2 size={16} /> Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <UserModal user={selectedUser} onClose={() => setIsModalOpen(false)} onSave={handleSaveUser} />
      )}

      <ConfirmDeleteModal 
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, user: null, loading: false })}
        onConfirm={confirmDeleteUser}
        loading={deleteModal.loading}
        title="Konfirmasi Hapus"
        message="Apakah Anda yakin ingin menghapus pengguna ini? Semua data terkait akan ikut terhapus secara permanen."
        itemName={deleteModal.user?.name || deleteModal.user?.username}
      />

      <ConfirmDeleteModal 
        isOpen={deleteClassModal.open}
        onClose={() => setDeleteClassModal({ open: false, loading: false })}
        onConfirm={confirmDeleteByClass}
        loading={deleteClassModal.loading}
        title="Hapus Satu Kelas"
        message={`Peringatan! Anda akan menghapus SELURUH pengguna di kelas "${selectedClassObj?.class_name}".`}
        itemName={`Total: ${users.length} pengguna`}
      />
    </div>
  );
};

export default ManageUsersPage;
'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, X, User, Shield, GraduationCap, Save } from 'lucide-react';

const UserModal = ({ user, onClose, onSave }) => {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('student');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch('/api/classes');
        if (res.ok) {
          const data = await res.json();
          const classList = Array.isArray(data) ? data : (data.classes || []);
          setClasses(classList);

          if (!user && classList.length > 0 && !classId) {
            const defaultClass = classList.find(c => c.id == 1) || classList[0];
            setClassId(defaultClass.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch classes:', error);
      }
    };

    fetchClasses();

    if (user) {
      setUsername(user.username);
      setName(user.name || '');
      setRole(user.role);
      setClassId(user.class_id || '');
    } else {
      setUsername('');
      setName('');
      setPassword('');
      setShowPassword(false);
      setRole('student');
    }
  }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id: user?.id,
      username,
      name,
      password,
      role,
      class_id: role === 'student' ? classId : null
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${user ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
               {user ? <Shield size={20} /> : <User size={20} />}
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              {user ? 'Edit Profil' : 'Tambah User Baru'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Nama Lengkap</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: Budi Santoso"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Username</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
              {user ? 'Password Baru (Opsional)' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={user ? 'Kosongkan jika tidak ingin ganti' : 'Minimal 6 karakter'}
                required={!user}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-500 focus:outline-none transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Tingkat Akses</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="student">Siswa / Peserta</option>
                <option value="teacher">Instruktur / Guru</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {role === 'student' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Unit / Kelas</label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  <select
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    required={role === 'student'}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.class_name}</option>
                    ))}
                    {classes.length === 0 && <option value="">Tidak ada kelas</option>}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              className="flex-1 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {user ? 'Simpan Perubahan' : 'Buat User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;

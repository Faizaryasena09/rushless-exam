'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, X, User, Shield, GraduationCap, Save, UserPlus, Users, BookOpen, Lock, Info } from 'lucide-react';

const ROLES = [
    { value: 'student', label: 'Siswa', desc: 'Hanya bisa melihat dan mengerjakan ujian.', icon: GraduationCap, active: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' },
    { value: 'teacher', label: 'Guru', desc: 'Buat soal, atur ujian, dan lihat hasil.', icon: BookOpen, active: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' },
    { value: 'admin', label: 'Administrator', desc: 'Akses penuh termasuk pengaturan sistem.', icon: Shield, active: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' }
];

const UserModal = ({ user, onClose, onSave }) => {
  const isEdit = !!user;

  // Form diinisialisasi sekali dari prop `user` (modal selalu di-mount ulang saat dibuka)
  const [form, setForm] = useState(() => ({
    username: user?.username || '',
    name: user?.name || '',
    password: '',
    role: user?.role || 'student',
    classId: user?.class_id || ''
  }));
  const [showPassword, setShowPassword] = useState(false);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { username, name, password, role, classId } = form;
  const setField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const handleUsernameChange = (e) => {
    const cleaned = e.target.value.replace(/\s+/g, '');
    setForm(prev => ({ ...prev, username: cleaned }));
  };

  useEffect(() => {
    let active = true;

    const fetchClasses = async () => {
      try {
        const res = await fetch('/api/classes');
        if (!res.ok || !active) return;
        const data = await res.json();
        const classList = Array.isArray(data) ? data : (data.classes || []);
        if (!active) return;
        setClasses(classList);

        if (!user && classList.length > 0) {
          const defaultClass = classList.find(c => c.id == 1) || classList[0];
          setForm(prev => (prev.classId ? prev : { ...prev, classId: defaultClass.id }));
        }
      } catch (err) {
        console.error('Failed to fetch classes:', err);
      }
    };

    fetchClasses();

    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const validate = () => {
    if (!username.trim()) return 'Username wajib diisi.';
    if (!name.trim()) return 'Nama lengkap wajib diisi.';
    if (!isEdit && password.length < 6) return 'Password minimal 6 karakter.';
    if (isEdit && password && password.length < 6) return 'Password baru minimal 6 karakter.';
    if (role === 'student' && !classId) return 'Siswa wajib assigned ke sebuah kelas.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    setError('');
    setSaving(true);
    try {
      await onSave({
        id: user?.id,
        username: username.trim(),
        name: name.trim(),
        password,
        role,
        class_id: role === 'student' ? (classId ? parseInt(classId, 10) : null) : null
      });
    } catch (err) {
      setError(err.message || 'Gagal menyimpan pengguna.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit pengguna' : 'Tambah pengguna baru'}
        className="relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              {isEdit ? <Users size={18} /> : <UserPlus size={18} />}
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {isEdit ? 'Edit Pengguna' : 'Tambah Pengguna'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isEdit
                  ? `Mengubah data @${user.username}. Password hanya diganti bila diisi.`
                  : 'Isi data akun. Username dipakai untuk login dan tidak bisa diubah nanti.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/60">
              <Info size={15} className="shrink-0 mt-0.5 text-red-500" />
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nama Lengkap" htmlFor="userName" hint="Nama yang tampil di daftar dan hasil ujian.">
              <input
                id="userName"
                type="text"
                value={name}
                onChange={setField('name')}
                placeholder="Contoh: Budi Santoso"
                className={inputCls}
              />
            </Field>

            <Field label="Username" htmlFor="userUsername" hint="Dipakai untuk login. Tanpa spasi.">
              <input
                id="userUsername"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="contoh: budi.santoso"
                autoComplete="off"
                className={inputCls}
              />
            </Field>
          </div>

          <Field
            label={isEdit ? 'Password Baru (opsional)' : 'Password'}
            htmlFor="userPassword"
            hint={isEdit ? 'Kosongkan bila tidak ingin mengganti password.' : 'Minimal 6 karakter.'}
          >
            <div className="relative">
              <input
                id="userPassword"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setField('password')}
                placeholder={isEdit ? 'Kosongkan jika tidak ingin ganti' : 'Minimal 6 karakter'}
                autoComplete="new-password"
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Peran akun</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ROLES.map(r => {
                const isActive = role === r.value;
                const Icon = r.icon;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, role: r.value }))}
                    aria-pressed={isActive}
                    className={`flex flex-col items-start gap-1.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${isActive
                      ? r.active
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon size={14} className={isActive ? '' : 'text-slate-400'} />
                      <span className="text-sm font-semibold">{r.label}</span>
                    </span>
                    <span className={`text-[11px] leading-snug ${isActive ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>
                      {r.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {role === 'student' && (
            <Field label="Kelas" htmlFor="userClass" hint="Siswa hanya melihat ujian yang diberikan ke kelas ini.">
              {classes.length === 0 ? (
                <div className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 border border-slate-200 dark:border-slate-700">
                  Belum ada kelas. Buat kelas terlebih dahulu di menu Kelas.
                </div>
              ) : (
                <select
                  id="userClass"
                  value={classId}
                  onChange={setField('classId')}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="">Pilih kelas...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {role === 'student' && classes.length === 0 && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/60">
              <Info size={15} className="shrink-0 mt-0.5 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Pengguna dengan peran siswa wajib punya kelas agar bisa melihat ujian.
              </p>
            </div>
          )}

          {role !== 'student' && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <Info size={15} className="shrink-0 mt-0.5 text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {role === 'teacher'
                  ? 'Guru tidak perlu kelas. Aksesnya mengikuti kelas & mata pelajaran yang ditugaskan.'
                  : 'Administrator memiliki akses ke seluruh fitur, termasuk pengaturan website.'}
              </p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-1.5">
            <Lock size={12} />
            Data disimpan setelah tombol ditekan.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save size={15} />
              {saving ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Buat Pengguna')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors';

function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

export default UserModal;
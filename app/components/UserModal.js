'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, X, User, Shield, GraduationCap, Save, UserPlus, Users, BookOpen, Lock, Info } from 'lucide-react';

// Warna per peran harus sama persis dengan RoleChip di halaman pengguna, jadi
// pilihan di modal ini langsung nyambung dengan warna di tabel.
const ROLE_TONE = {
    student: {
        chip: 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400',
        active: 'bg-sky-600 text-white border-sky-600 shadow-sm shadow-sky-300/50 dark:shadow-sky-950/40',
        activeDesc: 'text-sky-50 dark:text-sky-200/80',
        icon: 'bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400',
        idle: 'border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-800',
    },
    teacher: {
        chip: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
        active: 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-300/50 dark:shadow-amber-950/40',
        activeDesc: 'text-amber-50 dark:text-amber-100/80',
        icon: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
        idle: 'border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-800',
    },
    admin: {
        chip: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
        active: 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-300/50 dark:shadow-rose-950/40',
        activeDesc: 'text-rose-50 dark:text-rose-100/80',
        icon: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
        idle: 'border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800',
    },
};

const ROLES = [
    { value: 'student', label: 'Siswa', desc: 'Hanya bisa melihat dan mengerjakan ujian.', icon: GraduationCap, tone: ROLE_TONE.student },
    { value: 'teacher', label: 'Guru', desc: 'Buat soal, atur ujian, dan lihat hasil.', icon: BookOpen, tone: ROLE_TONE.teacher },
    { value: 'admin', label: 'Administrator', desc: 'Akses penuh termasuk pengaturan sistem.', icon: Shield, tone: ROLE_TONE.admin }
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
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
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
            <span className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${isEdit
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}`}>
              {isEdit ? <Users size={18} /> : <UserPlus size={18} />}
            </span>
            <div className="min-w-0">
              <h2 className={`text-base sm:text-lg font-bold ${isEdit ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
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
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
              <Info size={15} className="shrink-0 mt-0.5 text-rose-500" />
              <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
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
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                    className={`flex flex-col items-start gap-1.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-200 ${isActive
                      ? r.tone.active
                      : `bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ${r.tone.idle}`}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon size={14} className={isActive ? '' : 'text-slate-400'} />
                      <span className="text-sm font-bold">{r.label}</span>
                    </span>
                    <span className={`text-[11px] leading-snug ${isActive ? r.tone.activeDesc : 'text-slate-500 dark:text-slate-400'}`}>
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
                <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
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
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
              <Info size={15} className="shrink-0 mt-0.5 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Pengguna dengan peran siswa wajib punya kelas agar bisa melihat ujian.
              </p>
            </div>
          )}

          {role !== 'student' && (
            <div
              className={`flex items-start gap-2 px-3.5 py-2.5 rounded-xl border ${
                role === 'admin'
                  ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30'
                  : 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30'
              }`}
            >
              <Info size={15} className={`shrink-0 mt-0.5 ${role === 'admin' ? 'text-rose-500' : 'text-amber-500'}`} />
              <p className={`text-xs ${role === 'admin' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
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
            <span className="grid place-items-center w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400">
              <Lock size={11} />
            </span>
            Data disimpan setelah tombol ditekan.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${
                isEdit
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-300/50 dark:shadow-amber-950/40'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-300/50 dark:shadow-emerald-950/40'
              }`}
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

const inputCls = 'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-600 transition-colors';

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
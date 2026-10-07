'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    Search,
    Save,
    Check,
    Building2,
    BookOpen,
    X,
    Info,
    Users
} from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

/**
 * Warna per kelompok chip: kelas = violet, mata pelajaran = emerald. Dipakai
 * untuk panel, strip atas, ikon, dan chip aktif sekaligus supaya satu group
 * selalu tampil sebagai satu blok warna.
 */
const CHIP_TONE = {
    violet: {
        panel: 'border-violet-200 dark:border-violet-900/60 bg-violet-50/40 dark:bg-violet-950/20',
        strip: 'from-violet-500 to-fuchsia-500',
        icon: 'bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400',
        heading: 'text-violet-700 dark:text-violet-300',
        active: 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-300/50 dark:shadow-violet-950/40',
        hover: 'hover:border-violet-300 dark:hover:border-violet-800',
        link: 'text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-700 dark:hover:text-violet-300',
    },
    emerald: {
        panel: 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20',
        strip: 'from-emerald-500 to-teal-500',
        icon: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
        heading: 'text-emerald-700 dark:text-emerald-300',
        active: 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-300/50 dark:shadow-emerald-950/40',
        hover: 'hover:border-emerald-300 dark:hover:border-emerald-800',
        link: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300',
    },
};

// Kartu satu guru, dengan state kelas & mapel sendiri
const TeacherCard = ({ teacher, allClasses, allSubjects, onDirtyChange }) => {
    const { t } = useLanguage();
    const [assignedClasses, setAssignedClasses] = useState(teacher.assigned_classes || []);
    const [assignedSubjects, setAssignedSubjects] = useState(teacher.assigned_subjects || []);
    const [saving, setSaving] = useState(false);

    const hasChanges =
        JSON.stringify(teacher.assigned_classes || []) !== JSON.stringify(assignedClasses) ||
        JSON.stringify(teacher.assigned_subjects || []) !== JSON.stringify(assignedSubjects);

    // Laporkan status "belum disimpan" ke halaman agar bisa ditampilkan di
    // header, jadi admin tidak lupa menekan Simpan di salah satu kartu.
    useEffect(() => {
        onDirtyChange(teacher.id, hasChanges);
    }, [teacher.id, hasChanges, onDirtyChange]);

    const toggleClass = (classId) => {
        setAssignedClasses(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]);
    };

    const toggleSubject = (subjectId) => {
        setAssignedSubjects(prev => prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]);
    };

    const handleSave = async () => {
        setSaving(true);
        const teacherName = teacher.name || teacher.username;
        const toastId = toast.loading(t('teachers_toast_saving').replace('{name}', teacherName));
        try {
            const resClasses = await fetch('/api/teachers/classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId: teacher.id, classIds: assignedClasses })
            });
            if (!resClasses.ok) throw new Error(t('teachers_error_classes'));

            const resSubjects = await fetch('/api/teachers/subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId: teacher.id, subjectIds: assignedSubjects })
            });
            if (!resSubjects.ok) throw new Error(t('teachers_error_subjects'));

            teacher.assigned_classes = [...assignedClasses];
            teacher.assigned_subjects = [...assignedSubjects];

            toast.success(t('teachers_toast_success').replace('{name}', teacherName), { id: toastId });
        } catch (e) {
            toast.error(e.message, { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    // Kartu guru punya dua kondisi: belum ada perubahan (indigo netral) dan
    // ada perubahan yang belum disimpan (amber). Strip atas + warna avatar
    // ikut berubah supaya yang perlu disimpan langsung kelihatan.
    const tone = hasChanges
        ? {
            strip: 'from-amber-400 to-orange-500',
            avatar: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
            border: 'border-amber-300 dark:border-amber-800/70',
            ring: 'ring-amber-200/70 dark:ring-amber-900/40',
        }
        : {
            strip: 'from-indigo-400 to-sky-500',
            avatar: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400',
            border: 'border-slate-200 dark:border-slate-800',
            ring: 'ring-slate-200/70 dark:ring-slate-800/70',
        };

    return (
        <article className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 ring-1 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-slate-950/50 hover:-translate-y-0.5 ${tone.border} ${tone.ring}`}
        >
            <div aria-hidden="true" className={`h-1 w-full bg-gradient-to-r ${tone.strip}`} />

            {/* Header guru */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl ${tone.avatar}`}>
                        <Users size={17} />
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {teacher.name || teacher.username}
                            </h3>
                            {hasChanges && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                                    {t('teachers_badge_unsaved')}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">@{teacher.username}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-[11px] font-bold tabular-nums">
                        {assignedClasses.length} kelas
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold tabular-nums">
                        {assignedSubjects.length} mapel
                    </span>
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all ${hasChanges
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-300/50 dark:shadow-amber-950/40'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'}`}
                    >
                        <Save size={14} />
                        {saving ? t('teachers_btn_saving') : t('teachers_btn_save')}
                    </button>
                </div>
            </div>

            {/* Kelas & Mata Pelajaran */}
            <div className="px-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ChipGroup
                    tone="violet"
                    title={t('teachers_table_classes')}
                    icon={<Building2 size={14} />}
                    items={allClasses}
                    selected={assignedClasses}
                    onToggle={toggleClass}
                    selectedLabel={t('teachers_empty_classes')}
                    onSelectAll={() => setAssignedClasses(allClasses.map(c => c.id))}
                    onClear={() => setAssignedClasses([])}
                />

                <ChipGroup
                    tone="emerald"
                    title={t('teachers_table_subjects')}
                    icon={<BookOpen size={14} />}
                    items={allSubjects}
                    selected={assignedSubjects}
                    onToggle={toggleSubject}
                    selectedLabel={t('teachers_empty_subjects')}
                    onSelectAll={() => setAssignedSubjects(allSubjects.map(s => s.id))}
                    onClear={() => setAssignedSubjects([])}
                />
            </div>
        </article>
    );
};

function ChipGroup({ title, icon, items, selected, onToggle, selectedLabel, onSelectAll, onClear, tone = 'violet' }) {
    const { t } = useLanguage();
    const count = selected.length;

    // Panel dan chip aktif memakai warna yang sama dalam satu group, jadi guru
    // bisa langsung tahu panel mana yang sedang diisi.
    const c = CHIP_TONE[tone] || CHIP_TONE.violet;

    return (
        <div className={`relative overflow-hidden rounded-2xl border p-3 ${c.panel}`}>
            <div aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${c.strip}`} />

            <div className="relative flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <p className={`text-xs font-bold inline-flex items-center gap-1.5 ${c.heading}`}>
                    <span className={`grid place-items-center w-5 h-5 rounded-md ${c.icon}`}>
                        {icon}
                    </span>
                    {title}
                    <span className="font-bold tabular-nums">({count})</span>
                </p>

                {items.length > 0 && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onSelectAll}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${c.link}`}
                        >
                            Pilih semua
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <button
                            onClick={onClear}
                            disabled={count === 0}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${c.link}`}
                        >
                            Kosongkan
                        </button>
                    </div>
                )}
            </div>

            {items.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">{selectedLabel}</p>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {items.map(item => {
                        const isSelected = selected.includes(item.id);
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onToggle(item.id)}
                                aria-pressed={isSelected}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${isSelected
                                    ? c.active
                                    : `border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-400 ${c.hover}`}`}
                            >
                                {isSelected ? <Check size={12} /> : <span className="w-3" />}
                                {item.class_name || item.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function TeachersAssignmentsPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [teachers, setTeachers] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dirtyTeacherIds, setDirtyTeacherIds] = useState(() => new Set());

    // useCallback supaya TeacherCard tidak masuk loop effect karena referensi
    // fungsi yang selalu berubah setiap render.
    const handleDirtyChange = useCallback((teacherId, isDirty) => {
        setDirtyTeacherIds(prev => {
            if (isDirty === prev.has(teacherId)) return prev;
            const next = new Set(prev);
            if (isDirty) next.add(teacherId);
            else next.delete(teacherId);
            return next;
        });
    }, []);

    useEffect(() => {
        let active = true;

        async function fetchData() {
            try {
                const [teachersRes, classesRes, teacherSubjectsRes, subjectsRes] = await Promise.all([
                    fetch('/api/teachers/classes'),
                    fetch('/api/classes'),
                    fetch('/api/teachers/subjects'),
                    fetch('/api/subjects')
                ]);

                if (teachersRes.status === 401) {
                    router.push('/');
                    return;
                }

                const teachersData = await teachersRes.json();
                const classesData = await classesRes.json();
                const teacherSubjectsData = await teacherSubjectsRes.json();
                const subjectsData = await subjectsRes.json();
                if (!active) return;

                const mergedTeachers = (teachersData.teachers || []).map(tc => {
                    const ts = (teacherSubjectsData.teachers || []).find(x => x.id === tc.id);
                    return { ...tc, assigned_subjects: ts ? ts.assigned_subjects : [] };
                });

                setTeachers(mergedTeachers);
                setAllClasses(Array.isArray(classesData) ? classesData : (classesData.classes || []));
                setAllSubjects(Array.isArray(subjectsData) ? subjectsData : (subjectsData.subjects || []));
            } catch (error) {
                console.error("Failed to fetch data", error);
                toast.error(t('teachers_error_fetch'));
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchData();
        return () => { active = false; };
    }, [router, t]);

    const filteredTeachers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return teachers;
        return teachers.filter(teacher =>
            (teacher.name || '').toLowerCase().includes(query) ||
            (teacher.username || '').toLowerCase().includes(query)
        );
    }, [teachers, searchQuery]);

    const sortedTeachers = useMemo(() => {
        return [...filteredTeachers].sort((a, b) =>
            (a.name || a.username || '').localeCompare(b.name || b.username || '')
        );
    }, [filteredTeachers]);

    const stats = useMemo(() => {
        const withClasses = teachers.filter(x => (x.assigned_classes || []).length > 0).length;
        const withSubjects = teachers.filter(x => (x.assigned_subjects || []).length > 0).length;
        return { total: teachers.length, withClasses, withSubjects };
    }, [teachers]);

    if (loading) {
        return (
            <div className="space-y-5">
                <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
                    ))}
                </div>
                {[0, 1, 2].map(i => (
                    <div key={i} className="h-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    // Jumlah guru yang punya perubahan belum disimpan. Status "kotor" hidup di
    // dalam kartu (state lokal), jadi halaman ini hanya menyimpan daftar id-nya
    // untuk ditampilkan di header.
    const unsavedCount = dirtyTeacherIds.size;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-emerald-50 dark:from-violet-950/30 dark:via-slate-900 dark:to-emerald-950/30" />
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-emerald-500" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-5">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <span className="shrink-0 grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-emerald-600 text-white shadow-lg shadow-violet-500/25">
                            <Users size={20} />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('nav_teacher_assignments')}</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {t('teachers_subtitle')} Guru hanya bisa melihat ujian dari kelas dan mata pelajaran yang ditugaskan.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                            {sortedTeachers.length} dari {teachers.length} guru
                        </span>
                        {unsavedCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-xs font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                                {unsavedCount} belum disimpan
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Ringkasan */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Guru" value={stats.total} icon={<Users size={13} />} tone="slate" />
                <StatCard label="Ada Kelas Ditugaskan" value={stats.withClasses} icon={<Building2 size={13} />} tone="emerald" />
                <StatCard label="Ada Mapel Ditugaskan" value={stats.withSubjects} icon={<BookOpen size={13} />} tone="violet" />
                <StatCard label="Jumlah Kelas" value={allClasses.length} icon={<Building2 size={13} />} tone="amber" />
            </div>

            {/* Toolbar */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 p-3">
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 to-emerald-500 opacity-70" />
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder={t('teachers_search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label={t('teachers_search_placeholder')}
                        className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            aria-label="Bersihkan pencarian"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <span className="font-semibold">Keterangan:</span>
                <span className="inline-flex items-center gap-1"><Info size={12} /> perubahan disimpan per guru dengan tombol Simpan</span>
            </div>

            {/* Daftar guru */}
            {sortedTeachers.length === 0 ? (
                <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 p-12 text-center">
                    <div className="mx-auto mb-3 grid place-items-center w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-500 dark:text-violet-400">
                        <Users size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('teachers_no_data')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                        {searchQuery
                            ? 'Tidak ada guru yang cocok dengan pencarian. Coba kata kunci lain.'
                            : 'Belum ada akun guru di sistem. Tambahkan pengguna dengan peran Guru di menu Pengguna.'}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                            Reset pencarian
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedTeachers.map(teacher => (
                        <TeacherCard
                            key={teacher.id}
                            teacher={teacher}
                            allClasses={allClasses}
                            allSubjects={allSubjects}
                            onDirtyChange={handleDirtyChange}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon, tone = 'slate' }) {
    // Warna kartu = makna angka: total netral, yang punya tugas = warna
    // kelompok yang ditugaskan (kelas emerald, mapel violet).
    const toneCls = {
        slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
        emerald: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
        violet: 'bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400',
        amber: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    }[tone];

    const valueCls = {
        slate: 'text-slate-900 dark:text-white',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        violet: 'text-violet-600 dark:text-violet-400',
        amber: 'text-amber-600 dark:text-amber-400',
    }[tone];

    return (
        <div className={`group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-slate-200/70 dark:ring-slate-800/70 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-slate-950/40 ${toneCls}`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                <span className="shrink-0 grid place-items-center w-6 h-6 rounded-lg bg-white/70 dark:bg-slate-800/60">
                    {icon}
                </span>
            </div>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${valueCls}`}>{value}</p>
        </div>
    );
}
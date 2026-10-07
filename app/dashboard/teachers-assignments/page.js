'use client';

import { useEffect, useState, useMemo } from 'react';
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

// Kartu satu guru, dengan state kelas & mapel sendiri
const TeacherCard = ({ teacher, allClasses, allSubjects }) => {
    const { t } = useLanguage();
    const [assignedClasses, setAssignedClasses] = useState(teacher.assigned_classes || []);
    const [assignedSubjects, setAssignedSubjects] = useState(teacher.assigned_subjects || []);
    const [saving, setSaving] = useState(false);

    const hasChanges =
        JSON.stringify(teacher.assigned_classes || []) !== JSON.stringify(assignedClasses) ||
        JSON.stringify(teacher.assigned_subjects || []) !== JSON.stringify(assignedSubjects);

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

    return (
        <article className={`rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors ${hasChanges
            ? 'border-amber-300 dark:border-amber-800/70'
            : 'border-slate-200 dark:border-slate-800'}`}
        >
            {/* Header guru */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Users size={17} />
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {teacher.name || teacher.username}
                            </h3>
                            {hasChanges && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                                    {t('teachers_badge_unsaved')}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">@{teacher.username}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                        {assignedClasses.length} kelas
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                        {assignedSubjects.length} mapel
                    </span>
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${hasChanges
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'}`}
                    >
                        <Save size={14} />
                        {saving ? t('teachers_btn_saving') : t('teachers_btn_save')}
                    </button>
                </div>
            </div>

            {/* Kelas & Mata Pelajaran */}
            <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ChipGroup
                    title={t('teachers_table_classes')}
                    icon={<Building2 size={14} />}
                    items={allClasses}
                    selected={assignedClasses}
                    onToggle={toggleClass}
                    selectedLabel={t('teachers_empty_classes')}
                    onSelectAll={() => setAssignedClasses(allClasses.map(c => c.id))}
                    onClear={() => setAssignedClasses([])}
                    activeClass="bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500"
                />

                <ChipGroup
                    title={t('teachers_table_subjects')}
                    icon={<BookOpen size={14} />}
                    items={allSubjects}
                    selected={assignedSubjects}
                    onToggle={toggleSubject}
                    selectedLabel={t('teachers_empty_subjects')}
                    onSelectAll={() => setAssignedSubjects(allSubjects.map(s => s.id))}
                    onClear={() => setAssignedSubjects([])}
                    activeClass="bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500"
                />
            </div>
        </article>
    );
};

function ChipGroup({ title, icon, items, selected, onToggle, selectedLabel, onSelectAll, onClear, activeClass }) {
    const { t } = useLanguage();
    const count = selected.length;

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                    <span className="text-slate-400">{icon}</span>
                    {title}
                    <span className="text-slate-400 font-semibold">({count})</span>
                </p>

                {items.length > 0 && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onSelectAll}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
                        >
                            Pilih semua
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <button
                            onClick={onClear}
                            disabled={count === 0}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${isSelected
                                    ? activeClass
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`}
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
                <div className="h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
                {[0, 1, 2].map(i => (
                    <div key={i} className="h-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('nav_teacher_assignments')}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('teachers_subtitle')} Guru hanya bisa melihat ujian dari kelas dan mata pelajaran yang ditugaskan.
                </p>
            </div>

            {/* Ringkasan */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Guru" value={stats.total} />
                <StatCard label="Ada Kelas Ditugaskan" value={stats.withClasses} tone="emerald" />
                <StatCard label="Ada Mapel Ditugaskan" value={stats.withSubjects} tone="indigo" />
                <StatCard label="Jumlah Kelas" value={allClasses.length} />
            </div>

            {/* Toolbar */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder={t('teachers_search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label={t('teachers_search_placeholder')}
                        className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
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
                <span>{sortedTeachers.length} dari {teachers.length} guru ditampilkan</span>
                <span className="inline-flex items-center gap-1"><Info size={12} /> perubahan disimpan per guru dengan tombol Simpan</span>
            </div>

            {/* Daftar guru */}
            {sortedTeachers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
                        <Users size={18} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('teachers_no_data')}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {searchQuery
                            ? 'Tidak ada guru yang cocok dengan pencarian. Coba kata kunci lain.'
                            : 'Belum ada akun guru di sistem. Tambahkan pengguna dengan peran Guru di menu Pengguna.'}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Reset pencarian
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedTeachers.map(teacher => (
                        <TeacherCard
                            key={teacher.id}
                            teacher={teacher}
                            allClasses={allClasses}
                            allSubjects={allSubjects}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, tone = 'default' }) {
    const toneCls = {
        default: 'text-slate-900 dark:text-white',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        indigo: 'text-indigo-600 dark:text-indigo-400'
    }[tone];

    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
        </div>
    );
}
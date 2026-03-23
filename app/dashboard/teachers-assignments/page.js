'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';

const Icons = {
    User: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Search: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Save: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
};

// Inline row component to manage individual teacher's state
const TeacherRow = ({ teacher, allClasses, allSubjects }) => {
    // Clone initial arrays to state
    const [assignedClasses, setAssignedClasses] = useState(teacher.assigned_classes || []);
    const [assignedSubjects, setAssignedSubjects] = useState(teacher.assigned_subjects || []);
    const [saving, setSaving] = useState(false);
    
    // Check if there are unsaved changes
    const initialClassesRef = JSON.stringify(teacher.assigned_classes || []);
    const initialSubjectsRef = JSON.stringify(teacher.assigned_subjects || []);
    const hasChanges = initialClassesRef !== JSON.stringify(assignedClasses) || initialSubjectsRef !== JSON.stringify(assignedSubjects);

    const toggleClass = (classId) => {
        setAssignedClasses(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]);
    };

    const toggleSubject = (subjectId) => {
        setAssignedSubjects(prev => prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]);
    };

    const handleSave = async () => {
        setSaving(true);
        const toastId = toast.loading(`Menyimpan data ${teacher.name || teacher.username}...`);
        try {
            // Save classes
            const resClasses = await fetch('/api/teachers/classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherId: teacher.id,
                    classIds: assignedClasses
                })
            });
            if (!resClasses.ok) throw new Error('Failed to save classes');

            // Save subjects
            const resSubjects = await fetch('/api/teachers/subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherId: teacher.id,
                    subjectIds: assignedSubjects
                })
            });
            if (!resSubjects.ok) throw new Error('Failed to save subjects');

            // Update local object to reflect saved state
            teacher.assigned_classes = [...assignedClasses];
            teacher.assigned_subjects = [...assignedSubjects];
            
            toast.success(`Data ${teacher.name || teacher.username} berhasil disimpan!`, { id: toastId });
        } catch (e) {
            toast.error(e.message, { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr className="flex flex-col md:table-row border-b md:border-b-0 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <td className="px-4 sm:px-6 py-4 md:whitespace-nowrap align-top border-b md:border-b-0 border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between md:justify-start">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Icons.User />
                        </div>
                        <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{teacher.name || teacher.username}</div>
                            {teacher.name && <div className="text-xs text-slate-500 dark:text-slate-400">@{teacher.username}</div>}
                        </div>
                    </div>
                </div>
                
                {/* Save Button rendering under Teacher info for direct visual mapping */}
                <div className="mt-4 md:ml-14 flex items-center justify-between md:justify-start gap-4">
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all ${
                            hasChanges
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        <Icons.Save />
                        <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
                    </button>
                    {hasChanges && <span className="text-[10px] font-bold text-amber-500 uppercase md:hidden animate-pulse">Perlu Simpan!</span>}
                </div>
            </td>
            
            {/* Assigned Classes Interface */}
            <td className="px-4 sm:px-6 py-4 align-top border-b md:border-b-0 border-slate-100 dark:border-slate-800 md:border-l border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3 md:hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Akses Kelas</span>
                    {assignedClasses.length > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">{assignedClasses.length} Terpilih</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {allClasses.map(cls => (
                        <label key={cls.id} className={`select-none flex items-center p-2 rounded-lg cursor-pointer border transition-all text-xs ${assignedClasses.includes(cls.id) ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={assignedClasses.includes(cls.id)}
                                onChange={() => toggleClass(cls.id)}
                            />
                            <div className={`w-3.5 h-3.5 rounded border mr-2 flex items-center justify-center transition-colors ${assignedClasses.includes(cls.id) ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500'}`}>
                                {assignedClasses.includes(cls.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="font-semibold">{cls.class_name}</span>
                        </label>
                    ))}
                    {allClasses.length === 0 && <span className="text-sm text-slate-400 italic">Belum ada kelas di sistem.</span>}
                </div>
            </td>
            
            {/* Assigned Subjects Interface */}
            <td className="px-4 sm:px-6 py-4 align-top md:border-l border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3 md:hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Akses Mata Pelajaran</span>
                    {assignedSubjects.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">{assignedSubjects.length} Terpilih</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {allSubjects.map(sbj => (
                        <label key={sbj.id} className={`select-none flex items-center p-2 rounded-lg cursor-pointer border transition-all text-xs ${assignedSubjects.includes(sbj.id) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={assignedSubjects.includes(sbj.id)}
                                onChange={() => toggleSubject(sbj.id)}
                            />
                            <div className={`w-3.5 h-3.5 rounded border mr-2 flex items-center justify-center transition-colors ${assignedSubjects.includes(sbj.id) ? 'bg-blue-500 border-blue-500' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500'}`}>
                                {assignedSubjects.includes(sbj.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="font-semibold">{sbj.name}</span>
                        </label>
                    ))}
                    {allSubjects.length === 0 && <span className="text-sm text-slate-400 italic">Belum ada mapel di sistem.</span>}
                </div>
            </td>
        </tr>
    );
};

export default function TeachersAssignmentsPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [teachers, setTeachers] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    useEffect(() => {
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

                // Merge class and subject assignments into one teacher object array
                const mergedTeachers = (teachersData.teachers || []).map(tc => {
                    const ts = (teacherSubjectsData.teachers || []).find(t => t.id === tc.id);
                    return {
                        ...tc,
                        assigned_subjects: ts ? ts.assigned_subjects : []
                    };
                });

                setTeachers(mergedTeachers);
                setAllClasses(Array.isArray(classesData) ? classesData : (classesData.classes || []));
                setAllSubjects(Array.isArray(subjectsData) ? subjectsData : (subjectsData.subjects || []));
            } catch (error) {
                console.error("Failed to fetch data", error);
                toast.error("Gagal memuat data dari database.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [router]);

    // Filter teachers based on search query
    const filteredTeachers = teachers.filter(teacher => {
        const query = searchQuery.toLowerCase();
        const teacherName = (teacher.name || '').toLowerCase();
        const teacherUsername = (teacher.username || '').toLowerCase();
        return teacherName.includes(query) || teacherUsername.includes(query);
    });

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

    const sortedTeachers = useMemo(() => {
        const data = [...filteredTeachers];
        const { direction } = sortConfig;
        
        data.sort((a, b) => {
            const valA = (a.name || a.username).toLowerCase();
            const valB = (b.name || b.username).toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        return data;
    }, [filteredTeachers, sortConfig]);

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-slate-500 dark:text-slate-400">Memuat data guru...</span>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('nav_teacher_assignments')}</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Kelola akses Kelas dan Mata Pelajaran untuk guru secara langsung.</p>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Icons.Search />
                    </div>
                    <input
                        type="text"
                        placeholder="Cari nama guru..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 md:table flex flex-col">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 hidden md:table-header-group">
                            <tr>
                                <th 
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-1/4 cursor-pointer group select-none hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                                    onClick={() => toggleSort('name')}
                                >
                                    <div className="flex items-center gap-3">
                                        Informasi Guru
                                        <SortIcon columnKey="name" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-1/3 border-l border-slate-200 dark:border-slate-700">Akses Kelas</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-1/3 border-l border-slate-200 dark:border-slate-700">Akses Mata Pelajaran</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700 md:table-row-group flex flex-col">
                            {sortedTeachers.map(teacher => (
                                <TeacherRow 
                                    key={teacher.id} 
                                    teacher={teacher} 
                                    allClasses={allClasses} 
                                    allSubjects={allSubjects} 
                                />
                            ))}
                            
                            {sortedTeachers.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <Icons.User />
                                            <span className="mt-2 font-medium">Tidak ada guru yang ditemukan.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

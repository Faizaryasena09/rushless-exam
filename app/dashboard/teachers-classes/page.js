'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const Icons = {
    User: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Check: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
};

export default function TeachersClassesPage() {
    const router = useRouter();
    const [teachers, setTeachers] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [tempSelectedClasses, setTempSelectedClasses] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [teachersRes, classesRes] = await Promise.all([
                    fetch('/api/teachers/classes'),
                    fetch('/api/classes')
                ]);

                if (teachersRes.status === 401) {
                    router.push('/');
                    return;
                }

                const teachersData = await teachersRes.json();
                const classesData = await classesRes.json();

                setTeachers(teachersData.teachers || []);
                // api/classes currently returns array directly, or object depending on route implementation. 
                // Based on previous step, it returns array directly if Admin.
                setAllClasses(Array.isArray(classesData) ? classesData : (classesData.classes || []));
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [router]);

    const openModal = (teacher) => {
        setSelectedTeacher(teacher);
        setTempSelectedClasses(teacher.assigned_classes || []);
    };

    const closeModal = () => {
        setSelectedTeacher(null);
        setTempSelectedClasses([]);
    };

    const toggleClass = (classId) => {
        setTempSelectedClasses(prev => {
            if (prev.includes(classId)) return prev.filter(id => id !== classId);
            return [...prev, classId];
        });
    };

    const handleSave = async () => {
        if (!selectedTeacher) return;
        setSaving(true);
        try {
            const res = await fetch('/api/teachers/classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherId: selectedTeacher.id,
                    classIds: tempSelectedClasses
                })
            });

            if (!res.ok) throw new Error('Failed to save');

            // Update local state
            setTeachers(prev => prev.map(t =>
                t.id === selectedTeacher.id
                    ? { ...t, assigned_classes: tempSelectedClasses }
                    : t
            ));
            closeModal();
        } catch (e) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900">Manage Teacher Classes</h1>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Teacher</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned Classes</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {teachers.map(teacher => (
                            <tr key={teacher.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                            <Icons.User />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-slate-900">{teacher.name || teacher.username}</div>
                                            {teacher.name && <div className="text-xs text-slate-500">@{teacher.username}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        {teacher.assigned_classes && teacher.assigned_classes.length > 0 ? (
                                            teacher.assigned_classes.map(cId => {
                                                const cls = allClasses.find(c => c.id === cId);
                                                return cls ? (
                                                    <span key={cId} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                        {cls.class_name}
                                                    </span>
                                                ) : null;
                                            })
                                        ) : (
                                            <span className="text-sm text-slate-400 italic">No classes assigned</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => openModal(teacher)} className="text-indigo-600 hover:text-indigo-900 font-semibold">
                                        Edit Assignment
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {selectedTeacher && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-900/50 transition-opacity" aria-hidden="true" onClick={closeModal}></div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full relative z-50">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                        <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                                            Assign Classes for <span className="font-bold text-indigo-600">{selectedTeacher.name || selectedTeacher.username}</span>
                                        </h3>
                                        <div className="mt-4 max-h-60 overflow-y-auto border border-slate-100 rounded-lg p-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                {allClasses.map(cls => (
                                                    <label key={cls.id} className={`flex items-center p-3 rounded-lg cursor-pointer border transition-all ${tempSelectedClasses.includes(cls.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                                            checked={tempSelectedClasses.includes(cls.id)}
                                                            onChange={() => toggleClass(cls.id)}
                                                        />
                                                        <span className="ml-2 text-sm text-slate-700 font-medium">{cls.class_name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            {allClasses.length === 0 && <p className="text-sm text-slate-500">No classes found in the system.</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-indigo-300"
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Assignments'}
                                </button>
                                <button
                                    type="button"
                                    className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={closeModal}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState, useCallback } from 'react';

const Icons = {
    Lock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    Unlock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>,
    Logout: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Refresh: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Stop: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
};

export default function ControlPage() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    // New Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('All');

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/control/users');
            if (res.ok) {
                const data = await res.json();
                setStudents(data.students || []);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Poll error", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Compute Derived Data for Filtering
    const classes = ['All', ...new Set(students.map(s => s.class_name).filter(Boolean))];

    const filteredStudents = students.filter(student => {
        const matchesClass = selectedClass === 'All' || student.class_name === selectedClass;
        const matchesSearch = student.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              student.username?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesClass && matchesSearch;
    });


    const handleAction = async (action, payload) => {
        if (action === 'reset_exam' && !confirm('Warning: This will delete the student\'s active exam attempt and log them out. Continue?')) return;
        if (action === 'force_logout' && !confirm('Force logout this user?')) return;

        try {
            const res = await fetch('/api/control/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload })
            });
            if (!res.ok) throw new Error((await res.json()).message);
            fetchStatus(); // Instant refresh
        } catch (e) {
            alert(e.message);
        }
    };

    const handleAddTime = (userId, attemptId) => {
        const minutes = prompt("Enter minutes to add:", "10");
        if (minutes && !isNaN(minutes)) {
            handleAction('add_time', { userId, attemptId, minutes: parseInt(minutes) });
        }
    };

    const handleBatchAddTime = () => {
        const activeFilteredStudents = filteredStudents.filter(s => s.attempt_id && s.is_online);
        if (activeFilteredStudents.length === 0) {
            alert("None of the currently filtered students are active and online taking an exam.");
            return;
        }

        const minutes = prompt(`Enter minutes to add for ${activeFilteredStudents.length} filtered active student(s):`, "10");
        if (minutes && !isNaN(minutes)) {
            const attemptIds = activeFilteredStudents.map(s => s.attempt_id);
            // This bypasses handleAction slightly due to different payload structure need without re-parsing, but handleAction handles it fine if we just pass attemptIds directly in payload.
            handleAction('add_time_batch', { attemptIds, minutes: parseInt(minutes) });
        }
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Loading Control Panel...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Exam Control</h1>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        Updated: {lastUpdated.toLocaleTimeString()}
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-2"></span>
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="Search student..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    {/* Class Filter */}
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {classes.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    {/* Batch Add Time Button */}
                    <button 
                        onClick={handleBatchAddTime}
                        className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold whitespace-nowrap"
                    >
                        + Add Time (Filtered)
                    </button>

                    {/* Refresh Button */}
                    <button onClick={fetchStatus} title="Refresh Data" className="w-full sm:w-auto p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors flex justify-center">
                        <Icons.Refresh />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/80">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Current Activity</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredStudents.map(s => (
                            <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${s.is_online ? 'bg-indigo-50/10' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className={`flex-shrink-0 h-2.5 w-2.5 rounded-full mr-3 ${s.is_online ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-900">{s.name || s.username}</div>
                                            <div className="text-xs text-slate-500">{s.name ? `@${s.username} • ` : ''}{s.class_name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${s.is_online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {s.is_online ? 'Online' : 'Offline'}
                                        </span>
                                        {s.is_locked && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 w-fit">Locked</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {s.current_exam ? (
                                        <div className="text-sm">
                                            <span className="font-bold text-indigo-600">Taking Exam:</span>
                                            <br />{s.current_exam}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-400">Idle</span>
                                    )}
                                    <div className="text-xs text-slate-400 mt-1">
                                        Last active: {s.last_activity_seconds_ago > 3600 ? '> 1h ago' : `${Math.floor(s.last_activity_seconds_ago / 60)}m ago`}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {/* Lock Toggle */}
                                        <button
                                            onClick={() => handleAction('lock_login', { userId: s.id })}
                                            className={`p-2 rounded-lg transition-colors ${s.is_locked ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            title={s.is_locked ? "Unlock Login" : "Lock Login"}
                                        >
                                            {s.is_locked ? <Icons.Lock /> : <Icons.Unlock />}
                                        </button>

                                        {/* Logout */}
                                        <button
                                            onClick={() => handleAction('force_logout', { userId: s.id })}
                                            className="p-2 bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                            title="Force Logout"
                                        >
                                            <Icons.Logout />
                                        </button>

                                        {/* Exam Actions (Only if active) */}
                                        {s.current_exam && (
                                            <>
                                                <div className="w-px h-6 bg-slate-300 mx-1"></div>
                                                <button
                                                    onClick={() => handleAddTime(s.id, s.attempt_id)}
                                                    className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                                    title="Add Time"
                                                >
                                                    <Icons.Clock />
                                                </button>
                                                <button
                                                    onClick={() => handleAction('reset_exam', { userId: s.id, attemptId: s.attempt_id })}
                                                    className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                                                    title="Reset Exam & Logout"
                                                >
                                                    <Icons.Stop />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                            <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                                    No students found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

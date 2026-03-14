'use client';

import { useEffect, useState, useCallback } from 'react';

// --- Icons ---
const I = {
    Table: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Plus: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Edit: () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash: () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Search: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    ChevronLeft: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    ChevronRight: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
    Code: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    Columns: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>,
    Refresh: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    Back: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    Sort: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>,
    SortUp: () => <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z" /></svg>,
    SortDown: () => <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5 5 5-5H5z" /></svg>,
    Database: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
    X: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Key: () => <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M8 2a6 6 0 00-5.47 8.53l-.93.93a1 1 0 000 1.41l.71.71a1 1 0 001.41 0l.93-.93A6 6 0 108 2zm0 10a4 4 0 110-8 4 4 0 010 8z" /></svg>,
    Play: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

function truncateText(text, max = 100) {
    if (text === null || text === undefined) return <span className="text-slate-300 italic">NULL</span>;
    const str = String(text);
    if (str.length <= max) return str;
    return str.substring(0, max) + '…';
}

// ===========================================
// MAIN COMPONENT
// ===========================================
export default function DatabaseManagerPage() {
    const [view, setView] = useState('tables'); // tables | rows | columns | sql
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Row browsing state
    const [rows, setRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [columnDetails, setColumnDetails] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [totalPages, setTotalPages] = useState(0);
    const [orderBy, setOrderBy] = useState('');
    const [orderDir, setOrderDir] = useState('ASC');
    const [searchCol, setSearchCol] = useState('');
    const [searchText, setSearchText] = useState('');

    // Column info state
    const [columnInfo, setColumnInfo] = useState(null);

    // Edit modal state
    const [editModal, setEditModal] = useState(null); // { mode: 'edit'|'insert', row, columns }
    const [editData, setEditData] = useState({});

    // SQL console state
    const [sqlText, setSqlText] = useState('');
    const [sqlResult, setSqlResult] = useState(null);
    const [sqlRunning, setSqlRunning] = useState(false);

    // Notification
    const [notification, setNotification] = useState(null);

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // --- Fetch Tables ---
    const fetchTables = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/db-manager?action=tables');
            if (!res.ok) throw new Error('Failed to fetch tables');
            const data = await res.json();
            setTables(data.tables);
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // --- Fetch Rows ---
    const fetchRows = useCallback(async (tbl, p = 1, ob = '', od = 'ASC', sc = '', st = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                action: 'rows', table: tbl, page: p, limit,
                ...(ob && { orderBy: ob, orderDir: od }),
                ...(st && sc && { search: st, searchCol: sc })
            });
            const res = await fetch(`/api/db-manager?${params}`);
            if (!res.ok) throw new Error('Failed to fetch rows');
            const data = await res.json();
            setRows(data.rows);
            setColumns(data.columns);
            setColumnDetails(data.columnDetails);
            setTotal(data.total);
            setPage(data.page);
            setTotalPages(data.totalPages);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    // --- Fetch Column Info ---
    const fetchColumns = useCallback(async (tbl) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/db-manager?action=columns&table=${tbl}`);
            if (!res.ok) throw new Error('Failed to fetch columns');
            const data = await res.json();
            setColumnInfo(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTables(); }, [fetchTables]);

    // --- Actions ---
    const openTable = (tableName) => {
        setSelectedTable(tableName);
        setView('rows');
        setOrderBy('');
        setOrderDir('ASC');
        setSearchCol('');
        setSearchText('');
        fetchRows(tableName);
    };

    const openColumns = (tableName) => {
        setSelectedTable(tableName);
        setView('columns');
        fetchColumns(tableName);
    };

    const handleSort = (col) => {
        const newDir = orderBy === col && orderDir === 'ASC' ? 'DESC' : 'ASC';
        setOrderBy(col);
        setOrderDir(newDir);
        fetchRows(selectedTable, 1, col, newDir, searchCol, searchText);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchRows(selectedTable, 1, orderBy, orderDir, searchCol, searchText);
    };

    const handlePageChange = (newPage) => {
        fetchRows(selectedTable, newPage, orderBy, orderDir, searchCol, searchText);
    };

    const openInsertModal = () => {
        const emptyData = {};
        columnDetails.forEach(c => { emptyData[c.Field] = ''; });
        setEditData(emptyData);
        setEditModal({ mode: 'insert' });
    };

    const openEditModal = (row) => {
        setEditData({ ...row });
        setEditModal({ mode: 'edit', originalRow: { ...row } });
    };

    const handleSaveRow = async () => {
        try {
            if (editModal.mode === 'insert') {
                const res = await fetch('/api/db-manager', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'insert', table: selectedTable, data: editData })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showNotification(`Row inserted (ID: ${result.insertId})`);
            } else {
                const res = await fetch('/api/db-manager', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update', table: selectedTable,
                        data: editData, where: editModal.originalRow
                    })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showNotification(`Row updated (${result.affectedRows} affected)`);
            }
            setEditModal(null);
            fetchRows(selectedTable, page, orderBy, orderDir, searchCol, searchText);
        } catch (err) {
            showNotification(err.message, 'error');
        }
    };

    const handleDeleteRow = async (row) => {
        if (!confirm('Delete this row? This cannot be undone.')) return;
        try {
            const res = await fetch('/api/db-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', table: selectedTable, where: row })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showNotification(`Row deleted (${result.affectedRows} affected)`);
            fetchRows(selectedTable, page, orderBy, orderDir, searchCol, searchText);
        } catch (err) {
            showNotification(err.message, 'error');
        }
    };

    const handleTruncateTable = async (tableName) => {
        if (!confirm(`TRUNCATE table "${tableName}"? This will delete ALL rows!`)) return;
        if (!confirm(`Are you ABSOLUTELY sure? This cannot be undone!`)) return;
        try {
            const res = await fetch('/api/db-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'truncate', table: tableName })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showNotification(`Table ${tableName} truncated`);
            fetchTables();
        } catch (err) {
            showNotification(err.message, 'error');
        }
    };

    const handleDropTable = async (tableName) => {
        if (!confirm(`DROP table "${tableName}"? This will DELETE the table entirely!`)) return;
        if (!confirm(`FINAL WARNING: Drop "${tableName}"? This CANNOT be undone!`)) return;
        try {
            const res = await fetch('/api/db-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'drop', table: tableName })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showNotification(`Table ${tableName} dropped`);
            setView('tables');
            setSelectedTable(null);
            fetchTables();
        } catch (err) {
            showNotification(err.message, 'error');
        }
    };

    const handleRunSQL = async () => {
        if (!sqlText.trim()) return;
        setSqlRunning(true);
        setSqlResult(null);
        try {
            const res = await fetch('/api/db-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sql', sql: sqlText })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            setSqlResult(result);
        } catch (err) {
            setSqlResult({ type: 'error', message: err.message });
        } finally {
            setSqlRunning(false);
        }
    };

    const goBack = () => {
        setView('tables');
        setSelectedTable(null);
        fetchTables();
    };

    // =========================================
    // RENDER
    // =========================================
    return (
        <div className="space-y-4">
            {/* Notification */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in ${notification.type === 'error'
                    ? 'bg-red-600 dark:bg-red-700 text-white' : 'bg-emerald-600 dark:bg-emerald-700 text-white'
                    }`}>
                    {notification.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {(view !== 'tables') && (
                        <button onClick={goBack} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                            <I.Back />
                        </button>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 truncate">
                            <I.Database />
                            Database Manager
                        </h1>
                        {selectedTable && (
                            <div className="flex items-center gap-2 mt-1 overflow-hidden">
                                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Table:</span>
                                <span className="text-xs sm:text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate">{selectedTable}</span>
                                {total > 0 && <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">({total})</span>}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    {/* View tabs */}
                    {selectedTable && (
                        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-1">
                            {[
                                { id: 'rows', label: 'Rows', icon: <I.Table />, act: () => { setView('rows'); fetchRows(selectedTable); } },
                                { id: 'columns', label: 'Structure', icon: <I.Columns />, act: () => { setView('columns'); fetchColumns(selectedTable); } },
                                { id: 'sql', label: 'SQL', icon: <I.Code />, act: () => { setView('sql'); setSqlText(`SELECT * FROM \`${selectedTable}\` LIMIT 100;`); } }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={tab.act}
                                    className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${view === tab.id ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {tab.icon} <span className={view === tab.id ? 'block' : 'hidden sm:block'}>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {!selectedTable && (
                        <button
                            onClick={() => { setView('sql'); setSqlText(''); setSqlResult(null); }}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all active:scale-95"
                        >
                            <I.Code /> SQL Console
                        </button>
                    )}
                </div>
            </div>

            {/* Loading bar */}
            {loading && <div className="h-0.5 bg-indigo-100 dark:bg-indigo-900/30 rounded overflow-hidden"><div className="h-full bg-indigo-500 rounded animate-pulse w-2/3" /></div>}

            {error && <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* ======================== TABLE LIST VIEW ======================== */}
            {view === 'tables' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all">
                    <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                            <span className="p-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-md"><I.Table /></span>
                            Tables ({tables.length})
                        </h3>
                        <button onClick={fetchTables} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 transition-all active:rotate-180 duration-500"><I.Refresh /></button>
                    </div>

                    {/* Desktop View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
                                    <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Table Name</th>
                                    <th className="text-right py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Rows</th>
                                    <th className="text-right py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Size</th>
                                    <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Engine</th>
                                    <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Collation</th>
                                    <th className="text-center py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tables.map((t, idx) => (
                                    <tr key={t.name} className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-700/10'}`}>
                                        <td className="py-3 px-4">
                                            <button onClick={() => openTable(t.name)} className="font-mono text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                                                {t.name}
                                            </button>
                                        </td>
                                        <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300 font-medium">{(t.rowCount || 0).toLocaleString()}</td>
                                        <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400 text-xs">{t.dataSizeKB} KB</td>
                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase">{t.engine}</td>
                                        <td className="py-3 px-4 text-slate-400 dark:text-slate-500 text-xs">{t.collation}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => openTable(t.name)} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-tighter text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded transition-all">Browse</button>
                                                <button onClick={() => openColumns(t.name)} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-tighter text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all">Structure</button>
                                                <button onClick={() => handleTruncateTable(t.name)} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-tighter text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-all">Truncate</button>
                                                <button onClick={() => handleDropTable(t.name)} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-tighter text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-all">Drop</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="lg:hidden p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {tables.map((t) => (
                            <div key={t.name} className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex flex-col h-full group">
                                <div className="flex justify-between items-start mb-3">
                                    <button onClick={() => openTable(t.name)} className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-tight text-left">
                                        {t.name}
                                    </button>
                                    <span className="text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">{t.engine}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rows</div>
                                        <div className="text-sm font-black text-slate-800 dark:text-white">{(t.rowCount || 0).toLocaleString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Size</div>
                                        <div className="text-sm font-bold font-mono text-slate-600 dark:text-slate-400">{t.dataSizeKB} KB</div>
                                    </div>
                                </div>

                                <div className="mt-auto grid grid-cols-2 gap-2">
                                    <button onClick={() => openTable(t.name)} className="flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-black uppercase text-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white transition-all">
                                        <I.Search /> Browse
                                    </button>
                                    <button onClick={() => openColumns(t.name)} className="flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-black uppercase text-slate-600 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-600 hover:text-white transition-all">
                                        <I.Columns /> Struct
                                    </button>
                                    <button onClick={() => handleTruncateTable(t.name)} className="flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-black uppercase text-amber-600 border border-amber-200 dark:border-amber-900 rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-600 hover:text-white transition-all">
                                        Truncate
                                    </button>
                                    <button onClick={() => handleDropTable(t.name)} className="flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-black uppercase text-red-600 border border-red-200 dark:border-red-900 rounded-lg bg-white dark:bg-slate-800 hover:bg-red-600 hover:text-white transition-all">
                                        Drop
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ======================== ROWS VIEW ======================== */}
            {view === 'rows' && selectedTable && (
                <div className="space-y-3">
                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex gap-2">
                            <button onClick={openInsertModal}
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-black uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95">
                                <I.Plus /> Insert Row
                            </button>
                            <button onClick={() => fetchRows(selectedTable, page, orderBy, orderDir, searchCol, searchText)}
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-black uppercase text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all active:scale-95">
                                <I.Refresh /> Refresh
                            </button>
                        </div>

                        {/* Search */}
                        <form onSubmit={handleSearch} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                            <select value={searchCol} onChange={e => setSearchCol(e.target.value)}
                                className="flex-1 sm:flex-none text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-700 dark:text-white bg-slate-50 dark:bg-slate-700/50 focus:ring-2 focus:ring-indigo-400 outline-none transition-all cursor-pointer">
                                <option value="">Select Column...</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className="relative flex-1 sm:w-48">
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                    placeholder="Search value..."
                                    className="w-full text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-xl pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                                />
                                <I.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                            <button type="submit" className="hidden sm:block p-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 dark:shadow-none"><I.Search /></button>
                        </form>
                    </div>

                    {/* Data Display */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40">
                                        <th className="py-3 px-3 text-slate-500 font-bold uppercase tracking-wider text-[10px] text-center w-20">Actions</th>
                                        {columns.map(col => (
                                            <th key={col}
                                                onClick={() => handleSort(col)}
                                                className="py-3 px-3 text-left text-slate-500 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none whitespace-nowrap transition-colors">
                                                <span className="inline-flex items-center gap-1.5">
                                                    {col}
                                                    {orderBy === col ? (orderDir === 'ASC' ? <I.SortUp /> : <I.SortDown />) : <I.Sort className="opacity-30" />}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={columns.length + 1} className="text-center py-20 text-slate-400 dark:text-slate-500 italic">No data found in this table.</td></tr>
                                    ) : rows.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/20 dark:bg-slate-700/5'}`}>
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1 justify-center">
                                                    <button onClick={() => openEditModal(row)} className="p-1.5 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-all" title="Edit"><I.Edit /></button>
                                                    <button onClick={() => handleDeleteRow(row)} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-all" title="Delete"><I.Trash /></button>
                                                </div>
                                            </td>
                                            {columns.map(col => (
                                                <td key={col} className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 max-w-xs truncate whitespace-nowrap">
                                                    {truncateText(row[col], 80)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden">
                            {rows.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 italic">No data found.</div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {rows.map((row, idx) => (
                                        <div key={idx} className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono text-[10px] font-black text-slate-500 uppercase">Row #{idx + 1 + (page - 1) * limit}</div>
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => openEditModal(row)} className="p-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl active:scale-95 transition-all"><I.Edit /></button>
                                                    <button onClick={() => handleDeleteRow(row)} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/40 rounded-xl active:scale-95 transition-all"><I.Trash /></button>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                {columns.slice(0, 6).map(col => (
                                                    <div key={col} className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{col}</span>
                                                        <span className="text-xs font-mono text-slate-800 dark:text-slate-200 break-all">{row[col] === null ? <span className="text-slate-300 italic">NULL</span> : String(row[col])}</span>
                                                    </div>
                                                ))}
                                                {columns.length > 6 && (
                                                    <button onClick={() => openEditModal(row)} className="w-full text-center py-2 text-[10px] font-black uppercase text-slate-400 hover:text-indigo-500 transition-colors">
                                                        + {columns.length - 6} more columns (click to edit)
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                                Showing <span className="text-indigo-600 dark:text-indigo-400">{(page - 1) * limit + 1}-{Math.min(page * limit, total)}</span> of <span className="text-slate-800 dark:text-white font-black">{total}</span> records
                            </span>
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page <= 1}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-500 transition-all active:scale-75"
                                >
                                    <I.ChevronLeft />
                                </button>
                                <div className="hidden sm:flex items-center gap-1">
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let p;
                                        if (totalPages <= 5) p = i + 1;
                                        else if (page <= 3) p = i + 1;
                                        else if (page >= totalPages - 2) p = totalPages - 4 + i;
                                        else p = page - 2 + i;
                                        return (
                                            <button key={p} onClick={() => handlePageChange(p)}
                                                className={`w-9 h-9 text-xs font-black rounded-lg transition-all ${p === page
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none scale-105'
                                                    : 'text-slate-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 duration-200'}`}>
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="sm:hidden px-3 text-xs font-black text-indigo-600">Page {page} / {totalPages}</div>
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page >= totalPages}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-500 transition-all active:scale-75"
                                >
                                    <I.ChevronRight />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ======================== COLUMNS / STRUCTURE VIEW ======================== */}
            {view === 'columns' && columnInfo && (
                <div className="space-y-4">
                    {/* Columns Structure */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                                <span className="p-1 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-md"><I.Columns /></span>
                                Column Definitions
                            </h3>
                        </div>

                        {/* Desktop View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                                        <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Field</th>
                                        <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Type</th>
                                        <th className="text-center py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Null</th>
                                        <th className="text-center py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Key</th>
                                        <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Default</th>
                                        <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Extra</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {columnInfo.columns.map((col, idx) => (
                                        <tr key={col.Field} className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-violet-50/30 dark:hover:bg-violet-900/10 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/10 dark:bg-slate-700/10'}`}>
                                            <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                {col.Key === 'PRI' && <I.Key className="w-3.5 h-3.5" />}
                                                {col.Field}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{col.Type}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${col.Null === 'YES' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                                    {col.Null}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {col.Key && (
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${col.Key === 'PRI' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : col.Key === 'UNI' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                                        {col.Key}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-slate-500 text-[10px]">{col.Default === null ? <span className="text-slate-300 italic">NULL</span> : String(col.Default)}</td>
                                            <td className="py-3 px-4 text-[10px] font-bold text-slate-400 italic font-mono uppercase">{col.Extra}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {columnInfo.columns.map((col) => (
                                <div key={col.Field} className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            {col.Key === 'PRI' && <I.Key />}
                                            <span className="font-mono text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{col.Field}</span>
                                        </div>
                                        <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 font-black">{col.Type}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nullable</div>
                                            <span className={`text-[10px] font-black uppercase ${col.Null === 'YES' ? 'text-amber-600' : 'text-slate-500'}`}>{col.Null}</span>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Key</div>
                                            <div className="text-right">
                                                <span className={`text-[10px] font-black uppercase ${col.Key === 'PRI' ? 'text-indigo-600' : 'text-slate-500'}`}>{col.Key || '-'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Default</div>
                                            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">{col.Default === null ? 'NULL' : String(col.Default)}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Extra</div>
                                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase italic leading-none">{col.Extra || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Indexes */}
                    {columnInfo.indexes && columnInfo.indexes.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <span className="p-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-md"><I.Key /></span>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Table Indexes ({columnInfo.indexes.length})</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                                            <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase text-[10px]">Index Name</th>
                                            <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase text-[10px]">Column</th>
                                            <th className="text-center py-3 px-4 text-slate-500 font-bold uppercase text-[10px]">Unique</th>
                                            <th className="text-left py-3 px-4 text-slate-500 font-bold uppercase text-[10px]">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {columnInfo.indexes.map((idx, i) => (
                                            <tr key={i} className={`border-b border-slate-50 dark:border-slate-700/50 ${i % 2 === 0 ? '' : 'bg-slate-50/10'}`}>
                                                <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{idx.Key_name}</td>
                                                <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{idx.Column_name}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${idx.Non_unique === 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                                        {idx.Non_unique === 0 ? 'YES' : 'NO'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-[10px] font-bold text-slate-400 uppercase">{idx.Index_type}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* DDL Statement */}
                    {columnInfo.createStatement && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
                                <span className="p-1 bg-slate-800 text-slate-400 rounded-md"><I.Code /></span>
                                <h3 className="font-bold text-slate-200 text-sm">DDL / Create Statement</h3>
                            </div>
                            <pre className="p-5 text-[11px] font-mono leading-relaxed bg-slate-950 text-emerald-400 overflow-x-auto selection:bg-indigo-500 selection:text-white scrollbar-thin scrollbar-thumb-slate-800">
                                {columnInfo.createStatement}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* ======================== SQL CONSOLE ======================== */}
            {view === 'sql' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                        <div className="px-5 py-3.5 bg-slate-800/50 border-b border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                                <span className="p-1 bg-indigo-500 text-white rounded-md"><I.Code /></span>
                                SQL Workspace
                            </h3>
                            <button onClick={handleRunSQL} disabled={sqlRunning || !sqlText.trim()}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 text-xs font-black uppercase text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl transition-all active:scale-95">
                                {sqlRunning ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <I.Play />}
                                {sqlRunning ? 'Executing...' : 'Run Query'}
                            </button>
                        </div>
                        <div className="p-0">
                            <textarea
                                value={sqlText}
                                onChange={e => setSqlText(e.target.value)}
                                onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleRunSQL(); }}
                                rows={8}
                                className="w-full font-mono text-sm p-5 focus:outline-none bg-transparent text-emerald-400 placeholder-slate-600 resize-none leading-relaxed"
                                placeholder="-- Write your SQL query here
SELECT * FROM rhs_users LIMIT 20;"
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    {/* SQL Results */}
                    {sqlResult && (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <h3 className={`font-bold text-sm ${sqlResult.type === 'error' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {sqlResult.type === 'error' ? 'Query Error' :
                                        sqlResult.type === 'select' ? `Result Set (${sqlResult.rowCount} rows)` :
                                            'Command Executed Successfully'}
                                </h3>
                                {sqlResult.duration !== undefined && (
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full uppercase tracking-widest">{sqlResult.duration}ms</span>
                                )}
                            </div>

                            {sqlResult.type === 'error' && (
                                <div className="p-6 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm font-mono leading-relaxed whitespace-pre-wrap">{sqlResult.message}</div>
                            )}

                            {sqlResult.type === 'select' && sqlResult.rows.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                                                {sqlResult.columns.map(col => (
                                                    <th key={col} className="text-left py-3 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sqlResult.rows.map((row, idx) => (
                                                <tr key={idx} className={`border-b border-slate-50 dark:border-slate-700/50 ${idx % 2 === 0 ? '' : 'bg-slate-50/20'}`}>
                                                    {sqlResult.columns.map(col => (
                                                        <td key={col} className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300 max-w-xs truncate whitespace-nowrap">
                                                            {truncateText(row[col], 100)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {sqlResult.type === 'execute' && (
                                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Affected Rows</div>
                                        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{sqlResult.affectedRows}</div>
                                    </div>
                                    {sqlResult.insertId !== undefined && (
                                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                            <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Insert ID</div>
                                            <div className="text-2xl font-black text-blue-700 dark:text-blue-400 font-mono">{sqlResult.insertId}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ======================== EDIT/INSERT MODAL ======================== */}
            {editModal && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 sm:p-4 transition-all duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-500">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                            <div>
                                <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                                    {editModal.mode === 'insert' ? <span className="text-emerald-500">➕</span> : <span className="text-indigo-500">✏️</span>}
                                    {editModal.mode === 'insert' ? 'Insert New Entry' : 'Update Record'}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Table: {selectedTable}</p>
                            </div>
                            <button onClick={() => setEditModal(null)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all active:scale-90"><I.X /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                            {Object.keys(editData).map(key => {
                                const colDetail = columnDetails.find(c => c.Field === key);
                                const isPrimary = colDetail?.Key === 'PRI';
                                const isAutoInc = colDetail?.Extra?.includes('auto_increment');
                                return (
                                    <div key={key} className="group">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 transition-colors group-focus-within:text-indigo-500">
                                                {isPrimary && <I.Key className="w-3 h-3 text-amber-500" />}
                                                <span className="font-mono">{key}</span>
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded italic">{colDetail?.Type}</span>
                                            </label>
                                            {isAutoInc && <span className="text-[8px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full uppercase tracking-tighter">Auto-Inc</span>}
                                        </div>
                                        {colDetail?.Type?.includes('text') || colDetail?.Type?.includes('blob') || colDetail?.Type?.includes('json') ? (
                                            <textarea
                                                value={editData[key] === null ? '' : editData[key]}
                                                onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                                                rows={4}
                                                className="w-full text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500/50 transition-all resize-y"
                                                placeholder={isAutoInc && editModal.mode === 'insert' ? 'Automatically Generated' : 'Value (NULL)'}
                                                disabled={isAutoInc && editModal.mode === 'insert'}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={editData[key] === null ? '' : editData[key]}
                                                onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                                                className="w-full text-sm font-mono border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500/50 transition-all"
                                                placeholder={isAutoInc && editModal.mode === 'insert' ? 'Automatically Generated' : 'Value (NULL)'}
                                                disabled={isAutoInc && editModal.mode === 'insert'}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sticky bottom-0">
                            <button onClick={() => setEditModal(null)}
                                className="order-2 sm:order-1 px-6 py-3 text-xs font-black uppercase text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSaveRow}
                                className="order-1 sm:order-2 px-8 py-3 text-xs font-black uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-95">
                                {editModal.mode === 'insert' ? 'Insert Record' : 'Apply Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

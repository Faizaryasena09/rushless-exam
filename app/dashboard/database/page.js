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
                    ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                    {notification.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {(view !== 'tables') && (
                        <button onClick={goBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                            <I.Back />
                        </button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <I.Database />
                            Database Manager
                        </h1>
                        {selectedTable && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-slate-500">Table:</span>
                                <span className="text-sm font-mono font-semibold text-indigo-600">{selectedTable}</span>
                                {total > 0 && <span className="text-xs text-slate-400">({total} rows)</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* View tabs */}
                {selectedTable && (
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                        <button onClick={() => { setView('rows'); fetchRows(selectedTable); }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'rows' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <span className="flex items-center gap-1"><I.Table /> Rows</span>
                        </button>
                        <button onClick={() => { setView('columns'); fetchColumns(selectedTable); }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'columns' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <span className="flex items-center gap-1"><I.Columns /> Structure</span>
                        </button>
                        <button onClick={() => { setView('sql'); setSqlText(`SELECT * FROM \`${selectedTable}\` LIMIT 100;`); }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'sql' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <span className="flex items-center gap-1"><I.Code /> SQL</span>
                        </button>
                    </div>
                )}

                {!selectedTable && (
                    <button onClick={() => { setView('sql'); setSqlText(''); setSqlResult(null); }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                        <I.Code /> SQL Console
                    </button>
                )}
            </div>

            {/* Loading bar */}
            {loading && <div className="h-0.5 bg-indigo-100 rounded overflow-hidden"><div className="h-full bg-indigo-500 rounded animate-pulse w-2/3" /></div>}

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            {/* ======================== TABLE LIST VIEW ======================== */}
            {view === 'tables' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><I.Database /> Tables ({tables.length})</h3>
                        <button onClick={fetchTables} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-400 transition-colors"><I.Refresh /></button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                    <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Table</th>
                                    <th className="text-right py-2.5 px-4 text-slate-500 font-medium">Rows</th>
                                    <th className="text-right py-2.5 px-4 text-slate-500 font-medium">Size</th>
                                    <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Engine</th>
                                    <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Collation</th>
                                    <th className="text-center py-2.5 px-4 text-slate-500 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tables.map((t, idx) => (
                                    <tr key={t.name} className={`border-b border-slate-50 hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                        <td className="py-2.5 px-4">
                                            <button onClick={() => openTable(t.name)} className="font-mono text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
                                                {t.name}
                                            </button>
                                        </td>
                                        <td className="py-2.5 px-4 text-right text-slate-600">{(t.rowCount || 0).toLocaleString()}</td>
                                        <td className="py-2.5 px-4 text-right font-mono text-slate-500 text-xs">{t.dataSizeKB} KB</td>
                                        <td className="py-2.5 px-4 text-slate-500">{t.engine}</td>
                                        <td className="py-2.5 px-4 text-slate-400 text-xs">{t.collation}</td>
                                        <td className="py-2.5 px-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => openTable(t.name)} className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Browse">Browse</button>
                                                <button onClick={() => openColumns(t.name)} className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Structure">Structure</button>
                                                <button onClick={() => handleTruncateTable(t.name)} className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Truncate">Truncate</button>
                                                <button onClick={() => handleDropTable(t.name)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors" title="Drop">Drop</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ======================== ROWS VIEW ======================== */}
            {view === 'rows' && selectedTable && (
                <div className="space-y-3">
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <div className="flex gap-2">
                            <button onClick={openInsertModal}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
                                <I.Plus /> Insert Row
                            </button>
                            <button onClick={() => fetchRows(selectedTable, page, orderBy, orderDir, searchCol, searchText)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
                                <I.Refresh /> Refresh
                            </button>
                        </div>

                        {/* Search */}
                        <form onSubmit={handleSearch} className="flex gap-2 items-center">
                            <select value={searchCol} onChange={e => setSearchCol(e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-2 text-slate-600 bg-white">
                                <option value="">Column...</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                                placeholder="Search..." className="text-xs border border-slate-200 rounded-lg px-3 py-2 w-40" />
                            <button type="submit" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"><I.Search /></button>
                        </form>
                    </div>

                    {/* Data Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50">
                                        <th className="py-2.5 px-3 text-slate-400 font-medium text-center w-20">Actions</th>
                                        {columns.map(col => (
                                            <th key={col}
                                                onClick={() => handleSort(col)}
                                                className="py-2.5 px-3 text-left text-slate-500 font-medium cursor-pointer hover:text-slate-800 select-none whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1">
                                                    {col}
                                                    {orderBy === col ? (orderDir === 'ASC' ? <I.SortUp /> : <I.SortDown />) : <I.Sort />}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={columns.length + 1} className="text-center py-8 text-slate-400">No rows found</td></tr>
                                    ) : rows.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-slate-50 hover:bg-amber-50/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                            <td className="py-1.5 px-3">
                                                <div className="flex items-center gap-1 justify-center">
                                                    <button onClick={() => openEditModal(row)} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors" title="Edit"><I.Edit /></button>
                                                    <button onClick={() => handleDeleteRow(row)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete"><I.Trash /></button>
                                                </div>
                                            </td>
                                            {columns.map(col => (
                                                <td key={col} className="py-1.5 px-3 font-mono text-slate-700 max-w-xs truncate whitespace-nowrap">
                                                    {truncateText(row[col], 80)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
                                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition-colors"><I.ChevronLeft /></button>
                                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                    let p;
                                    if (totalPages <= 7) p = i + 1;
                                    else if (page <= 4) p = i + 1;
                                    else if (page >= totalPages - 3) p = totalPages - 6 + i;
                                    else p = page - 3 + i;
                                    return (
                                        <button key={p} onClick={() => handlePageChange(p)}
                                            className={`w-8 h-8 text-xs rounded-lg transition-colors ${p === page
                                                ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
                                            {p}
                                        </button>
                                    );
                                })}
                                <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
                                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition-colors"><I.ChevronRight /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ======================== COLUMNS / STRUCTURE VIEW ======================== */}
            {view === 'columns' && columnInfo && (
                <div className="space-y-4">
                    {/* Columns */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><I.Columns /> Columns</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/50">
                                        <th className="text-left py-2 px-4 text-slate-500 font-medium">Field</th>
                                        <th className="text-left py-2 px-4 text-slate-500 font-medium">Type</th>
                                        <th className="text-center py-2 px-4 text-slate-500 font-medium">Null</th>
                                        <th className="text-left py-2 px-4 text-slate-500 font-medium">Key</th>
                                        <th className="text-left py-2 px-4 text-slate-500 font-medium">Default</th>
                                        <th className="text-left py-2 px-4 text-slate-500 font-medium">Extra</th>
                                        <th className="text-left py-2 px-4 text-slate-500 font-medium">Collation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {columnInfo.columns.map((col, idx) => (
                                        <tr key={col.Field} className={`border-b border-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                            <td className="py-2 px-4 font-mono font-medium text-slate-800 flex items-center gap-1.5">
                                                {col.Key === 'PRI' && <I.Key />}
                                                {col.Field}
                                            </td>
                                            <td className="py-2 px-4 font-mono text-indigo-600 text-xs">{col.Type}</td>
                                            <td className="py-2 px-4 text-center">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.Null === 'YES' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {col.Null}
                                                </span>
                                            </td>
                                            <td className="py-2 px-4">
                                                {col.Key && (
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.Key === 'PRI' ? 'bg-amber-50 text-amber-700' : col.Key === 'UNI' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {col.Key}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 px-4 font-mono text-xs text-slate-500">{col.Default === null ? <span className="text-slate-300">NULL</span> : col.Default}</td>
                                            <td className="py-2 px-4 text-xs text-slate-500">{col.Extra}</td>
                                            <td className="py-2 px-4 text-xs text-slate-400">{col.Collation || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Indexes */}
                    {columnInfo.indexes && columnInfo.indexes.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                                <h3 className="font-semibold text-slate-800 text-sm">Indexes ({columnInfo.indexes.length})</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50/50">
                                            <th className="text-left py-2 px-4 text-slate-500 font-medium">Key Name</th>
                                            <th className="text-left py-2 px-4 text-slate-500 font-medium">Column</th>
                                            <th className="text-center py-2 px-4 text-slate-500 font-medium">Unique</th>
                                            <th className="text-left py-2 px-4 text-slate-500 font-medium">Type</th>
                                            <th className="text-right py-2 px-4 text-slate-500 font-medium">Cardinality</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {columnInfo.indexes.map((idx, i) => (
                                            <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                <td className="py-2 px-4 font-mono text-xs text-slate-700">{idx.Key_name}</td>
                                                <td className="py-2 px-4 font-mono text-xs text-indigo-600">{idx.Column_name}</td>
                                                <td className="py-2 px-4 text-center">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${idx.Non_unique === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {idx.Non_unique === 0 ? 'Yes' : 'No'}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-4 text-xs text-slate-500">{idx.Index_type}</td>
                                                <td className="py-2 px-4 text-right text-xs text-slate-500">{idx.Cardinality}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* CREATE TABLE statement */}
                    {columnInfo.createStatement && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                                <h3 className="font-semibold text-slate-800 text-sm">CREATE TABLE Statement</h3>
                            </div>
                            <pre className="p-4 text-xs font-mono text-slate-700 overflow-x-auto bg-slate-900 text-slate-200 leading-relaxed">{columnInfo.createStatement}</pre>
                        </div>
                    )}
                </div>
            )}

            {/* ======================== SQL CONSOLE ======================== */}
            {view === 'sql' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><I.Code /> SQL Console</h3>
                            <button onClick={handleRunSQL} disabled={sqlRunning || !sqlText.trim()}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-lg transition-colors">
                                <I.Play /> {sqlRunning ? 'Running...' : 'Execute (Ctrl+Enter)'}
                            </button>
                        </div>
                        <div className="p-4">
                            <textarea
                                value={sqlText}
                                onChange={e => setSqlText(e.target.value)}
                                onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleRunSQL(); }}
                                rows={6}
                                className="w-full font-mono text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-900 text-emerald-400 placeholder-slate-600 resize-y"
                                placeholder="SELECT * FROM rhs_users LIMIT 10;"
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    {/* SQL Results */}
                    {sqlResult && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <h3 className="font-semibold text-slate-800 text-sm">
                                    {sqlResult.type === 'error' ? '❌ Error' :
                                        sqlResult.type === 'select' ? `✅ ${sqlResult.rowCount} rows returned` :
                                            `✅ ${sqlResult.affectedRows} row(s) affected`}
                                </h3>
                                {sqlResult.duration !== undefined && (
                                    <span className="text-xs text-slate-400">{sqlResult.duration}ms</span>
                                )}
                            </div>

                            {sqlResult.type === 'error' && (
                                <div className="p-4 text-red-600 text-sm font-mono">{sqlResult.message}</div>
                            )}

                            {sqlResult.type === 'select' && sqlResult.rows.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                                {sqlResult.columns.map(col => (
                                                    <th key={col} className="text-left py-2 px-3 text-slate-500 font-medium whitespace-nowrap">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sqlResult.rows.map((row, idx) => (
                                                <tr key={idx} className={`border-b border-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                    {sqlResult.columns.map(col => (
                                                        <td key={col} className="py-1.5 px-3 font-mono text-slate-700 max-w-xs truncate whitespace-nowrap">
                                                            {truncateText(row[col], 80)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {sqlResult.type === 'execute' && (
                                <div className="p-4 text-sm text-slate-600">
                                    <p>Affected rows: <strong>{sqlResult.affectedRows}</strong></p>
                                    {sqlResult.insertId && <p>Insert ID: <strong>{sqlResult.insertId}</strong></p>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ======================== EDIT/INSERT MODAL ======================== */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800">
                                {editModal.mode === 'insert' ? '➕ Insert New Row' : '✏️ Edit Row'}
                            </h3>
                            <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"><I.X /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-3">
                            {Object.keys(editData).map(key => {
                                const colDetail = columnDetails.find(c => c.Field === key);
                                const isPrimary = colDetail?.Key === 'PRI';
                                const isAutoInc = colDetail?.Extra?.includes('auto_increment');
                                return (
                                    <div key={key}>
                                        <label className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                                            {isPrimary && <I.Key />}
                                            <span className="font-mono">{key}</span>
                                            <span className="text-slate-400 font-normal">({colDetail?.Type})</span>
                                            {isAutoInc && <span className="text-xs text-amber-500 bg-amber-50 px-1.5 rounded">auto_increment</span>}
                                        </label>
                                        {colDetail?.Type?.includes('text') || colDetail?.Type?.includes('blob') || colDetail?.Type?.includes('json') ? (
                                            <textarea
                                                value={editData[key] === null ? '' : editData[key]}
                                                onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                                                rows={3}
                                                className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                                                placeholder={isAutoInc && editModal.mode === 'insert' ? 'Auto-generated' : 'NULL'}
                                                disabled={isAutoInc && editModal.mode === 'insert'}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={editData[key] === null ? '' : editData[key]}
                                                onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                                                className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                placeholder={isAutoInc && editModal.mode === 'insert' ? 'Auto-generated' : 'NULL'}
                                                disabled={isAutoInc && editModal.mode === 'insert'}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                            <button onClick={() => setEditModal(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSaveRow}
                                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
                                {editModal.mode === 'insert' ? 'Insert' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

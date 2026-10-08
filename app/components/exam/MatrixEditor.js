'use client';

import { Plus, Trash2, Check } from 'lucide-react';
import { columnTone } from './MatrixTable';

/**
 * Editor untuk tipe soal `true_false_matrix`.
 *
 * Dipakai bersama oleh:
 * - app/dashboard/exams/questions/[id]/page.js (edit + input manual)
 * - app/components/bank/BankQuestionForm.js
 *
 * Komponen ini sengaja tidak mengimpor Jodit sendiri supaya pemanggil bisa
 * menyuntikkan editor-nya (Jodit hanya boleh dimuat di client).
 */

const INPUT_CLASS =
    'w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all';

const MAX_COLUMNS = 6;

function nextKey(columns) {
    let idx = 0;
    const used = new Set(columns.map(c => c.key));
    while (used.has(String.fromCharCode(65 + idx))) idx += 1;
    return String.fromCharCode(65 + idx);
}

export default function MatrixEditor({
    columns = [],
    onColumnsChange,
    items = [],
    onItemsChange,
    correctKeys = [],
    onCorrectKeysChange,
    Editor,
    isEmptyStatement = (text) => !(text || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
}) {
    const updateColumnLabel = (key, label) => {
        onColumnsChange(columns.map(col => (col.key === key ? { ...col, label } : col)));
    };

    const addColumn = () => {
        if (columns.length >= MAX_COLUMNS) return;
        onColumnsChange([...columns, { key: nextKey(columns), label: '' }]);
    };

    const removeColumn = (key) => {
        if (columns.length <= 2) return;
        const next = columns.filter(col => col.key !== key);
        onColumnsChange(next);
        // Kunci yang menunjuk kolom dihapus harus dialihkan ke kolom pertama.
        const fallback = next[0]?.key || 'A';
        onCorrectKeysChange?.(correctKeys.map(k => (k === key ? fallback : k)));
    };

    const updateItem = (id, text) => {
        onItemsChange(items.map(item => (item.id === id ? { ...item, text } : item)));
    };

    const addItem = () => {
        const used = new Set(items.map(i => i.id));
        let n = items.length + 1;
        while (used.has(`r${n}`)) n += 1;
        onItemsChange([...items, { id: `r${n}`, text: '' }]);
        onCorrectKeysChange?.([...correctKeys, columns[0]?.key || 'A']);
    };

    const removeItem = (id) => {
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return;
        onItemsChange(items.filter(item => item.id !== id));
        const nextKeys = [...correctKeys];
        nextKeys.splice(index, 1);
        onCorrectKeysChange?.(nextKeys);
    };

    const setCorrectKey = (index, key) => {
        const next = [...correctKeys];
        while (next.length < items.length) next.push(columns[0]?.key || 'A');
        next[index] = key;
        onCorrectKeysChange?.(next);
    };

    const incompleteColumn = columns.some(col => !col.label.trim());
    const incompleteItem = items.some(item => isEmptyStatement(item.text));

    return (
        <div className="space-y-5">
            {/* Kolom aksi */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                            Kolom Jawaban
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Minimal 2 kolom, maksimal {MAX_COLUMNS}. Tiap baris hanya boleh memilih satu kolom.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={addColumn}
                        disabled={columns.length >= MAX_COLUMNS}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-cyan-300 dark:border-cyan-800 bg-cyan-50/40 dark:bg-cyan-950/20 text-xs font-extrabold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/60 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        <Plus size={14} />
                        Tambah Kolom
                    </button>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                    {columns.map((col, idx) => {
                        const tone = columnTone(idx);
                        return (
                            <div
                                key={col.key}
                                className="flex items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm"
                            >
                                <span className={`h-6 w-1.5 shrink-0 rounded-full bg-gradient-to-b ${tone.bar}`} aria-hidden="true" />
                                <input
                                    type="text"
                                    value={col.label}
                                    placeholder="misal: Benar"
                                    onChange={(e) => updateColumnLabel(col.key, e.target.value)}
                                    className={INPUT_CLASS}
                                />
                                {columns.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => removeColumn(col.key)}
                                        aria-label={`Hapus kolom ${col.label || col.key}`}
                                        className="shrink-0 p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {incompleteColumn && (
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        Ada kolom tanpa label. Beri nama dulu sebelum disimpan.
                    </p>
                )}
            </div>

            {/* Baris pernyataan */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                            Pernyataan
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Tulis tiap pernyataan, lalu tentukan kolom mana yang jadi kunci jawabannya.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={addItem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-cyan-300 dark:border-cyan-800 bg-cyan-50/40 dark:bg-cyan-950/20 text-xs font-extrabold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100/60 transition-all shadow-xs shrink-0"
                    >
                        <Plus size={14} />
                        Tambah Pernyataan
                    </button>
                </div>

                <div className="space-y-2.5">
                    {items.map((item, index) => {
                        const selectedKey = correctKeys[index] || columns[0]?.key || 'A';
                        return (
                            <div
                                key={item.id}
                                className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2.5"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-xs font-extrabold tabular-nums">
                                        {String.fromCharCode(65 + index)}.
                                    </span>
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id)}
                                            aria-label={`Hapus pernyataan ${String.fromCharCode(65 + index)}`}
                                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>

                                {Editor ? (
                                    <Editor
                                        value={item.text || ''}
                                        // placeholder WAJIB string. Kalau undefined, Jodit
                                        // melempar "i18n: Need string in first argument".
                                        placeholder="Tulis pernyataan di sini…"
                                        // onChange = sinkron live, onBlur = jaring pengaman
                                        // kalau Jodit tidak memancarkan 'change' (mis. paste).
                                        onChange={newContent => updateItem(item.id, newContent)}
                                        onBlur={newContent => updateItem(item.id, newContent)}
                                    />
                                ) : (
                                    <textarea
                                        value={item.text || ''}
                                        onChange={(e) => updateItem(item.id, e.target.value)}
                                        rows={2}
                                        className={`${INPUT_CLASS} font-normal`}
                                        placeholder="Tulis pernyataan…"
                                    />
                                )}

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                                        Kunci
                                    </span>
                                    {columns.map((col, colIdx) => {
                                        const tone = columnTone(colIdx);
                                        const active = selectedKey === col.key;
                                        return (
                                            <label
                                                key={col.key}
                                                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-extrabold transition-all duration-200 ${
                                                    active ? tone.chip : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`matrix_correct_${item.id}`}
                                                    className="sr-only"
                                                    checked={active}
                                                    onChange={() => setCorrectKey(index, col.key)}
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className={`grid place-items-center w-4 h-4 rounded-md border-2 ${
                                                        active
                                                            ? `border-transparent bg-gradient-to-br ${tone.bar} text-white`
                                                            : 'border-slate-300 dark:border-slate-600'
                                                    }`}
                                                >
                                                    {active && <Check size={11} strokeWidth={3.5} />}
                                                </span>
                                                {col.label || col.key}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {incompleteItem && (
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        Ada pernyataan yang masih kosong.
                    </p>
                )}
            </div>
        </div>
    );
}
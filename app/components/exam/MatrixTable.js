'use client';

/**
 * Tabel pernyataan (tipe soal `true_false_matrix`).
 *
 * Satu komponen dipakai di 4 tempat supaya tampilannya tidak pernah berbeda:
 * - halaman kerjakan (siswa, interaktif)
 * - halaman preview (pengajar, interaktif)
 * - bank soal (pratinjau read-only)
 * - halaman hasil / analisis (read-only + kunci jawaban)
 */

const COLUMN_TONE = [
    {
        chip: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60',
        bar: 'from-emerald-500 to-teal-500',
        text: 'text-emerald-600 dark:text-emerald-400',
    },
    {
        chip: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
        bar: 'from-rose-500 to-pink-500',
        text: 'text-rose-600 dark:text-rose-400',
    },
    {
        chip: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
        bar: 'from-amber-500 to-orange-500',
        text: 'text-amber-600 dark:text-amber-400',
    },
    {
        chip: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60',
        bar: 'from-indigo-500 to-violet-500',
        text: 'text-indigo-600 dark:text-indigo-400',
    },
    {
        chip: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/60',
        bar: 'from-violet-500 to-fuchsia-500',
        text: 'text-violet-600 dark:text-violet-400',
    },
    {
        chip: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60',
        bar: 'from-sky-500 to-cyan-500',
        text: 'text-sky-600 dark:text-sky-400',
    },
];

export function columnTone(index) {
    return COLUMN_TONE[index % COLUMN_TONE.length];
}

/**
 * @param {Array<{key: string, label: string}>} columns
 * @param {Array<{id: string, text: string}>} items
 * @param {object}   value            map { itemId: columnKey }
 * @param {Function} onChange         (itemId, columnKey) => void
 * @param {boolean}  disabled
 * @param {Array}    correctKeys      index = urutan baris (mode review)
 * @param {string}   statementLabel   judul kolom kiri
 * @param {string}   statementClass   class font untuk isi pernyataan (accessibility font-size)
 * @param {string}   groupId          prefix unik name radio per soal (wajib saat >1 soal di halaman)
 */
export default function MatrixTable({
    columns = [],
    items = [],
    value = {},
    onChange,
    disabled = false,
    correctKeys = null,
    statementLabel = 'Pernyataan',
    statementClass = 'text-sm',
    groupId = 'matrix',
}) {
    if (!columns.length || !items.length) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                Belum ada pernyataan pada soal ini.
            </div>
        );
    }

    const review = Array.isArray(correctKeys);

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                            <th
                                scope="col"
                                className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700"
                            >
                                {statementLabel}
                            </th>
                            {columns.map((col, idx) => {
                                const tone = columnTone(idx);
                                return (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        className="px-3 py-3 text-center border-b border-slate-200 dark:border-slate-700 min-w-[6.5rem]"
                                    >
                                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.chip}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-r ${tone.bar}`} aria-hidden="true" />
                                            {col.label}
                                        </span>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, rowIndex) => {
                            const selectedKey = value?.[item.id] || '';
                            const correctKey = review ? (correctKeys[rowIndex] || '') : null;
                            return (
                                <tr
                                    key={item.id}
                                    className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <th
                                        scope="row"
                                        className={`sticky left-0 z-10 bg-white dark:bg-slate-900 px-4 py-3 font-normal text-slate-700 dark:text-slate-200 ${statementClass}`}
                                    >
                                        <span className="mr-2 inline-block min-w-[1.75rem] font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                                            {String.fromCharCode(65 + rowIndex)}.
                                        </span>
                                        <span
                                            className="custom-content-wrapper"
                                            dangerouslySetInnerHTML={{ __html: item.text }}
                                        />
                                    </th>
                                    {columns.map((col, idx) => {
                                        const tone = columnTone(idx);
                                        const isSelected = selectedKey === col.key;
                                        const isCorrectKey = review && correctKey === col.key;
                                        // Tiga kondisi yang harus dibedakan jelas di mode review:
                                        // - kunci terisi & cocok  -> hijau (tone kolom)
                                        // - kunci terisi tapi salah -> merah
                                        // - baris tidak dijawab    -> merah muda + kunci ditandai
                                        const isWrongPick = review && isSelected && !isCorrectKey;
                                        const isMissedKey = review && !selectedKey && isCorrectKey;

                                        let cellClass = 'px-3 py-3 text-center transition-colors';
                                        if (isSelected) cellClass += ' bg-gradient-to-b from-white to-slate-50/60 dark:from-slate-900 dark:to-slate-800/40';
                                        if (isWrongPick) cellClass += ' bg-rose-50/70 dark:bg-rose-950/30';
                                        if (isMissedKey) cellClass += ' bg-amber-50/70 dark:bg-amber-950/30';

                                        let chipClass = 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50';
                                        if (isSelected) chipClass = tone.chip;
                                        else if (isWrongPick) chipClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60';
                                        else if (isMissedKey) chipClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60';

                                        return (
                                            <td key={col.key} className={cellClass}>
                                                <label
                                                    className={`inline-flex items-center justify-center rounded-xl border px-2 py-1.5 transition-all duration-200 ${chipClass} ${
                                                        disabled ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60 dark:hover:shadow-slate-950/50'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`${groupId}-${item.id}`}
                                                        className="sr-only"
                                                        checked={isSelected}
                                                        disabled={disabled || !onChange}
                                                        onChange={() => onChange?.(item.id, col.key)}
                                                    />
                                                    {isCorrectKey ? (
                                                        <span className={`text-xs font-semibold ${isSelected ? tone.text : 'text-amber-600 dark:text-amber-400'}`} title="Kunci jawaban">
                                                            &#10003;
                                                        </span>
                                                    ) : (
                                                        <span
                                                            aria-hidden="true"
                                                            className={`h-4 w-4 rounded-full border-2 ${
                                                                isSelected
                                                                    ? `border-transparent bg-gradient-to-r ${tone.bar}`
                                                                    : isWrongPick
                                                                        ? 'border-rose-400 dark:border-rose-500'
                                                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                                            }`}
                                                        />
                                                    )}
                                                    <span className="sr-only">{col.label}</span>
                                                </label>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {review ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tanda centang (✓) menandai kunci jawaban tiap baris. Sel merah = jawaban siswa salah, sel amber = baris itu tidak dijawab.
                </p>
            ) : null}
        </div>
    );
}
/**
 * Helper untuk tipe soal `true_false_matrix`
 * (tabel pernyataan dengan 2-N kolom aksi yang bisa dikustom labelnya).
 *
 * Bentuk penyimpanan:
 * - options          : { "A": "Benar", "B": "Salah" }  (label kolom, bebas 2-N)
 * - matrix_items     : [{ id, text }, ...]             (urutan = urutan baris)
 * - scoring_metadata : { matrixKeys: ["A", "B", ...] } (kunci per baris, index = urutan baris)
 * - correct_option   : sentinel "MATRIX" (kunci asli ada di scoring_metadata)
 */

export const MATRIX_TYPE = 'true_false_matrix';
export const MATRIX_SENTINEL = 'MATRIX';
export const MATRIX_STRATEGIES = ['matrix_partial', 'matrix_strict'];

export const DEFAULT_MATRIX_COLUMNS = { A: 'Benar', B: 'Salah' };

function parseMaybeJson(value, fallback) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return parsed === null || parsed === undefined ? fallback : parsed;
    } catch {
        return fallback;
    }
}

/**
 * Kolom aksi -> [{ key, label }]. Selalu minimal 2 kolom.
 *
 * Menerima 3 bentuk input sekaligus karena kolom yang sampai ke client berbeda
 * bentuknya per sumber:
 * - object map dari DB          : { "A": "Benar", "B": "Salah" }
 * - array dari /api/exams/questions: [{ originalKey: "A", text: "Benar" }]
 * - array ringkas (bank)        : [{ key: "A", label: "Benar" }]
 */
export function normalizeMatrixColumns(options) {
    const parsed = parseMaybeJson(options, {});
    const rawColumns = Array.isArray(parsed)
        ? parsed.map((col, idx) => {
            if (typeof col === 'string') {
                return { key: String.fromCharCode(65 + idx), label: col };
            }
            return {
                key: String(col?.originalKey ?? col?.key ?? String.fromCharCode(65 + idx)),
                label: String(col?.text ?? col?.label ?? ''),
            };
        })
        : Object.entries(parsed && typeof parsed === 'object' ? parsed : {}).map(([key, label]) => ({
            key: String(key),
            label: String(label ?? ''),
        }));

    const columns = rawColumns
        .map(col => ({ key: col.key, label: col.label.trim() }))
        .filter(col => col.label !== '');

    if (columns.length === 0) {
        return Object.entries(DEFAULT_MATRIX_COLUMNS).map(([key, label]) => ({ key, label }));
    }
    return columns;
}

/**
 * Baris pernyataan -> [{ id, text }] dengan id selalu string & unik.
 */
export function normalizeMatrixItems(matrixItems) {
    const parsed = parseMaybeJson(matrixItems, []);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    return parsed
        .map(item => {
            const text = typeof item === 'string' ? item : String(item?.text ?? '');
            let id = String(item?.id ?? '').trim();
            if (!id || seen.has(id)) {
                let candidate = `r${seen.size + 1}`;
                while (seen.has(candidate)) candidate = `r${seen.size + 1}x${candidate}`;
                id = candidate;
            }
            seen.add(id);
            return { id, text };
        })
        .filter(item => item.text.trim() !== '' && item.text.replace(/<[^>]*>/g, '').trim() !== '');
}

/**
 * Kunci jawaban per baris -> array of column key, panjang = jumlah item.
 * Baris yang belum punya kunci diisi dengan kolom pertama.
 */
export function normalizeMatrixKeys(keys, itemCount, columns) {
    const parsed = parseMaybeJson(keys, []);
    const list = Array.isArray(parsed) ? parsed : [];
    const fallbackKey = columns[0]?.key ?? 'A';

    const result = [];
    for (let i = 0; i < itemCount; i += 1) {
        const raw = list[i];
        const key = String(raw ?? '').trim();
        result.push(key || fallbackKey);
    }
    return result;
}

/**
 * Ambil kunci jawaban dari scoring_metadata soal.
 */
export function getMatrixKeys(scoringMetadata) {
    const meta = parseMaybeJson(scoringMetadata, {});
    return Array.isArray(meta?.matrixKeys) ? meta.matrixKeys : [];
}

/**
 * Pesan error yang menyebut kolom mana yang belum diberi label, supaya
 * "kenapa ga ke save" jelas tanpa perlu menebak.
 */
export function unlabeledColumnError(columns) {
    const missing = (columns || [])
        .filter(col => !String(col.label ?? '').trim())
        .map(col => `kolom ${col.key}`);

    if (missing.length === 0) return 'Ada kolom jawaban yang belum diberi label.';
    return `Beri nama dulu pada ${missing.join(', ')} sebelum menyimpan.`;
}

/**
 * Apakah semua baris tabel sudah dijawab.
 * Dipakai supaya tabel yang baru diisi 1 dari 4 baris tidak dihitung "selesai"
 * oleh indikator progres maupun pengecekan "wajib menjawab semua".
 *
 * `items` boleh berupa [{ id, text }] (dari matrix_items) atau array id string.
 */
export function isMatrixAnswerComplete(answer, items) {
    const expectedIds = (Array.isArray(items) ? items : [])
        .map(item => (typeof item === 'string' ? item : item?.id))
        .filter(id => id !== undefined && id !== null && String(id) !== '');

    if (expectedIds.length === 0) return false;

    const choices = parseMatrixAnswer(answer);
    return expectedIds.every(id => {
        const key = choices[id];
        return typeof key === 'string' && key !== '';
    });
}

/**
 * Parse jawaban siswa { itemId: columnKey } dari string JSON.
 * Selalu mengembalikan objek supaya aman dipakai langsung di render.
 */
export function parseMatrixAnswer(answer) {
    const parsed = parseMaybeJson(answer, null);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
}

/**
 * Peta "huruf baris" -> nilai jawaban untuk teks jawaban di export.
 * Contoh keluaran: "A=Salah, B=Benar".
 */
export function describeMatrixKeys(keys, items, columns) {
    const list = Array.isArray(items) ? items : normalizeMatrixItems(items);
    if (list.length === 0) return '';

    const normalizedColumns = normalizeMatrixColumns(columns);
    const resolved = normalizeMatrixKeys(keys, list.length, normalizedColumns);
    const labelOf = key => normalizedColumns.find(col => col.key === key)?.label || key;

    return list
        .map((_, idx) => `${String.fromCharCode(65 + idx)}=${labelOf(resolved[idx])}`)
        .join(', ');
}
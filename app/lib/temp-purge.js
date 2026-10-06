import { query } from './db';
import { ensureArchiveTable } from './temp-archive';

/**
 * PEMBERSIHAN ARSIP JAWABAN
 * =========================
 * Arsip jawaban (rhs_temporary_answer_archive) disimpan 30 hari sejak
 * jawaban diarsipkan (≈ waktu siswa submit), lalu dihapus bertahap.
 *
 * Penghapusannya bertahap (per 1000 baris) supaya tabel besar tidak terkunci
 * lama dan tidak membebani replication/log.
 */

// Retensi default 30 hari, bisa diubah lewat env TEMP_RETENTION_DAYS
export const TEMP_RETENTION_DAYS = Number(process.env.TEMP_RETENTION_DAYS) || 30;

const DELETE_CHUNK = 1000;

/**
 * Hapus arsip yang sudah melewati masa retensi.
 * @param {number} retentionDays
 * @param {boolean} dryRun hanya hitung, tidak menghapus
 */
export async function purgeExpiredTempAnswers(retentionDays = TEMP_RETENTION_DAYS, dryRun = false) {
    await ensureArchiveTable();

    try {
        if (dryRun) {
            const rows = await query({
                query: `SELECT COUNT(*) AS c FROM rhs_temporary_answer_archive
                        WHERE archived_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
                values: [retentionDays]
            });
            return { deleted: 0, wouldDelete: rows[0].c, retentionDays, dryRun: true };
        }

        let deleted = 0;
        // Loop sampai tidak ada lagi baris yang perlu dihapus.
        // LIMIT tanpa ORDER BY aman karena semua baris yang tersisa memenuhi kondisi.
        while (true) {
            const res = await query({
                query: `DELETE FROM rhs_temporary_answer_archive
                        WHERE archived_at < DATE_SUB(NOW(), INTERVAL ? DAY)
                        LIMIT ${DELETE_CHUNK}`,
                values: [retentionDays]
            });
            const affected = res?.affectedRows || 0;
            deleted += affected;
            if (affected < DELETE_CHUNK) break;
            if (deleted > 500000) { // pengaman runaway loop
                console.warn('[TempPurge] Melewati 500.000 baris, dihentikan di siklus ini.');
                break;
            }
        }

        const remaining = await query({
            query: 'SELECT COUNT(*) AS c FROM rhs_temporary_answer_archive',
            values: []
        });

        console.log(`[TempPurge] Selesai: ${deleted} baris arsip (> ${retentionDays} hari) dihapus, sisa ${remaining[0].c}`);
        return { deleted, remaining: remaining[0].c, retentionDays, dryRun: false };
    } catch (err) {
        console.error('[TempPurge] Gagal membersihkan arsip:', err.message);
        return { deleted: 0, remaining: null, retentionDays, error: err.message };
    }
}
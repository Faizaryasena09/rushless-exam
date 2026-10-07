import { query } from './db';

/**
 * Skema lengkap tabel activity log.
 * Kolom baru (request_id, method, path, status_code, user_agent, error_name,
 * stack_trace, duration_ms) ditambahkan lewat migrasi ALTER TABLE di bawah
 * supaya aman untuk instalasi lama yang tabelnya sudah ada.
 */
const CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS rhs_activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        username VARCHAR(255),
        ip_address VARCHAR(45),
        action VARCHAR(100) NOT NULL,
        level ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
        details TEXT,
        request_id VARCHAR(64),
        method VARCHAR(10),
        path VARCHAR(255),
        status_code SMALLINT,
        user_agent VARCHAR(512),
        error_name VARCHAR(255),
        stack_trace MEDIUMTEXT,
        duration_ms INT,
        fallback_id VARCHAR(64) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_level (level),
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_request_id (request_id)
    )
`;

const NEW_COLUMNS = [
    { name: 'request_id', ddl: 'VARCHAR(64)' },
    { name: 'method', ddl: 'VARCHAR(10)' },
    { name: 'path', ddl: 'VARCHAR(255)' },
    { name: 'status_code', ddl: 'SMALLINT' },
    { name: 'user_agent', ddl: 'VARCHAR(512)' },
    { name: 'error_name', ddl: 'VARCHAR(255)' },
    { name: 'stack_trace', ddl: 'MEDIUMTEXT' },
    { name: 'duration_ms', ddl: 'INT' },
    { name: 'fallback_id', ddl: 'VARCHAR(64) UNIQUE' }
];

let schemaReady = false;
let schemaPromise = null;

/**
 * Skema tabel log ujian + kolom fallback_id (unik) supaya replay file
 * fallback ke MySQL bersifat idempotent (tidak menghasilkan duplikat).
 */
const CREATE_EXAM_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS rhs_exam_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attempt_id INT NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        description TEXT,
        fallback_id VARCHAR(64) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_attempt_id (attempt_id),
        INDEX idx_created_at (created_at)
    )
`;

const EXAM_COLUMNS = [
    { name: 'fallback_id', ddl: 'VARCHAR(64) UNIQUE' }
];

/**
 * Pastikan tabel + kolom baru tersedia. Aman dipanggil berulang kali.
 */
export async function ensureActivityLogsSchema() {
    if (schemaReady) return;
    if (schemaPromise) return schemaPromise;

    schemaPromise = (async () => {
        try {
            await query({ query: CREATE_TABLE_SQL });
        } catch (err) {
            console.error('[ActivityLogSchema] Gagal membuat tabel:', err.message);
            return;
        }

        for (const col of NEW_COLUMNS) {
            try {
                await query({
                    query: `ALTER TABLE rhs_activity_logs ADD COLUMN ${col.name} ${col.ddl}`
                });
            } catch (err) {
                // ER_DUP_FIELDNAME (1060) = kolom sudah ada, aman diabaikan.
                if (err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME' || /duplicate column/i.test(err.message || ''))) {
                    continue;
                }
                console.error(`[ActivityLogSchema] Gagal menambah kolom ${col.name}:`, err.message);
            }
        }

        // Tabel log ujian (dipakai juga oleh logExamActivity)
        try {
            await query({ query: CREATE_EXAM_TABLE_SQL });
        } catch (err) {
            console.error('[ActivityLogSchema] Gagal membuat tabel rhs_exam_logs:', err.message);
        }

        for (const col of EXAM_COLUMNS) {
            try {
                await query({
                    query: `ALTER TABLE rhs_exam_logs ADD COLUMN ${col.name} ${col.ddl}`
                });
            } catch (err) {
                if (err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME' || /duplicate column/i.test(err.message || ''))) {
                    continue;
                }
                console.error(`[ActivityLogSchema] Gagal menambah kolom rhs_exam_logs.${col.name}:`, err.message);
            }
        }

        schemaReady = true;
    })();

    return schemaPromise;
}
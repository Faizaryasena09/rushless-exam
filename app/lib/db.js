import mysql from "mysql2/promise";
import { recordInfraError } from "./log-fallback";
import { timeZoneOffsetLabel } from "./timezone";

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// PENTING: nilai-nilai di bawah bisa dikali jumlah worker PM2 (`instances`).
// Total koneksi ke MySQL = DB_POOL_SIZE x jumlah instance.
// Jaga totalnya jauh di bawah `max_connections` MySQL (default 151).
const POOL_SIZE = toPositiveInt(process.env.DB_POOL_SIZE, 15);
// Antrean hanya menyimpan callback kecil (~ratusan byte), jadi 5000 antrean
// hanya memakai <-1 MB. Angkanya sengaja dibatasi: kalau 0 (unlimited),
// lonjakan traffic akan menumpuk ribuan Promise dan proses bisa OOM.
// Default `connectionLimit` mysql2 yang dangerous justru tidak ada batas antrean.
const QUEUE_LIMIT = toNonNegativeInt(process.env.DB_QUEUE_LIMIT, 5000);
const MAX_IDLE = toPositiveInt(process.env.DB_MAX_IDLE, POOL_SIZE);
const IDLE_TIMEOUT = toPositiveInt(process.env.DB_IDLE_TIMEOUT, 60000);

const dbConfig = {
  host: process.env.DB_HOST,
  port: toPositiveInt(process.env.DB_PORT, 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  // Jangan pakai angka besar: inilah penyebab utama "Too many connections".
  connectionLimit: POOL_SIZE,
  // Batas antrean tunggu. Kalau 0 (unlimited), lonjakan traffic akan
  // menumpuk ribuan Promise di memory dan proses bisa OOM.
  queueLimit: QUEUE_LIMIT,
  // Buang koneksi yang menganggur agar tidak menahan slot / threshold MySQL.
  maxIdle: MAX_IDLE,
  idleTimeout: IDLE_TIMEOUT,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000, // 10 seconds timeout for new connections
  charset: "utf8mb4",
  multipleStatements: false,

  // PENTING: kolom DATETIME di aplikasi ini bersifat "naive" (tanpa info
  // zona waktu). Tanpa opsi ini, mysql2 menganggap nilainya sebagai waktu
  // lokal lalu mengubahnya jadi objek Date dalam UTC. Akibatnya nilai yang
  // sama bergeser 7 jam di server berzona WIB sebelum sampai ke browser
  // (contoh: tersimpan 08:00, tampil & tersimpan ulang jadi 01:00).
  //
  // Dengan dateStrings: true, DATETIME dikirim apa adanya sebagai string
  // dan tidak pernah digeser. timezone saat ditampilkan-atasi di sisi klien
  // (app/lib/timezone.js) dan di UI pengaturan.
  dateStrings: true,
};

let lastPoolErrorAt = 0;

// Zona waktu sesi MySQL. Nilai DATETIME di aplikasi ini bersifat naive, jadi
// UNIX_TIMESTAMP(start_time) hanya benar kalau MySQL menafsirkan string itu di
// zona yang sama dengan zona aplikasi. Tanpa baris ini, batas waktu ujian
// bergeser sebesar selisih zona server DB versus zona aplikasi (7 jam untuk
// MySQL yang jalan di UTC).
const DB_TIME_ZONE = timeZoneOffsetLabel();

function createPool() {
  const instance = mysql.createPool(dbConfig);

  // Dijalankan sekali per koneksi fisik, sebelum query pertama.
  instance.pool.on("connection", (conn) => {
    conn.query(`SET time_zone = '${DB_TIME_ZONE}'`, (err) => {
      if (err) {
        console.warn(`[DB] Gagal set time_zone sesi: ${err?.message}`);
      }
    });
  });

  // Tanpa listener 'error', error koneksi dari pool akan jadi unhandled
  // 'error' event dan menjatuhkan seluruh proses Node.
  instance.on("error", (error) => {
    const now = Date.now();
    if (now - lastPoolErrorAt < 30000) return;
    lastPoolErrorAt = now;
    console.warn(
      `[DB] Pool connection error: ${error?.code || ""} ${error?.message}`.trim(),
    );
  });

  return instance;
}

// Cache pool di globalThis: Next.js (Turbopack/webpack) mengevaluasi ulang modul
// ini setiap hot-reload di dev, sehingga tanpa cache setiap reload membuat pool
// baru dan pool lama tidak pernah ditutup (koneksi bocor sampai max_connections).
const pool =
  globalThis.__rushlessExamDbPool ??
  (globalThis.__rushlessExamDbPool = createPool());

export function getPoolStats() {
  return {
    connectionLimit: POOL_SIZE,
    queueLimit: QUEUE_LIMIT,
    maxIdle: MAX_IDLE,
    idleTimeout: IDLE_TIMEOUT,
    free: pool.pool?._freeConnections?.length ?? null,
    queued: pool.pool?._connectionQueue?.length ?? null,
  };
}

let poolClosing = null;

// Dipanggil PM2 saat graceful reload/restart supaya worker tidak dibunuh
// di tengah query dan koneksi ditutup dengan rapi.
export function closePool() {
  if (!poolClosing) {
    poolClosing = pool.end().catch((error) => {
      console.warn(`[DB] Gagal menutup pool: ${error?.message}`);
    });
  }
  return poolClosing;
}

if (process.env.NODE_ENV === "production") {
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      closePool().finally(() => process.exit(0));
    });
  }
}

// Error transient yang layak dicoba ulang. Sengaja TIDAK memasukkan
// ER_CON_COUNT_ERROR / "Too many connections": saat server sudah penuh,
// mencoba connect lagi justru memperparah beban. Untuk kasus itu kita
// kembalikan 503 supaya client mundur (backoff).
const RETRYABLE_CODES = new Set([
  "PROTOCOL_CONNECTION_LOST",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "PROTOCOL_SEQUENCE_TIMEOUT",
  "PROTOCOL_ENQUEUE_AFTER_QUIT",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "PROTOCOL_ENQUEUE_AFTER_DESTROY",
]);

const OVERLOAD_CODES = new Set(["ER_CON_COUNT_ERROR", "ER_TOO_MANY_USER_CONNECTIONS"]);

// Error yang berarti "server tidak bisa menerima koneksi saat ini" —
// dicatat sebagai error infrastruktur (bukan error aplikasi biasa).
function reportDbFailure(normalized, original) {
    const code = original?.code;
    const errno = original?.errno;
    const isOverload = OVERLOAD_CODES.has(code) || errno === 1040 || errno === 1203;
    const isConnection = isRetryable(original) || code === "ECONNREFUSED" || code === "DB_POOL_BUSY" || code === "DB_POOL_CLOSED";
    if (!isOverload && !isConnection) return;

    recordInfraError(isOverload ? 'mysql-connection-overloaded' : 'mysql-connection-failed', original, {
        errno: errno ?? null,
        code: code ?? null,
        poolQueueLimit: getPoolStats().queueLimit ?? null
    });
}

function isRetryable(error) {
  if (!error) return false;
  if (OVERLOAD_CODES.has(error.code)) return false;
  if (error.errno === 1040) return false; // Too many connections
  if (RETRYABLE_CODES.has(error.code)) return true;
  if (error.errno === 2013 || error.errno === 1053 || error.errno === 2006) {
    return true;
  }
  const message = error.message || "";
  return (
    message.includes("Lost connection") ||
    message.includes("Connection lost") ||
    message.includes("Connection ended") ||
    message.includes("read ECONNRESET")
  );
}

// Jaga error.code / errno tetap tersedia: banyak route memeriksa
// err.code === "ER_DUP_ENTRY" dsb. Kalau dibungkus jadi Error baru,
// properties itu hilang dan deteksi error ikut gagal.
function normalizeError(error) {
  if (!error || typeof error !== "object") return new Error(String(error));
  if (error instanceof Error && error.code !== undefined && error.rushlessNormalized) {
    return error;
  }
  const wrapped = new Error(error.message || "Database error");
  wrapped.name = error.name || "Error";
  wrapped.code = error.code;
  wrapped.errno = error.errno;
  wrapped.sqlState = error.sqlState;
  wrapped.sql = error.sql;
  wrapped.sqlMessage = error.sqlMessage;
  wrapped.fatal = error.fatal;
  wrapped.rushlessNormalized = true;

  if (error.message === "Queue limit reached.") {
    wrapped.code = "DB_POOL_BUSY";
    wrapped.status = 503;
    wrapped.message =
      "Server sedang sibuk - database penuh. Silakan coba beberapa saat lagi.";
  } else if (error.message === "Pool is closed.") {
    wrapped.code = "DB_POOL_CLOSED";
    wrapped.status = 503;
  } else if (isRetryable(error) && error.code === undefined) {
    wrapped.status = 503;
  } else if (OVERLOAD_CODES.has(error.code) || error.errno === 1040) {
    wrapped.status = 503;
  }

  return wrapped;
}

// Function to execute single queries using the pool
// Set `one: true` untuk langsung menerima baris pertama (atau null bila kosong).
export async function query({ query, values = [], one = false }) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let connection;
    try {
      connection = await pool.getConnection();
      const [results] = await connection.execute(query, values);
      if (one) {
        return (Array.isArray(results) && results.length > 0) ? results[0] : null;
      }
      return results;
    } catch (error) {
      const normalized = normalizeError(error);
      if (attempt === 0 && isRetryable(error)) {
        continue;
      }
      // Re-throw the error to be caught by the calling function
      reportDbFailure(normalized, error);
      throw normalized;
    } finally {
      if (connection) connection.release();
    }
  }
}

/**
 * Memastikan kolom/tabel untuk fitur Arsip & preferensi UI sudah ada.
 * Dipanggil otomatis agar tidak harus menjalankan /api/setup manual.
 * Hasilnya di-cache per proses supaya tidak menambah query di setiap request.
 */
let archiveSchemaPromise = null;

export async function ensureArchiveSchema() {
  if (!archiveSchemaPromise) {
    archiveSchemaPromise = (async () => {
      try {
        await query({ query: `ALTER TABLE rhs_exams ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) NOT NULL DEFAULT 0` });
        await query({ query: `ALTER TABLE rhs_exams ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL DEFAULT NULL` });
        await query({ query: `ALTER TABLE rhs_exam_categories ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) NOT NULL DEFAULT 0` });
        await query({
          query: `CREATE TABLE IF NOT EXISTS rhs_user_ui_prefs (
            user_id INT NOT NULL,
            pref_key VARCHAR(100) NOT NULL,
            pref_value TEXT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, pref_key),
            INDEX idx_user_prefs (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        });
        return true;
      } catch (error) {
        // Feature ini bersifat non-kritis: biarkan query berikutnya yang decides
        console.error('[ensureArchiveSchema] Gagal menyiapkan skema arsip:', error.message);
        return false;
      }
    })();
  }
  return archiveSchemaPromise;
}

// Function to execute a transaction with automatic deadlock retry
export async function transaction(callback, retries = 3) {
  for (let i = 0; i < retries; i++) {
    let connection;
    let started = false;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      started = true;

      const transactionQuery = async ({ query, values = [], one = false }) => {
        const [results] = await connection.execute(query, values);
        if (one) {
          return (Array.isArray(results) && results.length > 0) ? results[0] : null;
        }
        return results;
      };

      const result = await callback(transactionQuery);
      await connection.commit();
      return result;
    } catch (error) {
      // Rollback hanya mungkin kalau transaksi sempat dimulai. Kalau gagal di
      // `getConnection`/`beginTransaction`, koneksi bisa saja sudah diputus
      // server dan rollback-nya justru melempar error baru.
      if (connection && started) {
        try {
          await connection.rollback();
        } catch {
          // abaikan: koneksi sudah tidak valid
        }
      }

      // Check for Deadlock (ER_LOCK_DEADLOCK: 1213)
      const isDeadlock =
        error.message.includes("Deadlock") ||
        error.code === "ER_LOCK_DEADLOCK" ||
        error.errno === 1213;

      if (isDeadlock && i < retries - 1) {
        // Random backoff to desynchronize retrying threads
        const delay = Math.floor(Math.random() * 500) + i * 500;
        console.warn(
          `[DB] Deadlock detected. Retrying transaction (Attempt ${i + 2}/${retries}) in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Koneksi hilang di tengah transaksi: belum ada data yang ter-commit,
      // jadi aman untuk dicoba ulang dengan koneksi baru.
      if (!started && i < retries - 1 && isRetryable(error)) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }

      throw normalizeError(error);
    } finally {
      if (connection) connection.release();
    }
  }
}

// Special function for the one-time setup
export async function setupDatabase() {
  let serverConnection;
  try {
    // 1. Connect to the server
    serverConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: dbConfig.connectTimeout,
    });

    // 2. Create the database if it doesn't exist
    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``,
    );
    console.log(`Database ${dbConfig.database} created or already exists.`);

    // Close server connection
    await serverConnection.end();

    // 3. Use the pool for setting up tables
    let connection;
    try {
      connection = await pool.getConnection();

      await connection.query(`
              CREATE TABLE IF NOT EXISTS rhs_classes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                class_name VARCHAR(255) NOT NULL UNIQUE
              )
          `);
      console.log('Table "rhs_classes" created or already exists.');

      await connection.query(`
              CREATE TABLE IF NOT EXISTS rhs_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'teacher', 'student') NOT NULL,
                class_id INT,
                session_id VARCHAR(255),
                last_activity DATETIME,
                is_locked BOOLEAN NOT NULL DEFAULT FALSE,
                is_online_realtime BOOLEAN DEFAULT 0,
                last_login DATETIME NULL DEFAULT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES rhs_classes(id) ON DELETE SET NULL
              )
          `);
      console.log('Table "rhs_users" created or already exists.');

      // Check if any user exists, if not create default admin
      const [users] = await connection.query(
        "SELECT COUNT(*) as count FROM rhs_users",
      );
      if (users[0].count === 0) {
        // Password is 'admin' hashed with bcrypt
        const hashedPassword = "$2b$10$Bip8Jha67dJS2knb5Hd6T.DZI97ugPxUtGwC7qgMpbTFtd4OmHk0e";

        await connection.query(
          `
            INSERT INTO rhs_users (username, password, role) 
            VALUES ('admin', ?, 'admin')
        `,
          [hashedPassword],
        );
        console.log("Default admin user created: admin / admin");
      }

      // Create the 'rhs_exams' table
      await connection.query(`
              CREATE TABLE IF NOT EXISTS rhs_exams (
                id INT AUTO_INCREMENT PRIMARY KEY,
                exam_name VARCHAR(255) NOT NULL,
                description TEXT,
                timer_mode ENUM('sync', 'async') NOT NULL DEFAULT 'sync',
                duration_minutes INT DEFAULT 60,
                max_attempts INT DEFAULT 1,
                is_archived TINYINT(1) NOT NULL DEFAULT 0,
                archived_at DATETIME NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              )
          `);
      console.log('Table "rhs_exams" created or already exists.');

      // Create the 'rhs_exam_settings' table
      await connection.query(`
              CREATE TABLE IF NOT EXISTS rhs_exam_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                exam_id INT NOT NULL UNIQUE,
                start_time DATETIME,
                end_time DATETIME,
                require_seb BOOLEAN DEFAULT FALSE,
                seb_config_key VARCHAR(255),
                show_instructions BOOLEAN DEFAULT FALSE,
                instruction_type ENUM('template', 'custom') DEFAULT 'template',
                custom_instructions TEXT,
                show_result BOOLEAN DEFAULT FALSE,
                show_analysis BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE
              )
          `);
      console.log('Table "rhs_exam_settings" created or already exists.');

    // Migration: Ensure 'require_safe_browser' exists (for existing tables)
    try {
      await connection.query(`
            ALTER TABLE rhs_exam_settings
            ADD COLUMN require_safe_browser BOOLEAN DEFAULT FALSE;
        `);
      console.log("Column 'require_safe_browser' added to rhs_exam_settings");
    } catch (err) {
      // Ignore error if column already exists (Error 1060: Duplicate column name)
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.log("Note: " + err.message);
      }
    }

    try {
      await connection.query(`
            ALTER TABLE rhs_exam_settings
            ADD COLUMN require_seb BOOLEAN DEFAULT FALSE,
            ADD COLUMN seb_config_key VARCHAR(255);
        `);
      console.log(
        "Columns 'require_seb' and 'seb_config_key' added to rhs_exam_settings",
      );
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.log("Note: " + err.message);
      }
    }

    // Migration: Instruction flags and Results flags
    try {
      await connection.query(`
            ALTER TABLE rhs_exam_settings
            ADD COLUMN show_instructions BOOLEAN DEFAULT FALSE,
            ADD COLUMN instruction_type ENUM('template', 'custom') DEFAULT 'template',
            ADD COLUMN custom_instructions TEXT,
            ADD COLUMN show_result BOOLEAN DEFAULT FALSE,
            ADD COLUMN show_analysis BOOLEAN DEFAULT FALSE;
        `);
      console.log(
        "Columns instructions and results added to rhs_exam_settings",
      );
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.log("Note: " + err.message);
      }
    }

    // Create the 'rhs_exam_questions' table
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_exam_questions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              exam_id INT NOT NULL,
              question_text TEXT NOT NULL,
              options JSON,
              correct_option VARCHAR(1) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE
            )
        `);
    console.log('Table "rhs_exam_questions" created or already exists.');

    // Migration: Ensure 'sort_order' column exists for question reordering
    try {
      await connection.query(`
            ALTER TABLE rhs_exam_questions
            ADD COLUMN sort_order INT DEFAULT 0;
        `);
      console.log("Column 'sort_order' added to rhs_exam_questions");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.log("Note: " + err.message);
      }
    }

    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_exam_attempts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                exam_id INT NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME,
                status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
                INDEX (user_id, exam_id),
                FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
                FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE
            );
        `);
    console.log('Table "rhs_exam_attempts" created or already exists.');

    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_student_answer (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              exam_id INT NOT NULL,
              attempt_id INT NOT NULL,
              question_id INT NOT NULL,
              selected_option TEXT NOT NULL,
              is_correct BOOLEAN NOT NULL,
              score_earned FLOAT NOT NULL DEFAULT 0,
              submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE,
              FOREIGN KEY (question_id) REFERENCES rhs_exam_questions(id) ON DELETE CASCADE,
              FOREIGN KEY (attempt_id) REFERENCES rhs_exam_attempts(id) ON DELETE CASCADE,
              UNIQUE KEY unique_attempt_question (attempt_id, question_id)
            )
        `);
    console.log('Table "rhs_student_answer" created or already exists.');

    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_temporary_answer (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              exam_id INT NOT NULL,
              question_id INT NOT NULL,
              selected_option TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE,
              FOREIGN KEY (question_id) REFERENCES rhs_exam_questions(id) ON DELETE CASCADE,
              UNIQUE KEY unique_answer (user_id, exam_id, question_id)
            )
        `);
    console.log('Table "rhs_temporary_answer" created or already exists.');

    // Arsip jawaban sementara (aman, dibersihkan otomatis setelah 30 hari).
    // Sengaja TANPA foreign key supaya tetap tersimpan walaupun attempt/ujian/user dihapus.
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_temporary_answer_archive (
              id INT AUTO_INCREMENT PRIMARY KEY,
              attempt_id INT NOT NULL,
              user_id INT NOT NULL,
              exam_id INT NOT NULL,
              question_id INT NOT NULL,
              selected_option TEXT,
              answer_source VARCHAR(32) NOT NULL DEFAULT 'submit',
              username VARCHAR(255),
              student_name VARCHAR(255),
              exam_name VARCHAR(255),
              class_name VARCHAR(255),
              created_at DATETIME NULL DEFAULT NULL,
              archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uniq_attempt_question (attempt_id, question_id),
              INDEX idx_archived_at (archived_at),
              INDEX idx_user (user_id),
              INDEX idx_exam (exam_id)
            )
        `);
    console.log('Table "rhs_temporary_answer_archive" created or already exists.');

    // Backup jawaban sebelum pemulihan (supaya restore bisa di-undo).
    // Tanpa FK agar tetap ada walau attempt dihapus.
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_answer_restore_backup (
              id INT AUTO_INCREMENT PRIMARY KEY,
              attempt_id INT NOT NULL,
              user_id INT NOT NULL,
              exam_id INT NOT NULL,
              question_id INT NOT NULL,
              selected_option TEXT,
              is_correct BOOLEAN NOT NULL DEFAULT 0,
              score_earned FLOAT NOT NULL DEFAULT 0,
              restored_by VARCHAR(255),
              restore_mode VARCHAR(20),
              is_undone TINYINT(1) NOT NULL DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_attempt (attempt_id),
              INDEX idx_created (created_at)
            )
        `);
    console.log('Table "rhs_answer_restore_backup" created or already exists.');

    // Create the 'rhs_launch_tokens' table for ExamSafer handoff
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_launch_tokens (
                token VARCHAR(255) PRIMARY KEY,
                user_id INT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE
            )
        `);
    console.log('Table "rhs_launch_tokens" created or already exists.');

    // Create the 'rhs_activity_logs' table for activity logging
    await connection.query(`
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_created_at (created_at),
                INDEX idx_level (level),
                INDEX idx_user_id (user_id),
                INDEX idx_action (action),
                INDEX idx_request_id (request_id)
            )
        `);
    console.log('Table "rhs_activity_logs" created or already exists.');
 
     // Create the 'rhs_license' table for license storage
     await connection.query(`
             CREATE TABLE IF NOT EXISTS rhs_license (
                 id INT PRIMARY KEY DEFAULT 1,
                 status VARCHAR(50) DEFAULT 'inactive',
                 pj VARCHAR(255),
                 pj_email VARCHAR(255),
                 instansi VARCHAR(255),
                 kuota INT DEFAULT 0,
                 paket VARCHAR(50),
                 expiry VARCHAR(50),
                 signature TEXT,
                 last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 server_status VARCHAR(50) DEFAULT 'offline'
             )
         `);
     console.log('Table "rhs_license" created or already exists.');

    // Migration: Add brute force columns to rhs_users
    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN failed_login_attempts INT DEFAULT 0`,
      );
      console.log("Column 'failed_login_attempts' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN locked_until TIMESTAMP NULL DEFAULT NULL`,
      );
      console.log("Column 'locked_until' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN refresh_requested_at TIMESTAMP NULL DEFAULT NULL`,
      );
      console.log("Column 'refresh_requested_at' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN is_online_realtime BOOLEAN DEFAULT 0`,
      );
      console.log("Column 'is_online_realtime' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Add last_login to rhs_users (session control monitoring)
    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN last_login DATETIME NULL DEFAULT NULL`,
      );
      console.log("Column 'last_login' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Jawaban panjang (essay / matching JSON) tidak boleh terpotong
    try {
      await connection.query(
        `ALTER TABLE rhs_temporary_answer MODIFY COLUMN selected_option TEXT NULL DEFAULT NULL`,
      );
      console.log("Column 'selected_option' widened to TEXT in rhs_temporary_answer");
    } catch (err) {
      console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_student_answer MODIFY COLUMN selected_option TEXT NOT NULL`,
      );
      console.log("Column 'selected_option' widened to TEXT in rhs_student_answer");
    } catch (err) {
      console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_student_answer ADD COLUMN IF NOT EXISTS score_earned FLOAT NOT NULL DEFAULT 0`,
      );
      console.log("Column 'score_earned' ensured in rhs_student_answer");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: UNIQUE (attempt_id, question_id) supaya INSERT selalu idempotent
    try {
      // Bersihkan duplikat lama terlebih dahulu
      await connection.query(
        `DELETE a FROM rhs_student_answer a
         JOIN rhs_student_answer b
           ON a.attempt_id = b.attempt_id
          AND a.question_id = b.question_id
          AND a.id > b.id`,
      );
      await connection.query(
        `ALTER TABLE rhs_student_answer ADD UNIQUE KEY unique_attempt_question (attempt_id, question_id)`,
      );
      console.log("Unique key 'unique_attempt_question' added to rhs_student_answer");
    } catch (err) {
      if (err.code !== "ER_DUP_KEYNAME" && err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Add require_all_answered to rhs_exam_settings
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings ADD COLUMN require_all_answered TINYINT(1) NOT NULL DEFAULT 0`,
      );
      console.log("Column 'require_all_answered' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Add Token feature columns to rhs_exam_settings
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings ADD COLUMN require_token TINYINT(1) NOT NULL DEFAULT 0`,
      );
      console.log("Column 'require_token' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings ADD COLUMN token_type ENUM('static', 'auto') NOT NULL DEFAULT 'static'`,
      );
      console.log("Column 'token_type' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings ADD COLUMN current_token VARCHAR(10) NULL DEFAULT NULL`,
      );
      console.log("Column 'current_token' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Add Geschool Secure Mode columns
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings 
         ADD COLUMN require_geschool TINYINT(1) NOT NULL DEFAULT 0,
         ADD COLUMN geschool_exit_password VARCHAR(255) NULL DEFAULT NULL`,
      );
      console.log("Columns 'require_geschool' and 'geschool_exit_password' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Fitur Arsip (exam & kategori bisa diarsipkan)
    try {
      await connection.query(
        `ALTER TABLE rhs_exams ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0`,
      );
      console.log("Column 'is_archived' added to rhs_exams");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_exams ADD COLUMN archived_at DATETIME NULL DEFAULT NULL`,
      );
      console.log("Column 'archived_at' added to rhs_exams");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_categories ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0`,
      );
      console.log("Column 'is_archived' added to rhs_exam_categories");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Tabel preferensi UI per user (mis. accordion kategori yang terbuka)
    try {
      await connection.query(
        `CREATE TABLE IF NOT EXISTS rhs_user_ui_prefs (
            user_id INT NOT NULL,
            pref_key VARCHAR(100) NOT NULL,
            pref_value TEXT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, pref_key),
            INDEX idx_user_prefs (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
      console.log("Table 'rhs_user_ui_prefs' ensured");
    } catch (err) {
      console.log("Note: " + err.message);
    }

    } finally {
      if (connection) connection.release();
    }
    return { success: true };
  } catch (error) {
    console.error("Database setup failed:", error.message);
    throw new Error(`Database setup failed: ${error.message}`);
  } finally {
    if (serverConnection) {
      try {
        await serverConnection.end();
      } catch (e) {
        console.error("Error closing server connection:", e.message);
      }
    }
  }
}

// Function to reset the entire database
export async function resetDatabase() {
  let serverConnection;
  try {
    // 1. Connect to the server
    serverConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: dbConfig.connectTimeout,
    });

    // 2. Drop the database if it exists
    await serverConnection.query(
      `DROP DATABASE IF EXISTS \`${dbConfig.database}\``,
    );
    console.log(`Database ${dbConfig.database} dropped.`);

    // 3. Recreate the database
    await serverConnection.query(
      `CREATE DATABASE \`${dbConfig.database}\``,
    );
    console.log(`Database ${dbConfig.database} recreated.`);

    // Close server connection
    await serverConnection.end();

    // 4. Run the setup to create tables and default admin
    await setupDatabase();
    
    return { success: true };
  } catch (error) {
    console.error("Database reset failed:", error.message);
    if (serverConnection) await serverConnection.end();
    throw new Error(`Database reset failed: ${error.message}`);
  }
}

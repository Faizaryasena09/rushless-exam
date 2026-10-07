const os = require("os");

// PENTING untuk koneksi database:
// Setiap worker PM2 di mode cluster membuat POOL mysql2 sendiri.
// Total koneksi MySQL = instances x DB_POOL_SIZE.
// Kalau `instances: "max"` dipakai bersama pool yang besar, MySQL akan
// mengembalikan "Too many connections" (ER_CON_COUNT_ERROR).
//
// Aturan: instances x DB_POOL_SIZE harus jauh di bawah max_connections MySQL
// (default 151). Contoh di bawah: 4 x 15 = 60 koneksi.
const WEB_INSTANCES = Math.max(
  1,
  Number.parseInt(process.env.WEB_INSTANCES, 10) ||
    Math.min(4, os.cpus().length || 2),
);

const DB_POOL_SIZE = process.env.DB_POOL_SIZE || "15";

// Beri waktu worker menyelesaikan query yang sedang berjalan sebelum PM2
// membunuhnya, supaya tidak ada koneksi yang terpotong di tengah jalan.
const KILL_TIMEOUT = Number.parseInt(process.env.KILL_TIMEOUT, 10) || 15000;

// ─── Zona waktu ───────────────────────────────────────────────────────────
// Nilai di sini HANYA default. Sumber kebenaran untuk tampilan di aplikasi
// adalah setting "Zona Waktu" di Admin Tools (app_timezone).
// Kalau env di-set, env yang menang; kalau tidak, default di bawah dipakai
// sehingga perilaku lama tidak berubah sama sekali.
const DEFAULT_TZ = "Asia/Jakarta";

function pickTimezone(value) {
  const tz = typeof value === "string" ? value.trim() : "";
  if (!tz) return DEFAULT_TZ;
  try {
    // Validasi cheaply: runtime harus mengenali nama IANA ini.
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date(0));
    return tz;
  } catch (e) {
    console.warn(
      `[ecosystem] Zona waktu "${tz}" tidak dikenali, memakai ${DEFAULT_TZ}`,
    );
    return DEFAULT_TZ;
  }
}

const TZ = pickTimezone(process.env.TZ);
// Default untuk tampilan; APP_TIMEZONE hanya dipakai sebagai nilai awal,
// dan bisa ditimpa lewat setting app_timezone di Admin Tools.
const APP_TIMEZONE = pickTimezone(process.env.APP_TIMEZONE || TZ);

module.exports = {
  apps: [
    {
      name: "rushless-exam",
      script: "server.js",
      cwd: "/app",
      instances: WEB_INSTANCES,
      exec_mode: "cluster",
      kill_timeout: KILL_TIMEOUT,
      listen_timeout: 10000,
      wait_ready: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        TZ: TZ,
        APP_TIMEZONE: APP_TIMEZONE,
        DB_POOL_SIZE: DB_POOL_SIZE,
        DB_QUEUE_LIMIT: process.env.DB_QUEUE_LIMIT || "5000",
        DB_MAX_IDLE: process.env.DB_MAX_IDLE || DB_POOL_SIZE,
        DB_IDLE_TIMEOUT: process.env.DB_IDLE_TIMEOUT || "60000",
      },
    },
    {
      name: "redis-server",
      script: "redis-server",
      args: "--bind 127.0.0.1 --save '' --appendonly no",
      exec_mode: "fork",
    },
  ],
};
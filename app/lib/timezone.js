// Utilitas zona waktu terpusat.
//
//单机 aplikasi menyimpan waktu sebagai DATETIME "naive" (tanpa info zona),
// jadi zona waktu hanya dipakai saat MENAMPILKAN waktu ke pengguna - bukan
// untuk mengubah cara penyimpanan atau perhitungan timer di server.
//
// Default-nya diambil dari env APP_TIMEZONE (di-set Jenkins/PM2/Coolify),
// lalu jatuh ke Asia/Jakarta supaya perilaku lama tidak berubah.

// IANA timezone, mis. 'Asia/Jakarta'
export const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';

const FALLBACK_LOCALE = 'id-ID';

/**
 * Cek apakah string timezone valid.
 * Cara paling akurat: coba format dengan Intl, yang akan throw kalau nama
 * zona tidak dikenal oleh runtime.
 */
export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date(0));
    return true;
  } catch (e) {
    return false;
  }
}

/** Daftar zona waktu yang didukung runtime untuk dropdown admin. */
export function getSupportedTimezones() {
  try {
    // API ini hanya tersedia di runtime modern (Node 18+/browser modern).
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch (e) {
    // jatuh ke daftar ringkas di bawah
  }
  return FALLBACK_TIMEZONES;
}

// Dipakai hanya kalau Intl.supportedValuesOf tidak tersedia.
const FALLBACK_TIMEZONES = [
  'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore',
  'Asia/Kuala_Lumpur', 'Asia/Tokyo', 'Asia/Manila', 'Asia/Bangkok',
  'Australia/Sydney', 'Europe/Amsterdam', 'Europe/London', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'UTC',
];

/** Locale dari konteks bahasa, atau default. */
export function resolveLocale(locale) {
  return locale || FALLBACK_LOCALE;
}

/**
 * Offset zona waktu sebagai string yang dipahami MySQL, contoh "+07:00".
 *
 * Dipakai untuk meng-set `SET time_zone` di tiap koneksi, supaya
 * UNIX_TIMESTAMP() dan NOW() memakai zona yang sama dengan aplikasi. Tanpa ini
 * seluruh perhitungan batas waktu ujian bergeser sebesar selisih antara zona
 * server MySQL dan zona aplikasi.
 *
 * Catatan: offset dihitung sekali saat proses start. Untuk zona dengan DST
 * (mis. Europe/Amsterdam) valuanya bisa bergeser mengikuti musim; zona WIB
 * sendiri tidak pernah punya DST.
 */
export function timeZoneOffsetLabel(timeZone, atMs = Date.now()) {
  const tz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const totalMinutes = Math.round(timeZoneOffsetMs(atMs, tz) / 60000);
  const sign = totalMinutes < 0 ? '-' : '+';
  const abs = Math.abs(totalMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Pola "wall clock" tanpa zona: yang dipakai MySQL DATETIME dan
 * <input type="datetime-local">, contoh "2025-10-07 08:00:00" atau
 * "2025-10-07T08:00".
 *
 * Sengaja TIDAK menerima sufiks Z / +07:00: string yang membawa zona adalah
 * momen absolut (hasil toISOString/API), bukan wall clock aplikasi.
 */
const NAIVE_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/;

/**
 * True kalau string BERBENTUK wall clock naive, valid atau tidak.
 *
 * Dipakai supaya nilai seperti "2025-02-30 10:00:00" tidak jatuh ke
 * `new Date()` yang melunak dan melompat ke 2 Mar - lebih baik dianggap
 * tidak valid daripada menampilkan tanggal yang salah.
 */
function looksNaiveDatetime(input) {
  return typeof input === 'string' && NAIVE_DATETIME_RE.test(input.trim().replace(/\.\d+$/, ''));
}

/** Ambil komponen wall clock dari string naive MySQL, atau null. */
function parseNaiveParts(input) {
  if (typeof input !== 'string') return null;
  // Buang pecahan detik (MySQL bisa kirim 6 digit) sebelum dipecah.
  const s = input.trim().replace(/\.\d+$/, '');
  if (!NAIVE_DATETIME_RE.test(s)) return null;
  const [y, mo, d, h = '0', mi = '0', sec = '0'] = s.replace('T', ' ').split(/[- :]/);
  const parts = { year: +y, month: +mo - 1, day: +d, hour: +h, minute: +mi, second: +sec };
  const probe = new Date(Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second));
  // Tolak tanggal tidak valid seperti "2025-02-30" (Date.UTC merolover ke bulan berikutnya).
  if (probe.getUTCMonth() !== parts.month || probe.getUTCDate() !== parts.day) return null;
  return parts;
}

/** Ubah epoch ms menjadi epoch ms "seolah-olah" field wall-clock-nya adalah UTC. */
function naiveToPseudoUtc(input) {
  const p = parseNaiveParts(input);
  if (!p) return null;
  const date = new Date(Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second));
  return Number.isNaN(date.getTime()) ? null : date;
}

const OFFSET_FORMATTERS = new Map();
function offsetFormatter(timeZone) {
  let fmt = OFFSET_FORMATTERS.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    OFFSET_FORMATTERS.set(timeZone, fmt);
  }
  return fmt;
}

/** Selisih (ms) antara zona `timeZone` dan UTC pada momen `epochMs`. */
function timeZoneOffsetMs(epochMs, timeZone) {
  const parts = offsetFormatter(timeZone).formatToParts(new Date(epochMs));
  const map = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour) % 24, Number(map.minute), Number(map.second),
  );
  return asUtc - epochMs;
}

/**
 * Epoch ms absolut dari nilai MySQL DATETIME pada zona waktu aplikasi.
 *
 * Dipakai untuk membandingkan jadwal ujian dengan "sekarang" tanpa
 * tersesat oleh zona browser/Node.
 */
export function wallClockToEpochMs(value, timeZone) {
  if (value === null || value === undefined || value === '') return null;
  const tz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (looksNaiveDatetime(value)) {
    const p = parseNaiveParts(value);
    if (!p) return null;
    const naive = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
    // Dua iterasi sudah cukup untuk menangani batas DST.
    let guess = naive - timeZoneOffsetMs(naive, tz);
    guess = naive - timeZoneOffsetMs(guess, tz);
    return guess;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function normalize(input, timeZone, locale) {
  if (input === null || input === undefined || input === '') return null;
  const locale_ = resolveLocale(locale);

  // Wall clock aplikasi: parse komponennya, lalu format dengan timeZone 'UTC'
  // supaya hasil tampil PERSIS sama dengan yang tersimpan - tidak ada
  // konversi zona sama sekali. Versi lama memakai new Date() yang mengartikan
  // string sebagai waktu lokal browser, lalu diformat ulang ke zona aplikasi,
  // sehingga setiap jam bergeser sebesar selisih kedua zona.
  if (looksNaiveDatetime(input)) {
    const pseudo = naiveToPseudoUtc(input);
    if (!pseudo) return null;
    return { date: pseudo, locale: locale_, timeZone: 'UTC' };
  }

  // Momen absolut (Date, ISO dengan Z, epoch ms) -> format di zona aplikasi.
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date,
    locale: locale_,
    timeZone: isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE,
  };
}

/** Tanggal saja, contoh: 7 Oktober 2025 */
export function formatDate(input, { locale, timeZone } = {}) {
  const n = normalize(input, timeZone, locale);
  if (!n) return '-';
  return new Intl.DateTimeFormat(n.locale, {
    timeZone: n.timeZone, day: 'numeric', month: 'long', year: 'numeric',
  }).format(n.date);
}

/** Jam saja, contoh: 14:05 */
export function formatTime(input, { locale, timeZone } = {}) {
  const n = normalize(input, timeZone, locale);
  if (!n) return '-';
  return new Intl.DateTimeFormat(n.locale, {
    timeZone: n.timeZone, hour: '2-digit', minute: '2-digit',
  }).format(n.date);
}

/** Tanggal + jam, contoh: 7 Okt 2025, 14:05 */
export function formatDateTime(input, { locale, timeZone } = {}) {
  const n = normalize(input, timeZone, locale);
  if (!n) return '-';
  return new Intl.DateTimeFormat(n.locale, {
    timeZone: n.timeZone,
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(n.date);
}

/**
 * Tanggal + jam, contoh: 07 Okt 2025, 14:05.
 * Set `seconds: true` untuk menambah detik (dipakai log & audit).
 */
export function formatTimestamp(input, { locale, timeZone, seconds = false } = {}) {
  const n = normalize(input, timeZone, locale);
  if (!n) return '-';
  return new Intl.DateTimeFormat(n.locale, {
    timeZone: n.timeZone,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
  }).format(n.date);
}

/** Jam dengan detik, untuk jam dinding / log yang perlu presisi. */
export function formatClock(input, { locale, timeZone } = {}) {
  const n = normalize(input, timeZone, locale);
  if (!n) return '-';
  return new Intl.DateTimeFormat(n.locale, {
    timeZone: n.timeZone,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(n.date);
}

/**
 * Ubah nilai <input type="datetime-local"> (selalu "wall clock" tanpa zona)
 * menjadi string MySQL DATETIME tanpa menggeser nilainya.
 *
 * Penting: TIDAK memakai new Date() di sini, karena itu akan menginterpetasi
 * string sebagai waktu lokal browser lalu menggesernya - sumber bug yang
 * membuat jam ujian bergeser setiap kali disimpan dari browser di zona lain.
 */
export function datetimeLocalToMysql(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return `${y}-${mo}-${d} ${h}:${mi}:00`;
}

/**
 * Kebalikan dari datetimeLocalToMysql: string DATETIME MySQL -> nilai untuk
 * <input type="datetime-local">. Sengaja tanpa konversi zona waktu.
 */
export function mysqlToDatetimeLocal(value) {
  if (!value) return '';
  const str = String(value).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return '';
  const [, y, mo, d, h, mi] = m;
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/** Sisa waktu dalam hitungan detik -> "2j 15m 30d" (dipakai untuk countdown). */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}h ${h}m`;
  if (h > 0) return `${h}m ${s}d`;
  if (m > 0) return `${m}m ${s}d`;
  return `${s}d`;
}
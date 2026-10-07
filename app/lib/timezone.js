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

function normalize(input, timeZone, locale) {
  if (input === null || input === undefined || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return { date, locale: resolveLocale(locale), timeZone: isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE };
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
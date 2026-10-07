// Rahasia penanda tangan cookie sesi.
//
// WAJIB diset di environment variable pada produksi:
//   SESSION_SECRET=$(openssl rand -base64 48)
//
// Kalau env ini tidak diset, aplikasi tetap jalan memakai nilai fallback di
// bawah supaya tidak broke saat development, TAPI cookie sesi bisa dipalsukan
// oleh siapa pun yang tahu kode sumber ini. Aplikasi akan memperingatkan di log.
const FALLBACK_SECRET = 'a_super_secret_password_that_is_at_least_32_char_long';

const sessionSecret = process.env.SESSION_SECRET || FALLBACK_SECRET;

const usingFallback = !process.env.SESSION_SECRET;

if (usingFallback && process.env.NODE_ENV === 'production') {
  console.warn(
    '[SECURITY] SESSION_SECRET tidak diset. Cookie sesi bisa dipalsukan oleh siapa pun ' +
    'yang mengetahui nilai fallback. Set SESSION_SECRET di environment sebelum produksi.'
  );
}

// secure: true hanya boleh aktif kalau aplikasi benar-benar berjalan di HTTPS,
// kalau tidak cookie tidak akan terkirim sama sekali dan semua user logout.
const useSecureCookie = process.env.SESSION_SECURE_COOKIE === 'true';

export const sessionOptions = {
  password: sessionSecret,
  cookieName: 'rushless-exam-session',
  cookieOptions: {
    secure: useSecureCookie,
    sameSite: 'lax', // Allow lax for redirection flows
    httpOnly: true,
  },
};

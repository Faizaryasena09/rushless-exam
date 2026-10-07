# AGENTS.md

## Tema visual (WAJIB FOLLOW)

 Tema ini adalah preferensi utama proyek. Halaman baru atau revisi halaman
lama **harus** memakai pola di bawah, bukan gaya abu-abu datar.

### Prinsip

1. **Warna selalu punya arti.** Setiap kartu/aksen warna diturunkan dari
   status atau fungsi, bukan dekorasi acak. Biru = navigasi, hijau = tersedia
   atau sukses, amber = berjalan/dalam proses, ungu = laporan, rose = destruktif,
   slate = netral/telah selesai.
2. **Angka tidak sendirian.** Source of truth warna disimpan di satu objek tone
   per komponen (lihat `TONE` di `app/dashboard/page.js` dan `STATUS_ACCENT` di
   `app/dashboard/exams/page.js`). Jangan menulis ulang kelas warna yang sama
   di beberapa tempat — ambil dari palet itu, supaya kartu dan tombolnya tidak
   pernah berbeda warna.
3. **Card lifted, bukan flat.** Standar card:
   `rounded-2xl border bg-white dark:bg-slate-900` + `ring-1` +
   `hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-slate-950/50`
   + `transition-all duration-200`.
4. **Garis aksen.** Strip `h-1`/`h-0.5` gradien di tepi atas card atau header
   sebagai penanda status. Pada hover, strip `opacity-0` -> `opacity-100`.
5. **Ikon dalam chip berwarna.** `grid place-items-center` dengan bg tinted
   (`bg-{warna}-100 dark:bg-{warna}-950/60`) dan teks colored, bukan ikon polos.
6. **Dark mode wajib Valdez.** Setiap warna light wajib punya pasangan
   `dark:`. Pattern tinted: `bg-x-50 dark:bg-x-950/30`, teks
   `text-x-700 dark:text-x-300`, border `border-x-200 dark:border-x-900/60`.
7. **Header dengan latar.** Gradient lembut + strip warna, bukan kartu putih
   polos. Untuk panel clock Live: `bg-white/70 dark:bg-slate-800/50 backdrop-blur`.
8. **Angka tabular.** Jam, tanggal, dan angka selalu `tabular-nums` supaya tidak
   bergeser saat nilainya berubah tiap detik.
9. **Ruang.** Kartu `p-4` atau `px-4 py-3.5`, grid `gap-3` / `gap-4`,
   halaman `space-y-5`.

### Larangan

- Jangan pakai `bg-slate-100` sebagai warna chip status — itu indistinguishable
  dari badge netral.
- Jangan set `bg-white dark:bg-slate-900` lalu `hover:bg-slate-50` polos; itu
  Flat dan melanggar prinsip 3.
- Jangan menambah warna baru di luar palet status/tone yang sudah ada tanpa
  menambahkannya ke objek tone lebih dulu.

## Verifikasi

```bash
npx eslint <file-yang-diubah>
```

Lint saja sudah cukup untuk task UI. Jangan menjalankan `next build` kecuali
diminta eksplisit — build penuh memakan waktu lama.

## Zona waktu

Waktu di aplikasi ini disimpan sebagai DATETIME naive di MySQL. Aturan main:

- **Jangan** `new Date()` lalu format ulang untuk nilai dari DB. String naive
  di-parse sebagai waktu lokal browser lalu digeser ulang ke zona aplikasi.
- Untuk tampil: pakai `fmt.*` dari `useLanguage()` (identity untuk nilai naive).
- Untuk epoch/perbandingan: `wallClockToEpochMs(value, timezone)`.
- Satu clock per halaman, bukan satu per kartu.
- Nilai `new Date()` saat render harus diinisialisasi `null` lalu diisi di
  `useEffect`, supaya tidak hydration mismatch.

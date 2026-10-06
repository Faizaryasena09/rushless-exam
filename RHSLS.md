# RHSLS — Rushless Exam CLI

Dokumentasi lengkap untuk CLI operasional Rushless Exam.
CLI ini menggantikan panel admin web untuk keperluan **sesi**, **user**, dan **backup/restore**.

> Cakupan CLI sengaja **tidak** mencakup pembuatan/pengujian soal & ujian.
> Operasi ujian tetap dilakukan lewat antarmuka web.

---

## 1. Daftar Isi

1. [Instalasi & Menjalankan](#2-instalasi--menjalankan)
2. [Konsep Dasar](#3-konsep-dasar)
3. [Opsi Umum](#4-opsi-umum)
4. [Perintah Inti](#5-perintah-inti)
   - [Dashboard & Doctor](#51-dashboard--doctor)
   - [Session](#52-session-manajemen-sesi)
   - [User](#53-manajemen-user)
   - [Backup & Restore](#54-backup--restore)
   - [Database](#55-database)
   - [Settings, Activity, Admin](#56-settings-activity--admin)
5. [Isi Paket Backup](#7-isi-paket-backup)
6. [Keamanan & judicious Restore](#8-keamanan--restore)
7. [Variabel Environment](#9-variabel-environment)
8. [Otomasi &_exit_code](#10-otomasi--exit-code)
9. [Troubleshooting](#11-troubleshooting)
10. [Contoh Recipes Harian](#12-contoh-recipes-harian)

---

## 2. Instalasi & Menjalankan

### Tanpa instalasi (paling umum)

```bash
npm run rhsls -- <perintah>
```

Contoh:

```bash
npm run rhsls -- session:list
npm run rhsls -- user:unlock-all
```

### Sebagai perintah global

```bash
npm link
rhsls session:list
```

- Windows: `rhsls.cmd` sudah tersedia di root proyek (tidak perlu `npm link`).
- Linux/macOS: gunakan `npm link`, atau tambahkan symlink manual ke `/usr/local/bin/rhsls`.

### Zhou Lan

Pastikan sudah menjalankan `npm install` karena CLI memakai dependensi yang sudah ada:
`mysql2`, `ioredis`, `bcryptjs`, `adm-zip`.

---

## 3. Konsep Dasar

Semua perintah berbentuk:

```bash
rhsls <namespace>:<command> [argumen] [opsi]
```

- **namespace** kelompok fitur: `session`, `user`, `backup`, `db`, `settings`, `activity`, `admin`.
- Setiap perintah punya namaunal (mis. `session:kick` punya alias `kick`).
-	rhsls menampilkan **suggesti ejaan** bila nama perintah salah ketik:

```bash
rhsls sesion:list
# → Apakah yang Anda maksud: session:list ?
```

- Bantuan tersedia per kelompok:

```bash
rhsls help            # semua perintah
rhsls help session    # hanya perintah sesi
rhsls help user:reset-password
```

---

## 4. Opsi Umum

| Opsi | Fungsi |
|---|---|
| `--json` | Output JSON (untuk otomasi/skrip) |
| `--dry-run` | Simulasikan, tidak mengubah apa pun |
| `--yes`, `-y` | Lewati konfirmasi untuk perintah destruktif |
| `--no-color` | Matikan output berwarna |
| `--limit <n>` | Batas jumlah baris yang ditampilkan |
| `--db-name <nama>` | Jalankan perintah pada database lain (mis. saat restore) |
| `--force-db-name` | Izinkan restore walau nama DB pada paket berbeda |
| `--env-file <path>` | Pakai file env tertentu |
| `--quiet` | Kurangi keluaran |
| `--help`, `-h` | Bantuan perintah |

Semua perintah yang mengubah data mendukung `--dry-run` **kecuali** yang secara eksplisit tidak aman disimulasikan (mis. `user:import` — gunakan `--dry-run` untuk memeriksa baris lebih dulu).

---

## 5. Perintah Inti

### 5.1 Dashboard & Doctor

#### `dashboard` (perintah bawaan)

Ringkasan cepat: jumlah user, sesi aktif, ujian berjalan, status DB/Redis.

```bash
rhsls                # tanpa argumen = dashboard
rhsls dashboard --json
```

#### `doctor`

Diagnosis menyeluruh: env, koneksi DB, skema, Redis, file, izin folder, backup.

```bash
rhsls doctor
rhsls doctor --json
```

Gunakan ini pertama kali bila CLI gagal terhubung.

---

### 5.2 Manajemen Sesi

#### `session:list` — daftar user & status sesi

```bash
rhsls session:list
rhsls session:list --role student
rhsls session:list --class "Kelas 1"
rhsls session:list --online
rhsls session:list --search aqq
rhsls session:list --limit 20
```

Kolom penting: `status` (online/offline), `nyangkut` (sesi macet), `idle` (terakhir aktif).

#### `session:show` — detail satu sesi

```bash
rhsls session:show aqq
rhsls session:show 12
```

#### `session:reset` — paksa login ulang

```bash
# satu user
rhsls session:reset --user aqq --yes

# semua sesi aktif
rhsls session:reset --all --yes

# hanya sesi yang nyangkut (idle > 1 jam)
rhsls session:reset --stuck --yes

# sesi yang idle lebih dari N menit
rhsls session:reset --older-than 30 --yes

# semua user kecuali admin
rhsls session:reset --all --except-admins --yes
```

Tambahkan `--dry-run` untuk melihat dampaknya tanpa mengubah apa pun.

#### `session:kick` — keluarkan satu user

```bash
rhsls session:kick aqq --yes
```

#### `session:invalidate-all`

```bash
rhsls session:invalidate-all --yes
rhsls session:invalidate-all --except-admins --yes
```

#### `session:stats`

```bash
rhsls session:stats
rhsls session:stats --json
```

#### `session:sync-online`

Selaraskan flag `is_online_realtime` di MySQL dengan kondisi sebenarnya di Redis.

```bash
rhsls session:sync-online --dry-run
rhsls session:sync-online --yes
```

#### `session:audit`

Riwayat login/logout/gagal login dari activity log.

```bash
rhsls session:audit
rhsls session:audit aqq --limit 20
rhsls session:audit --level warn,error
rhsls session:audit --all
```

#### `session:stuck`

Deteksi sesi nyangkut (idle > 1 jam).

```bash
rhsls session:stuck
rhsls session:stuck --fix --yes
```

#### `session:purge-cache`

Bersihkan cache Redis (status online & jawaban sementara).

```bash
rhsls session:purge-cache --scope online --yes
rhsls session:purge-cache --scope all --yes
```

#### `session:watch`

Pantau aktivitas login secara real-time. Tekan `Ctrl+C` untuk berhenti.

```bash
rhsls session:watch
rhsls session:watch --interval 5
```

---

### 5.3 Manajemen User

#### `user:list`

```bash
rhsls user:list
rhsls user:list --role student --limit 50
rhsls user:list --locked          # yang terkunci
rhsls user:list --never-login     # belum pernah login
```

#### `user:show`

```bash
rhsls user:show aqq
```

Menampilkan ID, role, kelas, status kunci, jumlah percobaan, statistik ujian.

#### `user:create`

```bash
# password di-generate otomatis
rhsls user:create --username aqiq --name "Aqiq Rajab" --role student --class-id 2

# tampilkan password hasil generate
rhsls user:create --username budi --role teacher --generate
```

#### `user:update`

```bash
rhsls user:update aqq --name "Aqiq R."
rhsls user:update aqq --class-id 3
rhsls user:update aqq --role teacher
```

#### `user:delete`

> Menghapus user **juga menghapus jawaban & riwayat ujiannya** (cascade FK).

```bash
rhsls user:delete aqq --yes
```

Gunakan `--dry-run` lebih dulu bila ragu.

#### `user:reset-password`

```bash
rhsls user:reset-password aqq                    # generate & tampilkan
rhsls user:reset-password aqq --generate
rhsls user:reset-password aqq --password "Rahasia123"
rhsls user:reset-password aqq --password-stdin   # dari pipe
```

#### `user:verify-password`

Membantu siswa yang lupa password, dengan cara memeriksa kandidat password.

```bash
rhsls user:verify-password aqq --password "Siswa#2024"
rhsls user:verify-password aqq --password "salah" --json
```

Tidak mengubah apa pun — aman dipanggil berkali-kali.

#### Kunci akun

```bash
rhsls user:lock aqq --yes
rhsls user:unlock aqq
rhsls user:unlock-all --yes
rhsls user:reset-attempts aqq        # reset penghitung brute-force
rhsls user:reset-attempts --all
```

#### `user:promote` / `user:demote`

```bash
rhsls user:promote aqq                       # siswa -> guru
rhsls user:promote aqq --to admin --yes
rhsls user:demote aqq
rhsls user:demote aqq --to teacher --yes
```

#### `user:move-class`

```bash
rhsls user:move-class --from "Kelas 1" --to "Kelas 2" --dry-run
rhsls user:move-class --from "Kelas 1" --to "Kelas 2" --yes
```

#### `user:export` / `user:import`

Ekspor ke CSV:

```bash
rhsls user:export
rhsls user:export --out users.csv
rhsls user:export --role student
rhsls user:export --class "Kelas 1"
```

Impor dari CSV (kolom: `username,name,role,class_name,password`):

```bash
rhsls user:import --file users.csv --dry-run
rhsls user:import --file users.csv --yes
rhsls user:import --file users.csv --update --yes   # timpa user yang sudah ada
```

Selalu jalankan `--dry-run` lebih dulu. Bila kolom `password` kosong, CLI membuat password acak dan **menampilkannya**.

#### `user:stats`

```bash
rhsls user:stats
rhsls user:stats --json
```

#### `user:cleanup`

Hapus user yatim (tanpa kelas & belum pernah login).

```bash
rhsls user:cleanup --dry-run
rhsls user:cleanup --older-than 30 --yes
```

---

### 5.4 Backup & Restore

#### `backup:create`

```bash
# backup penuh (database + upload + kunci + env)
rhsls backup:create

# nama file & tujuan kustom
rhsls backup:create --out sebelum-upgrade.zip

# subset
rhsls backup:create --db-only
rhsls backup:create --no-uploads
rhsls backup:create --no-secrets      # jangan ikutkan kunci & env
rhsls backup:create --tables "rhs_users,rhs_classes"
rhsls backup:create --no-logs         # jangan ikutkan activity log
rhsls backup:create --gzip
```

Default: output ke folder `backups/` dengan nama bercap timestamp.

#### `backup:list`

```bash
rhsls backup:list
rhsls backup:list --json
```

#### `backup:verify`

Memeriksa checksum tiap file di dalam paket.

```bash
rhsls backup:verify
rhsls backup:verify backups/backup-2026-03-17.zip
```

#### `backup:open`

Lihat isi paket tanpa mengekstrak.

```bash
rhsls backup:open
rhsls backup:open --limit 200
```

#### `backup:restore` ⚠️ MENIMPA

```bash
# lebih aman: periksa dulu
rhsls backup:verify backups/backup-2026-03-17.zip

# restore
rhsls backup:restore backups/backup-2026-03-17.zip
```

Opsi:

| Opsi | Fungsi |
|---|---|
| `--db-only` | Hanya pulihkan database |
| `--files-only` | Hanya pulihkan file (upload/kunci/env) |
| `--skip-verify` | Lewati pemeriksaan checksum (tidak disarankan) |
| `--no-safety-backup` | Jangan buat backup pengaman sebelum restore |
| `--force-db-name` | Izinkan restore walau nama DB paket ≠ DB tujuan |
| `--db-name <nama>` | Restore ke database tertentu |
| `--yes` | Lewati konfirmasi |

**Perilaku aman yang sudah diterapkan:**

1. Nama file backup yang diketikkan selalu diprioritaskan — tidak pernah diam-diam berganti ke backup lain.
2. Restore ke database dengan nama berbeda **ditolak**, kecuali memakai `--db-name` atau `--force-db-name`.
3. Sebelum menimpa, CLI membuat **safety backup** otomatis (bisa dimatikan dengan `--no-safety-backup`).
4. Tabel dipulihkan sesuai urutan dependensi **foreign key** agar tidak gagal di tengah jalan.
5. `--dry-run` menampilkan rencana tanpa mengubah apa pun.

#### `backup:prune`

```bash
rhsls backup:prune --keep 10 --dry-run
rhsls backup:prune --keep 10 --yes
```

---

### 5.5 Database

#### `db:status`

```bash
rhsls db:status
rhsls db:status --json
```

Menampilkan koneksi, versi server, jumlah tabel, dan tabel yang hilang.

#### `db:migrate`

Menjalankan migrasi skema (idempotent, aman diulang).

```bash
rhsls db:migrate --dry-run
rhsls db:migrate --yes
```

#### `db:optimize`

Membersihkan ruang setelah banyak `DELETE`.

```bash
rhsls db:optimize --dry-run
rhsls db:optimize --yes
rhsls db:optimize --table rhs_activity_logs --yes
```

---

### 5.6 Settings, Activity & Admin

```bash
rhsls settings:list
rhsls settings:get site_name
rhsls settings:set maintenance_mode true --yes

rhsls activity:tail --limit 40
rhsls activity:tail --level warn,error
rhsls activity:tail --user aqq
rhsls activity:tail --search "login"

# pintu darurat: pastikan ada admin & reset passwordnya
rhsls admin:reset
rhsls admin:reset --generate
rhsls admin:reset --password "PasswordBaru123" --yes
```

---

## 7. Isi Paket Backup

```
backup-2026-03-17-143022.zip
├── manifest.json            versi app, waktu, host, jumlah baris, checksum
├── db/
│   ├── schema.sql           definisi tabel & index
│   └── data/
│       ├── rhs_users.sql
│       ├── rhs_exam_attempts.sql
│       └── ...
├── files/
│   ├── uploads/…            logo, foto, berkas unggahan siswa
│   └── license_status.json  status license runtime
├── keys/
│   └── private.pem          kunci privat license   (opsional, default ikut)
└── config/
    ├── .env.local           konfigurasi            (opsional, default ikut)
    └── .env                 konfigurasi            (opsional, default ikut)
```

Catatan:

- `--no-secrets` mengecualikan folder `keys/` dan `config/`.
- Paket yang memuat rahasia **jangan** dikirim lewat email/chat publik.
- Backup disimpan di `backups/` yang sudah masuk `.gitignore`.

---

## 8. Keamanan & PenRestorean yang Hati-hati

Checklist sebelum menjalankan `backup:restore` di server produksi:

1. `rhsls backup:verify <file>` — pastikan checksum valid.
2. `rhsls backup:open <file>` — pastikan isi sesuai harapan.
3. `rhsls backup:restore <file> --dry-run` — lihat rencana.
4. Pastikan tidak ada proses ujian sedang berjalan.
5. Jalankan restore **tanpa** `--skip-verify` dan **tanpa** `--no-safety-backup`.
6. Setelah restore: `rhsls db:migrate` lalu `rhsls doctor`.
7. Bila perlu mengembalikan kondisi sebelum restore, pakai file safety backup yang disebut pada output.

Aksi destruktif selalu meminta konfirmasi. Di lingkungan non-interaktif (CI, cron), tambahkan `--yes` secara sadar.

---

## 9. Variabel Environment

CLI membaca `.env.local` lalu `.env` (nilai yang sudah ada di `process.env` tidak ditimpa).

| Variabel | Kegunaan |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Koneksi MySQL |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` | Koneksi Redis (opsional) |
| `RHSLS_UPLOADS_DIR` | Lokasi folder upload (default `public/uploads`) |
| `RHSLS_BACKUP_DIR` | Lokasi folder backup (default `backups/`) |

Ganti file env dengan `--env-file <path>` bila perlu.

---

## 10. Otomasi & exit code

Semua perintah mendukung `--json` dan mengembalikan exit code bermakna:

| Code | Arti |
|---|---|
| `0` | Berhasil |
| `1` | Terjadi kesalahan (lihat pesan di stderr/JSON) |

Contoh otomasi:

```bash
# health check
rhsls doctor --json | node -e "process.exit(JSON.parse(require('fs').readFileSync(0)).ok ? 0 : 1)"

# auto-unlock akun terkunci tiap pagi
rhsls user:unlock-all --yes > /dev/null

# backup harian
rhsls backup:create --gzip
```

---

## 11. Troubleshooting

| Gejala | Penyebab & Solusi |
|---|---|
| `Can't reach database server` | Jalankan `rhsls doctor`; pastikan MySQL hidup & kredensial `.env.local` benar |
| `Can't add new command when connection is in closed state` | Proses selesai sangat cepat / koneksi diputus. Jalankan ulang; bila sering, periksa stabilitas MySQL |
| Tabel tidak ditemukan saat restore | Paket dibuat dari versi lama. Jalankan `rhsls db:migrate` setelah restore |
| Restore ditolak: nama DB tidak cocok | Gunakan `--db-name <nama>` atau `--force-db-name` bila memang disengaja |
| Redis `off` di dashboard | Redis opsional. CLI tetap jalan dengan data MySQL (mode fallback) |
| Lupa password admin | `rhsls admin:reset` |

---

## 12. Contoh Recipes Harian

**Pagi — cek kondisi sistem**

```bash
rhsls doctor
rhsls session:stats
```

**Ada siswa complain “keluar sendiri”**

```bash
rhsls session:audit aqq --level warn,error
rhsls session:kick aqq --yes
```

**Siswa lupa password**

```bash
rhsls user:verify-password aqq --password "Siswa#2024"
rhsls user:reset-password aqq --generate
```

**Sesi semua macet setelah restart server**

```bash
rhsls session:stuck
rhsls session:reset --stuck --dry-run
rhsls session:reset --stuck --yes
```

**Backup sebelum upgrade**

```bash
rhsls backup:create --gzip
rhsls backup:verify
```

---

<div align="center">

**rhsls v1.0.0** — bagian dari Rushless Exam

</div>

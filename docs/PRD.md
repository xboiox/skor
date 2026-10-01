# PRD — Skor (Padel Tournament Scoring)

> Product Requirements Document · versi 0.1 · 2026-09-30

## 1. Ringkasan

**Skor** adalah web app untuk mengelola turnamen padel sosial (Americano, Mexicano, dst.) dengan skor realtime. Host membuat turnamen, sistem menyusun jadwal otomatis ke beberapa lapangan, pemain menginput skor live dari HP, host menyetujui hasil akhir, dan semua orang melihat leaderboard yang terupdate langsung.

Referensi produk: aplikasi sejenis seperti Padel Up.

## 2. Masalah

- Penyelenggara main bareng/turnamen komunitas masih menyusun jadwal rotasi pasangan secara manual (kertas/spreadsheet) — lambat dan rawan tidak adil.
- Skor dicatat terpisah per lapangan lalu direkap manual; klasemen baru diketahui di akhir.
- Pemain & penonton tidak bisa melihat skor/klasemen secara langsung.

## 3. Target pengguna

| Persona          | Kebutuhan                                                                          |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Host / Admin** | Membuat turnamen cepat, jadwal otomatis, kontrol jalannya ronde, approve skor      |
| **Player**       | Tahu kapan & di lapangan mana main, input skor dengan mudah, lihat posisi klasemen |
| **Viewer**       | Melihat skor live & leaderboard tanpa perlu akun                                   |

## 4. Scope MVP

### 4.1 Akun

- Register/login dengan **email + password** dan **Google account**.
- **Guest mode**: membuat turnamen tanpa login. Akses via link bertoken. Data **dihapus otomatis 7 hari** setelah dibuat.
- User login: turnamen tersimpan permanen dan tampil di dashboard.

### 4.2 Create Tournament

| Field               | Aturan                                                             |
| ------------------- | ------------------------------------------------------------------ |
| Tournament name     | wajib, 1–100 karakter                                              |
| Tournament date     | wajib                                                              |
| Match type          | MVP: **Americano**, **Mexicano** (individu)                        |
| Number of courts    | wajib, 1–20                                                        |
| Scoring type        | **Rally points** atau **Tennis scoring**                           |
| Points per match    | Rally points: **16 / 21 / 24 / 32** (total points)                 |
|                     | Tennis scoring: **First to X games** atau **Total of X games**     |
| X (games)           | Tombol cepat **4** dan **6**, plus kolom isi bebas **1–12**        |
| Deuce rule (tennis) | **Golden point** atau **Advantage** (berlaku saat skor game 40-40) |
| Players             | Nama individu, minimal 4, unik dalam satu turnamen                 |

### 4.3 Aturan skor

- **Rally points (total points)**: tiap reli = 1 poin. Match selesai saat `skorA + skorB = N`. Untuk N genap, hasil seri dimungkinkan (mis. 12-12).
- **Tennis — First to X games**: match selesai saat salah satu tim mencapai X game. Tidak bisa seri.
- **Tennis — Total of X games**: match selesai saat `gameA + gameB = X`. Untuk X genap, seri dimungkinkan.
- **Dalam satu game** (tennis): 0 → 15 → 30 → 40 → game. Saat 40-40:
  - _Golden point_: poin berikutnya menentukan game.
  - _Advantage_: harus unggul 2 poin.

### 4.4 Jadwal & ronde

- Kapasitas per ronde = `min(courts × 4, floor(players / 4) × 4)`. Sisanya **bye** (istirahat), dirotasi secara adil.
- **Americano**: jadwal di-generate sampai **setiap pemain pernah berpasangan dengan semua pemain lain** (atau sedekat mungkin bila tidak ada jadwal sempurna).
- **Mexicano**: tidak ada jumlah ronde di awal. Host menekan **Next round** setelah semua match di ronde berjalan _Approved_; pasangan ditentukan dari klasemen (peringkat 1 & 3 vs 2 & 4 per grup empat).
- **Kontrol host**:
  - **End tournament** kapan saja (selesai lebih awal).
  - **Repeat (home/away)** — Americano: mengulang seluruh jadwal putaran pertama sebagai putaran kedua.

### 4.5 Input skor

- **Siapa pun pemain terdaftar** bisa menginput skor **semua match** via _Player link_.
- Saat membuka Player link, pemain memilih identitas dari **dropdown "I am …"** (daftar pemain terdaftar). Pilihan disimpan di browser.
- Dua mode input:
  - **Live**: tombol tambah poin per tim + Undo.
  - **Final result only**: langsung ketik skor akhir.
- Semua perubahan skor dicatat (siapa, kapan) — audit log.
- **Final score harus di-approve host.** Host bisa approve, reject, atau edit.

### 4.6 Status match

```
Scheduled → In progress → Submitted → Approved
                              │
                              └→ Rejected (kembali ke In progress) / Edited by host
```

### 4.7 Leaderboard

Sistem penilaian berbasis **poin yang diraih di setiap match** (standar Americano/Mexicano). Tidak ada hitungan menang/kalah/seri — skor 2-2 berarti +2 points won dan +2 points lost.

Kolom: **Rank, Player, Played, Points won, Points lost, Diff** (Diff = won − lost).

Urutan peringkat:

1. **Points won** tertinggi.
   Jika jumlah match yang dimainkan antar pemain **tidak sama** (karena bye atau penggantian pemain), dipakai **Avg points won per match** (= points won ÷ played) agar adil; kolom _Avg_ ditampilkan.
2. **Diff** tertinggi
3. **Points lost** terkecil
4. **Head-to-head** — hasil antar pemain yang sama-sama tied saat berada di tim berlawanan
5. Masih sama → rank bersama

Pemain yang _withdrawn_ tetap tampil dengan label **Withdrawn**.
Hasil _Approved_ bersifat final; hasil yang belum di-approve ditampilkan sebagai **provisional** (visual berbeda).

### 4.8 Realtime

- Beberapa orang bisa input skor bersamaan di lapangan berbeda; semua layar (host, player, viewer) terupdate langsung tanpa refresh.
- Konflik pada match yang sama ditangani dengan versioning (update basi ditolak, layar di-sync ulang).

### 4.9 Link & akses

| Link            | Hak akses                                                                     |
| --------------- | ----------------------------------------------------------------------------- |
| **Admin link**  | Semua kontrol host + approve skor (untuk guest; user login cukup via session) |
| **Player link** | Pilih identitas + input skor                                                  |
| **Public link** | Read-only: jadwal, skor live, leaderboard                                     |

### 4.10 Platform

- UI **Bahasa Inggris**, web **mobile-first** (tombol besar, bisa dipakai satu tangan di pinggir lapangan). Detail: [UI_GUIDELINES.md](UI_GUIDELINES.md).
- Share link via tombol Share (WhatsApp, dll.) dan **QR code** untuk Player & Public link.

### 4.11 Replace player (pengganti pemain)

Untuk pemain yang berhalangan/sakit. **Hanya host** yang bisa melakukan penggantian, dan **hanya untuk match berstatus Scheduled** (belum dimulai). Jika match sudah berjalan lalu pemain cedera, host mengedit skor atau mengakhiri match secara manual.

**Jenis penggantian**

| Jenis                    | Efek                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Temporary**            | Pemain absen untuk **satu ronde**; pengganti mengisi slotnya di match ronde itu. Ronde berikutnya pemain asli kembali sesuai jadwal |
| **Permanent (withdraw)** | Pemain keluar mulai ronde tertentu. Status pemain → _Withdrawn_. Semua slotnya di ronde-ronde berikutnya diambil alih pengganti     |

**Sumber pengganti**

| Sumber         | Keterangan                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------- |
| **New player** | Host mengetik nama baru → ditambahkan ke daftar pemain (otomatis muncul di dropdown "I am …") |
| **Bye player** | Pemain yang sedang bye di ronde tersebut — **hanya untuk Temporary**                          |

| Jenis     | Sumber pengganti yang boleh    |
| --------- | ------------------------------ |
| Temporary | New player **atau** Bye player |
| Permanent | **New player saja**            |

**Aturan**

- **Poin masuk ke pemain pengganti** (punya baris sendiri di leaderboard). Pemain asli tidak mendapat poin untuk match itu.
- **Americano**: pengganti **mengambil alih slot jadwal** — jadwal tidak di-generate ulang, rotasi pemain lain tidak berubah.
- **Mexicano**: temporary sama seperti Americano (untuk ronde berjalan). Permanent → pemain di-withdraw, pemain baru menggantikan slotnya di ronde berjalan dan ikut di Next round berikutnya.
- Setiap penggantian dicatat (siapa diganti, oleh siapa, ronde, jenis, oleh host siapa).
- Jumlah match pemain jadi tidak sama → leaderboard memakai **Avg points per match** (lihat 4.7).

## 5. Di luar scope MVP (iterasi berikutnya)

- Team Americano, Team Mexicano, Mix Americano, round robin + knockout
- PWA (installable, offline-first)
- Klaim turnamen guest ke akun setelah register
- Tracking server/servis & pindah sisi
- Scoreboard mode layar TV
- Statistik & riwayat pemain lintas turnamen, ranking klub
- Multi-bahasa

## 6. Metrik sukses

- Host bisa membuat turnamen 8 pemain / 2 lapangan dalam **< 2 menit**.
- Update skor tampil di perangkat lain dalam **< 1 detik** (jaringan normal).
- **0** kesalahan perhitungan leaderboard (dijamin oleh unit test engine).

## 7. Keputusan

| #   | Keputusan                                                                                           |
| --- | --------------------------------------------------------------------------------------------------- |
| A1  | ✅ Nilai X tennis scoring: tombol cepat 4 dan 6 + input bebas 1–12                                  |
| A2  | ✅ Leaderboard berbasis Points won / Points lost / Diff — tidak ada W/D/L (lihat 4.7)               |
| A3  | ✅ Docker Compose untuk **development lokal** dulu; konfigurasi production menyusul                 |
| A4  | ❎ Dihapus — set difference tidak dipakai (digantikan sistem 4.7)                                   |
| A5  | ✅ Mexicano ronde 1 memakai urutan acak; bye diprioritaskan ke pemain dengan bye paling sedikit     |
| A6  | ✅ Match otomatis berstatus _Submitted_ saat kondisi selesai tercapai (live mode)                   |
| A7  | ✅ Jika jumlah match antar pemain tidak sama, kriteria 1 leaderboard = **Avg points won per match** |
| A8  | ✅ Temporary: pengganti = new player atau bye player. Permanent: new player saja                    |

# UI Guidelines — Skor (Mobile-first)

> versi 0.1 · 2026-10-01 · mayoritas pengguna membuka Skor dari **browser HP di pinggir lapangan**

## 1. Konteks pemakaian

| Kondisi                                      | Implikasi desain                                                   |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Satu tangan, sering sambil pegang raket/bola | Aksi utama di **zona jempol** (bawah layar), tombol besar          |
| Outdoor, sinar matahari                      | **Kontras tinggi**, teks tebal, jangan andalkan warna saja         |
| Berkeringat, terburu-buru                    | Target sentuh besar, jarak antar tombol cukup, **Undo** selalu ada |
| Sinyal venue sering lemah                    | UI tetap responsif saat request lambat, status koneksi terlihat    |
| Dilihat dari jarak 1–2 meter                 | Angka skor sangat besar                                            |
| Layar bisa mati saat menunggu                | Layar scoring menahan layar tetap menyala                          |

## 2. Prinsip

1. **Didesain untuk 360–430px dulu**, lalu diperluas ke tablet/desktop (`sm` 640px, `md` 768px, `lg` 1024px).
2. **Satu layar = satu tugas utama.** Tidak ada halaman yang memaksa scroll horizontal (kecuali tabel di dalam container sendiri).
3. **Aksi utama di bawah**: tombol primary _sticky_ di bagian bawah layar, bukan di header.
4. **Feedback instan**: setiap tap memberi respons visual (< 100ms), getar ringan bila didukung.
5. **Tidak ada hover-only**: semua informasi bisa diakses dengan tap.

## 3. Spesifikasi dasar

| Aspek              | Aturan                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Target sentuh      | min **48×48px**; tombol skor ≥ 40% tinggi layar per tim                                           |
| Jarak antar target | min 8px                                                                                           |
| Font body          | min 16px (mencegah auto-zoom iOS saat fokus input)                                                |
| Angka skor         | 72–120px, `font-variant-numeric: tabular-nums` (lebar angka tetap, tidak "loncat")                |
| Kontras            | min WCAG AA 4.5:1; teks skor & tombol utama target 7:1                                            |
| Safe area          | `env(safe-area-inset-*)` untuk notch & home indicator                                             |
| Viewport           | `width=device-width, initial-scale=1, viewport-fit=cover`; **zoom tidak dikunci** (aksesibilitas) |
| Double-tap zoom    | `touch-action: manipulation` pada tombol skor agar tap cepat tidak memicu zoom                    |
| Tema               | Light & dark mengikuti sistem; tombol toggle manual                                               |
| Input              | `inputmode="numeric"` untuk skor & angka; `autocomplete` pada form auth                           |
| Gerak              | Animasi singkat (≤ 200ms), hormati `prefers-reduced-motion`                                       |

## 4. Navigasi

- **Bottom tab bar** di halaman turnamen (publik/player/admin):
  `Matches` · `Leaderboard` · `Rounds` · (`Admin` jika host)
- Header ringkas: nama turnamen + indikator koneksi realtime (● Live / ○ Reconnecting).
- Tombol back browser harus selalu bekerja dengan wajar (tiap tab = URL sendiri).

## 5. Wireframe layar utama

### 5.1 Scoring (layar paling penting)

Portrait — dua panel tim membagi layar, **tap di mana saja pada panel = +1 poin** tim tersebut.

```
┌─────────────────────────┐
│ ← Court 2 · R3   ● Live │
├─────────────────────────┤
│   Andi / Budi           │
│                         │
│          14             │  ← tap area Team A (+1)
│        (40)             │  ← poin game (tennis)
├─────────────────────────┤
│          10             │  ← tap area Team B (+1)
│        (15)             │
│                         │
│   Citra / Dewi          │
├─────────────────────────┤
│ [ ↶ Undo ]  [ Final… ]  │  ← sticky bawah
└─────────────────────────┘
```

- Landscape: panel kiri/kanan.
- Rally: tampil juga sisa poin (`24 − 14 − 10 = 0 left`).
- Saat target tercapai → layar konfirmasi "Match complete · Submitted for approval".
- **Final…** membuka bottom sheet input skor akhir (dua input numerik besar + tombol Submit).
- Menahan layar tetap menyala (**Screen Wake Lock API**) selama layar scoring terbuka.
- Konflik versi → toast "Score updated by someone else" + skor tersinkron, tanpa kehilangan tap yang valid.

### 5.2 Player — daftar match

```
┌─────────────────────────┐
│ Friday Americano  ● Live│
│ You: Andi ▾             │  ← ganti identitas
├─────────────────────────┤
│ ROUND 3                 │
│ ┌─────────────────────┐ │
│ │ Court 1   IN PROGRESS│ │
│ │ Andi/Budi   14      │ │
│ │ Citra/Dewi  10      │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Court 2   SCHEDULED │ │
│ │ Eka/Fajar  vs Gita/…│ │
│ └─────────────────────┘ │
│ Bye: Hadi               │
├─────────────────────────┤
│ Matches  Board  Rounds  │  ← bottom tab
└─────────────────────────┘
```

- Match yang melibatkan pemain terpilih ditandai/di-pin paling atas.
- Tap kartu → layar scoring.

### 5.3 "I am …"

Bottom sheet daftar nama (bukan `<select>` kecil): list besar + kolom pencarian bila > 12 pemain.

### 5.4 Leaderboard

```
┌─────────────────────────┐
│ #  Player   P  Won  Diff│
│ 1  Andi     3   44  +16 │
│ 2  Citra    3   40   +8 │
│ 3= Budi     3   36    0 │
│ 3= Eka      3   36    0 │
│ …                       │
└─────────────────────────┘
```

- Di layar sempit tampil kolom inti: **#, Player, Played, Won, Diff**. Tap baris → detail (Points lost, Avg, riwayat match).
- ≥ 640px: semua kolom tampil.
- Baris provisional: teks lebih pudar + ikon jam; legenda di bawah tabel.
- Pemain terpilih ("You") di-highlight.

### 5.5 Create tournament

- Form **satu kolom**, dibagi langkah: `Details → Format & scoring → Players → Review`.
- Pilihan (match type, scoring type, 16/21/24/32, 4/6) memakai **segmented button / chip besar**, bukan dropdown.
- Input pemain: ketik nama + Enter → chip; tombol **Paste list** (satu nama per baris) untuk input cepat.
- Tombol **Next / Create** sticky di bawah.
- **Isian tidak hilang**: draft disimpan di `sessionStorage` (tab yang sama) dan dipulihkan setelah reload atau setelah kembali dari login — dibaca setelah hydration agar HTML server & klien sama; dihapus setelah turnamen dibuat.
- **Review (guest)**: kotak "You are not signed in: this tournament and its links are deleted after 7 days" + tautan **Log in to keep it →** (`/login?next=/tournaments/new`).
- **Tournament created (guest)**: peringatan "Save your admin link now" + tip "Next time, **log in first** and you won't need this link".

### 5.6 Admin

- Kartu **Needs approval** paling atas dengan tombol `Approve` / `Edit` besar per match.
- Kontrol turnamen (Next round, Repeat, Replace player, End) di bagian **Manage** pada halaman admin, dengan konfirmasi di dalam halaman untuk aksi yang tidak bisa dibatalkan (Repeat, End).

### 5.7 Share links

- Tombol **Share** memakai **Web Share API** (langsung ke WhatsApp dll.), fallback ke _Copy link_.
- **QR code** untuk Player link & Public link — pemain cukup scan di venue.

### 5.8 Landing

```
┌─────────────────────────┐
│ Skor.            Log in │
├─────────────────────────┤
│ [Americano · Mexicano]  │
│ Padel tournaments,      │
│ scored live.            │
│ Create a tournament in  │  ← tanpa "No account needed"
│ under two minutes.      │
│ ┌ Auto schedule ──────┐ │
│ │ …byes included. Swap│ │
│ │ in a substitute…    │ │
│ └─────────────────────┘ │
│ ┌ Live scores ────────┐ │
│ ┌ Live leaderboard ───┐ │
│ ┏ Free account, more ┓ │  ← bingkai primary
│ ┃ ✓ Tournaments saved ┃ │
│ ┃ ✓ Any phone         ┃ │
│ ┃ ✓ One dashboard     ┃ │
│ ┃ [Create free account]┃ │  ← tombol sekunder
│ ┗━━━━━━━━━━━━━━━━━━━━━┛ │
├─────────────────────────┤
│ Or just create a tourna-│  ← footer sticky, latar solid
│ ment as a guest — …     │
│ [  Create tournament  ] │  ← tombol utama
└─────────────────────────┘
```

- Tombol utama tetap **Create tournament**; akun ditawarkan, bukan dipaksakan.
- Halaman **statis** (tanpa session) agar tetap cepat — bagian akun tampil untuk semua orang.
- Footer sticky memakai latar **solid** (bukan transparan) agar teks di belakangnya tidak tembus.

## 6. Kondisi jaringan

- Tap skor menampilkan **optimistic update** dengan indikator "saving"; jika gagal → kembali ke nilai server + pesan jelas.
- Banner tipis saat offline/reconnecting; tombol skor dinonaktifkan saat offline agar tidak terjadi skor ganda.
- Skeleton loading, bukan spinner layar penuh.

## 7. Performa (budget)

| Metrik             | Target (HP kelas menengah, 4G) |
| ------------------ | ------------------------------ |
| LCP                | < 2.5 s                        |
| INP                | < 200 ms                       |
| CLS                | < 0.1                          |
| JS halaman scoring | < 150 KB gzip                  |

Gunakan Server Components untuk halaman baca (leaderboard, rounds); client component hanya untuk bagian interaktif.

## 8. Testing tampilan

- Playwright dijalankan dengan viewport **iPhone 13/14 (390×844)** dan **Pixel 7 (412×915)** sebagai default; desktop sebagai tambahan.
- Cek manual di Safari iOS & Chrome Android sebelum rilis.
- Lighthouse mobile ≥ 90 untuk Performance & Accessibility.

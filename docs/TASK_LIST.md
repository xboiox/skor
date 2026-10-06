# Task List — Skor MVP

> versi 0.1 · 2026-09-30 · centang `[x]` saat selesai. Engine dikerjakan TDD (test → implementasi → refactor).

## Fase 1 — Setup project & database

- [x] Inisialisasi Next.js 16 + TypeScript (strict) + Tailwind 4 + ESLint + Prettier
- [x] Setup Vitest (project `unit` & `integration`) & Playwright (iPhone 13, Pixel 7, desktop)
- [x] Design tokens Tailwind: warna kontras tinggi light/dark, skala tipografi skor, safe-area
- [x] Landing page mobile-first
- [x] `Dockerfile.dev` + `docker-compose.yml` (`app`, `db`, `cleanup`)
- [x] `.env.example` + validasi env dengan Zod
- [x] Drizzle: schema semua tabel ([SYSTEM_DESIGN §1](SYSTEM_DESIGN.md)) + migrasi awal
- [x] Helper envelope API + error handler + logger + `GET /api/health`
- [x] `git init` + `.gitignore`

**Selesai bila:** `docker compose up` menjalankan app & DB, migrasi sukses, `npm test` hijau.

## Fase 2 — Scoring engine (TDD)

- [x] Rally: `applyPoint`, `isComplete`, `validateFinal`
- [x] Tennis: poin dalam game (golden point & advantage), `formatGamePoint`
- [x] Tennis: `first_to` & `total_of`
- [x] Auto-submit saat selesai (`statusForScore`, A6)
- [x] Undo: `findUndoTarget` (pemulihan `prev_state` dilakukan service di Fase 7)
- [x] Test simulasi invariant (ribuan poin acak ber-seed di semua konfigurasi)
- [x] Coverage domain/scoring ≥ 95% (100% baris, 97.5% cabang)

## Fase 3 — Scheduling engine (TDD)

- [x] PRNG ber-seed (mulberry32) + `shuffle` immutable + `deriveSeed`
- [x] Kapasitas ronde & batas bawah jumlah ronde Americano
- [x] Pemilihan bye yang adil + skor preferensi (cakupan pasangan untuk Americano)
- [x] Minimum-cost perfect matching (branch & bound)
- [x] Americano: generator jadwal + kriteria selesai (semua partner tercakup)
- [x] Americano: repeat home/away
- [x] Mexicano: ronde 1 acak + ronde berikutnya berdasarkan klasemen
- [x] Replace player: `planSubstitution` (temporary: new/bye player; permanent: new player)
- [x] Coverage domain/scheduling ≥ 95% (100% baris, 97% cabang)

## Fase 4 — Leaderboard engine (TDD)

- [x] Agregasi stat per pemain (played, points won, points lost, diff, avg)
- [x] Sorting tie-breaker berlapis + head-to-head + rank bersama (competition ranking)
- [x] Mode final vs provisional
- [x] Avg points won per match saat jumlah played berbeda + label withdrawn / substitute
- [x] Test invariant lintas engine (jadwal Americano asli + skor acak)
- [x] Coverage domain/leaderboard 100%

## Fase 5 — Auth & akses

- [x] Better Auth: email/password (scrypt) + Google (aktif bila kredensial diisi), session di DB
- [x] Migrasi tabel auth ke skema Better Auth (0001 hapus struktur lama, 0002 tabel baru)
- [x] Halaman `/login`, `/register` (+ `?next=` aman dari open redirect), `/dashboard` sementara, sign out
- [x] Token admin/player: generate, hash, tukar ke cookie httpOnly, redirect URL bersih (`/t/:slug/enter/:role`)
- [x] Guard `requireHost`, `requireScorer`, `requireViewer`
- [x] Rate limit login/register (bawaan Better Auth: 3 / 10 detik per IP), aktif di semua environment
- [x] E2E alur register → dashboard → sign out → login, password salah, `?next=` luar, link tidak valid (iPhone 13, Pixel 7, desktop)

## Fase 6 — Tournament management

- [x] Validasi Zod bersama (form + API): nama, tanggal, format, lapangan, scoring, 4–100 pemain unik
- [x] API `POST /api/tournaments` (guest & user) + cek same-origin/JSON (CSRF)
- [x] Player link disimpan terenkripsi (AES-256-GCM) agar bisa ditampilkan lagi; admin link tetap hash saja
- [x] Form `/tournaments/new` 4 langkah (Details → Format → Players → Review), paste daftar pemain, estimasi ronde
- [x] Layar "Tournament created" dengan admin/player/public link (Copy + Share)
- [x] Kelola pemain saat `draft` (API + halaman `/t/[slug]/admin`)
- [x] `start` → generate jadwal & simpan (Americano semua ronde, Mexicano ronde 1), aman dari klik ganda (`FOR UPDATE`)
- [x] `/dashboard` menampilkan turnamen milik user
- [x] Form tahan hydration lambat: submit aktif setelah halaman siap, `method="post"` (password tidak pernah masuk URL)

## Fase 7 — Scoring flow & approval

- [x] Service skor: point/undo/final dengan `FOR UPDATE` + cek versi (409 berisi state terbaru) + audit `score_events`
- [x] Service host: approve / reject / edit (edit = approved), perkembangan status ronde otomatis
- [x] Aturan: match di ronde mana pun boleh diskor selama turnamen aktif & belum approved
- [x] Next round (Mexicano, setelah semua approved), Repeat home/away (Americano, memakai pengganti permanen), End
- [x] Replace player: service + preview (dry run) + wizard `/t/[slug]/admin/replace`
- [x] API: `/api/matches/:id/{actions,approve,reject}`, `PATCH /api/matches/:id`, `/api/tournaments/:id/{rounds/next,repeat,end,substitutions[/preview]}`, `/api/t/:slug/identity`
- [x] Halaman `/t/[slug]/play`: "I am …" (daftar besar + cari), match saya di atas, ronde & bye
- [x] Layar scoring `/t/[slug]/match/[matchId]`: tap panel +1, antrian optimistic, sinkron saat konflik, Undo, sheet Final, Wake Lock, getar, landscape
- [x] Halaman admin aktif: antrian approval, semua hasil + Edit, kontrol Next/Repeat/Replace/End
- [x] Tab bar bawah (Matches · Admin)
- [x] QR code (server-side SVG) untuk player & public link

## Fase 8 — Realtime

- [ ] Hub LISTEN/NOTIFY dengan auto-reconnect
- [ ] Endpoint SSE + heartbeat
- [ ] Hook client `useTournamentStream` (refetch saat event / reconnect)
- [ ] Integration test: update di satu client diterima client lain

## Fase 9 — Leaderboard & halaman publik

- [ ] `/t/[slug]`: leaderboard (final/provisional), daftar ronde & skor live
- [ ] Penanda visual provisional & rank bersama

## Fase 10 — Cleanup & hardening

- [x] Container `cleanup` (hapus guest expired tiap jam) + test — selesai di Fase 1
- [ ] Rate limit aksi skor
- [ ] Rate limit di balik reverse proxy: set `advanced.ipAddress.trustedProxies` (header `x-forwarded-for` bisa dipalsukan bila app diakses langsung)
- [ ] Security review (token, cookie, input, error leak)
- [ ] E2E suite ([TECH_DOC §7](TECH_DOC.md)) hijau
- [ ] Coverage total ≥ 80%
- [ ] Lighthouse mobile ≥ 90 (Performance & Accessibility) + uji manual Safari iOS & Chrome Android

## Backlog (setelah MVP)

- [ ] Team Americano, Team Mexicano, Mix Americano
- [ ] PWA
- [ ] Klaim turnamen guest ke akun
- [ ] Scoreboard mode TV
- [ ] Konfigurasi production (Docker prod, reverse proxy, HTTPS, backup DB)
- [ ] Statistik pemain lintas turnamen

## Keputusan terbuka

Tidak ada — semua keputusan tercatat di [PRD §7](PRD.md#7-keputusan).

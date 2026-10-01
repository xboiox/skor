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

- [ ] Rally: `applyPoint`, `isComplete`, `validateFinal`
- [ ] Tennis: poin dalam game (golden point & advantage), `formatGamePoint`
- [ ] Tennis: `first_to` & `total_of`
- [ ] Undo (via snapshot `prev_state`)
- [ ] Coverage domain/scoring ≥ 95%

## Fase 3 — Scheduling engine (TDD)

- [ ] PRNG ber-seed + util shuffle (immutable)
- [ ] Kapasitas & pemilihan bye yang adil
- [ ] Americano: generator ronde + kriteria selesai (semua partner tercakup)
- [ ] Americano: repeat home/away
- [ ] Mexicano: ronde 1 acak + ronde berikutnya berdasarkan klasemen
- [ ] Replace player: `planSubstitution` (temporary: new/bye player; permanent: new player)
- [ ] Coverage domain/scheduling ≥ 95%

## Fase 4 — Leaderboard engine (TDD)

- [ ] Agregasi stat per pemain (played, points won, points lost, diff)
- [ ] Sorting tie-breaker berlapis + head-to-head + rank bersama
- [ ] Mode final vs provisional
- [ ] Avg points won per match saat jumlah played berbeda + label withdrawn

## Fase 5 — Auth & akses

- [ ] Auth.js: Credentials (argon2id) + Google provider
- [ ] Halaman `/login`, `/register`
- [ ] Token admin/player: generate, hash, tukar ke cookie httpOnly, redirect URL bersih
- [ ] Guard `requireHost`, `requirePlayer`, `requireViewer`
- [ ] Rate limit login/register

## Fase 6 — Tournament management

- [ ] API `POST /api/tournaments` (guest & user) + validasi Zod
- [ ] Halaman `/tournaments/new` (form dinamis) & `/tournaments/new/created` (link + copy)
- [ ] Kelola pemain saat `draft`
- [ ] `start` → generate jadwal & simpan
- [ ] `/dashboard` untuk user login

## Fase 7 — Scoring flow & approval

- [ ] API aksi skor (point/undo) dengan optimistic lock + audit `score_events`
- [ ] API final result
- [ ] API approve / reject / host edit
- [ ] Komponen layout turnamen: header + bottom tab bar + bottom sheet
- [ ] Halaman `/t/[slug]/play` (bottom sheet "I am …") & `/t/[slug]/match/[matchId]`
- [ ] Layar scoring: tap panel +1, optimistic update, Wake Lock, haptic, landscape
- [ ] Share link: Web Share API + QR code
- [ ] Halaman `/t/[slug]/admin`: antrian approval, Next round, Repeat, End
- [ ] API substitutions (preview + simpan) + wizard `/t/[slug]/admin/replace`

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

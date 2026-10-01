# Architecture — Skor

> versi 0.1 · 2026-09-30 · lihat juga [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) untuk detail data model & algoritma

## 1. Gambaran besar

```
 ┌──────────────┐   HTTP (actions)   ┌──────────────────────────────┐
 │  Browser     │ ─────────────────▶ │  Next.js app (container)     │
 │  host/player │                    │  ├─ UI (App Router, RSC)     │
 │  /viewer     │ ◀───────────────── │  ├─ Route handlers (API)     │
 └──────────────┘   SSE (events)     │  ├─ Domain engines (pure TS) │
                                     │  └─ Realtime hub (LISTEN)    │
                                     └──────────┬───────────────────┘
                                                │ SQL + NOTIFY
                                     ┌──────────▼───────────────────┐
                                     │  PostgreSQL (container)      │
                                     └──────────▲───────────────────┘
                                                │ DELETE expired guests (hourly)
                                     ┌──────────┴───────────────────┐
                                     │  cleanup (container)         │
                                     └──────────────────────────────┘
```

## 2. Tech stack

| Layer         | Pilihan                                             | Alasan                                                     |
| ------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Framework     | **Next.js (App Router) + TypeScript**               | UI + API dalam satu codebase                               |
| Styling       | **Tailwind CSS**                                    | Cepat untuk UI mobile-first                                |
| Database      | **PostgreSQL**                                      | Relasional, mendukung LISTEN/NOTIFY untuk realtime         |
| ORM & migrasi | **Drizzle ORM + drizzle-kit**                       | Ringan, type-safe, SQL-like                                |
| Auth          | **Better Auth**: email/password + Google            | Stabil, session di DB, rate limit & adapter Drizzle bawaan |
| Validasi      | **Zod**                                             | Validasi input di semua boundary                           |
| Realtime      | **Server-Sent Events + Postgres LISTEN/NOTIFY**     | Satu arah (server → client), tanpa Redis tambahan          |
| Test          | **Vitest** (unit/integration), **Playwright** (E2E) |                                                            |
| Container     | **Docker Compose**                                  | Semua service lokal                                        |

> Versi terpasang (Fase 1): Next.js 16.3, React 19.2, Tailwind 4, Drizzle ORM 0.45, postgres.js 3.4, Zod 4, Vitest 5, Playwright 1.63, PostgreSQL 18, Node.js 24.
> Auth: Better Auth 1.7 (dipilih di Fase 5 karena Auth.js v5 masih beta).

## 3. Prinsip arsitektur

1. **Domain engine murni.** Logika scoring, scheduling, dan leaderboard adalah fungsi TypeScript tanpa I/O (`src/domain/*`). Mudah di-unit-test, tidak bergantung pada DB/HTTP.
2. **Server adalah sumber kebenaran.** Client mengirim _aksi_ (mis. `POINT_A`), bukan nilai skor absolut. Server menerapkan aksi lewat domain engine lalu menyimpan hasilnya.
3. **Optimistic concurrency.** Setiap match punya `version`. Aksi membawa versi yang diharapkan; jika tidak cocok → `409 Conflict` + state terbaru.
4. **Event setelah commit.** Setiap perubahan state memicu `NOTIFY` di dalam transaksi yang sama; Postgres baru mengirimkannya setelah commit, sehingga client tidak pernah menerima event untuk data yang gagal disimpan.
5. **Immutable data flow.** Engine menerima state dan mengembalikan state baru; tidak ada mutasi objek input.

## 4. Struktur folder (rencana)

```
skor/
├─ docker-compose.yml
├─ Dockerfile.dev
├─ .env.example
├─ drizzle.config.ts
├─ docs/
├─ src/
│  ├─ app/                      # Next.js routes (UI + API)
│  │  ├─ (auth)/login, register
│  │  ├─ dashboard/
│  │  ├─ tournaments/new/
│  │  ├─ t/[slug]/              # public view
│  │  │  ├─ play/               # player view (butuh player token)
│  │  │  ├─ admin/              # host view (butuh admin token / owner session)
│  │  │  └─ match/[matchId]/    # layar input skor
│  │  └─ api/
│  ├─ domain/                   # PURE — tanpa I/O
│  │  ├─ scoring/               # rally & tennis engine
│  │  ├─ scheduling/            # americano & mexicano scheduler
│  │  └─ leaderboard/           # agregasi & tie-breaker
│  ├─ server/
│  │  ├─ db/                    # schema Drizzle, client, migrations
│  │  ├─ services/              # use case: createTournament, applyScoreAction, ...
│  │  ├─ auth/                  # Better Auth config + session helper
│  │  ├─ access/                # token admin/player, penukaran link, guard
│  │  └─ realtime/              # LISTEN hub + SSE helper
│  ├─ components/               # UI components
│  └─ lib/                      # validation (zod), utils, api envelope
├─ tests/
│  ├─ integration/              # service + DB
│  └─ e2e/                      # Playwright
└─ scripts/
   └─ cleanup.sql
```

## 5. Docker Compose (dev)

| Service   | Image                       | Tugas                                                                     |
| --------- | --------------------------- | ------------------------------------------------------------------------- |
| `db`      | `postgres`                  | Database, volume persisten `pgdata`                                       |
| `app`     | build dari `Dockerfile.dev` | `next dev`, source di-mount untuk hot reload, jalankan migrasi saat start |
| `cleanup` | `postgres` (pakai `psql`)   | Loop tiap jam: hapus turnamen guest yang `expires_at < now()`             |

Port: app `3000`, db `5432`.

## 6. Keamanan

| Aspek              | Penanganan                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password           | Hash **scrypt** (bawaan Better Auth, rekomendasi OWASP), 8–128 karakter                                                                                    |
| Token admin/player | 32 byte random (base64url). Disimpan **hash SHA-256** di DB, bukan plaintext                                                                               |
| Token di URL       | Saat link pertama dibuka, token ditukar ke **cookie httpOnly** (per turnamen) lalu redirect ke URL bersih, supaya token tidak bocor lewat history/referrer |
| Otorisasi          | Setiap route handler memanggil guard: `requireHost`, `requirePlayer`, `requireViewer`                                                                      |
| Input              | Semua body/params divalidasi Zod; error dikembalikan dalam envelope standar                                                                                |
| Rate limit         | In-memory per IP untuk login/register & aksi skor (MVP, single instance)                                                                                   |
| Secret             | Semua via env (`AUTH_SECRET`, Google OAuth), tidak pernah di-commit                                                                                        |
| Audit              | Tabel `score_events` mencatat setiap aksi skor beserta aktornya                                                                                            |

## 7. Keputusan arsitektur (ADR singkat)

| #     | Keputusan                               | Alternatif yang ditolak                                        | Alasan                                                            |
| ----- | --------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| ADR-1 | SSE + LISTEN/NOTIFY                     | WebSocket/Socket.IO, Redis pub/sub                             | Alur data satu arah; tidak perlu service tambahan                 |
| ADR-2 | Postgres lokal via Docker               | Supabase                                                       | Permintaan user: DB lokal & docker compose                        |
| ADR-3 | Client kirim aksi, bukan skor absolut   | Client kirim skor                                              | Mencegah double-count saat dua orang menekan bersamaan            |
| ADR-4 | Better Auth, session di database        | Auth.js v5 (beta, JWT wajib untuk credentials), bangun sendiri | Stabil, session bisa dicabut, rate limit & adapter Drizzle bawaan |
| ADR-5 | Cleanup guest via container `psql` loop | pg_cron, cron di app                                           | Paling sederhana, terisolasi dari app                             |

# Technical Documentation — Skor

> versi 0.1 · 2026-09-30 · panduan developer: setup, konvensi, API, UI routes, testing

## 1. Setup lokal

Prasyarat: Docker Desktop. Node.js 24+ hanya diperlukan untuk opsi B.

**Opsi A — semua di Docker**

```bash
cp .env.example .env        # isi nilai secret
docker compose up --build   # migrasi otomatis, app di http://localhost:3000
```

**Opsi B — DB di Docker, app di host** (hot reload lebih cepat di macOS, sesuai saran dokumentasi Next.js)

```bash
cp .env.example .env
docker compose up -d db cleanup
npm install
npm run db:migrate
npm run dev
```

Perintah berguna:

| Perintah                                              | Fungsi                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `npm run db:generate -- --name <nama>`                | Buat file migrasi dari perubahan `schema.ts`                  |
| `npm run db:migrate`                                  | Jalankan migrasi                                              |
| `npm run typecheck`                                   | `next typegen` + `tsc`                                        |
| `npm run lint` / `npm run format`                     | ESLint / Prettier                                             |
| `npm run test:unit`                                   | Unit test (tanpa DB)                                          |
| `npm run test:integration`                            | Integration test — DB `skor_test` dibuat & dimigrasi otomatis |
| `npm run test:coverage`                               | Semua test + laporan coverage                                 |
| `npm run test:e2e`                                    | Playwright (menjalankan `npm run dev` bila server belum ada)  |
| `E2E_BASE_URL=http://localhost:3000 npm run test:e2e` | Playwright terhadap server yang sudah jalan (mis. container)  |
| `docker compose exec app npm test`                    | Test dari dalam container                                     |
| `docker compose exec db psql -U skor skor`            | Masuk ke database                                             |

Browser Playwright perlu dipasang sekali: `npx playwright install chromium webkit`.

## 2. Environment variables

| Nama                                                  | Contoh                                          | Keterangan                                                     |
| ----------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`                                        | `postgres://skor:skor@localhost:5432/skor`      | Koneksi Postgres (di container `app` di-override ke host `db`) |
| `TEST_DATABASE_URL`                                   | `postgres://skor:skor@localhost:5432/skor_test` | DB untuk integration test                                      |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `skor`                                          | Kredensial container Postgres                                  |
| `APP_URL`                                             | `http://localhost:3000`                         | Base URL app (untuk link turnamen)                             |
| `GUEST_TTL_DAYS`                                      | `7`                                             | Masa berlaku turnamen guest (1–90)                             |
| `AUTH_SECRET`                                         | hasil `openssl rand -base64 32`                 | Secret Better Auth (wajib, min. 32 karakter)                   |
| `AUTH_GOOGLE_ID`                                      | …                                               | OAuth Client ID                                                |
| `AUTH_GOOGLE_SECRET`                                  | …                                               | OAuth Client Secret                                            |

App memvalidasi env saat start (Zod) dan gagal cepat bila ada yang kurang.

### Google OAuth

1. Google Cloud Console → APIs & Services → Credentials → _Create OAuth client ID_ (Web application).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
3. Salin Client ID & Secret ke `.env`.

## 3. Konvensi kode

- TypeScript `strict`. Tidak ada `any` tanpa alasan tertulis.
- **Immutability**: fungsi mengembalikan objek baru, tidak memutasi input.
- `src/domain/**` **dilarang** meng-import DB, HTTP, atau Next.js.
- File 200–400 baris (maks 800); fungsi < 50 baris; nesting maks 4 level.
- Penamaan: `camelCase` variabel/fungsi, `PascalCase` type/komponen, `UPPER_SNAKE_CASE` konstanta, boolean diawali `is/has/should/can`.
- Tidak ada `console.log` di kode yang di-commit; gunakan logger server.
- Commit: `feat: …`, `fix: …`, `refactor: …`, `test: …`, `docs: …`, `chore: …`.

## 4. Format response API

Semua route handler mengembalikan envelope yang sama:

```ts
type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string; details?: unknown } };
```

| HTTP | `error.code`       | Kapan                                             |
| ---- | ------------------ | ------------------------------------------------- |
| 400  | `VALIDATION_ERROR` | Input tidak valid (detail dari Zod)               |
| 401  | `UNAUTHENTICATED`  | Tidak ada session/token                           |
| 403  | `FORBIDDEN`        | Peran tidak cukup                                 |
| 404  | `NOT_FOUND`        | Resource tidak ada / sudah expired                |
| 409  | `VERSION_CONFLICT` | Versi match basi (`details` berisi state terbaru) |
| 409  | `INVALID_STATE`    | Aksi tidak sah untuk status sekarang              |
| 429  | `RATE_LIMITED`     | Terlalu banyak request                            |
| 500  | `INTERNAL_ERROR`   | Pesan generik; detail hanya di log server         |

## 5. API endpoints

### Auth

| Method | Path                      | Akses         | Keterangan                                                                                          |
| ------ | ------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| *      | `/api/auth/*`             | publik        | Better Auth: `sign-up/email`, `sign-in/email`, `sign-in/social` (Google), `sign-out`, `get-session` |
| GET    | `/t/:slug/enter/:role?k=` | pemegang link | Tukar token admin/player → cookie httpOnly → redirect `/t/:slug/admin` atau `/t/:slug/play`         |

### Tournament

| Method | Path                                                       | Akses         | Keterangan                                                                           |
| ------ | ---------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| POST   | `/api/tournaments`                                         | publik / user | Buat turnamen + pemain. Guest → response berisi `adminUrl`, `playerUrl`, `publicUrl` |
| —      | `/api/tournaments/mine`                                    | user          | Tidak dibuat: `/dashboard` membaca daftar turnamen langsung di server                |
| GET    | `/api/t/:slug`                                             | viewer        | State lengkap: info, pemain, ronde, match                                            |
| PATCH  | `/api/tournaments/:id`                                     | host          | Belum dibuat (backlog): ubah info saat `draft`                                       |
| POST   | `/api/tournaments/:id/players`                             | host          | Tambah pemain (hanya saat `draft`)                                                   |
| DELETE | `/api/tournaments/:id/players/:playerId`                   | host          | Hapus pemain (hanya saat `draft`)                                                    |
| POST   | `/api/tournaments/:id/start`                               | host          | Generate jadwal, status → `active`                                                   |
| POST   | `/api/tournaments/:id/rounds/next`                         | host          | Mexicano: buat ronde berikutnya                                                      |
| POST   | `/api/tournaments/:id/repeat`                              | host          | Americano: buat leg 2 (home/away)                                                    |
| POST   | `/api/tournaments/:id/end`                                 | host          | status → `finished`                                                                  |
| GET    | `/api/tournaments/:id/leaderboard?mode=final\|provisional` | viewer        |                                                                                      |
| GET    | `/api/tournaments/:id/stream`                              | viewer        | SSE                                                                                  |

### Replace player

| Method | Path                                         | Akses | Body                                                                                                                                                  |
| ------ | -------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/tournaments/:id/substitutions/preview` | host  | sama seperti di bawah → mengembalikan match yang terdampak tanpa menyimpan                                                                            |
| POST   | `/api/tournaments/:id/substitutions`         | host  | `{ type: 'temporary' \| 'permanent', fromRound, outPlayerId, in: { newPlayerName } \| { playerId } }` — `playerId` (bye player) hanya untuk temporary |
| GET    | `/api/tournaments/:id/substitutions`         | host  | Riwayat penggantian                                                                                                                                   |

### Match

| Method | Path                       | Akses        | Body                                                          |
| ------ | -------------------------- | ------------ | ------------------------------------------------------------- |
| POST   | `/api/matches/:id/actions` | player, host | `{ type: 'point_a' \| 'point_b' \| 'undo', expectedVersion }` |
| POST   | `/api/matches/:id/final`   | player, host | `{ scoreA, scoreB, expectedVersion }`                         |
| POST   | `/api/matches/:id/approve` | host         | `{ expectedVersion }`                                         |
| POST   | `/api/matches/:id/reject`  | host         | `{ expectedVersion }`                                         |
| PATCH  | `/api/matches/:id`         | host         | `{ scoreA, scoreB, expectedVersion }` (edit hasil)            |
| GET    | `/api/matches/:id/events`  | host         | Audit log                                                     |

### Player identity

| Method | Path                    | Akses        | Body                                  |
| ------ | ----------------------- | ------------ | ------------------------------------- |
| POST   | `/api/t/:slug/identity` | player token | `{ playerId }` → set cookie identitas |

Semua mutasi (POST/PATCH/DELETE) wajib **same-origin** (`Origin` = `APP_URL`, atau `Sec-Fetch-Site: same-origin`) dan, bila punya body, `Content-Type: application/json` — perlindungan CSRF untuk cookie session/admin. Respons create: `201 { id, slug, isGuest, links: { admin, player, public } }`.

### Contoh: create tournament

```json
POST /api/tournaments
{
  "name": "Friday Night Americano",
  "date": "2026-10-03",
  "matchType": "americano",
  "courts": 2,
  "scoring": { "type": "rally", "totalPoints": 24 },
  "players": ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi"]
}
```

Tennis:

```json
"scoring": { "type": "tennis", "mode": "first_to", "games": 4, "deuce": "golden_point" }
```

## 6. UI routes

| Route                             | Akses        | Isi                                                                                                                                    |
| --------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                               | publik       | Landing + CTA "Create tournament"                                                                                                      |
| `/login?next=`, `/register?next=` | publik       | Email/password + "Continue with Google"                                                                                                |
| `/dashboard`                      | user         | Daftar turnamen milik user                                                                                                             |
| `/tournaments/new`                | publik       | Form create (field dinamis sesuai scoring type)                                                                                        |
| `/tournaments/new/created`        | pembuat      | Menampilkan admin/player/public link (guest: peringatan simpan admin link)                                                             |
| `/t/[slug]`                       | viewer       | Leaderboard, ronde & skor live                                                                                                         |
| `/t/[slug]/play`                  | player       | Dropdown "I am …", daftar match, tombol input skor                                                                                     |
| `/t/[slug]/match/[matchId]`       | player, host | Layar scoring: tombol besar +1 Team A / Team B, Undo, mode Final result                                                                |
| `/t/[slug]/admin`                 | host         | Antrian approval, kontrol Next round / Repeat / End, edit skor, tombol **Replace player**                                              |
| `/t/[slug]/admin/replace`         | host         | Wizard: pilih pemain → Temporary/Permanent → ronde → New player / Bye player (bye hanya muncul untuk Temporary) → preview → konfirmasi |

Prinsip UI: mobile-first — lihat [UI_GUIDELINES.md](UI_GUIDELINES.md) untuk spesifikasi, wireframe, dan budget performa.

## 7. Testing

| Level       | Tool                               | Cakupan                                               |
| ----------- | ---------------------------------- | ----------------------------------------------------- |
| Unit        | Vitest                             | `src/domain/**` — target coverage ≥ 95% (inti logika) |
| Integration | Vitest + Postgres (container test) | services, route handlers, guard akses, konflik versi  |
| E2E         | Playwright                         | Alur kritis (lihat bawah)                             |

Target coverage keseluruhan **≥ 80%**. Engine dikerjakan secara **TDD** (test dulu).

### Kasus uji wajib (engine)

**Scoring**

- Rally 24: 23 poin → belum selesai; poin ke-24 → selesai; poin ke-25 → error.
- Rally 24: final 12-12 valid (seri); 13-12 tidak valid.
- Tennis golden point: 40-40 → poin berikutnya menang game.
- Tennis advantage: 40-40 → AD → kembali deuce → AD → game.
- Tennis first_to 4: 4-3 selesai; final 4-4 dan 5-2 tidak valid.
- Tennis total_of 6: 3-3 selesai (seri).

**Scheduling**

- 8 pemain / 2 court: tiap ronde 8 pemain main, 0 bye, semua pasangan partner tercakup.
- 10 pemain / 2 court: 2 bye per ronde, selisih jumlah bye antar pemain ≤ 1.
- 5 pemain / 3 court: hanya 1 match per ronde.
- Tidak ada pemain muncul dua kali dalam satu ronde.
- Seed sama → jadwal identik.
- Mexicano: grup [1,2,3,4] → 1&3 vs 2&4; grup teratas di Court 1.
- Repeat: leg 2 = leg 1 dengan tim ditukar.

**Replace player**

- Temporary: hanya match ronde itu yang berubah; ronde lain tetap milik pemain asli.
- Permanent: semua match scheduled ≥ fromRound berubah; pemain → withdrawn.
- Match in_progress/submitted/approved tidak pernah diubah.
- Temporary + bye player: dihapus dari `round_byes` ronde itu; ditolak jika dia tidak bye di ronde tersebut.
- Permanent + pemain lama: ditolak (harus new player).
- Ditolak: pengganti = pemain asli, pengganti withdrawn, pemain muncul dua kali di satu ronde.
- Mexicano: pemain withdrawn tidak ikut Next round.

**Leaderboard**

- Skor 2-2 → masing-masing +2 won, +2 lost.
- Urutan: points won → diff → points lost (terkecil) → head-to-head → rank bersama.
- Head-to-head hanya dari match saat pemain berada di tim berlawanan.
- Mode final mengabaikan match non-approved.
- Played tidak sama → kriteria pertama memakai avgWon.
- Poin match yang dimainkan pengganti masuk ke pengganti, bukan pemain asli.

### E2E

1. Guest membuat turnamen Americano 8 pemain → menerima 3 link.
2. Dua browser player input skor di court berbeda → browser viewer melihat update realtime.
3. Konflik: dua player menekan +1 bersamaan di match yang sama → skor bertambah tepat sekali per aksi yang diterima.
4. Host approve → leaderboard final berubah.
5. Mexicano: Next round terkunci sampai semua match approved.
6. Login Google (di-mock) → turnamen muncul di dashboard.
7. Host melakukan permanent replace dengan pemain baru → pemain baru muncul di dropdown "I am …" dan jadwal sisa ronde terupdate realtime.

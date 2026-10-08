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

- [x] `notifyTournament` di dalam transaksi semua service yang mengubah data (event hanya setelah commit)
- [x] Hub LISTEN/NOTIFY (satu koneksi per proses, auto-reconnect postgres.js, aman dari hot reload)
- [x] Endpoint SSE `/api/t/:slug/stream` + heartbeat + `ready` setelah LISTEN aktif + lepas subscription saat putus
- [x] Hook `useTournamentStream` (status, resync saat reconnect / tab kembali), `LiveUpdates`, indikator ● Live
- [x] Layar scoring menerima update HP lain (`receiveRemote`), resync via `GET /api/matches/:id`, kunci saat offline
- [x] Integration test: event diterima subscriber, tidak bocor antar turnamen, tidak ada event saat rollback, SSE end-to-end
- [x] E2E: penonton melihat skor live, antrian approval terisi sendiri, dua HP sinkron, halaman waiting → mulai, offline

## Fase 9 — Leaderboard & halaman publik

- [x] `standingsOf` + `playerHistory` dari data board (tanpa query tambahan)
- [x] `/t/[slug]` publik: tab Leaderboard / Rounds (di URL), mode Live (provisional) / Final only, realtime
- [x] Tabel mobile: #, Player, P, Won/Avg, Diff; ≥ 640px + Lost/Avg; tap baris → detail & riwayat match
- [x] Penanda provisional (⏱ live + keterangan), rank bersama `3=`, label Sub/Withdrawn, "You", catatan mode rata-rata
- [x] Status draft ("Starting soon") & finished ("Final results"); kartu match tanpa link untuk penonton
- [x] Tab bar: Leaderboard untuk semua, Matches untuk pemegang player link, Admin untuk host
- [x] Realtime: resync juga saat koneksi pertama (menutup celah antara render server dan SSE)

## Fase 10 — Cleanup & hardening

- [x] Container `cleanup` (hapus guest expired tiap jam) + test — selesai di Fase 1
- [x] Rate limit API: skor, aksi host, buat turnamen, identitas (`429` + `Retry-After`)
- [x] IP klien hanya dari proxy tepercaya (`TRUST_PROXY`, `CLIENT_IP_HEADER`, `TRUSTED_PROXIES`), sama untuk Better Auth
- [x] Security header (`nosniff`, `X-Frame-Options`, CSP framing/form/object, Referrer/Permissions-Policy, HSTS prod, tanpa `X-Powered-By`)
- [x] Security review semua route (origin, guard, Zod) + `npm audit` → [SECURITY.md](SECURITY.md)
- [x] E2E suite hijau (iPhone 13, Pixel 7, desktop)
- [x] Coverage total ≥ 80%
- [x] Lighthouse mobile (build production): `/` 97/100/100, `/tournaments/new` 95/100/100, `/login` 99/100/100, `/t/:slug` 100/100/100 (Performance/Accessibility/Best practices)
- [ ] Uji manual di Safari iOS & Chrome Android (perangkat sungguhan — dilakukan oleh tim)

## Iterasi pasca-MVP

- [x] Perbaikan hydration tombol Share (Web Share API) + test hydration semua halaman utama
- [x] Deployment production: VPS (Docker Compose + Caddy) dan Vercel (cron, unpooled LISTEN) — [DEPLOYMENT.md](DEPLOYMENT.md)
- [x] Template env Vercel (`.env.vercel.example`) + langkah import
- [x] Ajakan membuat akun: bagian manfaat di landing, _Log in to keep it_ di Review, tip di layar created ([PRD §4.1](PRD.md#41-akun))
- [x] Draft form create bertahan saat login/reload (`sessionStorage`, divalidasi)
- [x] Copy landing: subjudul tanpa "No account needed", Auto schedule menyebut pengganti pemain, opsi guest di footer di atas _Create tournament_
- [x] Tombol ← Back di kanan atas login & register (riwayat dalam-app, fallback `?next=`/Home); form create hanya memakai Back di sebelah Next; langkah form di URL agar back HP mundur per langkah; _Next_ aman dari ketukan ganda
- [x] Home membaca session: user login melihat "My tournaments", tanpa ajakan daftar (logo tidak lagi terlihat "logout")
- [x] Test integration memakai jam relatif (tanggal tetap membuat turnamen guest "kedaluwarsa" seiring waktu)

## Backlog (setelah MVP)

- [ ] Team Americano, Team Mexicano, Mix Americano
- [ ] PWA
- [ ] Klaim turnamen guest ke akun
- [ ] Scoreboard mode TV
- [x] Konfigurasi production: `Dockerfile` + `docker-compose.prod.yml` + Caddy (HTTPS), dan Vercel (`vercel.json` cron, unpooled LISTEN) — [DEPLOYMENT.md](DEPLOYMENT.md)
- [ ] CSP dengan nonce untuk script
- [ ] Rate limit & batas koneksi SSE di store bersama (multi-instance)
- [ ] Statistik pemain lintas turnamen

## Keputusan terbuka

Tidak ada — semua keputusan tercatat di [PRD §7](PRD.md#7-keputusan).

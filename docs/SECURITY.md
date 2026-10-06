# Security — Skor

> versi 0.1 · 2026-10-06 · hasil security review Fase 10. Wajib dibaca sebelum deploy ke production.

## 1. Ringkasan kontrol

| Area              | Kontrol                                                                                                                                                                                                    | Lokasi                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Password          | scrypt (Better Auth), 8–128 karakter                                                                                                                                                                       | `src/server/auth/auth.ts`                   |
| Session           | Di database (bisa dicabut), 30 hari, cookie httpOnly dari Better Auth                                                                                                                                      | Better Auth                                 |
| Login/register    | Rate limit bawaan Better Auth: 3 request / 10 detik per IP; origin asing → 403                                                                                                                             | Better Auth                                 |
| Link admin/player | Token 32 byte acak; disimpan **SHA-256**; player link juga **AES-256-GCM** (kunci dari `AUTH_SECRET`) agar bisa ditampilkan ulang; admin link tidak bisa dipulihkan                                        | `src/server/access/`                        |
| Token di URL      | Ditukar ke cookie httpOnly + redirect ke URL bersih, `Referrer-Policy: no-referrer`                                                                                                                        | `/t/:slug/enter/:role`                      |
| Cookie akses      | httpOnly, SameSite=Lax, Secure bila `APP_URL` https, umur = umur turnamen guest (atau 180 hari)                                                                                                            | `accessCookieOptions`                       |
| Otorisasi         | `requireHost` / `requireScorer` / `requirePlayerLink` / `requireViewer` di setiap route; match/pemain selalu dicek milik turnamen yang sama                                                                | `src/server/access/guards.ts`               |
| CSRF              | Semua mutasi: `Origin` = `APP_URL` (atau `Sec-Fetch-Site: same-origin`) **dan** `Content-Type: application/json` bila ada body                                                                             | `src/server/http/same-origin.ts`            |
| Input             | Zod di semua body; ID di path divalidasi UUID (selain itu → 404); cookie identitas divalidasi UUID                                                                                                         | `src/lib/validation/`, `request-context.ts` |
| SQL               | Drizzle (parameterized) — tidak ada string SQL dari input                                                                                                                                                  | —                                           |
| Error             | 500 selalu pesan generik; detail hanya di log server (JSON)                                                                                                                                                | `src/lib/api-response.ts`                   |
| Rate limit API    | Lihat §3                                                                                                                                                                                                   | `src/server/http/rate-limits.ts`            |
| Header            | `nosniff`, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`, `Referrer-Policy`, `Permissions-Policy`, HSTS (production), tanpa `X-Powered-By` | `next.config.ts`                            |
| Form              | `method="post"` + tombol aktif setelah hydration → password tidak pernah masuk URL                                                                                                                         | form auth/admin                             |
| Open redirect     | `?next=` hanya path lokal                                                                                                                                                                                  | `src/lib/safe-redirect.ts`                  |
| Realtime          | Event hanya setelah commit; payload divalidasi Zod saat diterima                                                                                                                                           | `src/server/realtime/`                      |
| Data guest        | Dihapus otomatis setelah `GUEST_TTL_DAYS` (default 7) oleh container `cleanup`; yang expired sudah tidak bisa diakses sebelum dihapus                                                                      | `scripts/cleanup.sql`                       |

## 2. IP klien & reverse proxy (WAJIB untuk production)

Route handler Next.js **tidak bisa melihat IP socket**. IP klien hanya bisa dibaca dari header yang ditulis reverse proxy. Tanpa proxy, header itu dikirim oleh klien sendiri dan **bisa dipalsukan** — rate limit per IP (termasuk login) bisa diakali.

| Variabel           | Default           | Production                                                                                                                          |
| ------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `TRUST_PROXY`      | `false`           | `true`, **hanya** bila app tidak bisa diakses langsung, selalu lewat proxy                                                          |
| `CLIENT_IP_HEADER` | `x-forwarded-for` | Header yang ditulis proxy, mis. `x-forwarded-for` (nginx/Caddy) atau `cf-connecting-ip` (Cloudflare)                                |
| `TRUSTED_PROXIES`  | kosong            | IP / CIDR IPv4 proxy, dipakai saat membaca `X-Forwarded-For` dari kanan. Kosong = ambil entri paling kanan (yang ditambahkan proxy) |

Aturan yang sama dipakai API kita dan Better Auth. Pastikan proxy **menimpa/menambahkan** header dengan IP asli dan port app (3000) tidak terbuka ke internet.

> Development lokal memakai `TRUST_PROXY=true` agar E2E bisa mensimulasikan banyak klien lewat `X-Forwarded-For`. Jangan salin nilai ini ke production tanpa proxy.

## 3. Rate limit API

| Aksi            | Batas       | Kunci                                          |
| --------------- | ----------- | ---------------------------------------------- |
| Input skor      | 120 / menit | turnamen + pemain (atau host)                  |
| Aksi host       | 120 / menit | turnamen                                       |
| Buat turnamen   | 10 / jam    | IP (300 / jam bersama bila IP tidak diketahui) |
| Pilih identitas | 30 / menit  | turnamen + IP                                  |

Melebihi batas → `429 RATE_LIMITED` + header `Retry-After`. Penyimpanan **in-memory per proses**: cukup untuk satu instance (MVP). Untuk beberapa instance → pindahkan ke Postgres/Redis.

## 4. Keputusan sadar (risiko diterima)

| Topik                       | Keputusan                                                                      | Alasan / mitigasi                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identitas pemain ("I am …") | Tanpa login; siapa pun dengan player link bisa memilih nama siapa saja         | Skala komunitas; semua aksi tercatat di `score_events`; hasil akhir wajib di-approve host                                                                                                              |
| Halaman publik & stream     | Siapa pun dengan slug bisa melihat skor                                        | Memang fitur (public link). Slug 6 karakter dari 31 simbol ≈ 887 juta kombinasi; tidak terindeks (`robots: noindex`)                                                                                   |
| CSP script                  | Tanpa nonce untuk script                                                       | Next.js memakai inline script; CSP nonce butuh middleware per request. Kontrol lain (escape React, tanpa `dangerouslySetInnerHTML` dari input pengguna) mencegah XSS. Lanjutan: CSP nonce              |
| `dangerouslySetInnerHTML`   | Hanya untuk SVG QR code                                                        | SVG dihasilkan library `qrcode` dari URL kita sendiri                                                                                                                                                  |
| Koneksi SSE                 | Tidak dibatasi per IP                                                          | Satu koneksi LISTEN bersama; tiap SSE ringan. Lanjutan: batasi koneksi per IP di proxy                                                                                                                 |
| `npm audit` (9 temuan)      | Diterima                                                                       | Semua di tooling dev: `eslint-config-next` → `braces` (DoS glob saat lint) dan `drizzle-kit` → `esbuild` lama (dev server esbuild, tidak dipakai). "Fix" npm = downgrade major. Cek ulang tiap upgrade |
| Rotasi `AUTH_SECRET`        | Mencabut semua session & membuat player link lama tidak bisa ditampilkan ulang | Dokumentasikan sebelum rotasi; token player tetap valid untuk pemain yang sudah masuk (hash tidak berubah)                                                                                             |

## 5. Checklist sebelum production

- [ ] `AUTH_SECRET` baru (≥ 32 karakter, `openssl rand -base64 32`), tidak sama dengan dev
- [ ] `APP_URL` https → cookie `Secure` + HSTS aktif
- [ ] Reverse proxy di depan app; `TRUST_PROXY` / `CLIENT_IP_HEADER` / `TRUSTED_PROXIES` sesuai §2; port app tidak publik
- [ ] Proxy tidak mem-buffer `text/event-stream` (route sudah mengirim `X-Accel-Buffering: no`)
- [ ] Kredensial Postgres bukan `skor/skor`; DB tidak terbuka ke internet; backup terjadwal
- [ ] Google OAuth: redirect URI production terdaftar
- [ ] `npm audit --omit=dev` ditinjau
- [ ] Uji manual di Safari iOS & Chrome Android (lihat TECH_DOC §7)

# Deployment — Skor

> versi 0.1 · 2026-10-08 · panduan instalasi production dengan dua cara: **(A) VPS + Docker Compose** dan **(B) Vercel**.
> Untuk menjalankan di laptop (development), lihat [TECH_DOC.md §1](TECH_DOC.md#1-setup-lokal). Sebelum go-live, baca juga [SECURITY.md](SECURITY.md).

## Memilih cara

|                      | A. VPS + Docker Compose                               | B. Vercel                                                                                  |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Yang perlu disiapkan | 1 server Linux + domain                               | Akun Vercel + database Postgres terkelola (mis. Neon)                                      |
| HTTPS                | Otomatis (Caddy + Let's Encrypt)                      | Otomatis                                                                                   |
| Database             | Di server yang sama (container)                       | Layanan terpisah (pooled + direct URL)                                                     |
| Skor live (SSE)      | Koneksi terus terbuka                                 | Diputus Vercel tiap ≤ 300 detik (Hobby) / ≤ 800 detik (Pro), lalu otomatis tersambung lagi |
| Hapus data guest     | Container `cleanup`, tiap jam                         | Vercel Cron, sekali sehari                                                                 |
| Rate limit           | Satu proses → akurat                                  | Per instance fungsi → lebih longgar                                                        |
| Biaya                | Tetap (harga VPS)                                     | Sesuai pemakaian; setiap halaman live yang terbuka menjaga satu fungsi tetap berjalan      |
| Cocok untuk          | Klub/komunitas yang rutin main, biaya bisa diprediksi | Coba cepat, tanpa mengurus server                                                          |

Rekomendasi: **A** untuk pemakaian rutin (realtime paling mulus, biaya tetap). **B** bila tidak ingin mengelola server.

---

## A. VPS dengan Docker Compose

### A.1 Yang dibutuhkan

- VPS **Ubuntu 24.04** (atau Linux lain dengan Docker), minimal **2 GB RAM** (build Next.js butuh memori; dengan 1 GB, tambahkan swap — lihat [A.8](#a8-troubleshooting)).
- **Domain** (mis. `skor.example.com`) dengan record **A** (dan **AAAA** bila ada IPv6) mengarah ke IP VPS.
- Port **80** dan **443** terbuka. Port lain (3000, 5432) **tidak** perlu dan tidak boleh dibuka.

File yang dipakai (sudah ada di repo):

| File                      | Isi                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`              | Image production multi-stage: `migrator` (jalankan migrasi lalu berhenti) dan `runner` (server Next.js standalone, user non-root, healthcheck) |
| `docker-compose.prod.yml` | `db` (Postgres 18) → `migrate` → `app` → `caddy` (+ `cleanup`)                                                                                 |
| `Caddyfile`               | Reverse proxy + HTTPS otomatis; menulis IP asli klien ke `X-Forwarded-For`; stream skor live tidak dikompres                                   |
| `.env.production.example` | Contoh konfigurasi                                                                                                                             |

```
Internet ──443/80──▶ caddy ──▶ app:3000 ──▶ db:5432
                                    ▲
                     migrate (sekali saat start) · cleanup (tiap jam)
```

### A.2 Siapkan server

```bash
# Login ke VPS
ssh user@IP_VPS

# Docker Engine + Compose plugin (skrip resmi Docker)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER    # lalu logout & login lagi

# Firewall: hanya SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

> Docker mem-bypass `ufw` untuk port yang di-_publish_. Di stack ini hanya Caddy yang mem-publish port (80/443), jadi database dan app tetap tidak terjangkau dari internet.

### A.3 Ambil kode & isi konfigurasi

```bash
git clone <URL_REPO> skor
cd skor
cp .env.production.example .env.production
nano .env.production
```

Isi setiap nilai:

| Variabel                               | Contoh / cara membuat      | Keterangan                                                                                             |
| -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `SITE_ADDRESS`                         | `skor.example.com`         | Domain publik; Caddy membuat sertifikat HTTPS untuknya                                                 |
| `APP_URL`                              | `https://skor.example.com` | **Harus sama persis** dengan alamat yang dibuka pengguna (dipakai untuk link turnamen & proteksi CSRF) |
| `POSTGRES_PASSWORD`                    | `openssl rand -base64 24`  | Wajib diisi                                                                                            |
| `POSTGRES_USER`, `POSTGRES_DB`         | `skor`                     | Boleh dibiarkan                                                                                        |
| `AUTH_SECRET`                          | `openssl rand -base64 32`  | Wajib, min. 32 karakter. Jangan pakai nilai dari development                                           |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | dari Google Cloud Console  | Opsional. Redirect URI: `https://skor.example.com/api/auth/callback/google`                            |
| `GUEST_TTL_DAYS`                       | `7`                        | Umur turnamen guest                                                                                    |

`TRUST_PROXY` dan `DATABASE_URL` **tidak perlu diisi** — sudah diatur di `docker-compose.prod.yml` (app hanya bisa dijangkau lewat Caddy).

### A.4 Jalankan

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Urutan otomatis: `db` sehat → `migrate` menjalankan migrasi lalu berhenti → `app` start (menunggu migrasi sukses) → `caddy` start setelah `app` sehat dan meminta sertifikat HTTPS.

Build pertama memakan beberapa menit.

### A.5 Verifikasi

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
# Diharapkan: db (healthy), migrate (Exited 0), app (healthy), caddy, cleanup (Up)

curl https://skor.example.com/api/health
# {"success":true,"data":{"status":"ok","database":"up"},"error":null}
```

Lalu di browser HP:

1. Buka `https://skor.example.com` → **Create tournament** → selesaikan form.
2. Klik **Open tournament** → **Start tournament**.
3. Buka _Player link_ di HP lain → pilih nama → isi beberapa poin.
4. Buka _Public link_ → indikator **● Live** dan skor berubah tanpa reload.

### A.6 Update ke versi baru

```bash
cd skor
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrasi baru dijalankan otomatis sebelum app versi baru menerima request. Data tetap aman di volume `pgdata`.

### A.7 Backup & restore

```bash
# Backup (simpan di luar server juga!)
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  pg_dump -U skor -d skor | gzip > backup-$(date +%F).sql.gz

# Restore ke database kosong
gunzip -c backup-2026-10-08.sql.gz | docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T db psql -U skor -d skor
```

Backup harian otomatis (crontab server, `crontab -e`):

```
0 2 * * * cd /home/user/skor && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db pg_dump -U skor -d skor | gzip > /home/user/backups/skor-$(date +\%F).sql.gz
```

### A.8 Troubleshooting

| Gejala                                                                | Penyebab & solusi                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Sertifikat HTTPS gagal (`docker compose … logs caddy`)                | DNS belum mengarah ke VPS, atau port 80/443 tertutup. Cek `dig skor.example.com`, firewall VPS & panel provider                            |
| Halaman terbuka tapi aksi gagal "Cross-site requests are not allowed" | `APP_URL` tidak sama dengan alamat di browser (mis. `http` vs `https`, `www` vs tanpa `www`). Perbaiki lalu `up -d`                        |
| `app` tidak pernah _healthy_                                          | `docker compose … logs app` — biasanya env tidak valid (pesan "Invalid environment variables")                                             |
| `migrate` _Exited (1)_                                                | `docker compose … logs migrate` — biasanya password DB salah setelah volume dibuat dengan password lain                                    |
| Build berhenti / "Killed"                                             | RAM kurang. Tambahkan swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Skor live tidak bergerak                                              | Pastikan memakai Caddy dari repo. Bila memakai proxy lain, lihat A.9                                                                       |

Perintah berguna:

```bash
alias skor='docker compose -f docker-compose.prod.yml --env-file .env.production'
skor logs -f app          # log aplikasi (JSON)
skor restart app
skor exec db psql -U skor -d skor
```

### A.9 Memakai nginx / Cloudflare sebagai pengganti Caddy

- **nginx**: matikan buffering untuk stream (`proxy_buffering off;` — route stream juga mengirim `X-Accel-Buffering: no`), set `proxy_set_header X-Forwarded-For $remote_addr;` (timpa, jangan tambahkan), `proxy_read_timeout 1h;`, dan HTTPS sendiri (mis. certbot).
- **Cloudflare di depan**: set `CLIENT_IP_HEADER=cf-connecting-ip` di service `app`, dan pastikan origin hanya menerima koneksi dari Cloudflare.

Detail aturan IP klien: [SECURITY.md §2](SECURITY.md#2-ip-klien--reverse-proxy-wajib-untuk-production).

---

## B. Vercel

### B.1 Yang dibutuhkan

- Akun **Vercel** dan repo di GitHub/GitLab/Bitbucket.
- Database **Postgres terkelola** dengan dua alamat koneksi:
  - **Pooled** → `DATABASE_URL` (query biasa, aman untuk banyak fungsi serverless).
  - **Direct / unpooled** → `DATABASE_URL_UNPOOLED` (dipakai untuk **skor live** — `LISTEN/NOTIFY` tidak jalan lewat pooler — dan untuk **migrasi**).

  Contoh: **Neon** lewat Vercel Marketplace.

Sudah disiapkan di repo: `vercel.json` (cron harian pembersih guest), route `/api/cron/cleanup` (dijaga `CRON_SECRET`), stream skor dengan `maxDuration = 300`.

### B.2 Buat database

1. Vercel Dashboard → **Storage** → **Create Database** → pilih **Neon** (Postgres) → pilih region terdekat dengan pengguna (mis. Singapore).
2. **Connect** database ke project Skor.
3. Buka **Settings → Environment Variables** dan pastikan ada:
   - `DATABASE_URL` — connection string **pooled** (host mengandung `-pooler`).
   - `DATABASE_URL_UNPOOLED` — connection string **direct** (tanpa `-pooler`).

   Bila integrasi memberi nama lain, salin nilainya ke dua nama di atas (keduanya juga ada di Neon Console → **Connect**).

### B.3 Import project

1. Vercel → **Add New → Project** → pilih repo Skor.
2. Framework: **Next.js** (terdeteksi otomatis). Build/Install command: biarkan default.
3. Jangan set `NEXT_OUTPUT` (khusus image Docker).

### B.4 Environment variables

Settings → Environment Variables (minimal untuk **Production**):

| Variabel                               | Nilai                                                          | Keterangan                                                                 |
| -------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`                         | pooled URL                                                     | dari B.2                                                                   |
| `DATABASE_URL_UNPOOLED`                | direct URL                                                     | dari B.2 — wajib untuk skor live                                           |
| `AUTH_SECRET`                          | `openssl rand -base64 32`                                      | min. 32 karakter                                                           |
| `APP_URL`                              | `https://skor.example.com` atau `https://<project>.vercel.app` | **Harus sama** dengan alamat yang dibuka pengguna                          |
| `TRUST_PROXY`                          | `true`                                                         | Vercel menimpa `X-Forwarded-For` dengan IP asli klien, jadi aman dipercaya |
| `CLIENT_IP_HEADER`                     | `x-forwarded-for`                                              |                                                                            |
| `CRON_SECRET`                          | `openssl rand -hex 24`                                         | min. 16 karakter; Vercel mengirimnya otomatis ke cron                      |
| `GUEST_TTL_DAYS`                       | `7`                                                            |                                                                            |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | opsional                                                       | Redirect URI: `https://<domain>/api/auth/callback/google`                  |

### B.5 Jalankan migrasi

Migrasi **tidak** jalan otomatis di Vercel. Jalankan dari laptop (butuh Node.js 24 dan repo ini) sebelum deploy pertama dan setiap ada migrasi baru:

```bash
npm ci
DATABASE_URL="<direct URL>" DATABASE_URL_UNPOOLED="<direct URL>" npm run db:migrate
```

> Bisa juga mengganti Build Command menjadi `npm run db:migrate && npm run build`, tetapi **hanya** bila environment Preview memakai database terpisah — kalau tidak, setiap preview deployment ikut memigrasi database production.

### B.6 Deploy & domain

1. **Deploy** (atau push ke branch utama).
2. Opsional: Settings → **Domains** → tambahkan `skor.example.com`, ikuti instruksi DNS.
3. Bila domain berubah, perbarui `APP_URL` lalu **Redeploy**.
4. Settings → **Cron Jobs**: `/api/cron/cleanup` terdaftar (jadwal `0 3 * * *`, UTC).

### B.7 Verifikasi

```bash
curl https://skor.example.com/api/health
curl -i https://skor.example.com/api/cron/cleanup      # tanpa secret → 401 (benar)
curl -H "Authorization: Bearer <CRON_SECRET>" https://skor.example.com/api/cron/cleanup
# {"success":true,"data":{"deleted":0},"error":null}
```

Lalu lakukan uji di HP yang sama seperti [A.5](#a5-verifikasi).

### B.8 Batasan di Vercel (perlu diketahui)

| Batasan                                         | Dampak                                                        | Catatan                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Durasi fungsi maks. 300 s (Hobby) / 800 s (Pro) | Stream skor live diputus berkala                              | Browser otomatis tersambung lagi dan resync; indikator sempat "Reconnecting…" beberapa detik |
| Cron Hobby hanya sekali sehari                  | Data guest dihapus harian, bukan per jam                      | Turnamen yang sudah lewat masa berlaku tetap tidak bisa diakses sebelum dihapus              |
| Rate limit in-memory per instance               | Batas per IP lebih longgar saat banyak instance               | Untuk ketat: pindahkan ke store bersama (backlog)                                            |
| Preview deployment                              | Alamat preview ≠ `APP_URL` → aksi (create, skor) ditolak CSRF | Uji di Production, atau set `APP_URL` Preview ke alias branch yang tetap                     |
| Biaya                                           | Tiap halaman live yang terbuka menahan satu fungsi berjalan   | Pantau Usage; untuk acara besar pertimbangkan cara A                                         |
| Paket Hobby                                     | Mengikuti ketentuan Vercel untuk penggunaan non-komersial     | Gunakan Pro untuk penggunaan komersial                                                       |

### B.9 Troubleshooting

| Gejala                                              | Penyebab & solusi                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Skor live tidak bergerak, log "LISTEN"/koneksi      | `DATABASE_URL_UNPOOLED` kosong atau berisi URL pooled. Isi dengan direct URL, redeploy   |
| Error tabel tidak ada (`relation … does not exist`) | Migrasi belum dijalankan — lihat B.5                                                     |
| "Cross-site requests are not allowed"               | `APP_URL` tidak sama dengan domain yang dibuka                                           |
| Cron `401` di log                                   | `CRON_SECRET` belum di-set atau beda dengan yang dipakai saat deploy — set lalu redeploy |
| "Invalid environment variables" di log fungsi       | Ada variabel wajib yang kosong/tidak valid (lihat tabel B.4)                             |

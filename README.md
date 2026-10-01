# Skor

Web app untuk turnamen padel sosial (Americano & Mexicano) dengan jadwal otomatis, input skor realtime, dan leaderboard live.

> Status: **Fase 1 selesai** (setup project, Docker, skema database). Lihat [docs/TASK_LIST.md](docs/TASK_LIST.md).

## Menjalankan

```bash
cp .env.example .env
docker compose up --build   # http://localhost:3000
```

Detail setup & perintah lain: [docs/TECH_DOC.md](docs/TECH_DOC.md#1-setup-lokal).

## Dokumentasi

| Dokumen                                        | Isi                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| [docs/PRD.md](docs/PRD.md)                     | Kebutuhan produk, scope MVP, aturan skor & leaderboard, asumsi terbuka        |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Tech stack, komponen, struktur folder, Docker, keamanan, ADR                  |
| [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | Data model, state machine, algoritma scoring/scheduling/leaderboard, realtime |
| [docs/TECH_DOC.md](docs/TECH_DOC.md)           | Setup lokal, env, konvensi, API, UI routes, strategi testing                  |
| [docs/UI_GUIDELINES.md](docs/UI_GUIDELINES.md) | Panduan UI mobile-first, wireframe layar utama, performa                      |
| [docs/TASK_LIST.md](docs/TASK_LIST.md)         | Rencana kerja per fase + backlog                                              |

## Stack

Next.js · TypeScript · Tailwind · PostgreSQL · Drizzle · Better Auth (email + Google) · SSE · Docker Compose

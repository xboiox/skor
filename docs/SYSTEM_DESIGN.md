# System Design — Skor

> versi 0.1 · 2026-09-30

## 1. Data model

```
users ─┬─< accounts            (Auth.js: provider Google)
       └─< tournaments ──┬─< players
          (owner_id null   ├─< rounds ──┬─< matches ──< score_events
           = guest)        │            └─< round_byes
                           ├─< substitutions
                           └─< access_tokens
```

### 1.1 Tabel

**users**

| Kolom          | Tipe             | Catatan                      |
| -------------- | ---------------- | ---------------------------- |
| id             | uuid PK          |                              |
| name           | text             |                              |
| email          | text unique      |                              |
| email_verified | timestamptz null |                              |
| password_hash  | text null        | null jika hanya login Google |
| image          | text null        |                              |
| created_at     | timestamptz      |                              |

**accounts** — tabel standar adapter Auth.js (provider, provider_account_id, token OAuth).

**tournaments**

| Kolom                  | Tipe                                  | Catatan                                            |
| ---------------------- | ------------------------------------- | -------------------------------------------------- |
| id                     | uuid PK                               |                                                    |
| slug                   | text unique                           | ID pendek untuk URL publik (mis. `k7p2xq`)         |
| owner_id               | uuid FK users null                    | null = guest                                       |
| name                   | text                                  |                                                    |
| date                   | date                                  |                                                    |
| match_type             | enum `americano \| mexicano`          | Team/Mix menyusul                                  |
| courts                 | int                                   | 1–20                                               |
| scoring_type           | enum `rally \| tennis`                |                                                    |
| rally_points           | int null                              | 16/21/24/32, wajib jika rally                      |
| tennis_mode            | enum `first_to \| total_of` null      | wajib jika tennis                                  |
| tennis_games           | int null                              | X, 1–12, wajib jika tennis                         |
| deuce_rule             | enum `golden_point \| advantage` null | wajib jika tennis                                  |
| status                 | enum `draft \| active \| finished`    |                                                    |
| current_leg            | int default 1                         | 2 setelah Repeat (home/away)                       |
| rng_seed               | int                                   | agar jadwal bisa direproduksi                      |
| expires_at             | timestamptz null                      | `created_at + 7 hari` untuk guest; null untuk user |
| created_at, updated_at | timestamptz                           |                                                    |

Constraint `CHECK` memastikan kombinasi kolom scoring konsisten dengan `scoring_type`.

**access_tokens**

| Kolom         | Tipe                   | Catatan            |
| ------------- | ---------------------- | ------------------ |
| id            | uuid PK                |                    |
| tournament_id | uuid FK cascade        |                    |
| role          | enum `admin \| player` |                    |
| token_hash    | text unique            | SHA-256 dari token |
| created_at    | timestamptz            |                    |

**players**

| Kolom                | Tipe                       | Catatan                                              |
| -------------------- | -------------------------- | ---------------------------------------------------- |
| id                   | uuid PK                    |                                                      |
| tournament_id        | uuid FK cascade            |                                                      |
| name                 | text                       | unique per turnamen (case-insensitive)               |
| position             | int                        | urutan input                                         |
| status               | enum `active \| withdrawn` | default `active`                                     |
| joined_round         | int null                   | null = sejak awal; diisi untuk pemain pengganti baru |
| withdrawn_from_round | int null                   | diisi saat permanent withdraw                        |

**rounds**

| Kolom         | Tipe                                  | Catatan              |
| ------------- | ------------------------------------- | -------------------- |
| id            | uuid PK                               |                      |
| tournament_id | uuid FK cascade                       |                      |
| number        | int                                   | unique per turnamen  |
| leg           | int                                   | 1 atau 2 (home/away) |
| status        | enum `pending \| active \| completed` |                      |

**round_byes** — (round_id, player_id) PK.

**matches**

| Kolom                                      | Tipe                                                     | Catatan                                         |
| ------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------- |
| id                                         | uuid PK                                                  |                                                 |
| tournament_id                              | uuid FK cascade                                          | untuk query & NOTIFY cepat                      |
| round_id                                   | uuid FK cascade                                          |                                                 |
| court                                      | int                                                      | 1..courts                                       |
| team_a_p1, team_a_p2, team_b_p1, team_b_p2 | uuid FK players                                          |                                                 |
| score_a, score_b                           | int default 0                                            | rally: poin; tennis: game                       |
| game_a, game_b                             | int default 0                                            | tennis live: poin di game berjalan (0,1,2,3,4…) |
| status                                     | enum `scheduled \| in_progress \| submitted \| approved` |                                                 |
| version                                    | int default 0                                            | optimistic lock                                 |
| approved_at                                | timestamptz null                                         |                                                 |
| updated_at                                 | timestamptz                                              |                                                 |

**substitutions** (riwayat penggantian pemain)

| Kolom              | Tipe                            | Catatan                                |
| ------------------ | ------------------------------- | -------------------------------------- |
| id                 | uuid PK                         |                                        |
| tournament_id      | uuid FK cascade                 |                                        |
| type               | enum `temporary \| permanent`   |                                        |
| from_round         | int                             | ronde mulai berlaku                    |
| out_player_id      | uuid FK players                 | pemain yang diganti                    |
| in_player_id       | uuid FK players                 | pengganti                              |
| source             | enum `new_player \| bye_player` |                                        |
| affected_match_ids | uuid[]                          | match yang slotnya diubah              |
| created_by_user_id | uuid null                       | host login (null jika via admin token) |
| created_at         | timestamptz                     |                                        |

**score_events** (audit log + undo)

| Kolom           | Tipe                                                                             | Catatan                                                            |
| --------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| id              | bigserial PK                                                                     |                                                                    |
| match_id        | uuid FK cascade                                                                  |                                                                    |
| action          | enum `point_a \| point_b \| undo \| set_final \| approve \| reject \| host_edit` |                                                                    |
| actor_role      | enum `host \| player`                                                            |                                                                    |
| actor_player_id | uuid null                                                                        | pemain yang dipilih di "I am …"                                    |
| actor_user_id   | uuid null                                                                        | host yang login                                                    |
| prev_state      | jsonb                                                                            | snapshot `{score_a, score_b, game_a, game_b, status}` sebelum aksi |
| created_at      | timestamptz                                                                      |                                                                    |

Undo = kembalikan `prev_state` dari event `point_*` terakhir yang belum di-undo.

### 1.2 Index penting

- `matches (tournament_id, round_id)`
- `players (tournament_id)`
- `tournaments (owner_id)`, `tournaments (expires_at) WHERE expires_at IS NOT NULL`
- `score_events (match_id, id DESC)`

## 2. State machine

### 2.1 Tournament

```
draft ──start──▶ active ──end──▶ finished
```

- `draft`: pemain masih bisa ditambah/dihapus.
- `start`: validasi ≥ 4 pemain, generate jadwal (Americano: semua ronde; Mexicano: ronde 1).

### 2.2 Round

```
pending ──▶ active ──(semua match approved)──▶ completed
```

Americano: ronde bisa dimainkan paralel/berurutan; status diturunkan dari status match-nya.

### 2.3 Match

| Dari        | Aksi                             | Ke                      | Siapa        |
| ----------- | -------------------------------- | ----------------------- | ------------ |
| scheduled   | point / set_final                | in_progress / submitted | player, host |
| in_progress | point (kondisi selesai tercapai) | submitted               | player, host |
| in_progress | set_final (valid)                | submitted               | player, host |
| submitted   | undo                             | in_progress             | player, host |
| submitted   | approve                          | approved                | host         |
| submitted   | reject                           | in_progress             | host         |
| approved    | host_edit                        | approved                | host         |

Match `approved` terkunci untuk player.

## 3. Scoring engine (`src/domain/scoring`)

Fungsi murni, tidak melempar error — kegagalan dikembalikan sebagai `Result` (`src/domain/result.ts`).

```ts
type ScoringConfig =
  | { type: "rally"; totalPoints: 16 | 21 | 24 | 32 }
  | { type: "tennis"; mode: "first_to" | "total_of"; games: number; deuce: "golden_point" | "advantage" };

type MatchScore = { scoreA: number; scoreB: number; gameA: number; gameB: number };
type ScoringError = { code: "MATCH_COMPLETE" | "INVALID_FINAL_SCORE"; message: string };

applyPoint(config, score, team: "A" | "B"): Result<MatchScore, ScoringError>
isComplete(config, score): boolean
statusForScore(config, score): "in_progress" | "submitted"       // A6: auto-submit saat selesai
validateFinal(config, scoreA, scoreB): Result<MatchScore, ScoringError>
formatGamePoint(deuce, { a, b }): { a: string; b: string; phase: "normal" | "deuce" | "advantage" | "golden_point" }
findUndoTarget(events): event | null                           // event yang prev_state-nya dipulihkan
```

Pemetaan error ke API: `MATCH_COMPLETE` → `409 INVALID_STATE`, `INVALID_FINAL_SCORE` → `400 VALIDATION_ERROR`.

### 3.1 Rally

- `applyPoint`: tambah 1 ke tim; `isComplete` saat `scoreA + scoreB === totalPoints`.
- `validateFinal`: `scoreA + scoreB === totalPoints`, keduanya ≥ 0.

### 3.2 Tennis — poin dalam game

`gameA/gameB` menyimpan jumlah poin mentah di game berjalan.

- Tim menang game jika poinnya ≥ 4 **dan**:
  - _golden_point_: poin tim > poin lawan (saat 3-3, poin berikutnya menang).
  - _advantage_: selisih ≥ 2.
- Saat game dimenangkan: `score` tim +1, `gameA = gameB = 0`.
- Deuce dinormalisasi: saat advantage hilang, poin kembali ke 3-3 (nilai tetap kecil, maks 4).
- Tampilan: 0→"0", 1→"15", 2→"30", 3→"40"; 3-3 → "40"/"40" dengan `phase` `deuce` atau `golden_point`; 4-3 → "AD"/"40" (`advantage`).

### 3.3 Tennis — selesai match

- `first_to`: `max(scoreA, scoreB) === games`.
- `total_of`: `scoreA + scoreB === games`.
- `validateFinal`:
  - `first_to`: tepat satu tim = X, tim lain < X.
  - `total_of`: jumlah = X.
  - Semua skor harus bilangan bulat ≥ 0.

### 3.4 Undo

`findUndoTarget` menelusuri `score_events` dari yang terbaru:

- `undo` → lewati satu event yang bisa di-undo berikutnya (mendukung undo berturut-turut).
- Bisa di-undo: `point_a`, `point_b`, `set_final`. `reject` dilewati.
- Batas: `approve` dan `host_edit` — undo tidak pernah menembus hasil yang sudah dikunci host.

## 4. Scheduling engine (`src/domain/scheduling`)

Semua fungsi deterministik dengan input `seed` (PRNG seperti mulberry32).

### 4.1 Kapasitas & bye

```
matches  = min(courts, floor(n / 4))
playing  = matches * 4
byes     = n - playing
```

Pemilihan bye (`selectByes`):

1. **Keadilan (wajib):** pemain dengan **jumlah match dimainkan terbanyak** istirahat lebih dulu. Untuk pemain lama ini setara dengan "bye paling sedikit"; pemain pengganti baru (yang masih sedikit main) otomatis main dulu.
2. **Di antara kandidat yang sama-sama layak** (jumlah main sama), dipilih kombinasi dengan **skor preferensi** tertinggi. Semua kombinasi dicoba bila ≤ 256, selebihnya 256 sampel acak.
   - Default (Mexicano): hindari bye berturut-turut.
   - Americano: maksimalkan pasangan yang belum pernah berpartner di antara pemain yang main; bye berturut-turut hanya penalti kecil. (Aturan "hindari bye berturut-turut" yang kaku membuat dua grup bergantian terus dan tidak pernah berpasangan — mis. 8 pemain / 1 lapangan.)

### 4.2 Americano (`generateAmericanoSchedule`)

Tujuan: setiap pasangan pemain pernah menjadi **partner** minimal sekali.

Per ronde:

1. Pilih bye (4.1, dengan skor cakupan).
2. Bentuk tim: **minimum-cost perfect matching** (branch & bound, ada batas langkah) dengan biaya = berapa kali dua pemain sudah berpartner. Berhenti segera bila ketemu matching tanpa partner berulang.
3. Pasangkan tim menjadi match dengan matching yang sama; biaya = jumlah pertemuan sebagai lawan (lawan tersebar).

Jadwal lengkap dibangun berulang dengan seed turunan (`deriveSeed`); dipilih yang: semua pasangan tercakup → ronde paling sedikit → lawan paling tersebar (Σ count²). Jumlah percobaan 2–24, dibatasi total 400 ronde dibangun agar tetap cepat. Berhenti lebih awal bila mencapai batas bawah `ceil(n(n-1) / playing)`.

Hasil terukur (seed 1, ≤ 24 pemain): mayoritas kombinasi tepat di batas bawah (mis. 8/2 → 7 ronde, 12/3 → 11, 16/4 → 15, 8/1 → 14); kasus bye sangat banyak (20–24 pemain di 1–2 lapangan) lebih 1–14 ronde. Semua < 0,5 detik; 40 pemain / 10 lapangan juga < 2 detik.

**Repeat (home/away)** (`repeatAsSecondLeg`): salin ronde leg 1 dengan tim A/B ditukar, nomor ronde dilanjutkan, `leg = 2`. Ditolak bila sudah pernah di-repeat.

### 4.3 Mexicano (`generateMexicanoFirstRound`, `generateMexicanoRound`)

- **Ronde 1**: urutan acak (seed), dikelompokkan per 4.
- **Ronde berikutnya** (dipicu host, hanya jika semua match ronde berjalan _approved_):
  1. Service menghitung leaderboard dan mengirim `ranking` = pemain **aktif** terurut peringkat.
  2. Pilih bye (4.1, skor default).
  3. Sisa pemain tetap urut peringkat; grup per 4: `[r1, r2, r3, r4]` → **r1 & r3 vs r2 & r4**.
  4. Grup peringkat teratas di Court 1, dst.

### 4.4 Replace player (`src/domain/scheduling/substitute.ts`)

Fungsi murni:

```ts
planSubstitution({
  type: "temporary" | "permanent",
  fromRound,
  outPlayerId,
  substitute: { source: "new_player" | "bye_player", playerId },  // pemain baru dibuat service lebih dulu
  players,  // { id, status }
  matches,  // { id, roundNumber, status, teamA, teamB }
  byes,     // { roundNumber, playerIds }
}): Result<{ matchUpdates; byeUpdates; playerUpdates }, SchedulingError>
```

Aturan:

1. Hanya match **scheduled** yang boleh diubah; match `in_progress/submitted/approved` dilewati.
2. **Temporary**: hanya ronde `fromRound`. Slot `outPlayer` di match ronde itu → `inPlayer`.
3. **Permanent**: semua ronde ≥ `fromRound` yang sudah ada di jadwal. `outPlayer.status → withdrawn`.
4. Sumber pengganti:
   - **Temporary**: new player, atau bye player (harus berstatus bye di ronde `fromRound`; dihapus dari `round_byes` ronde itu).
   - **Permanent**: **new player saja** (ditolak jika `inPlayer` adalah pemain lama).
5. `inPlayer` tidak boleh = `outPlayer`, tidak boleh _withdrawn_, dan tidak boleh muncul dua kali dalam satu ronde.
6. Mexicano: ronde berikutnya di-generate dari pemain `active` saja (pemain baru ikut, pemain withdrawn tidak).
7. **Temporary**: pemain yang diganti harus terjadwal main (bukan bye) di ronde itu dan match-nya masih `scheduled`.
8. **Permanent**: bye milik pemain lama di ronde-ronde berikutnya juga diambil alih pengganti (bentuk jadwal tetap).
9. **Pemain baru sebagai pengganti temporary** ditandai `withdrawn` mulai ronde berikutnya (`withdrawn_from_round = fromRound + 1`) agar tidak ikut di-schedule Mexicano. Di leaderboard ditampilkan sebagai pemain pengganti.

Service menyimpan hasilnya dalam satu transaksi (update slot match, byes, status pemain, baris `substitutions`) lalu `NOTIFY tournament.updated`.

## 5. Leaderboard engine (`src/domain/leaderboard`)

Input: daftar pemain + match (dengan skor & status). Output: baris terurut.

Per pemain, dari setiap match yang dia mainkan (skor timnya = `for`, skor lawan = `against`):

| Stat        | Definisi                               |
| ----------- | -------------------------------------- |
| played      | jumlah match                           |
| pointsWon   | Σ `for` (rally: poin; tennis: game)    |
| pointsLost  | Σ `against`                            |
| diff        | pointsWon − pointsLost                 |
| avgWon      | pointsWon ÷ played (0 jika played = 0) |
| isWithdrawn | dari status pemain (tetap ditampilkan) |

Tidak ada konsep menang/kalah/seri: skor 2-2 → +2 won, +2 lost.

Kriteria pertama:

- Semua pemain yang pernah main punya `played` sama → `pointsWon`.
- Ada perbedaan `played` (bye, pengganti) → `avgWon`.

Urutan: `pointsWon ↓ / avgWon ↓` → `diff ↓` → `pointsLost ↑` → **head-to-head** → rank bersama.

Statistik dihitung dari **slot aktual** di match (setelah penggantian), sehingga poin otomatis masuk ke pemain pengganti.

**Head-to-head** (untuk grup yang sama persis di semua kriteria sebelumnya):

- Hanya match di mana pemain yang tied berada di **tim berlawanan**.
- Bandingkan jumlah match yang dimenangkan (skor tim lebih tinggi) di antara mereka, lalu diff di match tersebut.
- Jika masih sama / tidak pernah berhadapan → **rank bersama** (ditampilkan sama, mis. `3=`).

Mode:

- `final`: hanya match `approved`.
- `provisional`: termasuk `in_progress` dan `submitted`; baris ditandai `isProvisional` jika ada kontribusi dari match non-approved.

## 6. Realtime

### 6.1 Alur

1. Service menulis perubahan dalam transaksi, lalu `SELECT pg_notify('tournament_events', json)` di transaksi yang sama.
2. App menjaga **satu koneksi LISTEN** (`src/server/realtime/hub.ts`) dan meneruskan event ke subscriber SSE per `tournamentId`.
3. Client: `EventSource('/api/tournaments/:id/stream')`.

### 6.2 Payload event

```json
{ "tournamentId": "…", "type": "match.updated", "matchId": "…", "version": 12 }
```

Tipe: `match.updated`, `round.created`, `tournament.updated`, `leaderboard.updated`.
Payload sengaja kecil (batas NOTIFY 8KB). Client lalu mengambil state terbaru via GET (atau memakai data yang sudah ada jika versinya sama).

### 6.3 Ketahanan koneksi

- Heartbeat komentar SSE tiap 25 detik.
- Saat reconnect, client melakukan full refetch state turnamen.
- Hub melakukan reconnect LISTEN otomatis jika koneksi DB terputus.

### 6.4 Konflik

Aksi skor: `POST /api/matches/:id/actions { type, expectedVersion }`

```sql
UPDATE matches SET …, version = version + 1
WHERE id = $1 AND version = $expectedVersion
```

0 baris ter-update → `409` + state terbaru → client menampilkan state baru (tanpa double count).

## 7. Akses & token

| Peran  | Cara mendapat akses                                                       |
| ------ | ------------------------------------------------------------------------- |
| Host   | Session user = `owner_id`, **atau** cookie admin token valid              |
| Player | Cookie player token valid + `playerId` pilihan "I am …" (cookie terpisah) |
| Viewer | Siapa pun dengan `slug`                                                   |

Alur link:

```
/t/{slug}/admin?k={adminToken}
  → server verifikasi hash → set cookie httpOnly `skor_admin_{slug}` → redirect /t/{slug}/admin
```

Token admin hanya ditampilkan **sekali** saat turnamen guest dibuat (dengan tombol copy & peringatan untuk menyimpannya).

## 8. Cleanup guest

Container `cleanup` menjalankan tiap jam:

```sql
DELETE FROM tournaments WHERE expires_at IS NOT NULL AND expires_at < now();
```

Semua data turunan terhapus lewat `ON DELETE CASCADE`.

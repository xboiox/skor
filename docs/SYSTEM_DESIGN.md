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

Signature:

```ts
type ScoringConfig =
  | { type: 'rally'; totalPoints: 16 | 21 | 24 | 32 }
  | { type: 'tennis'; mode: 'first_to' | 'total_of'; games: number; deuce: 'golden_point' | 'advantage' };

type MatchScore = { scoreA: number; scoreB: number; gameA: number; gameB: number };

applyPoint(config, score, team: 'A' | 'B'): MatchScore      // melempar error jika match sudah selesai
isComplete(config, score): boolean
validateFinal(config, scoreA, scoreB): Result<void, string>
formatGamePoint(config, score): { a: string; b: string }    // "0" "15" "30" "40" "AD"
```

### 3.1 Rally

- `applyPoint`: tambah 1 ke tim; `isComplete` saat `scoreA + scoreB === totalPoints`.
- `validateFinal`: `scoreA + scoreB === totalPoints`, keduanya ≥ 0.

### 3.2 Tennis — poin dalam game

`gameA/gameB` menyimpan jumlah poin mentah di game berjalan.

- Tim menang game jika poinnya ≥ 4 **dan**:
  - _golden_point_: poin tim > poin lawan (saat 3-3, poin berikutnya menang).
  - _advantage_: selisih ≥ 2.
- Saat game dimenangkan: `score` tim +1, `gameA = gameB = 0`.
- Tampilan: 0→"0", 1→"15", 2→"30", 3→"40"; advantage saat keduanya ≥ 3 → "40"/"40" atau "AD"/"40".

### 3.3 Tennis — selesai match

- `first_to`: `max(scoreA, scoreB) === games`.
- `total_of`: `scoreA + scoreB === games`.
- `validateFinal`:
  - `first_to`: tepat satu tim = X, tim lain < X.
  - `total_of`: jumlah = X.

## 4. Scheduling engine (`src/domain/scheduling`)

Semua fungsi deterministik dengan input `seed` (PRNG seperti mulberry32).

### 4.1 Kapasitas & bye

```
slots      = min(courts * 4, floor(n / 4) * 4)
matches    = slots / 4
byeCount   = n - slots
```

Pemilihan bye: pemain dengan jumlah bye paling sedikit → tie-break dengan urutan acak (seed). Pemain yang bye di ronde sebelumnya tidak di-bye lagi selama masih ada kandidat lain.

### 4.2 Americano

Tujuan: setiap pasangan pemain `{i, j}` pernah menjadi **partner** minimal sekali.

Algoritma (greedy + random restart per ronde):

1. Pilih pemain bye (4.1).
2. Dari pemain aktif, bentuk pasangan dengan meminimalkan **skor biaya**:
   - `partnerCount[i][j] × 100` (hindari partner berulang — prioritas utama)
   - `opponentCount[i][j] × 10` (sebar lawan)
3. Pasangkan tim menjadi match, minimalkan pengulangan lawan.
4. Ulangi langkah 2–3 sebanyak K percobaan (mis. 200) dengan urutan acak berbeda; ambil jadwal ronde dengan biaya terendah.
5. Ulangi ronde sampai semua pasangan partner tercakup, atau batas aman `maxRounds = n × 2` tercapai.

Catatan:

- Jumlah ronde minimum ≈ `ceil( n(n-1)/2 / (slots/2) )`. Contoh 8 pemain, 2 lapangan → 7 ronde.
- Untuk n dengan jadwal sempurna yang dikenal (whist tournament, n = 4k atau 4k+1), fase berikutnya bisa memakai tabel jadwal sempurna sebagai optimasi.
- **Repeat (home/away)**: salin semua ronde leg 1 ke leg 2 dengan tim A/B ditukar, nomor ronde dilanjutkan.

### 4.3 Mexicano

- **Ronde 1**: urutan acak (seed), dikelompokkan per 4.
- **Ronde berikutnya** (dipicu host, hanya jika semua match ronde berjalan _approved_):
  1. Hitung leaderboard (hasil approved).
  2. Pilih bye (4.1).
  3. Urutkan pemain aktif sesuai peringkat; grup per 4: `[r1, r2, r3, r4]` → **r1 & r3 vs r2 & r4**.
  4. Grup peringkat teratas di Court 1, dst.

### 4.4 Replace player (`src/domain/scheduling/substitute.ts`)

Fungsi murni:

```ts
planSubstitution(input: {
  rounds; matches; byes;            // jadwal saat ini
  type: 'temporary' | 'permanent';
  fromRound: number;
  outPlayerId; inPlayerId;
}): Result<{ matchUpdates: SlotUpdate[]; byeUpdates: ByeUpdate[] }, string>
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

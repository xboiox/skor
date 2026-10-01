import type { PlayerId } from "./types";

/** Counts how often two players were paired (as partners or as opponents). Backed by an n×n matrix. */
export class PairCounter {
  private readonly index: ReadonlyMap<PlayerId, number>;
  private readonly size: number;
  private readonly counts: Uint32Array;

  constructor(playerIds: readonly PlayerId[]) {
    this.index = new Map(playerIds.map((id, i) => [id, i]));
    this.size = playerIds.length;
    this.counts = new Uint32Array(this.size * this.size);
  }

  get(a: PlayerId, b: PlayerId): number {
    return this.counts[this.offset(a, b)]!;
  }

  add(a: PlayerId, b: PlayerId): number {
    const next = this.counts[this.offset(a, b)]! + 1;
    this.counts[this.offset(a, b)] = next;
    this.counts[this.offset(b, a)] = next;
    return next;
  }

  /** Σ count² over unordered pairs — lower means pairings are spread more evenly. */
  spread(): number {
    let total = 0;
    for (let i = 0; i < this.size; i += 1) {
      for (let j = i + 1; j < this.size; j += 1) {
        const count = this.counts[i * this.size + j]!;
        total += count * count;
      }
    }
    return total;
  }

  private offset(a: PlayerId, b: PlayerId): number {
    const i = this.index.get(a);
    const j = this.index.get(b);
    if (i === undefined || j === undefined) throw new Error(`Unknown player in pair ${a}/${b}`);
    return i * this.size + j;
  }
}

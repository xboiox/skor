export type Random = () => number;

/** mulberry32 — small, fast, deterministic PRNG returning values in [0, 1). */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOLDEN_RATIO_32 = 0x9e3779b9;

/** Independent seed for the n-th attempt derived from a base seed. */
export function deriveSeed(seed: number, attempt: number): number {
  return (seed + Math.imul(attempt + 1, GOLDEN_RATIO_32)) >>> 0;
}

/** Fisher–Yates on a copy; the input is never mutated. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

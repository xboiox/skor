import { shuffle, type Random } from "./random";

export const DEFAULT_SEARCH_BUDGET = 20_000;

type Pairing<T> = readonly (readonly [T, T])[];

/**
 * Minimum-cost perfect matching by branch and bound.
 * The first descent is greedy, so a complete matching is always found; the budget
 * caps further search on large inputs. Stops early on a zero-cost matching.
 */
export function minCostPerfectMatching<T>(
  items: readonly T[],
  cost: (a: T, b: T) => number,
  random: Random,
  budget = DEFAULT_SEARCH_BUDGET,
): Pairing<T> {
  if (items.length % 2 !== 0)
    throw new Error("minCostPerfectMatching needs an even number of items");
  if (items.length === 0) return [];

  const order = shuffle(items, random);
  const used = new Array<boolean>(order.length).fill(false);
  const current: [T, T][] = [];
  let best: Pairing<T> | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  let nodes = 0;

  const search = (costSoFar: number): void => {
    if (bestCost === 0 || (best && nodes >= budget)) return;
    nodes += 1;

    const first = used.indexOf(false);
    if (first === -1) {
      best = current.map(([a, b]) => [a, b] as const);
      bestCost = costSoFar;
      return;
    }

    used[first] = true;
    const candidates = order
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => !used[index])
      .map((c) => ({ ...c, cost: cost(order[first]!, c.item) }))
      .sort((x, y) => x.cost - y.cost);

    for (const candidate of candidates) {
      if (costSoFar + candidate.cost >= bestCost) break; // sorted: the rest cost more
      used[candidate.index] = true;
      current.push([order[first]!, candidate.item]);
      search(costSoFar + candidate.cost);
      current.pop();
      used[candidate.index] = false;
      if (bestCost === 0 || (best && nodes >= budget)) break;
    }
    used[first] = false;
  };

  search(0);
  return best ?? [];
}

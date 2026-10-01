import { PLAYERS_PER_MATCH } from "./types";

export type RoundCapacity = {
  readonly matches: number;
  readonly playing: number;
  readonly byes: number;
};

export function roundCapacity(playerCount: number, courts: number): RoundCapacity {
  const matches = Math.min(courts, Math.floor(playerCount / PLAYERS_PER_MATCH));
  const playing = matches * PLAYERS_PER_MATCH;
  return { matches, playing, byes: playerCount - playing };
}

/**
 * Lower bound on Americano rounds: every pair must partner once and each round
 * creates playing/2 partnerships → n(n-1)/2 ÷ (playing/2) = n(n-1)/playing.
 */
export function minAmericanoRounds(playerCount: number, courts: number): number {
  const { playing } = roundCapacity(playerCount, courts);
  return Math.ceil((playerCount * (playerCount - 1)) / playing);
}

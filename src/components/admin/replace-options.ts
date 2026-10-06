type RoundInfo = {
  readonly number: number;
  readonly status: string;
  readonly matches: readonly { readonly status: string; readonly players: readonly string[] }[];
  readonly byes: readonly string[];
};

/** Rounds a substitution can start from, given the rules in planSubstitution. */
export function roundOptions(input: {
  rounds: readonly RoundInfo[];
  outPlayerId: string;
  type: "temporary" | "permanent";
  matchType: "americano" | "mexicano";
}): number[] {
  const { rounds, outPlayerId, type, matchType } = input;
  if (type === "temporary") {
    return rounds
      .filter((r) =>
        r.matches.some((m) => m.status === "scheduled" && m.players.includes(outPlayerId)),
      )
      .map((r) => r.number);
  }
  const open = rounds.filter((r) => r.status !== "completed").map((r) => r.number);
  const next = (rounds.at(-1)?.number ?? 0) + 1;
  return matchType === "mexicano" ? [...open, next] : open;
}

export function byeCandidates(
  rounds: readonly RoundInfo[],
  roundNumber: number,
  players: readonly { id: string; name: string; status: "active" | "withdrawn" }[],
): { id: string; name: string }[] {
  const byes = new Set(rounds.find((r) => r.number === roundNumber)?.byes ?? []);
  return players
    .filter((p) => p.status === "active" && byes.has(p.id))
    .map(({ id, name }) => ({ id, name }));
}

import { failure, success, type Result } from "../result";
import type { PlannedRound, SchedulingError } from "./types";

/** Home/away: replays the first leg with sides swapped, numbering on from the last round. */
export function repeatAsSecondLeg(
  rounds: readonly PlannedRound[],
): Result<PlannedRound[], SchedulingError> {
  if (rounds.length === 0) {
    return failure({ code: "INVALID_INPUT", message: "There are no rounds to repeat." });
  }
  if (rounds.some((round) => round.leg === 2)) {
    return failure({
      code: "INVALID_INPUT",
      message: "This tournament has already been repeated.",
    });
  }

  const lastNumber = Math.max(...rounds.map((round) => round.number));
  const firstLeg = [...rounds].sort((a, b) => a.number - b.number);

  return success(
    firstLeg.map((round, i) => ({
      number: lastNumber + i + 1,
      leg: 2,
      matches: round.matches.map((match) => ({
        court: match.court,
        teamA: match.teamB,
        teamB: match.teamA,
      })),
      byes: [...round.byes],
    })),
  );
}

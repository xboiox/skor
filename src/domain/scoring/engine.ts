import { failure, success, type Result } from "../result";
import { winGamePoint } from "./tennis-game";
import type { LiveStatus, MatchScore, ScoringConfig, ScoringError, Team } from "./types";

type ScoringResult = Result<MatchScore, ScoringError>;

const MATCH_COMPLETE: ScoringError = {
  code: "MATCH_COMPLETE",
  message: "This match is already complete.",
};

function invalidFinal(message: string): ScoringResult {
  return failure({ code: "INVALID_FINAL_SCORE", message });
}

function isWholeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function isComplete(config: ScoringConfig, score: MatchScore): boolean {
  const { scoreA, scoreB } = score;
  if (config.type === "rally") return scoreA + scoreB >= config.totalPoints;
  if (config.mode === "first_to") return Math.max(scoreA, scoreB) >= config.games;
  return scoreA + scoreB >= config.games;
}

/** A6: a live match is submitted for approval as soon as it is complete. */
export function statusForScore(config: ScoringConfig, score: MatchScore): LiveStatus {
  return isComplete(config, score) ? "submitted" : "in_progress";
}

export function applyPoint(config: ScoringConfig, score: MatchScore, team: Team): ScoringResult {
  if (isComplete(config, score)) return failure(MATCH_COMPLETE);

  if (config.type === "rally") {
    return success({
      ...score,
      scoreA: score.scoreA + (team === "A" ? 1 : 0),
      scoreB: score.scoreB + (team === "B" ? 1 : 0),
    });
  }

  const { state, winner } = winGamePoint(config.deuce, { a: score.gameA, b: score.gameB }, team);
  return success({
    scoreA: score.scoreA + (winner === "A" ? 1 : 0),
    scoreB: score.scoreB + (winner === "B" ? 1 : 0),
    gameA: state.a,
    gameB: state.b,
  });
}

export function validateFinal(
  config: ScoringConfig,
  scoreA: number,
  scoreB: number,
): ScoringResult {
  if (!isWholeNumber(scoreA) || !isWholeNumber(scoreB)) {
    return invalidFinal("Scores must be whole numbers of 0 or more.");
  }

  const total = scoreA + scoreB;

  if (config.type === "rally" && total !== config.totalPoints) {
    return invalidFinal(`Scores must add up to ${config.totalPoints} points (got ${total}).`);
  }

  if (config.type === "tennis" && config.mode === "total_of" && total !== config.games) {
    return invalidFinal(`Games must add up to ${config.games} (got ${total}).`);
  }

  if (config.type === "tennis" && config.mode === "first_to") {
    const teamsAtTarget = [scoreA, scoreB].filter((s) => s === config.games).length;
    if (teamsAtTarget !== 1 || Math.max(scoreA, scoreB) > config.games) {
      return invalidFinal(`Exactly one team must reach ${config.games} games.`);
    }
  }

  return success({ scoreA, scoreB, gameA: 0, gameB: 0 });
}

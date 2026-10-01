import { failure, success, type Result } from "../result";
import { MIN_PLAYERS, type PlayerId, type SchedulingError } from "./types";

export function validateRoster(
  playerIds: readonly PlayerId[],
  courts: number,
): Result<true, SchedulingError> {
  if (!Number.isInteger(courts) || courts < 1) {
    return failure({ code: "INVALID_INPUT", message: "There must be at least one court." });
  }
  if (new Set(playerIds).size !== playerIds.length) {
    return failure({ code: "INVALID_INPUT", message: "Each player can only be added once." });
  }
  if (playerIds.length < MIN_PLAYERS) {
    return failure({
      code: "NOT_ENOUGH_PLAYERS",
      message: `At least ${MIN_PLAYERS} players are needed (got ${playerIds.length}).`,
    });
  }
  return success(true);
}

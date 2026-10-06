import { z } from "zod";

const version = z.number().int().min(0);
const score = z.number().int().min(0).max(999);

export const scoreActionSchema = z.object({
  expectedVersion: version,
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("point"), team: z.enum(["A", "B"]) }),
    z.object({ type: z.literal("undo") }),
    z.object({ type: z.literal("final"), scoreA: score, scoreB: score }),
  ]),
});

export const versionSchema = z.object({ expectedVersion: version });

export const hostEditSchema = z.object({ expectedVersion: version, scoreA: score, scoreB: score });

export const substitutionSchema = z.object({
  type: z.enum(["temporary", "permanent"]),
  fromRound: z.number().int().min(1),
  outPlayerId: z.uuid(),
  substitute: z.discriminatedUnion("source", [
    z.object({ source: z.literal("new_player"), name: z.string() }),
    z.object({ source: z.literal("bye_player"), playerId: z.uuid() }),
  ]),
});

export const identitySchema = z.object({ playerId: z.uuid() });

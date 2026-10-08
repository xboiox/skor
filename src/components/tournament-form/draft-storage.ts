import { z } from "zod";
import { RALLY_POINT_OPTIONS } from "@/lib/validation/tournament";
import { STEPS, type FormState } from "./form-state";

const KEY = "skor:create-draft";

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Storage is user-controlled: validate the shape before trusting it.
const draftSchema = z.object({
  step: z
    .number()
    .int()
    .min(0)
    .max(STEPS.length - 1),
  state: z.object({
    name: z.string().max(200),
    date: z.string().max(20),
    matchType: z.enum(["americano", "mexicano"]),
    courts: z.number().int(),
    scoringType: z.enum(["rally", "tennis"]),
    totalPoints: z.literal(RALLY_POINT_OPTIONS),
    tennisMode: z.enum(["first_to", "total_of"]),
    tennisGames: z.number(),
    deuce: z.enum(["golden_point", "advantage"]),
    players: z.array(z.string().max(100)).max(200),
  }),
});

/**
 * Keeps the create form across a detour to log in (incl. Google), in this tab only.
 * Every call is best-effort: storage can be missing, full or blocked.
 */
export function saveDraft(storage: DraftStorage, state: FormState, step: number): void {
  try {
    storage.setItem(KEY, JSON.stringify({ state, step }));
  } catch {
    // ignore: the form still works, it just won't survive a reload
  }
}

export type Draft = { state: FormState; step: number };

/** Validates a raw stored draft; anything unexpected becomes null. */
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function loadDraft(storage: DraftStorage): Draft | null {
  try {
    return parseDraft(storage.getItem(KEY));
  } catch {
    return null;
  }
}

/** The raw stored draft for useSyncExternalStore (a string, so the snapshot is stable). */
export function readDraftSnapshot(): string | null {
  try {
    return browserStorage()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export function clearDraft(storage: DraftStorage): void {
  try {
    storage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** sessionStorage, or null where it is unavailable (some private modes throw on access). */
export function browserStorage(): DraftStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

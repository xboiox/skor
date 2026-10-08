import { STEPS } from "./form-state";

const LAST_STEP = STEPS.length - 1;

/** `?step=` from the URL (user-editable): whole numbers 0..3, anything else is the first step. */
export function parseStepParam(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 0;
  return Math.min(Number(raw), LAST_STEP);
}

import { z } from "zod";

/** In-app pages visited in this tab, oldest first. Lets "Back" know whether a Skor page is behind it. */
export type NavStack = readonly string[];

export const MAX_DEPTH = 50;

const stackSchema = z.array(z.string().startsWith("/")).max(MAX_DEPTH);

/** Push a new page, pop when returning to the previous one, ignore reloads. */
export function nextStack(stack: NavStack, pathname: string): NavStack {
  if (stack.at(-1) === pathname) return stack;
  if (stack.at(-2) === pathname) return stack.slice(0, -1);
  return [...stack, pathname].slice(-MAX_DEPTH);
}

export function canGoBack(stack: NavStack): boolean {
  return stack.length > 1;
}

/** Stored value is user-controlled: only same-site paths are accepted. */
export function parseStack(raw: string | null): NavStack {
  if (!raw) return [];
  try {
    const parsed = stackSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.every((p) => !p.startsWith("//")) ? parsed.data : [];
  } catch {
    return [];
  }
}

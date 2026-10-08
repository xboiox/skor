import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Whether the Web Share API exists. False on the server and during hydration (so the HTML
 * matches), then the real value — reading `navigator` during render causes a hydration error.
 */
export function useCanShare(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
}

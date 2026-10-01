import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server render and hydration, true once React is in control.
 * Submit buttons stay disabled until then, so an early tap on a slow phone is not lost
 * or sent as a native form submission.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

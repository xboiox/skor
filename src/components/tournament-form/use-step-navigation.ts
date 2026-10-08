"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { parseStepParam } from "./step-param";

/**
 * Form steps live in `?step=` so the phone's own back button/gesture goes back one step.
 * "Next" pushes a history entry; "Back" pops it when it can, otherwise replaces the URL.
 */
export function useStepNavigation(basePath: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const step = parseStepParam(searchParams.get("step"));
  const pushed = useRef(0); // step entries this form added to history
  // True until the URL has moved to the new step: a quick double tap must not push the same step twice.
  const [isNavigating, startNavigation] = useTransition();
  const previous = useRef(step);

  // Keep the count honest when the system back button pops steps.
  useEffect(() => {
    if (step < previous.current)
      pushed.current = Math.max(0, pushed.current - (previous.current - step));
    previous.current = step;
  }, [step]);

  const urlFor = useCallback(
    (n: number) => (n === 0 ? basePath : `${basePath}?step=${n}`),
    [basePath],
  );

  return {
    step,
    hasStepParam: searchParams.has("step"),
    isNavigating,
    forward: (n: number) => {
      pushed.current += 1;
      startNavigation(() => router.push(urlFor(n)));
    },
    backward: () => {
      if (pushed.current > 0) router.back();
      else startNavigation(() => router.replace(urlFor(Math.max(0, step - 1))));
    },
    replaceWith: (n: number) => router.replace(urlFor(n)),
  };
}

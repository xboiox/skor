"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest, type ClientResponse } from "@/lib/api-client";

/** Runs one host API call at a time, shows its error and refreshes the page on success. */
export function useHostAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function run(
    key: string,
    url: string,
    method: "POST" | "PATCH",
    body: unknown = {},
  ): Promise<boolean> {
    setBusyKey(key);
    setError(null);
    const result: ClientResponse<unknown> = await apiRequest(url, { method, body });
    setBusyKey(null);
    if (!result.success) {
      setError(result.error.message);
      return false;
    }
    router.refresh();
    return true;
  }

  return { run, error, busyKey, isBusy: busyKey !== null };
}

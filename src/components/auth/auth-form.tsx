"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;
const TOO_MANY_REQUESTS = 429;

interface AuthFormProps {
  mode: "login" | "register";
  redirectTo: string;
}

type AuthError = { status?: number; message?: string } | null;

function friendlyMessage(error: NonNullable<AuthError>, mode: AuthFormProps["mode"]): string {
  if (error.status === TOO_MANY_REQUESTS)
    return "Too many attempts. Please wait a few seconds and try again.";
  if (mode === "login") return "Email or password is incorrect.";
  return error.message ?? "Could not create your account. Please try again.";
}

export function AuthForm({ mode, redirectTo }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";
  const isHydrated = useHydrated();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    setError(null);
    setIsSubmitting(true);
    const { error: authError } = isRegister
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });
    setIsSubmitting(false);

    if (authError) {
      setError(friendlyMessage(authError, mode));
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  const fieldClass =
    "min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted";

  return (
    // method="post": if the form is ever submitted natively, the password must not land in the URL.
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isRegister && (
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">Name</span>
          <input name="name" required maxLength={100} autoComplete="name" className={fieldClass} />
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
          autoComplete={isRegister ? "new-password" : "current-password"}
          className={fieldClass}
        />
        {isRegister && (
          <span className="text-muted text-sm">At least {MIN_PASSWORD_LENGTH} characters.</span>
        )}
      </label>

      {error && (
        <p
          role="alert"
          className="border-danger text-danger rounded-xl border px-4 py-3 font-medium"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !isHydrated}
        className="bg-primary text-primary-foreground min-h-14 rounded-xl text-lg font-bold disabled:opacity-60"
      >
        {isSubmitting ? "Please wait…" : isRegister ? "Create account" : "Log in"}
      </button>

      <p className="text-muted text-center">
        {isRegister ? "Already have an account? " : "New to Skor? "}
        <Link
          href={`${isRegister ? "/login" : "/register"}?next=${encodeURIComponent(redirectTo)}`}
          className="text-primary font-semibold"
        >
          {isRegister ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

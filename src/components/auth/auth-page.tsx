import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AuthForm } from "@/components/auth/auth-form";
import { GoogleButton } from "@/components/auth/google-button";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentSession } from "@/server/auth/session";
import { isGoogleAuthEnabled } from "@/server/env";

interface AuthPageProps {
  mode: "login" | "register";
  next: string | string[] | undefined;
}

export async function AuthPage({ mode, next }: AuthPageProps) {
  const redirectTo = safeRedirectPath(typeof next === "string" ? next : null);
  if (await getCurrentSession()) redirect(redirectTo);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {mode === "login" ? "Log in" : "Create your account"}
        </h1>
        {isGoogleAuthEnabled() && (
          <>
            <GoogleButton redirectTo={redirectTo} />
            <div className="text-muted flex items-center gap-3 text-sm" aria-hidden="true">
              <span className="bg-border h-px flex-1" />
              or with email
              <span className="bg-border h-px flex-1" />
            </div>
          </>
        )}
        <AuthForm mode={mode} redirectTo={redirectTo} />
      </main>
    </div>
  );
}

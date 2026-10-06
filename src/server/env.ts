import { z } from "zod";

const DEFAULT_GUEST_TTL_DAYS = 7;
const MAX_GUEST_TTL_DAYS = 90;

const MIN_SECRET_LENGTH = 32;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    APP_URL: z.url().default("http://localhost:3000"),
    GUEST_TTL_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_GUEST_TTL_DAYS)
      .default(DEFAULT_GUEST_TTL_DAYS),
    AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    /** Set to true only behind a reverse proxy that writes CLIENT_IP_HEADER (see docs/SECURITY.md). */
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    CLIENT_IP_HEADER: z
      .string()
      .min(1)
      .default("x-forwarded-for")
      .transform((v) => v.toLowerCase()),
    TRUSTED_PROXIES: z
      .string()
      .default("")
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
  })
  // Google sign-in is optional, but its credentials only work as a pair.
  .superRefine((env, ctx) => {
    if (env.AUTH_GOOGLE_ID && !env.AUTH_GOOGLE_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_GOOGLE_SECRET"],
        message: "Required when AUTH_GOOGLE_ID is set",
      });
    }
    if (env.AUTH_GOOGLE_SECRET && !env.AUTH_GOOGLE_ID) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_GOOGLE_ID"],
        message: "Required when AUTH_GOOGLE_SECRET is set",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

type EnvSource = Record<string, string | undefined>;

function withoutEmptyValues(source: EnvSource): EnvSource {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
}

export function parseEnv(source: EnvSource): Env {
  const result = envSchema.safeParse(withoutEmptyValues(source));
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}

export function isGoogleAuthEnabled(env: Env = getEnv()): boolean {
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

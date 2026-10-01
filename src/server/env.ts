import { z } from "zod";

const DEFAULT_GUEST_TTL_DAYS = 7;
const MAX_GUEST_TTL_DAYS = 90;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  APP_URL: z.url().default("http://localhost:3000"),
  GUEST_TTL_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_GUEST_TTL_DAYS)
    .default(DEFAULT_GUEST_TTL_DAYS),
  // Auth becomes required in Fase 5.
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
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

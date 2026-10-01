import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Host runs read .env; inside Docker the variables come from compose.
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});

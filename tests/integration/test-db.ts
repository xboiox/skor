import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/server/db/schema";

if (!process.env.TEST_DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://skor:skor@localhost:5432/skor_test";

export function connectTestDb() {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  const db = drizzle({ client: sql, schema, casing: "snake_case" });
  return { sql, db };
}

export async function truncateAll(sql: postgres.Sql): Promise<void> {
  await sql`truncate users, tournaments restart identity cascade`;
}

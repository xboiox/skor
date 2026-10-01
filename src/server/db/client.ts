import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/server/env";
import * as schema from "./schema";

const MAX_CONNECTIONS = 10;

export type Database = PostgresJsDatabase<typeof schema>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { skorSql?: postgres.Sql; skorDb?: Database };

export function getSql(): postgres.Sql {
  globalForDb.skorSql ??= postgres(getEnv().DATABASE_URL, { max: MAX_CONNECTIONS });
  return globalForDb.skorSql;
}

export function getDb(): Database {
  globalForDb.skorDb ??= drizzle({ client: getSql(), schema, casing: "snake_case" });
  return globalForDb.skorDb;
}

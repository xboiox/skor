import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/server/env";
import * as schema from "./schema";

const MAX_CONNECTIONS = 10;

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run queries: the pool or an open transaction. */
export type Executor = Database | Transaction;

// Only the connection pool survives hot reloads. The Drizzle instance is per module so it is
// rebuilt when schema.ts changes (a stale instance keeps an outdated column-name cache).
const globalForDb = globalThis as unknown as { skorSql?: postgres.Sql };
let db: Database | undefined;

export function getSql(): postgres.Sql {
  globalForDb.skorSql ??= postgres(getEnv().DATABASE_URL, { max: MAX_CONNECTIONS });
  return globalForDb.skorSql;
}

export function getDb(): Database {
  db ??= drizzle({ client: getSql(), schema, casing: "snake_case" });
  return db;
}

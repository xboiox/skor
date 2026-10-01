import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { TEST_DATABASE_URL } from "./test-db";

async function ensureDatabaseExists(url: URL): Promise<void> {
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    const rows = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (rows.length === 0) await admin.unsafe(`create database "${dbName.replaceAll('"', '""')}"`);
  } finally {
    await admin.end();
  }
}

export default async function setup(): Promise<void> {
  await ensureDatabaseExists(new URL(TEST_DATABASE_URL));
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle({ client: sql }), { migrationsFolder: "./drizzle" });
  } finally {
    await sql.end();
  }
}

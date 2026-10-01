import { afterAll, describe, expect, it } from "vitest";
import { getDb, getSql } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { TEST_DATABASE_URL } from "./test-db";

process.env.DATABASE_URL = TEST_DATABASE_URL;

afterAll(async () => {
  await getSql().end();
});

describe("db client", () => {
  it("reuses a single connection pool", () => {
    expect(getSql()).toBe(getSql());
    expect(getDb()).toBe(getDb());
  });

  it("runs queries with snake_case column mapping", async () => {
    const rows = await getDb().select({ email: users.email }).from(users).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });
});

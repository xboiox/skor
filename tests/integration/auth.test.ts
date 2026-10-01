import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getAuth } from "@/server/auth/auth";
import { getSql } from "@/server/db/client";
import { accounts, users } from "@/server/db/schema";
import { connectTestDb, TEST_DATABASE_URL, truncateAll } from "./test-db";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.AUTH_SECRET ??= "integration-test-secret-at-least-32-chars";

const { sql, db } = connectTestDb();
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const PASSWORD = "correct horse battery";

function signUp(email: string, password = PASSWORD) {
  return getAuth().api.signUpEmail({ body: { name: "Andi", email, password } });
}

/** Calls the HTTP handler (the only path that is rate limited). */
function postSignIn(ip: string, email: string, password: string) {
  return getAuth().handler(
    new Request(`${APP_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP_URL, "x-forwarded-for": ip },
      body: JSON.stringify({ email, password }),
    }),
  );
}

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
  await getSql().end();
});

describe("email & password auth", () => {
  it("registers a user with a hashed credential account", async () => {
    const result = await signUp("andi@example.com");
    expect(result.user).toMatchObject({
      email: "andi@example.com",
      name: "Andi",
      emailVerified: false,
    });

    const [account] = await db.select().from(accounts).where(eq(accounts.userId, result.user.id));
    expect(account).toMatchObject({ providerId: "credential" });
    expect(account!.password).toBeTruthy();
    expect(account!.password).not.toContain(PASSWORD);
  });

  it("signs in with the right password only", async () => {
    await signUp("andi@example.com");
    await expect(
      getAuth().api.signInEmail({ body: { email: "andi@example.com", password: PASSWORD } }),
    ).resolves.toMatchObject({ user: { email: "andi@example.com" } });
    await expect(
      getAuth().api.signInEmail({
        body: { email: "andi@example.com", password: "wrong password" },
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate email", async () => {
    await signUp("andi@example.com");
    await expect(signUp("andi@example.com")).rejects.toThrow();
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    await expect(signUp("budi@example.com", "short")).rejects.toThrow();
  });
});

describe("rate limiting", () => {
  it("limits repeated sign-in attempts from one IP", async () => {
    await signUp("andi@example.com");
    const ip = `10.0.0.${Math.floor(Math.random() * 200) + 1}`;
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await postSignIn(ip, "andi@example.com", "wrong password")).status);
    }
    expect(statuses.slice(0, 3)).not.toContain(429);
    expect(statuses.at(-1)).toBe(429);
  });

  it("keeps other IPs unaffected", async () => {
    await signUp("andi@example.com");
    const res = await postSignIn("10.9.9.9", "andi@example.com", PASSWORD);
    expect(res.status).toBe(200);
  });
});

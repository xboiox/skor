import { describe, expect, it } from "vitest";
import { formatSse, parseEvent } from "./events";

describe("parseEvent", () => {
  it("accepts a tournament event", () => {
    const payload = JSON.stringify({
      tournamentId: "00000000-0000-4000-8000-000000000001",
      type: "tournament.updated",
    });
    expect(parseEvent(payload)).toEqual({
      tournamentId: "00000000-0000-4000-8000-000000000001",
      type: "tournament.updated",
    });
  });

  it("rejects malformed or unknown payloads instead of throwing", () => {
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent(JSON.stringify({ type: "tournament.updated" }))).toBeNull();
    expect(parseEvent(JSON.stringify({ tournamentId: "x", type: "evil" }))).toBeNull();
  });
});

describe("formatSse", () => {
  it("writes a named event with a JSON data line and a blank line", () => {
    expect(formatSse("match.updated", { a: 1 })).toBe('event: match.updated\ndata: {"a":1}\n\n');
  });
});

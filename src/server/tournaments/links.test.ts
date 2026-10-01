import { describe, expect, it } from "vitest";
import { tournamentLinks } from "./links";

describe("tournamentLinks", () => {
  it("builds admin, player and public URLs", () => {
    expect(tournamentLinks("https://skor.app/", "k7p2xq", { admin: "AAA", player: "PPP" })).toEqual(
      {
        admin: "https://skor.app/t/k7p2xq/enter/admin?k=AAA",
        player: "https://skor.app/t/k7p2xq/enter/player?k=PPP",
        public: "https://skor.app/t/k7p2xq",
      },
    );
  });

  it("omits links whose token is unknown", () => {
    expect(tournamentLinks("http://localhost:3000", "abc", { admin: null, player: "P" })).toEqual({
      admin: null,
      player: "http://localhost:3000/t/abc/enter/player?k=P",
      public: "http://localhost:3000/t/abc",
    });
  });

  it("encodes tokens safely", () => {
    expect(tournamentLinks("http://x.test", "abc", { admin: "a+b/c", player: null }).admin).toBe(
      "http://x.test/t/abc/enter/admin?k=a%2Bb%2Fc",
    );
  });
});

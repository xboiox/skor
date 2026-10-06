import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

const headers = (h: Record<string, string>) => new Headers(h);

describe("clientIp", () => {
  it("ignores forwarding headers unless the app runs behind a trusted proxy", () => {
    expect(
      clientIp(headers({ "x-forwarded-for": "1.2.3.4" }), {
        trustProxy: false,
        header: "x-forwarded-for",
        trustedProxies: [],
      }),
    ).toBeNull();
  });

  it("takes the address appended by the proxy (rightmost) by default", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }); // the client may spoof the first entry
    expect(clientIp(h, { trustProxy: true, header: "x-forwarded-for", trustedProxies: [] })).toBe(
      "203.0.113.7",
    );
  });

  it("skips trusted proxy hops from the right", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.5, 10.0.0.6" });
    const config = {
      trustProxy: true,
      header: "x-forwarded-for",
      trustedProxies: ["10.0.0.5", "10.0.0.0/24"],
    };
    expect(clientIp(h, config)).toBe("203.0.113.7");
  });

  it("reads single-value headers such as cf-connecting-ip", () => {
    const h = headers({ "cf-connecting-ip": "2001:db8::1" });
    expect(clientIp(h, { trustProxy: true, header: "cf-connecting-ip", trustedProxies: [] })).toBe(
      "2001:db8::1",
    );
  });

  it("rejects values that are not IP addresses", () => {
    const h = headers({ "x-forwarded-for": "not-an-ip" });
    expect(
      clientIp(h, { trustProxy: true, header: "x-forwarded-for", trustedProxies: [] }),
    ).toBeNull();
  });

  it("returns null when the header is missing", () => {
    expect(
      clientIp(headers({}), { trustProxy: true, header: "x-forwarded-for", trustedProxies: [] }),
    ).toBeNull();
  });
});

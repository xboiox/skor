import { describe, expect, it } from "vitest";
import { qrSvg } from "./qr";

describe("qrSvg", () => {
  it("renders an accessible SVG for a URL", async () => {
    const svg = await qrSvg("http://localhost:3000/t/abc123");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("viewBox");
  });

  it("produces different codes for different URLs", async () => {
    expect(await qrSvg("http://x.test/a")).not.toBe(await qrSvg("http://x.test/b"));
  });
});

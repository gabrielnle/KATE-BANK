import { expect, test, describe } from "bun:test";
import { getSafeUrl } from "./url";

describe("getSafeUrl", () => {
  test("returns valid http URLs", () => {
    expect(getSafeUrl("http://example.com")).toBe("http://example.com/");
    expect(getSafeUrl("http://example.com/path")).toBe("http://example.com/path");
  });

  test("returns valid https URLs", () => {
    expect(getSafeUrl("https://example.com")).toBe("https://example.com/");
    expect(getSafeUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  test("prepends https:// to URLs without a protocol", () => {
    expect(getSafeUrl("example.com")).toBe("https://example.com/");
    expect(getSafeUrl("www.example.com")).toBe("https://www.example.com/");
    expect(getSafeUrl("example.com/path")).toBe("https://example.com/path");
  });

  test("returns '#' for malicious or invalid schemes", () => {
    expect(getSafeUrl("javascript:alert(1)")).toBe("#");
    expect(getSafeUrl("javascript:void(0)")).toBe("#");
    expect(getSafeUrl("vbscript:msgbox(\"test\")")).toBe("#");
    expect(getSafeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(getSafeUrl("mailto:test@example.com")).toBe("#");
    expect(getSafeUrl("tel:+123456789")).toBe("#");
  });

  test("handles empty or null inputs", () => {
    expect(getSafeUrl(null)).toBe("#");
    expect(getSafeUrl(undefined)).toBe("#");
    expect(getSafeUrl("")).toBe("#");
    expect(getSafeUrl("   ")).toBe("#");
  });

  test("handles mixed case protocols", () => {
    expect(getSafeUrl("HtTpS://example.com")).toBe("https://example.com/");
    expect(getSafeUrl("JaVaScRiPt:alert(1)")).toBe("#");
  });

  test("handles leading/trailing spaces", () => {
    expect(getSafeUrl("  https://example.com  ")).toBe("https://example.com/");
    expect(getSafeUrl("  javascript:alert(1)  ")).toBe("#");
  });
});

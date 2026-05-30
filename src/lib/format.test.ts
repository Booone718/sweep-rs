import { describe, expect, it } from "vitest";
import { formatBytes, formatItemCount } from "./format";

describe("formatBytes", () => {
  it("formats bytes with Chinese-friendly binary units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(3.25 * 1024 * 1024 * 1024)).toBe("3.3 GB");
  });
});

describe("formatItemCount", () => {
  it("uses Chinese item labels", () => {
    expect(formatItemCount(0)).toBe("0 项");
    expect(formatItemCount(8)).toBe("8 项");
  });
});


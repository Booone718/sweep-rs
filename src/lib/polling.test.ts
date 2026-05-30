import { describe, expect, it, vi } from "vitest";
import { waitForScanReport } from "./polling";
import type { ScanReport } from "../types";

const report: ScanReport = {
  sessionId: "scan-1",
  totalBytes: 0,
  items: [],
  duplicateGroups: [],
  appResidueGroups: [],
  permissionWarnings: []
};

describe("waitForScanReport", () => {
  it("keeps polling while the backend reports scan_not_ready", async () => {
    const fetchReport = vi
      .fn()
      .mockRejectedValueOnce("scan_not_ready")
      .mockRejectedValueOnce(new Error("scan_not_ready"))
      .mockResolvedValueOnce(report);

    await expect(waitForScanReport("scan-1", fetchReport, () => Promise.resolve())).resolves.toEqual(report);
    expect(fetchReport).toHaveBeenCalledTimes(3);
  });

  it("throws real scan errors immediately", async () => {
    const fetchReport = vi.fn().mockRejectedValueOnce(new Error("permission denied"));

    await expect(waitForScanReport("scan-1", fetchReport, () => Promise.resolve())).rejects.toThrow(
      "permission denied"
    );
    expect(fetchReport).toHaveBeenCalledTimes(1);
  });
});


import type { ScanReport } from "../types";

type FetchReport = (sessionId: string) => Promise<ScanReport>;
type Sleep = (ms: number) => Promise<void>;

export async function waitForScanReport(
  sessionId: string,
  fetchReport: FetchReport,
  sleep: Sleep = defaultSleep
): Promise<ScanReport> {
  for (;;) {
    try {
      return await fetchReport(sessionId);
    } catch (error) {
      if (!isScanNotReady(error)) {
        throw error;
      }
      await sleep(500);
    }
  }
}

function isScanNotReady(error: unknown): boolean {
  if (typeof error === "string") {
    return error === "scan_not_ready";
  }
  if (error instanceof Error) {
    return error.message === "scan_not_ready";
  }
  return false;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}


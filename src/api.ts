import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CleanReport, ScanReport, UserSettings } from "./types";

export type ScanConfig = {
  exclusions: string[];
  includeBrowserCaches: boolean;
  includeLargeFiles: boolean;
  includeProtectedUserFolders: boolean;
  largeFileThresholdBytes: number;
};

export type CleanRequest = {
  sessionId: string;
  itemIds: string[];
};

export type ScanProgress = {
  sessionId?: string;
  phase: "starting" | "walking" | "duplicates" | "app_residue" | "completed";
  currentPath: string;
  scannedFiles: number;
  matchedItems: number;
};

export type HistoryEntry = {
  id: string;
  cleanedBytes: number;
  movedItemCount: number;
  createdAt: string;
};

export async function startScan(config: ScanConfig): Promise<string> {
  return invoke<string>("start_scan", { config });
}

export async function cancelScan(sessionId: string): Promise<void> {
  await invoke("cancel_scan", { sessionId });
}

export async function getScanReport(sessionId: string): Promise<ScanReport> {
  return invoke<ScanReport>("get_scan_report", { sessionId });
}

export async function cleanItems(request: CleanRequest): Promise<CleanReport> {
  return invoke<CleanReport>("clean_items", { request });
}

export async function getSettings(): Promise<UserSettings> {
  return invoke<UserSettings>("get_settings");
}

export async function updateSettings(settings: UserSettings): Promise<UserSettings> {
  return invoke<UserSettings>("update_settings", { settings });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return invoke<HistoryEntry[]>("get_history");
}

export async function openTrash(): Promise<void> {
  await invoke("open_trash");
}

export async function revealPath(path: string): Promise<void> {
  await invoke("reveal_path", { path });
}

export async function onScanProgress(handler: (progress: ScanProgress) => void): Promise<() => void> {
  return listen<ScanProgress>("scan_progress", (event) => handler(event.payload));
}

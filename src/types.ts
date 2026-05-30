export type RiskLevel = "low" | "review" | "high";

export type CleanupCategory =
  | "cache"
  | "logs"
  | "crash_reports"
  | "trash"
  | "downloads"
  | "browser_cache"
  | "large_files"
  | "duplicates"
  | "ios_backups"
  | "app_residue";

export type ScanItem = {
  id: string;
  path: string;
  displayName: string;
  category: CleanupCategory;
  sizeBytes: number;
  risk: RiskLevel;
  reason: string;
  defaultSelected: boolean;
};

export type DuplicateGroup = {
  id: string;
  sizeBytes: number;
  hash: string;
  items: ScanItem[];
  reclaimableBytes: number;
};

export type AppResidueGroup = {
  id: string;
  appName: string;
  bundleId?: string;
  items: ScanItem[];
  totalBytes: number;
};

export type ScanReport = {
  sessionId: string;
  totalBytes: number;
  items: ScanItem[];
  duplicateGroups: DuplicateGroup[];
  appResidueGroups: AppResidueGroup[];
  permissionWarnings: string[];
};

export type CleanReport = {
  cleanedBytes: number;
  movedItemCount: number;
  failedItems: Array<{ path: string; error: string }>;
};

export type UserSettings = {
  exclusions: string[];
  includeBrowserCaches: boolean;
  includeLargeFiles: boolean;
  includeProtectedUserFolders: boolean;
  largeFileThresholdBytes: number;
};

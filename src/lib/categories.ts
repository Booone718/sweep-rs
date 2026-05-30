import type { CleanupCategory, ScanItem } from "../types";

export type CategorySummary = {
  category: CleanupCategory;
  label: string;
  sizeBytes: number;
  count: number;
  defaultSelectedCount: number;
  reviewCount: number;
};

export const CATEGORY_LABELS: Record<CleanupCategory, string> = {
  cache: "缓存",
  logs: "日志",
  crash_reports: "崩溃报告",
  trash: "废纸篓",
  downloads: "下载残留",
  browser_cache: "浏览器缓存",
  large_files: "大文件",
  duplicates: "重复文件",
  ios_backups: "旧 iOS 备份",
  app_residue: "应用残留"
};

export function summarizeCategories(items: ScanItem[]): CategorySummary[] {
  const summaries = new Map<CleanupCategory, CategorySummary>();

  for (const item of items) {
    const current =
      summaries.get(item.category) ??
      {
        category: item.category,
        label: CATEGORY_LABELS[item.category],
        sizeBytes: 0,
        count: 0,
        defaultSelectedCount: 0,
        reviewCount: 0
      };

    current.sizeBytes += item.sizeBytes;
    current.count += 1;
    current.defaultSelectedCount += item.defaultSelected ? 1 : 0;
    current.reviewCount += item.risk === "low" ? 0 : 1;
    summaries.set(item.category, current);
  }

  return [...summaries.values()].sort((left, right) => right.sizeBytes - left.sizeBytes);
}


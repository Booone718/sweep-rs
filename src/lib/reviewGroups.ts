import { CATEGORY_LABELS } from "./categories";
import type { CleanupCategory, RiskLevel, ScanItem } from "../types";

export type FolderGroup = {
  id: string;
  path: string;
  displayName: string;
  items: ScanItem[];
  itemCount: number;
  totalBytes: number;
  risk: RiskLevel;
  categoryLabel: string;
};

type FolderAccumulator = FolderGroup & {
  categories: Set<CleanupCategory>;
};

export function groupItemsByFolder(items: ScanItem[]): FolderGroup[] {
  const groups = new Map<string, FolderAccumulator>();

  for (const item of items) {
    const folderPath = parentFolder(item.path);
    const current =
      groups.get(folderPath) ??
      {
        id: folderPath,
        path: folderPath,
        displayName: folderName(folderPath),
        items: [],
        itemCount: 0,
        totalBytes: 0,
        risk: "low" as RiskLevel,
        categoryLabel: CATEGORY_LABELS[item.category],
        categories: new Set<CleanupCategory>()
      };

    current.items.push(item);
    current.itemCount += 1;
    current.totalBytes += item.sizeBytes;
    current.risk = maxRisk(current.risk, item.risk);
    current.categories.add(item.category);
    current.categoryLabel = current.categories.size === 1 ? CATEGORY_LABELS[item.category] : "多个分类";
    groups.set(folderPath, current);
  }

  return [...groups.values()]
    .map(({ categories: _categories, ...group }) => group)
    .sort((left, right) => right.totalBytes - left.totalBytes);
}

function parentFolder(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  const slashIndex = normalized.lastIndexOf("/");

  if (slashIndex <= 0) {
    return "未知位置";
  }

  return normalized.slice(0, slashIndex);
}

function folderName(path: string): string {
  if (path === "未知位置") {
    return path;
  }

  const normalized = path.replace(/\/+$/, "");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || normalized;
}

function maxRisk(left: RiskLevel, right: RiskLevel): RiskLevel {
  const priority: Record<RiskLevel, number> = {
    low: 0,
    review: 1,
    high: 2
  };

  return priority[right] > priority[left] ? right : left;
}

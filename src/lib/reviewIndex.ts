import { CATEGORY_LABELS, type CategorySummary } from "./categories";
import type { CleanupCategory, ScanItem } from "../types";

export type ReviewCategoryFilter = CleanupCategory | "all" | "selected";

export type ReviewIndex = {
  categories: CategorySummary[];
  items: ScanItem[];
  itemsByCategory: Map<CleanupCategory, ScanItem[]>;
};

const EMPTY_ITEMS: ScanItem[] = [];

export function createReviewIndex(items: ScanItem[]): ReviewIndex {
  const summaries = new Map<CleanupCategory, CategorySummary>();
  const itemsByCategory = new Map<CleanupCategory, ScanItem[]>();

  for (const item of items) {
    const currentSummary =
      summaries.get(item.category) ??
      {
        category: item.category,
        label: CATEGORY_LABELS[item.category],
        sizeBytes: 0,
        count: 0,
        defaultSelectedCount: 0,
        reviewCount: 0
      };

    currentSummary.sizeBytes += item.sizeBytes;
    currentSummary.count += 1;
    currentSummary.defaultSelectedCount += item.defaultSelected ? 1 : 0;
    currentSummary.reviewCount += item.risk === "low" ? 0 : 1;
    summaries.set(item.category, currentSummary);

    const categoryItems = itemsByCategory.get(item.category) ?? [];
    categoryItems.push(item);
    itemsByCategory.set(item.category, categoryItems);
  }

  return {
    categories: [...summaries.values()].sort((left, right) => right.sizeBytes - left.sizeBytes),
    items,
    itemsByCategory
  };
}

export function getCategoryFilteredItems(index: ReviewIndex, filter: ReviewCategoryFilter): ScanItem[] {
  if (filter === "all") {
    return index.items;
  }

  if (filter === "selected") {
    return EMPTY_ITEMS;
  }

  return index.itemsByCategory.get(filter) ?? EMPTY_ITEMS;
}

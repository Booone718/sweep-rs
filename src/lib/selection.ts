import type { CleanupCategory, ScanItem } from "../types";

export function createInitialSelection(items: ScanItem[]): Set<string> {
  return new Set(items.filter((item) => item.defaultSelected && item.risk === "low").map((item) => item.id));
}

export function toggleItem(selection: Set<string>, itemId: string): Set<string> {
  const next = new Set(selection);
  if (next.has(itemId)) {
    next.delete(itemId);
  } else {
    next.add(itemId);
  }
  return next;
}

export function toggleCategory(
  selection: Set<string>,
  items: ScanItem[],
  category: CleanupCategory,
  selected: boolean
): Set<string> {
  const next = new Set(selection);

  for (const item of items) {
    if (item.category !== category) {
      continue;
    }

    if (selected) {
      next.add(item.id);
    } else {
      next.delete(item.id);
    }
  }

  return next;
}


import { describe, expect, it } from "vitest";
import { createReviewIndex, getCategoryFilteredItems } from "./reviewIndex";
import type { ScanItem } from "../types";

const items: ScanItem[] = [
  {
    id: "cache-1",
    path: "/Users/test/Library/Caches/a.tmp",
    displayName: "a.tmp",
    category: "cache",
    sizeBytes: 100,
    risk: "low",
    reason: "缓存",
    defaultSelected: true
  },
  {
    id: "cache-2",
    path: "/Users/test/Library/Caches/b.tmp",
    displayName: "b.tmp",
    category: "cache",
    sizeBytes: 40,
    risk: "low",
    reason: "缓存",
    defaultSelected: true
  },
  {
    id: "large-1",
    path: "/Users/test/Movies/big.mov",
    displayName: "big.mov",
    category: "large_files",
    sizeBytes: 900,
    risk: "review",
    reason: "大文件",
    defaultSelected: false
  }
];

describe("review index", () => {
  it("builds category summaries and category item lists in one reusable index", () => {
    const index = createReviewIndex(items);

    expect(index.categories).toEqual([
      {
        category: "large_files",
        label: "大文件",
        sizeBytes: 900,
        count: 1,
        defaultSelectedCount: 0,
        reviewCount: 1
      },
      {
        category: "cache",
        label: "缓存",
        sizeBytes: 140,
        count: 2,
        defaultSelectedCount: 2,
        reviewCount: 0
      }
    ]);
    expect(getCategoryFilteredItems(index, "all")).toBe(items);
    expect(getCategoryFilteredItems(index, "cache").map((item) => item.id)).toEqual(["cache-1", "cache-2"]);
    expect(getCategoryFilteredItems(index, "large_files").map((item) => item.id)).toEqual(["large-1"]);
    expect(getCategoryFilteredItems(index, "selected")).toEqual([]);
  });
});

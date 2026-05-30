import { describe, expect, it } from "vitest";
import { summarizeCategories } from "./categories";
import type { ScanItem } from "../types";

const items: ScanItem[] = [
  {
    id: "cache-1",
    path: "/Users/test/Library/Caches/a",
    displayName: "a",
    category: "cache",
    sizeBytes: 100,
    risk: "low",
    reason: "缓存文件",
    defaultSelected: true
  },
  {
    id: "cache-2",
    path: "/Users/test/Library/Caches/b",
    displayName: "b",
    category: "cache",
    sizeBytes: 40,
    risk: "low",
    reason: "缓存文件",
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

describe("summarizeCategories", () => {
  it("groups scan items by category and preserves review counts", () => {
    expect(summarizeCategories(items)).toEqual([
      {
        category: "large_files",
        count: 1,
        defaultSelectedCount: 0,
        label: "大文件",
        reviewCount: 1,
        sizeBytes: 900
      },
      {
        category: "cache",
        count: 2,
        defaultSelectedCount: 2,
        label: "缓存",
        reviewCount: 0,
        sizeBytes: 140
      }
    ]);
  });
});


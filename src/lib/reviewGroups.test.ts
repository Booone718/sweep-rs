import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { groupItemsByFolder } from "./reviewGroups";
import type { ScanItem } from "../types";

const items: ScanItem[] = [
  {
    id: "cache-1",
    path: "/Users/test/Library/Caches/App/a.tmp",
    displayName: "a.tmp",
    category: "cache",
    sizeBytes: 120,
    risk: "low",
    reason: "缓存",
    defaultSelected: true
  },
  {
    id: "cache-2",
    path: "/Users/test/Library/Caches/App/b.tmp",
    displayName: "b.tmp",
    category: "logs",
    sizeBytes: 80,
    risk: "review",
    reason: "日志",
    defaultSelected: false
  },
  {
    id: "download-1",
    path: "/Users/test/Downloads/pkg.dmg",
    displayName: "pkg.dmg",
    category: "downloads",
    sizeBytes: 300,
    risk: "review",
    reason: "下载残留",
    defaultSelected: false
  }
];

describe("review folder groups", () => {
  it("aggregates scan items by parent folder with size, count, risk, and category labels", () => {
    const groups = groupItemsByFolder(items);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      id: "/Users/test/Downloads",
      path: "/Users/test/Downloads",
      displayName: "Downloads",
      itemCount: 1,
      totalBytes: 300,
      risk: "review",
      categoryLabel: "下载残留"
    });
    expect(groups[1]).toMatchObject({
      id: "/Users/test/Library/Caches/App",
      path: "/Users/test/Library/Caches/App",
      displayName: "App",
      itemCount: 2,
      totalBytes: 200,
      risk: "review",
      categoryLabel: "多个分类"
    });
  });

  it("aggregates many files in one folder without repeated full-folder scans", () => {
    const manyItems: ScanItem[] = Array.from({ length: 10_000 }, (_, index) => ({
      id: `cache-${index}`,
      path: `/Users/test/Library/Caches/Huge/item-${index}.tmp`,
      displayName: `item-${index}.tmp`,
      category: index % 2 === 0 ? "cache" : "logs",
      sizeBytes: 1,
      risk: "low",
      reason: "缓存",
      defaultSelected: true
    }));

    const started = performance.now();
    const groups = groupItemsByFolder(manyItems);
    const elapsedMs = performance.now() - started;

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      itemCount: 10_000,
      totalBytes: 10_000,
      categoryLabel: "多个分类"
    });
    expect(elapsedMs).toBeLessThan(200);
  });
});

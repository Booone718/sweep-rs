import { describe, expect, it } from "vitest";
import { createInitialSelection, setItemsSelected, toggleCategory, toggleItem } from "./selection";
import type { ScanItem } from "../types";

const items: ScanItem[] = [
  {
    id: "low-cache",
    path: "/Users/test/Library/Caches/low",
    displayName: "low",
    category: "cache",
    sizeBytes: 10,
    risk: "low",
    reason: "缓存",
    defaultSelected: true
  },
  {
    id: "large-review",
    path: "/Users/test/Downloads/video.mov",
    displayName: "video.mov",
    category: "large_files",
    sizeBytes: 20,
    risk: "review",
    reason: "大文件",
    defaultSelected: false
  },
  {
    id: "browser-review",
    path: "/Users/test/Library/Caches/Google/Chrome",
    displayName: "Chrome",
    category: "browser_cache",
    sizeBytes: 30,
    risk: "review",
    reason: "浏览器缓存",
    defaultSelected: false
  }
];

describe("selection helpers", () => {
  it("selects only low-risk default items after scan", () => {
    expect([...createInitialSelection(items)]).toEqual(["low-cache"]);
  });

  it("toggles one item without changing other selections", () => {
    const selection = createInitialSelection(items);
    expect([...toggleItem(selection, "large-review")].sort()).toEqual(["large-review", "low-cache"]);
  });

  it("selects and clears whole categories", () => {
    const initial = createInitialSelection(items);
    const selectedLarge = toggleCategory(initial, items, "large_files", true);
    expect([...selectedLarge].sort()).toEqual(["large-review", "low-cache"]);

    const clearedCache = toggleCategory(selectedLarge, items, "cache", false);
    expect([...clearedCache]).toEqual(["large-review"]);
  });

  it("selects and clears an arbitrary batch of items", () => {
    const initial = createInitialSelection(items);
    const selectedBatch = setItemsSelected(initial, items.slice(1), true);
    expect([...selectedBatch].sort()).toEqual(["browser-review", "large-review", "low-cache"]);

    const clearedBatch = setItemsSelected(selectedBatch, items.slice(0, 2), false);
    expect([...clearedBatch]).toEqual(["browser-review"]);
  });
});

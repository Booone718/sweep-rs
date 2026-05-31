import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { ScanReport, UserSettings } from "./types";

const report: ScanReport = {
  sessionId: "scan-1",
  totalBytes: 940,
  permissionWarnings: [],
  duplicateGroups: [],
  appResidueGroups: [],
  items: [
    {
      id: "cache-1",
      path: "/Users/test/Library/Caches/a",
      displayName: "a",
      category: "cache",
      sizeBytes: 100,
      risk: "low",
      reason: "缓存文件，可安全移到废纸篓",
      defaultSelected: true
    },
    {
      id: "large-1",
      path: "/Users/test/Movies/big.mov",
      displayName: "big.mov",
      category: "large_files",
      sizeBytes: 840,
      risk: "review",
      reason: "大文件，需要手动确认",
      defaultSelected: false
    }
  ]
};

const settings: UserSettings = {
  exclusions: [],
  includeBrowserCaches: true,
  includeLargeFiles: true,
  includeProtectedUserFolders: false,
  largeFileThresholdBytes: 1_000_000_000
};

const api = vi.hoisted(() => ({
  startScan: vi.fn(),
  getScanReport: vi.fn(),
  cleanItems: vi.fn(),
  getSettings: vi.fn(),
  getHistory: vi.fn(),
  openTrash: vi.fn(),
  revealPath: vi.fn(),
  updateSettings: vi.fn(),
  onScanProgress: vi.fn()
}));

vi.mock("./api", () => api);

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSettings.mockResolvedValue(settings);
    api.getHistory.mockResolvedValue([]);
    api.startScan.mockResolvedValue("scan-1");
    api.getScanReport.mockResolvedValue(report);
    api.cleanItems.mockResolvedValue({ cleanedBytes: 100, movedItemCount: 1, failedItems: [] });
    api.onScanProgress.mockResolvedValue(() => undefined);
  });

  it("shows a Chinese local-first dashboard before scanning", async () => {
    render(<App />);

    expect(await screen.findByText("Sweep")).toBeInTheDocument();
    expect(screen.getByText("本地优先，不上传文件名或扫描结果。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始扫描" })).toBeInTheDocument();
  });

  it("loads scan results into category cards and selects only low-risk items by default", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));

    await waitFor(() => expect(api.getScanReport).toHaveBeenCalledWith("scan-1"));
    expect(screen.getByRole("heading", { name: "缓存" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "大文件" })).toBeInTheDocument();
    expect(screen.getByText("已默认选择 1 项低风险内容")).toBeInTheDocument();
    expect(screen.getByText("已选择 100 B")).toBeInTheDocument();
  });

  it("shows selected bytes by category and opens a selected-only review", async () => {
    api.getScanReport.mockResolvedValue({
      ...report,
      totalBytes: 1_370,
      items: [
        {
          id: "cache-1",
          path: "/Users/test/Library/Caches/a",
          displayName: "a",
          category: "cache",
          sizeBytes: 100,
          risk: "low",
          reason: "缓存",
          defaultSelected: true
        },
        {
          id: "log-1",
          path: "/Users/test/Library/Logs/app.log",
          displayName: "app.log",
          category: "logs",
          sizeBytes: 300,
          risk: "low",
          reason: "日志",
          defaultSelected: true
        },
        {
          id: "crash-1",
          path: "/Users/test/Library/Logs/DiagnosticReports/app.crash",
          displayName: "app.crash",
          category: "crash_reports",
          sizeBytes: 70,
          risk: "low",
          reason: "崩溃报告",
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
      ]
    });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));

    expect(await screen.findByTestId("selected-breakdown")).toHaveTextContent("缓存100 B");
    expect(screen.getByTestId("selected-breakdown")).toHaveTextContent("日志300 B");
    expect(screen.getByTestId("selected-breakdown")).toHaveTextContent("崩溃报告70 B");

    fireEvent.click(screen.getByRole("button", { name: "查看已选择" }));

    expect(await screen.findByText("app.log")).toBeInTheDocument();
    expect(screen.getByText("已显示 3 / 3 项")).toBeInTheDocument();
    expect(screen.queryByText("big.mov")).not.toBeInTheDocument();
  });

  it("shows live scan progress with the current folder and checked file count", async () => {
    let progressHandler: (event: { currentPath: string; scannedFiles: number; matchedItems: number }) => void = () => {};
    api.onScanProgress.mockImplementation((handler) => {
      progressHandler = handler;
      return Promise.resolve(() => undefined);
    });
    api.getScanReport.mockImplementation(() => new Promise(() => undefined));

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));

    act(() => progressHandler({
      currentPath: "/Users/test/Library/Caches",
      scannedFiles: 420,
      matchedItems: 13
    }));

    expect(await screen.findByText("正在扫描 /Users/test/Library/Caches")).toBeInTheDocument();
    expect(screen.getByText("已检查 420 个文件，发现 13 项候选")).toBeInTheDocument();
  });

  it("limits the initial review render for large scan reports", async () => {
    const manyItems: ScanReport["items"] = Array.from({ length: 640 }, (_, index) => ({
      id: `cache-${index}`,
      path: `/Users/test/Library/Caches/item-${index}.tmp`,
      displayName: `item-${index}.tmp`,
      category: "cache",
      sizeBytes: 10,
      risk: "low",
      reason: "缓存",
      defaultSelected: true
    }));
    api.getScanReport.mockResolvedValue({ ...report, items: manyItems, totalBytes: 6400 });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));
    fireEvent.click(await screen.findByRole("button", { name: "审阅" }));

    expect(await screen.findByText("已显示 250 / 640 项")).toBeInTheDocument();
    expect(screen.getAllByTestId("review-row")).toHaveLength(250);
  });

  it("opens review filtered to a category when a dashboard category is clicked", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));

    fireEvent.click(await screen.findByRole("button", { name: /大文件/ }));

    expect(await screen.findByText("big.mov")).toBeInTheDocument();
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    expect(screen.getByText("/Users/test/Movies/big.mov")).toBeInTheDocument();
  });

  it("filters review rows with the category buttons", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));
    fireEvent.click(await screen.findByRole("button", { name: "审阅" }));
    fireEvent.click(await screen.findByRole("button", { name: "大文件" }));

    expect(await screen.findByText("big.mov")).toBeInTheDocument();
    expect(screen.queryByText("a")).not.toBeInTheDocument();
  });

  it("selects and clears all items in the current review filter", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));
    fireEvent.click(await screen.findByRole("button", { name: "审阅" }));

    expect(await screen.findByRole("checkbox", { name: /a/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /big.mov/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "选择当前" }));
    expect(screen.getByRole("checkbox", { name: /a/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /big.mov/ })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "取消当前" }));
    expect(screen.getByRole("checkbox", { name: /a/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /big.mov/ })).not.toBeChecked();
  });

  it("groups review items by folder and toggles a whole folder", async () => {
    api.getScanReport.mockResolvedValue({
      ...report,
      totalBytes: 500,
      items: [
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
      ]
    });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));
    fireEvent.click(await screen.findByRole("button", { name: "审阅" }));
    fireEvent.click(await screen.findByRole("button", { name: "文件夹" }));

    expect(await screen.findByText("App")).toBeInTheDocument();
    expect(screen.getByText("/Users/test/Library/Caches/App")).toBeInTheDocument();
    expect(screen.getByText("2 项 · 已选择 1 项")).toBeInTheDocument();
    expect(screen.getByText("多个分类")).toBeInTheDocument();
    expect(screen.getAllByTestId("folder-row")).toHaveLength(2);

    fireEvent.click(screen.getByRole("checkbox", { name: /App/ }));
    expect(screen.getByText("2 项 · 已选择 2 项")).toBeInTheDocument();
  });

  it("refreshes history with scan summaries after a scan finishes", async () => {
    api.getHistory
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "scan-history",
          eventType: "scan",
          totalBytes: 940,
          itemCount: 2,
          cleanedBytes: 0,
          movedItemCount: 0,
          createdAt: "2026-05-30T15:25:00Z"
        }
      ]);

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "开始扫描" }));
    fireEvent.click(await screen.findByRole("button", { name: "历史" }));

    expect(await screen.findByText("扫描记录")).toBeInTheDocument();
    expect(screen.getByText("发现 2 项候选")).toBeInTheDocument();
    expect(screen.getByText("940 B")).toBeInTheDocument();
  });
});

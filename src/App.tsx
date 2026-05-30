import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eraser,
  Eye,
  FileSearch,
  FolderOpen,
  HardDrive,
  History,
  Loader2,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  cleanItems,
  getHistory,
  getScanReport,
  getSettings,
  openTrash,
  onScanProgress,
  revealPath,
  startScan,
  updateSettings,
  type HistoryEntry,
  type ScanProgress
} from "./api";
import { CATEGORY_LABELS, summarizeCategories } from "./lib/categories";
import { formatBytes, formatItemCount } from "./lib/format";
import { waitForScanReport } from "./lib/polling";
import { createInitialSelection, toggleItem } from "./lib/selection";
import type { CleanReport, CleanupCategory, ScanItem, ScanReport, UserSettings } from "./types";

type View = "overview" | "review" | "history" | "settings";
type RunState = "idle" | "scanning" | "ready" | "cleaning" | "cleaned" | "error";
type CategoryFilter = CleanupCategory | "all" | "selected";
const REVIEW_BATCH_SIZE = 250;

const DEFAULT_SETTINGS: UserSettings = {
  exclusions: [],
  includeBrowserCaches: true,
  includeLargeFiles: true,
  includeProtectedUserFolders: false,
  largeFileThresholdBytes: 1024 * 1024 * 1024
};

const CATEGORY_ACCENTS: Record<CleanupCategory, string> = {
  cache: "#17a589",
  logs: "#5b8def",
  crash_reports: "#f39c12",
  trash: "#ef476f",
  downloads: "#06b6d4",
  browser_cache: "#8e7cc3",
  large_files: "#ff7a59",
  duplicates: "#2f855a",
  ios_backups: "#3b82f6",
  app_residue: "#d946ef"
};

const CATEGORY_DESCRIPTIONS: Record<CleanupCategory, string> = {
  cache: "系统和应用缓存，可重新生成。",
  logs: "历史日志，默认按低风险处理。",
  crash_reports: "旧崩溃报告，帮助定位过往问题。",
  trash: "废纸篓内容，清理前仍需确认。",
  downloads: "安装包、压缩包和下载残留。",
  browser_cache: "浏览器缓存，不含 Cookie、历史记录和密码。",
  large_files: "占用空间较大的用户文件，必须手动确认。",
  duplicates: "内容相同的重复文件组，默认不选择。",
  ios_backups: "旧 iPhone/iPad 备份，清理前手动确认。",
  app_residue: "已卸载应用留下的支持文件和缓存。"
};

function riskLabel(item: ScanItem): string {
  if (item.risk === "low") {
    return "低风险";
  }
  if (item.risk === "review") {
    return "需确认";
  }
  return "高风险";
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [runState, setRunState] = useState<RunState>("idle");
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [cleanReport, setCleanReport] = useState<CleanReport | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [reviewFilter, setReviewFilter] = useState<CategoryFilter>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS));
    void getHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onScanProgress((progress) => {
      if (!disposed) {
        setScanProgress(progress);
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const summaries = useMemo(() => summarizeCategories(report?.items ?? []), [report]);
  const selectedItems = useMemo(() => {
    if (!report) {
      return [];
    }
    return report.items.filter((item) => selection.has(item.id));
  }, [report, selection]);
  const selectedSummaries = useMemo(() => summarizeCategories(selectedItems), [selectedItems]);
  const selectedBytes = selectedItems.reduce((sum, item) => sum + item.sizeBytes, 0);
  const defaultSelectedCount = report?.items.filter((item) => item.defaultSelected && item.risk === "low").length ?? 0;

  async function handleStartScan() {
    setRunState("scanning");
    setError(null);
    setCleanReport(null);
    setScanProgress({
      phase: "starting",
      currentPath: settings.includeProtectedUserFolders ? "准备扫描用户目录" : "准备扫描安全目录",
      scannedFiles: 0,
      matchedItems: 0
    });
    setView("overview");

    try {
      const sessionId = await startScan(settings);
      const nextReport = await waitForScanReport(sessionId, getScanReport);
      setReport(nextReport);
      setSelection(createInitialSelection(nextReport.items));
      setScanProgress(null);
      setRunState("ready");
      setHistory(await getHistory().catch(() => history));
    } catch (scanError) {
      setRunState("error");
      setError(scanError instanceof Error ? scanError.message : "扫描失败");
    }
  }

  async function handleClean() {
    if (!report || selection.size === 0) {
      return;
    }

    setRunState("cleaning");
    setError(null);
    try {
      const result = await cleanItems({ sessionId: report.sessionId, itemIds: [...selection] });
      setCleanReport(result);
      setRunState("cleaned");
      setHistory(await getHistory().catch(() => history));
    } catch (cleanError) {
      setRunState("error");
      setError(cleanError instanceof Error ? cleanError.message : "清理失败");
    }
  }

  async function handleToggleBrowserCache() {
    const next = { ...settings, includeBrowserCaches: !settings.includeBrowserCaches };
    setSettings(next);
    await updateSettings(next).catch(() => undefined);
  }

  async function handleToggleProtectedUserFolders() {
    const next = { ...settings, includeProtectedUserFolders: !settings.includeProtectedUserFolders };
    setSettings(next);
    await updateSettings(next).catch(() => undefined);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <h1>Sweep</h1>
            <p>macOS 深度清理</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            <HardDrive size={18} />
            概览
          </button>
          <button className={view === "review" ? "active" : ""} onClick={() => setView("review")} disabled={!report}>
            <Eye size={18} />
            审阅
          </button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
            <History size={18} />
            历史
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
            <Settings size={18} />
            设置
          </button>
        </nav>

        <section className="privacy-note">
          <ShieldCheck size={18} />
          <span>本地优先，不上传文件名或扫描结果。</span>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">安全审阅式清理</p>
            <h2>{view === "overview" ? "让 Mac 轻一点，但每一步都看得见" : "清理前先确认"}</h2>
          </div>
          <div className="topbar-actions">
            <button className="ghost-button" onClick={() => void openTrash()}>
              <ArchiveRestore size={17} />
              打开废纸篓
            </button>
            <button className="primary-button" onClick={() => void handleStartScan()} disabled={runState === "scanning"}>
              {runState === "scanning" ? <Loader2 className="spin" size={18} /> : <FileSearch size={18} />}
              {runState === "scanning" ? "扫描中" : "开始扫描"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="alert">
            <AlertTriangle size={18} />
            {error}
          </div>
        ) : null}

        {view === "overview" ? (
          <Overview
            defaultSelectedCount={defaultSelectedCount}
            onClean={() => void handleClean()}
            onOpenCategory={(category) => {
              setReviewFilter(category);
              setView("review");
            }}
            onOpenSelected={() => {
              setReviewFilter("selected");
              setView("review");
            }}
            includeProtectedUserFolders={settings.includeProtectedUserFolders}
            report={report}
            runState={runState}
            scanProgress={scanProgress}
            selectedBytes={selectedBytes}
            selectedCount={selection.size}
            selectedSummaries={selectedSummaries}
            summaries={summaries}
            cleanReport={cleanReport}
          />
        ) : null}

        {view === "review" && report ? (
          <Review
            categoryFilter={reviewFilter}
            items={report.items}
            selection={selection}
            onFilterChange={setReviewFilter}
            onReveal={(path) => void revealPath(path)}
            onToggleItem={(id) => setSelection((current) => toggleItem(current, id))}
          />
        ) : null}

        {view === "history" ? <HistoryView entries={history} /> : null}

        {view === "settings" ? (
          <SettingsView
            settings={settings}
            onToggleBrowserCache={() => void handleToggleBrowserCache()}
            onToggleProtectedUserFolders={() => void handleToggleProtectedUserFolders()}
            onThresholdChange={(largeFileThresholdBytes) => {
              const next = { ...settings, largeFileThresholdBytes };
              setSettings(next);
              void updateSettings(next);
            }}
          />
        ) : null}
      </section>
    </main>
  );
}

type OverviewProps = {
  report: ScanReport | null;
  summaries: ReturnType<typeof summarizeCategories>;
  selectedSummaries: ReturnType<typeof summarizeCategories>;
  selectedBytes: number;
  selectedCount: number;
  defaultSelectedCount: number;
  runState: RunState;
  cleanReport: CleanReport | null;
  scanProgress: ScanProgress | null;
  includeProtectedUserFolders: boolean;
  onOpenCategory: (category: CleanupCategory) => void;
  onOpenSelected: () => void;
  onClean: () => void;
};

function Overview({
  report,
  summaries,
  selectedSummaries,
  selectedBytes,
  selectedCount,
  defaultSelectedCount,
  runState,
  cleanReport,
  scanProgress,
  includeProtectedUserFolders,
  onOpenCategory,
  onOpenSelected,
  onClean
}: OverviewProps) {
  return (
    <div className="overview-grid">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">可清理空间</p>
          <strong>{formatBytes(report?.totalBytes ?? 0)}</strong>
          <span>
            {includeProtectedUserFolders
              ? "已开启完整用户目录扫描。深度项默认只展示，不会自动选择。"
              : "默认避开下载、桌面、文稿等隐私目录；可在设置开启完整扫描。"}
          </span>
        </div>
        <div className="selection-meter">
          <span>已选择 {formatBytes(selectedBytes)}</span>
          <small>已默认选择 {defaultSelectedCount} 项低风险内容</small>
          {selectedSummaries.length > 0 ? (
            <div className="selected-breakdown" data-testid="selected-breakdown">
              {selectedSummaries.slice(0, 5).map((summary) => (
                <div className="selected-breakdown-row" key={summary.category}>
                  <span>
                    <i style={{ backgroundColor: CATEGORY_ACCENTS[summary.category] }} />
                    {summary.label}
                  </span>
                  <strong>{formatBytes(summary.sizeBytes)}</strong>
                </div>
              ))}
              {selectedSummaries.length > 5 ? <small>还有 {selectedSummaries.length - 5} 类已选择项目</small> : null}
            </div>
          ) : (
            <small>暂无已选择项目</small>
          )}
          <button className="ghost-button selected-review-button" disabled={!report || selectedCount === 0} onClick={onOpenSelected}>
            查看已选择
          </button>
          <button className="danger-button" disabled={!report || selectedCount === 0 || runState === "cleaning"} onClick={onClean}>
            {runState === "cleaning" ? <Loader2 className="spin" size={18} /> : <Trash2 size={18} />}
            移到废纸篓
          </button>
        </div>
      </section>

      {cleanReport ? (
        <section className="success-strip">
          <CheckCircle2 size={18} />
          已移动 {formatItemCount(cleanReport.movedItemCount)} 到废纸篓，释放候选空间 {formatBytes(cleanReport.cleanedBytes)}。
        </section>
      ) : null}

      {runState === "scanning" ? <ScanProgressPanel progress={scanProgress} /> : null}

      <section className="category-grid">
        {summaries.length === 0 ? (
          <div className="empty-state">
            <Eraser size={30} />
            <h3>先扫描，再审阅</h3>
            <p>扫描完成后会按缓存、下载残留、重复文件、大文件和应用残留分类展示。</p>
          </div>
        ) : (
          summaries.map((summary) => (
            <button className="category-card" key={summary.category} onClick={() => onOpenCategory(summary.category)}>
              <div className="category-icon" style={{ backgroundColor: CATEGORY_ACCENTS[summary.category] }}>
                <ChevronRight size={18} />
              </div>
              <div>
                <h3>{summary.label}</h3>
                <p>{CATEGORY_DESCRIPTIONS[summary.category]}</p>
              </div>
              <strong>{formatBytes(summary.sizeBytes)}</strong>
              <span>
                {formatItemCount(summary.count)} · {summary.reviewCount > 0 ? `${summary.reviewCount} 项需确认` : "低风险"}
              </span>
            </button>
          ))
        )}
      </section>
    </div>
  );
}

function ScanProgressPanel({ progress }: { progress: ScanProgress | null }) {
  const currentPath = progress?.currentPath ?? "准备扫描用户目录";
  const scannedFiles = progress?.scannedFiles ?? 0;
  const matchedItems = progress?.matchedItems ?? 0;

  return (
    <section className="scan-progress-panel">
      <div>
        <span className="pulse-dot" />
        <strong>正在扫描 {currentPath}</strong>
      </div>
      <p>
        已检查 {scannedFiles} 个文件，发现 {matchedItems} 项候选
      </p>
    </section>
  );
}

type ReviewProps = {
  categoryFilter: CategoryFilter;
  items: ScanItem[];
  selection: Set<string>;
  onFilterChange: (filter: CategoryFilter) => void;
  onToggleItem: (id: string) => void;
  onReveal: (path: string) => void;
};

function Review({ categoryFilter, items, selection, onFilterChange, onToggleItem, onReveal }: ReviewProps) {
  const categories = summarizeCategories(items);
  const filteredItems =
    categoryFilter === "selected"
      ? items.filter((item) => selection.has(item.id))
      : categoryFilter === "all"
        ? items
        : items.filter((item) => item.category === categoryFilter);
  const [visibleCount, setVisibleCount] = useState(REVIEW_BATCH_SIZE);
  const visibleItems = filteredItems.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(REVIEW_BATCH_SIZE);
  }, [categoryFilter, items]);

  return (
    <section className="review-layout">
      <div className="review-toolbar">
        <div className="review-filters">
          <button
            className={categoryFilter === "all" ? "active" : ""}
            onClick={() => onFilterChange("all")}
            aria-pressed={categoryFilter === "all"}
          >
            全部
          </button>
          <button
            className={categoryFilter === "selected" ? "active" : ""}
            onClick={() => onFilterChange("selected")}
            aria-pressed={categoryFilter === "selected"}
          >
            已选择
          </button>
          {categories.map((category) => (
            <button
              className={categoryFilter === category.category ? "active" : ""}
              key={category.category}
              onClick={() => onFilterChange(category.category)}
              aria-pressed={categoryFilter === category.category}
            >
              <span style={{ backgroundColor: CATEGORY_ACCENTS[category.category] }} />
              {category.label}
            </button>
          ))}
        </div>
        <p>已显示 {Math.min(visibleCount, filteredItems.length)} / {filteredItems.length} 项</p>
      </div>
      <div className="review-table">
        {visibleItems.map((item) => (
          <article className="review-row" data-testid="review-row" key={item.id}>
            <label>
              <input checked={selection.has(item.id)} onChange={() => onToggleItem(item.id)} type="checkbox" />
              <span className="file-identity">
                <strong>{item.displayName}</strong>
                <small>{item.path}</small>
              </span>
            </label>
            <span className={`risk-badge ${item.risk}`}>{riskLabel(item)}</span>
            <span>{CATEGORY_LABELS[item.category]}</span>
            <strong>{formatBytes(item.sizeBytes)}</strong>
            <p>{item.reason}</p>
            <button className="icon-button" title="在 Finder 中显示" onClick={() => onReveal(item.path)}>
              <FolderOpen size={17} />
            </button>
          </article>
        ))}
      </div>
      {visibleCount < filteredItems.length ? (
        <button
          className="ghost-button load-more-button"
          onClick={() => setVisibleCount((current) => Math.min(current + REVIEW_BATCH_SIZE, filteredItems.length))}
        >
          再显示 {Math.min(REVIEW_BATCH_SIZE, filteredItems.length - visibleCount)} 项
        </button>
      ) : null}
    </section>
  );
}

function HistoryView({ entries }: { entries: HistoryEntry[] }) {
  return (
    <section className="plain-panel">
      <h3>历史</h3>
      {entries.length === 0 ? (
        <p>还没有历史记录。应用只保存摘要，不保存完整文件清单。</p>
      ) : (
        entries.map((entry) => (
          <div className="history-row" key={entry.id}>
            <Clock3 size={17} />
            <span>
              <strong>{entry.eventType === "scan" ? "扫描记录" : "清理记录"}</strong>
              <small>{formatHistoryDate(entry.createdAt)}</small>
            </span>
            <strong>{formatBytes(entry.eventType === "scan" ? entry.totalBytes : entry.cleanedBytes)}</strong>
            <small>
              {entry.eventType === "scan"
                ? `发现 ${entry.itemCount} 项候选`
                : `移到废纸篓 ${formatItemCount(entry.movedItemCount)}`}
            </small>
          </div>
        ))
      )}
    </section>
  );
}

function formatHistoryDate(value: string): string {
  const parsed = /^\d+$/.test(value) ? new Date(Number(value) * 1000) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN");
}

type SettingsViewProps = {
  settings: UserSettings;
  onToggleBrowserCache: () => void;
  onToggleProtectedUserFolders: () => void;
  onThresholdChange: (bytes: number) => void;
};

function SettingsView({
  settings,
  onToggleBrowserCache,
  onToggleProtectedUserFolders,
  onThresholdChange
}: SettingsViewProps) {
  return (
    <section className="settings-grid">
      <label className="setting-card">
        <span>
          <strong>完整用户目录</strong>
          <small>扫描下载、桌面、文稿等目录；macOS 可能要求授权。</small>
        </span>
        <input
          checked={settings.includeProtectedUserFolders}
          onChange={onToggleProtectedUserFolders}
          type="checkbox"
        />
      </label>
      <label className="setting-card">
        <span>
          <strong>浏览器缓存</strong>
          <small>只清缓存和临时下载，不清 Cookie、历史记录或密码。</small>
        </span>
        <input checked={settings.includeBrowserCaches} onChange={onToggleBrowserCache} type="checkbox" />
      </label>
      <label className="setting-card">
        <span>
          <strong>大文件阈值</strong>
          <small>超过该大小的文件进入手动审阅。</small>
        </span>
        <select
          value={settings.largeFileThresholdBytes}
          onChange={(event) => onThresholdChange(Number(event.target.value))}
        >
          <option value={512 * 1024 * 1024}>512 MB</option>
          <option value={1024 * 1024 * 1024}>1 GB</option>
          <option value={2 * 1024 * 1024 * 1024}>2 GB</option>
        </select>
      </label>
    </section>
  );
}

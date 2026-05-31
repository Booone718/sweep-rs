import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

describe("scan progress layout guardrails", () => {
  it("keeps the main grid and workspace from expanding for long scan paths", () => {
    expect(css).toContain("grid-template-columns: 248px minmax(0, 1fr)");
    expect(css).toMatch(/\.workspace\s*\{[^}]*min-width:\s*0;/s);
    expect(css).toMatch(/\.overview-grid\s*\{[^}]*min-width:\s*0;/s);
  });

  it("truncates long scan paths inside the progress panel", () => {
    expect(css).toMatch(/\.scan-progress-panel\s*\{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.scan-progress-panel div\s*\{[^}]*flex:\s*1 1 auto;/s);
    expect(css).toMatch(/\.scan-progress-panel strong\s*\{[^}]*text-overflow:\s*ellipsis;/s);
  });

  it("keeps the sidebar viewport-bound while the workspace owns scrolling", () => {
    expect(css).toMatch(/body\s*\{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.app-shell\s*\{[^}]*height:\s*100vh;/s);
    expect(css).toMatch(/\.sidebar\s*\{[^}]*height:\s*100vh;/s);
    expect(css).toMatch(/\.workspace\s*\{[^}]*overflow-y:\s*auto;/s);
  });

  it("reserves review filter and scrollbar space to prevent category jumps", () => {
    expect(css).toMatch(/\.workspace\s*\{[^}]*scrollbar-gutter:\s*stable;/s);
    expect(css).toMatch(/\.review-filters\s*\{[^}]*min-height:\s*82px;/s);
    expect(css).toMatch(/\.review-toolbar p\s*\{[^}]*width:\s*150px;/s);
  });
});

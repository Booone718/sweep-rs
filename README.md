# Sweep

Sweep is a local-first macOS cleanup app built with Tauri 2, Rust, React, and TypeScript. It is designed for review-first cleanup: scan the machine, group candidates by category or folder, explain the risk, and move only the selected items to the macOS Trash.

> Sweep is currently early-stage software. The first release targets Apple Silicon Macs. Local builds are not Apple-signed or notarized yet.

## Features

- Scans common cleanup targets such as caches, logs, crash reports, downloads, browser caches, large files, duplicate files, iOS backups, and app leftovers.
- Keeps cleanup recoverable by moving selected items to Trash instead of permanently deleting them.
- Selects low-risk items by default while requiring manual confirmation for high-risk or review-needed files.
- Provides a review page with file-level and folder-level views.
- Supports category filters, batch select, and batch deselect for the current review scope.
- Shows the selected cleanup size and category breakdown before cleanup.
- Stores scan and cleanup summary history without storing full scan result manifests.
- Remembers the app window size between launches.
- Avoids macOS privacy-protected folders during extended user-directory scans to reduce permission prompts.
- Runs locally and does not upload paths, filenames, scan results, or telemetry by default.

## Install

Download the latest `Sweep_0.1.0_aarch64.dmg` from GitHub Releases, open it, and drag `Sweep.app` into Applications.

If macOS reports that the app is from an unidentified developer, it is because this early build is not signed or notarized. You can allow it from System Settings, or build the app locally from source.

## Safety Model

Sweep v0.1.0 only works with paths available to the current user. It does not install a privileged helper, request administrator access, or perform system-level deletion.

Browser cleanup is limited to caches and temporary download residue. Sweep does not clean browser cookies, history, passwords, sessions, or site data.

## Review Workflow

1. Start a scan from the overview page.
2. Review candidates by category.
3. Switch between file and folder views when a category contains many items.
4. Select or deselect individual items, folder groups, or the current filtered result set.
5. Move selected items to Trash.

## Development

Requirements:

- macOS
- Node.js
- Rust stable
- Native build tools required by Tauri 2

Install dependencies:

```bash
npm install
```

Run the Tauri development app:

```bash
npm run tauri -- dev
```

Run frontend tests:

```bash
npm test
```

Run Rust tests:

```bash
cd src-tauri
cargo test
```

Build the macOS app and installer:

```bash
npm run tauri -- build
```

Build outputs are written under:

```text
src-tauri/target/release/bundle/
```

## Tech Stack

- Tauri 2
- Rust
- React
- TypeScript
- Vite
- Vitest

## License

MIT License. See [LICENSE](LICENSE).

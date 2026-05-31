# Agent Instructions

This file gives AI agents and contributors the project-specific rules needed to work safely in this repository.

## Project Shape

- Sweep is a local-first macOS cleanup app.
- The desktop shell is Tauri 2.
- Frontend code lives under `src/` and uses React, TypeScript, Vite, and Vitest.
- Rust/Tauri code lives under `src-tauri/src/`.
- Rust integration tests live under `src-tauri/tests/`.
- The Chinese README is the primary README: `README.md`.
- The English README is `README.en.md`.

## Product Boundaries

- Keep cleanup recoverable. Selected items should move to the macOS Trash, not be permanently deleted.
- Do not add telemetry, analytics, remote logging, or uploads of paths, filenames, scan results, or history.
- Do not request administrator privileges or add a privileged helper without explicit user direction.
- Browser cleanup must stay limited to caches and temporary download residue. Do not clean cookies, history, passwords, sessions, or site data.
- Extended user-directory scans should avoid macOS privacy-protected folders that trigger permission prompts.
- When changing scan behavior, keep risk labels conservative. Low-risk items may be selected by default; review or high-risk items should require user confirmation.

## Documentation Rules

- Keep `README.md` and `README.en.md` aligned when user-facing behavior changes.
- Preserve Chinese-first documentation unless the user explicitly asks otherwise.
- If release filenames or versions change, update both README files.
- Keep `LICENSE` referenced from both README files.

## Version And Release Rules

- Do not overwrite an existing release tag.
- For a new public build, bump all app-facing version fields together:
  - `package.json`
  - `package-lock.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/Cargo.lock`
  - `src-tauri/tauri.conf.json`
- After a version bump, rebuild the Tauri bundle and upload the matching DMG asset.

## Verification

Run the checks that match the scope of the change:

```bash
npm test
cd src-tauri && cargo test
npm run tauri -- build
```

For frontend-only changes, at minimum run:

```bash
npm test
npm run build
```

For release work, run the full verification set and confirm the generated DMG path under:

```text
src-tauri/target/release/bundle/dmg/
```

## Git Hygiene

- Check `git status --short` before staging.
- Stage only files that belong to the requested change.
- Do not rewrite public history unless the user explicitly requests it.
- Do not push secrets, local runtime state, generated caches, or unrequested build artifacts.

# Pomi

An offline focus timer for iPhone: React, TypeScript and Vite, wrapped with Capacitor, with the iOS project under `ios/`. The desktop version is a separate project, Pomi Desktop.

## Commands

Run `npm install` first; the Xcode build also needs it.

- **Quick check:** `bash .claude/check.sh` (`npm test` and `npm run build`). It runs by itself when a builder finishes.
- **Work on the screens safely:** `npm run dev`. A browser with its own storage, not the phone's database.
- **Copy the web build into the iOS project:** `npm run ios:sync`. Run it before any iOS build.
- **Simulator and phone builds:** the exact commands are in `CLAUDE.local.md`.

## Safety

- **This repository is public on GitHub.** Signing team ids, device names, account handles and local paths stay out of tracked files; they belong in `CLAUDE.local.md`.
- **The working copy holds unsaved work of the owner's that includes his signing team id** (the Xcode project file, `PLAN.md` and files under `docs/`). Committing or pushing those files publishes it. Settle that with the owner before committing them.
- **History lives in SQLite on the phone** (`pomiSQLite.db` in the app's own folder) and settings in Capacitor Preferences. Deleting the app deletes the history; there is no backup or export.
- **The bundle id must stay the same.** A new id is a separate app with empty history.
- **Database upgrades** are steps in `MIGRATIONS` in `src/services/persistence.ts`, numbered by `PRAGMA user_version`. The schema stays identical to Pomi Desktop's.
- **Tests use in-memory databases** and never touch a phone or simulator.
- **`scripts/seed-simulator.py`** writes sample history into the booted simulator's copy of the app. Run it with the app quit.
- **Generated, leave alone:** `ios/App/App/public/`, `ios/App/App/capacitor.config.json`, `ios/App/App/config.xml`, `ios/App/CapApp-SPM/Package.swift`, `ios/App/DerivedData/`.
- **`support-site/`** is its own git repository inside this folder.
- **`ui-trials/cleanup-2026-09-23/restore.py`** rewrites source files.

## Gotchas

- `src/domain`, `src/ui`, `src/screens` and `src/content` were copied by hand into Pomi Desktop. The copies have drifted, and a change to shared code has to be carried across by hand.
- One failed save blocks every later save until the app reloads; the app then shows a recovery screen.
- Tag changes, History retagging, deleting a block and settings are saved outside `saveRuntime`.
- Timer and block ids are built from timestamps on purpose, so replay and notifications agree.
- The browser build uses localStorage, so browser checks do not exercise the phone's storage.
- No shared Xcode scheme is in the repository; `-scheme App` relies on the one Xcode creates.

## Where to look

- `docs/app-facts.md`: what the app does today, what is unfinished, and the words it uses, read from the code on 2026-09-29.
- `PLAN.md`, `design_handoff_pomi_v2/`, `docs/sync-plan.md`, `docs/device-install-workflow.md`, `docs/app-store-submission.md`: The owner's plans, designs and how-tos. They describe what he intends; parts are out of date.
- `CLAUDE.local.md`: details of this Mac, including the simulator and phone build commands. Not in git.
- The instruction file from before 2026-09-29 is in `~/claude-code-kit/projects/pomi/old-files/`.

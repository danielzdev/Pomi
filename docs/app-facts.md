# Pomi: facts from the code (2026-09-29)

Repo: `~/Documents/ChatGPT/Pomi` (GitHub `danielzdev/Pomi`, public). Paths below are
relative to it. Read on disk as-is: the working copy has 40 uncommitted entries (24 modified tracked
files, the rest untracked, including `src/domain/runtime.ts`, `docs/`, `scripts/`, `AGENTS.md`).
Last commit `c46a651` (2026-09-22). Nothing was built, run or changed.

## 1. What it does today

- Run a Pomodoro "block": focus sessions, short breaks between them, and a long break at the end. You set the session, short and long break lengths and sessions per block (1-999 min, 1-99 sessions).
- Length changes apply to the next block, not the one already running.
- When a phase ends, a full-screen "session over / break over / block finished" screen appears. Breaks and sessions can start by themselves after a 5-second countdown, which you can pause or skip.
- Pause, resume, end a session early, or skip a break.
- Use a stopwatch with laps instead. It stops itself at 24 hours.
- Close the app or lock the phone: the timer keeps its place. Reopening catches up on anything that finished while you were away.
- Get an iPhone notification when a focus session or break ends (if allowed).
- Choose one of five alert tones or Silent, with vibration, and keep the screen awake while running.
- Put several tags on what you are doing and change them mid-session. Tags have colours. You can create, rename, recolour and delete them (confirming first, unless turned off).
- See History: days of blocks and stopwatch runs with times, tags and a timeline. You can filter by tag, retag a session or part of one, and delete a whole block (cannot be undone).
- See Statistics by day, week, month or year: focus time, averages, a streak with an adjustable daily goal, streak history, time per tag, and your most used setup.
- Read the privacy policy offline, email support, or open the support website from Settings.
- Text size follows the iPhone's text size setting. The app is iPhone only and portrait only.

## 2. Started but not finished

- **Alerts when the phone is locked:** there is no sound or vibration. The notification itself does arrive. This is deliberately deferred and not fixed (PLAN.md:176-180, 214, 309-313).
- **Alert tones** are synthesized placeholders (`src/services/alerts.ts:6`). WAVs are rendered by `scripts/generate-alert-tones.py` into `ios/App/App/NotificationSounds/`.
- **Undo toast plumbing** (`ToastState.action`, `src/App.tsx:29,88`) exists, but no caller passes an action. Tag and block deletes have no undo.
- **Unused legacy writers:** `saveActiveTimer`, `saveUiState`, `saveSession` and `saveBlock` (`src/services/persistence.ts:166-193,277,308`) are only used by tests. The app never calls them.
- **Stopwatch 24 h cap:** the timer stops in the app but no notification is sent (PLAN.md:148).
- **iCloud sync:** designed only, with no code (`docs/sync-plan.md:8-9`). Deferred: Live Activities, Dynamic Island, iPad/Mac/Watch, export and backup (PLAN.md:247-255).
- **Distribution:**
  - App Store submission is not done. The owner does it personally (PLAN.md:349-356).
  - No friend's phone has been installed yet (PLAN.md:196).
  - SQLCipher export compliance is still open (PLAN.md:213).
- **Repo merge with Pomi-Desktop:** decided, not started (PLAN.md:398-420).

## 3. Commands

| Command | Covers | Weight |
|---|---|---|
| `npm install` | deps; also needed before any Xcode build (SPM packages point into `node_modules`, `ios/App/CapApp-SPM/Package.swift`) | network, once |
| `npm test` | `vitest run`, Node env (`vite.config.ts`): 12 files, 63 tests (domain timer/flow/runtime/stats/blocks, notification planning, web persistence, and SQLite transactions against in-memory `node:sqlite`) | seconds |
| `npm run build` | `tsc -b` (typechecks all of `src`, tests included) + `vite build` → `dist/` | light |
| `npm run dev` | browser at Vite's port (5173 in `.claude/launch.json`). Uses the localStorage fallback, not SQLite | light |
| `npm run ios:sync` | build + `cap sync ios`: copies `dist/` into `ios/App/App/public/` and regenerates native config | light-medium |
| `npm run ios:open` | opens the Xcode project | — |
| `xcodebuild … -sdk iphonesimulator …` (AGENTS.md:20-25) | native simulator build/install/launch | heavy (minutes) |
| device build/install (docs/device-install-workflow.md:39-50) | signed Debug build to a paired phone | heavy |

- **Fastest real check:** `npm test`. `src/services/runtime-persistence.test.ts` runs the real SQL of `saveRuntime` through `node:sqlite` and simulates failed writes. Node v26 is installed. Older Node may lack unflagged `node:sqlite`, and README.md:9 says only "Node 22 or newer".

## 4. Safety facts

- **Real user data (phone):** SQLite through `@capacitor-community/sqlite`, file `Documents/pomiSQLite.db` in the app container (`scripts/seed-simulator.py:17`). Tables are `tags`, `sessions`, `blocks` and `app_state` (`src/services/persistence.ts:64-84,37`).
  - Settings are stored separately in Capacitor Preferences (iOS UserDefaults) under key `pomi.settings.v1` (`persistence.ts:8,147-155`).
  - Deleting the app deletes the history. No backup or export exists (docs/device-install-workflow.md:58-60).
- **Migrations:** inline in `persistence.ts:29-46` (`MIGRATIONS`), stepped by `PRAGMA user_version` up to `SCHEMA_VERSION = 2` (line 17, loop 85-88). Migration 2 is non-idempotent `ALTER TABLE ADD COLUMN`.
  - Settings shape migrations live in `src/domain/settings.ts:23-43` (`migrateSettings`).
  - `docs/sync-plan.md:37-38` says the desktop SQLite schema is identical; keep them in step.
- **How tests avoid real data:**
  - Capacitor, Preferences and SQLite are mocked with `vi.mock`, using an in-memory `DatabaseSync(':memory:')` (`runtime-persistence.test.ts:1-40`).
  - Web tests use an in-memory `Storage` (`persistence.test.ts:5-22`).
  - No test touches a device or simulator.
- **Seed script:** `scripts/seed-simulator.py` writes `INSERT OR REPLACE` rows into the *booted simulator's* live Pomi DB. It needs the app installed and launched once so tables exist, and it should run with the app quit.
- **Generated, do not hand-edit:**
  - `ios/App/App/public/`, `ios/App/App/capacitor.config.json` and `ios/App/App/config.xml` (all gitignored, `ios/.gitignore:4,12-13`).
  - `ios/App/CapApp-SPM/Package.swift` ("DO NOT MODIFY … managed by Capacitor CLI").
  - `ios/App/DerivedData/`.
- **Bundle id must stay stable:** changing it makes a separate app with empty history. It was already renamed once, uncommitted, from the old id (HEAD `capacitor.config.ts`) to the current one. The old app with beta history is still on the owner's phone (PLAN.md:388-397). Keep `capacitor.config.ts:4` and `PRODUCT_BUNDLE_IDENTIFIER` in `project.pbxproj:341,363` identical.
- **Nested repo:** `support-site/` is its own git repo (published separately) inside this untracked tree.
- **`ui-trials/cleanup-2026-09-23/restore.py`** can rewrite source files. Do not run it casually (PLAN.md:175-178).

## 5. Gotchas

- **Shared code with Pomi-Desktop is a manual copy.** There is no symlink, package or alias: `~/Pomi-Desktop/src/{domain,ui,screens,content}` are plain directories.
  - The copy was taken 2026-09-25 from this *uncommitted* working tree (PLAN.md:374-376). It includes untracked files like `src/domain/runtime.ts`, so GitHub `danielzdev/Pomi` lacks code the desktop relies on.
  - The copies have already diverged. Desktop changed `domain/types.ts` (desktop-only Settings fields), `domain/settings.ts`, `domain/settings.test.ts`, `ui/parts.tsx` and `screens/SettingsPanel.tsx`, and added `ui/esc.ts`. `content/privacy.ts` differs on purpose. Desktop logs these in its PLAN.md "Changes to shared code".
  - Changes here must be hand-ported, and desktop changes are not here. `docs/sync-plan.md` is kept as an identical copy in both repos by hand.
- **`saveRuntime` failures:** one failed `saveRuntime` rejects the promise chain, so every later runtime save also fails until the app reloads (`persistence.ts:120-145`). The app then shows a recovery screen (`App.tsx:69-73,329`).
- **Legacy runtime keys are never deleted:** old `pomi.active.v1` / `pomi.ui.v2` are read only when `pomi.runtime.v1` is missing (`persistence.ts:94-102`).
- **Deleted tags:** `deletedAt` on tags is a legacy soft-delete. It is purged on every launch before the timer is restored (`App.tsx:128-129`). New deletes are immediate and go through `saveRuntime`.
- **Deterministic ids:** Pomodoro timer and block ids come from timestamps (`block:${at}`, `${block.id}:${n}:${phase}`, `runtime.ts:33-35`), so replay and notification projection agree. Records use `INSERT OR IGNORE`, so re-saving is harmless. Don't switch them to random UUIDs.
- **Notifications:**
  - Notifications are planned by running the same `recoverRuntime` forward, capped at 60 pending (`notifications.ts:7-9,14-38`). Ids 41025-41084 are reserved.
  - `LocalNotifications.presentationOptions: []` (`capacitor.config.ts:9`) suppresses banners while the app is in the foreground. The in-app alert plays instead.
- **Web vs phone persistence:** the web/dev build writes localStorage with a journal key, not SQLite (`persistence.ts:54-57,104-127`). Browser checks do not exercise the phone's storage.
- **Xcode scheme and packages:**
  - No shared Xcode scheme is on disk (`xcuserdata/.../xcschemes` is empty), so `-scheme App` relies on Xcode's auto-created scheme. On a fresh clone that is not confirmed.
  - SPM packages resolve from `node_modules`, so run `npm install` first.
- **`@types/node`:** it is not a declared devDependency, only transitive, yet a test references node types and `tsc -b` checks tests.
- **`generate-alert-tones.py`** overwrites the bundled WAVs.
- **Stale docs:**
  - README.md:22-23 says the active timer lives in Preferences. It is actually in SQLite `app_state` under `pomi.runtime.v1`.
  - README.md:9 says Xcode 16+; AGENTS.md says Xcode 27.
  - `design_handoff_pomi_v2/README.md` overrides PLAN.md where they conflict (AGENTS.md:6-7).

## 6. Words this project uses

- **Block**: one Pomodoro cycle of N focus sessions with short breaks, ending in a long break. Its setup is frozen at start.
- **Session**: one focus run. It is saved only if it completed or reached at least 1 minute (`timer.ts:104,109`).
- **Takeover**: the full-screen interstitial after a phase ends. Its kinds are `sessionOver`, `breakOver` and `blockFinished`.
- **Auto / countdown**: the 5-second pausable countdown before an auto-started phase (`flow.ts:4`).
- **Segment / stretch**: part of a run with one tag set. Toggling a tag "cuts" a new one.
- **Runtime / snapshot**: `{active, ui}`, the durable state of the timer plus the flow, key `pomi.runtime.v1`.
- **RuntimeChange**: a snapshot plus the sessions and blocks earned with it and the tag deletions. It is committed as one unit.
- **Recover / replay**: applying overdue transitions at their original timestamps (`runtime.ts:48-75`).
- **Hub**: the overlay with the Settings, Statistics and History tabs.
- **Handle**: the tag chip on the timer screen that opens the tag sheet.
- **Carry tags**: keep the current tags into the next session.
- **Nudge**: the one-shot animation of the Pomi mark (`App.tsx:47-63`).
- **13D / 2B**: design-spec section ids from `design_handoff_pomi_v2`.

## 7. Claims checked

1. **Confirmed.** `ios/App/App/public/` is gitignored (`.gitignore:4`, `ios/.gitignore:4`) and is filled by `npm run ios:sync` = `npm run build && cap sync ios` (`package.json:11`, `webDir: 'dist'` in `capacitor.config.ts:6`). It currently holds `index.html`, `assets/`, `cordova*.js`. `capacitor.config.json`, `config.xml` and `CapApp-SPM/Package.swift` are also regenerated.
2. **Confirmed, with nuance.**
   - `ActiveTimer` stores `startedAt`, `resumedAt`, `accumulatedMs` and `durationMs`; elapsed time is computed from `Date.now()` (`timer.ts:30-39`).
   - The takeover countdown is timestamped as well (`flow.ts:36-41`).
   - `App.tsx:146-156` does run a 250 ms interval (or requestAnimationFrame for the stopwatch), but only in the foreground, to refresh the display and call `recover(now)`.
   - Background completion relies on natively scheduled notifications (`notifications.ts`). On return, `appStateChange` calls `recover` (`App.tsx:175-183`), which replays at the original times.
3. **Confirmed, with exceptions.** `saveRuntime` (`persistence.ts:121-145`) writes several things in one `executeSet(..., true)` transaction:
   - new sessions and blocks,
   - tag deletions and the stripping of those tags from sessions,
   - the `{active, ui}` snapshot.

   The app routes all timer/UI changes through `commitRuntime` → `saveRuntime` (`App.tsx:66-81`). Some writes bypass it:
   - tag create/rename/recolour (`saveTag`, `App.tsx:251,261`),
   - History retag (`updateSessionTags`, `App.tsx:296`),
   - block delete (`deleteBlock`, `App.tsx:307`),
   - legacy tag purge on launch (`App.tsx:129`),
   - settings (Preferences).

   On web there is no transaction: a journal key is replayed on launch instead (`persistence.ts:55-56,125`).
4. **Confirmed.**
   - `npm test` = `vitest run`: 12 test files, 63 `it(` cases, domain logic plus notification planning plus persistence (web and mocked SQLite over `node:sqlite`).
   - `npm run build` = `tsc -b && vite build`: a typecheck of all `src`, including tests, and the production web bundle into `dist/`.
   - Neither touches iOS. Pass/fail was not run (read-only brief). PLAN.md claims 63 passing.
5. **Confirmed for layout.** The following all exist and match:
   - `ios/App/App.xcodeproj` and scheme `App` (auto-created, not shared).
   - `-derivedDataPath ios/App/DerivedData`, gitignored, with existing `Debug-iphonesimulator/App.app` and `Debug-iphoneos/App.app`.
   - The bundle id in the launch commands matches `capacitor.config.ts:4` and `project.pbxproj:341,363`.
   - The "iPhone 17 Pro" simulator exists in CoreSimulator, and `/Applications/Xcode.app` exists.

   Not confirmed: that the builds succeed today, and that the phone is paired or reachable. The docs omit that `npm install` must precede Xcode builds.
6. **Confirmed.** The file exists. It resolves the DB only through `xcrun simctl get_app_container booted … data` (`seed-simulator.py:15-17`), so it cannot reach a physical device. It does write into that simulator's real app DB (INSERT OR REPLACE of `seed-*` rows and four fixed tags).
7. **Confirmed.**
   - Phone: SQLite (`@capacitor-community/sqlite` 8.1.1, unencrypted, `persistence.ts:61-63`) for tags, sessions, blocks and the runtime snapshot. Capacitor Preferences holds settings, plus legacy UI and active keys read once.
   - Browser: localStorage.
   - Migrations: the `MIGRATIONS` map plus `PRAGMA user_version` in `src/services/persistence.ts:17,29-46,85-88`. Settings migrate in `src/domain/settings.ts:23-43`. There is no separate migrations folder.

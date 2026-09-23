# Pomi — build plan

Build a small, fast, offline iPhone app. Keep the interface easy to redesign from
screenshots or supplied HTML/CSS/React. App Store release is the eventual target.
Planning is complete; implement this checklist without reopening the stack decision
unless a concrete problem requires it.

## Scope and behavior

- Pomodoro: configurable focus duration, short break, long break, and long break
  every N completed focus sessions. Defaults: 25 / 5 / 15 minutes and N = 4.
- Stopwatch: start, pause, resume, stop. Only one timer runs at a time.
- Both modes support zero, one, or multiple tags, created and selected in the app.
- Metrics: simple all-time focused-duration totals per tag and overall. A 30-minute
  session with two tags credits each tag 30 minutes, but overall only 30.
- Breaks and pauses never count. Stopping early saves actual focused time; only
  completed focus periods advance the long-break cycle. Start each phase manually.
- Save settings, active timer, tags, and history locally. Stable tag IDs preserve
  history when renamed; unique session IDs prevent duplicate completion records.
- Ordinary local notifications announce Pomodoro phase completion, subject to
  device settings and permission. Permission denial must not prevent timer use.

## Keep implementation small

- React + TypeScript + Vite, CSS, and Capacitor for the iPhone app.
- One timer logic module independent of React, a small persistence module, and a
  notification helper. No generalized service framework or plugin architecture.
- SQLite for sessions, tags, and active state; Preferences for settings. Use a few
  straightforward tables and queries, without an elaborate data layer.
- Persist time references and accumulated active time on meaningful changes.
  Recalculate on launch/resume; never depend on a background JavaScript interval
  or write to storage every second. Cap Pomodoro credit at the phase duration.
- Timer screen with mode and tag selection, metrics screen, settings sheet.
- Shared CSS variables for fonts, colors, and spacing. No theme engine or imposed
  visual component system; supplied designs should be easy to adapt later.

## Build checklist

### 1. Get a working timer onto iPhone early

- [x] Inspect local tools and repository instructions; scaffold React and Capacitor.
- [x] Implement a plain timer screen with start, pause, resume, and stop.
- [x] Save and restore active state; schedule/cancel completion notifications.
- [ ] Build for iOS and check lock/unlock, background/foreground, and reopening.

Done when the timer recovers accurately and a finished session records once.
Use simulator checks where appropriate; clearly identify real-device checks still
requiring the user's phone. Never claim device checks passed without running them.

### 2. Complete the feature set

- [x] Add all four Pomodoro settings and short/long-break progression.
- [x] Add stopwatch mode and multiple-tag creation/selection.
- [x] Save actual focused duration and display totals by tag and overall.
- [x] Add focused tests for pause/resume, phase cadence, early stop, recovery,
      duplicate completion prevention, and overlapping tags in metrics.

Done when both modes, settings, tags, and totals work across app restarts.

### 3. Apply the design and check the experience

- [x] Use a clean functional interface until the user supplies a visual direction.
- [ ] Implement supplied mockups/code/assets while retaining the timer logic.
- [ ] Check touch targets, safe areas, tag-entry keyboard, readable text,
      accessibility labels, reduced motion, startup, scrolling, and animations.
- [ ] Verify notification denial/cancellation and timer behavior after device
      clock changes or reboot; resolve incorrect accounting before release.

Done when the app feels responsive on a real iPhone and the user accepts the design.

### 3b. Full-app design v2 (`design_handoff_pomi_v2/`)

The v2 README overrides TIMER-SPEC and the older scope notes above where they
conflict (auto-start settings replace "start each phase manually"; steppers move
by 1). Alert-tone audio assets are deferred.

- [x] 0. Commit v1 baseline; replace the v1 handoff folder with v2.
- [x] 1. Timer refresh: diff Turn 5 (5A–5M) against the build; hub glyph.
- [x] 2. Hub shell (14A) + mode-switch confirm (13D) + persisted hub UI state.
- [x] 3. Settings live spec + Settings type migration + Alert tone screen.
- [x] 4. Data foundation: tag colour, session segments, blocks, migration, tests.
- [x] 5. Tags: handle, sheet, cut segments, edit/delete/undo, Manage tags.
- [x] 6. History.
- [x] 7. Statistics.
- [x] 8. Edge cases (stopwatch digit steps, laps, 24 h cap) + large-text pass.

### 4. Prepare distribution

- [ ] Confirm supported iOS versions, signing, and the user's developer account.
- [ ] Prepare icon, screenshots, metadata, support/privacy pages, and accurate
      privacy declarations matching the actual app and dependencies.
- [ ] Beta test with the user and their friend; fix release-blocking issues.
- [ ] Submit for App Review when the user is ready to publish.

A working prototype and an approved App Store release are separate milestones.

## Explicitly deferred

Live Activities, Dynamic Island, Lock Screen controls, AlarmKit, iPad/Mac/Watch,
accounts, servers, sync, and backup/export features. Do not scaffold these now.
Capacitor allows future native Swift integrations; that is enough preparation.
Live Activity visuals will need native UI, and controls may require native session
handling. Local persistence alone does not promise backup or cross-device sync.

## Implementation handoff

The user intends to do most implementation with GPT-5.6 Sol. Follow this plan in
order, check off completed work, and note concrete blockers briefly here. Resolve
routine choices without adding scope or requesting repeated architecture approval.
Raise a difficult issue for discussion only when there is a concrete unresolved
problem; no model change or additional agent work is required by this plan.

Current status: v2 design implemented (slices 0–8). React/TypeScript/Vite and Capacitor iOS;
scaffolded; timer, stopwatch, persistence, notifications, tags, metrics, settings,
and the first interface are present. Ten focused tests, the production web build,
and an unsigned iOS simulator build pass. The app was installed and launched on an
iPhone 17 Pro simulator, and a running timer restored correctly from native SQLite
after termination and relaunch. Real-device lock-screen, lifecycle, notification,
and design-acceptance checks remain.

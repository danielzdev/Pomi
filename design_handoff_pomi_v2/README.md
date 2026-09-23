# Handoff v2: Pomi, full app design

This package covers the whole app: the timer screens, navigation and hub, tags, settings, statistics, history and edge cases. It replaces `design_handoff_pomi_screens/`. That older package is included here as `TIMER-SPEC.md` because its token and screen measurements are still correct. **Wherever the two disagree, this README wins.**

## How to use this package
- Everything in `reference/` is an **HTML design reference**, not production code. Rebuild it in Pomi's existing stack (React 19 + TypeScript + Vite + Capacitor iOS). Keep `src/domain/*` and `src/services/*`, and extend them as needed.
- Open any `reference/*.dc.html` file in a desktop browser. `support.js` has to sit next to it. The pages are pan/zoom canvases, and the `* Live` files are working prototypes you can click through.
- The **inline styles in the HTML are the spec** for every size, colour and piece of copy. The logic class at the bottom of each file (`class Component …`) is the reference for behaviour.
- **Ignore canvas scaffolding.** That means turn headers, option badges (5A, 14A…), explanation cards, "What's live" / "Rules" notes, the fake iOS status bar, the home indicator, the fake keyboards and the Nunito font (used only for annotations). On the phone, the only typeface is **Space Grotesk**.
- Fidelity: **high**. Match colours, type, spacing and copy one-to-one.

## Which files and options are final
| Area | Final | File |
|---|---|---|
| Timer, stopwatch, takeovers | **Turn 5, screens 5A–5M** (ignore Turn 3 below it) | `01 Timer Screens.dc.html` |
| Timer header | **Turn 14** (two icons) with the **15B four-square hub glyph**. Turn 13 is superseded, except 13D (mode-switch confirm), which stays | `02 Navigation and Hub.dc.html` |
| Hub | **14A**: segmented Settings · Statistics · History + close button | same |
| Tags on the timer + tag sheet | **Everything in the playground** (6A handle, 2B sheet, cut semantics, long-press edit/delete) | `03 Tags Live.dc.html` (`03b` is history/background only) |
| Settings | **The live prototype.** It supersedes screens 5N/5O and TIMER-SPEC §14–15 | `04 Settings Live.dc.html` |
| Statistics | **11A live prototype** (built from Turn 10) | `05 Statistics Live.dc.html` (`05b` = background) |
| History | **12A live prototype** | `06 History Live.dc.html` |
| Edge cases | **12A–12E** | `07 Edge Cases.dc.html` |

---

## 1. Navigation

**Timer header (Pomodoro + Stopwatch):**
- Left: the eyebrow label.
- Right: two 22 px glyphs, each in a 40–44 pt tap box.
  1. **Mode switch.** It shows where it takes you: the stopwatch glyph on Pomodoro screens, the clock glyph on Stopwatch screens.
  2. **Hub**, the 15B four-square grid:
     ```html
     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>
     ```
     It **replaces the sun/settings glyph everywhere**, including on takeovers.
- Glyph colour is `#6B6359`, or the screen's eyebrow colour on teal/takeover grounds.
- Takeover screens (5D, 5E, 5G, 5H) show **only the hub glyph**, not the mode switch.

**Mode switch confirm (13D).** The confirm appears only when something is live: running, paused, a break, or an auto-start countdown. From Ready, Block finished or Stopwatch-at-zero, the switch happens immediately.
- Dialog: "Switch to Stopwatch?" / "This ends session 02. The 7 m 18 s you've focused is saved." Buttons: **Keep going** (dark primary, the safe default) · End and switch.
- From the stopwatch: "Switch to Pomodoro?" / "This stops the stopwatch. 04:12 and 6 laps are saved."
- On a break: "This ends the break and the block. Nothing more is saved."
- Under 1 minute focused: "Less than a minute, so nothing is saved."

**Hub (14A).** A full-screen sheet over the timer.
- Header: a 40 px segmented control (Settings · Statistics · History; track `#E8E3D8`, active pill `#1A1916` with `#F3F0EA` text) plus a 40 px circular close button.
- **Opening** the hub lands on the last-used segment (Settings on first launch).
- **Closing** it always returns to the timer you came from. The hub never changes mode.
- **Nothing pauses.** A running timer keeps going underneath and fires its notifications and takeovers as normal.
- **Relaunch** restores the mode you were on. If the hub was open, it reopens on the same segment.
- Persist `mode`, `hubOpen` and `hubTab` in UI state.
- The Statistics/History/Settings prototypes show their own single-title headers. In the app, replace those with the 14A segmented header. Their sub-screens (tag detail, streak detail, alert tone, etc.) push with a back arrow.

The old bottom nav and the Metrics tab are **removed**.

## 2. Tags (see `03 Tags Live`)
Model: a tag has a stable `id`, a `name` and a `color` from this palette:
`#B96A1A #2F5F57 #58806F #A8512B #8A8175 #7FA294 #B4AFA2 #8A6420`

The "bright" variant is used on dark/selected chips: `BRIGHT` map in the file.

**Handle on the timer.** A pill between the helper line and the action row.
- No tags: "Add tag".
- 1–3 tags: that many coloured dots.
- 4 or more (the fold is at 3): the pill inverts to an ink ground, the count shows in paper white, and a small dot trio sits beside it.
- Tapping the handle opens the sheet.

**Sheet (2B)**, top to bottom:
- **On now**: the tags currently on. If none: "Nothing on — this stretch is untagged."
- **Often used**: this heading is hidden when no tag has logged time yet.
- **All (N)**: A–Z list with totals.
- **Search/create field**, pinned at the bottom near the thumb. Typing filters. If there's no exact match, the field offers to create the tag. Duplicate names (case-insensitive) are rejected with inline error text.
- Tapping a tag toggles it.

**Cut semantics (the key rule).** Turning any tag on or off closes the running segment at that instant and opens a new one with the new tag set.
- A focus session is therefore a list of `{start, end, tagIds[]}` segments. One session can hold several differently-tagged stretches.
- A segment of zero length is dropped.
- Renaming or recolouring a tag never cuts.
- Overall totals count wall time once. Per-tag totals credit each tag in the segment. This is the existing metrics rule, applied per segment.

**Long-press on any tag** (on now, often used or A–Z) opens a menu with Edit and Delete.
- Edit renames in place.
- Delete asks once. The dialog has a "Don't ask me again" checkbox; after that, the choice lives in Settings → Confirm before deleting.
- After a delete, a toast shows with **Undo for 5 s**.
- Logged time from a deleted tag becomes **Untagged**. It never disappears from totals.

**Tag deleted mid-session (Edge 12A).** The timer never stops.
- If it was the only tag on, the handle falls back to "Add tag" and the toast reads "Deleted "X" · session continues untagged".
- If other tags are still on, the handle loses a dot and the toast reads "… · removed from this session".
- Paused or on a break: same behaviour.
- Undo restores the tag, its colour, its history and its place in the current session.

**Carry tags into next session** (setting, default ON). If ON, the active tags persist into the next focus session. If OFF, every session starts untagged.

Stopwatch runs support tags the same way.

## 3. Settings (see `04 Settings Live`)
Settings is card sections under a dark "Block preview" card. The preview reads, e.g., "4 × 25 min · 2 h 10 m". Its total is sessions + short breaks between sessions + the long break, and it recomputes live.

| Section | Rows (default) |
|---|---|
| Durations | Session 25 min · Short break 5 min · Long break 15 min · Sessions / block 4 |
| Flow | Auto-start short breaks (ON) · Auto-start long break (ON) · Auto-start sessions (OFF) · Start a new block automatically (OFF) |
| Tags | Manage tags → (row shows the tag count) · Carry tags into the next session (ON) · Confirm before deleting (ON; applies to tags **and** History blocks) |
| Alerts | Sound (ON) · Alert tone → (Wood block) · Vibrate (ON) · Notify when closed (ON) |
| While running | Keep screen awake (OFF) · Stopwatch keeps running (ON) |
| — | Reset to defaults (text button `#A8512B`) |

**Durations.**
- The ± steppers move by 1. Tapping the value opens the numeric keypad so any number can be typed.
- Limits: minutes 1–999, sessions/block 1–99. Out-of-range input clamps and shows a toast ("Minimum is 1").
- Changes apply **from the next block**. A running block keeps the setup it started with.

**Manage tags** screen:
- Search, sort A–Z / Most used, each row shows its logged total.
- Tapping a row opens edit: name, colour swatches from the palette, Delete tag.
- Select mode allows bulk delete.

**Alert tone** screen:
- Tones: Wood block, Soft chime, Marimba, Bowl, Tick, Silent (vibration only). Each has a sub-label (see `TONES` in the file).
- Tapping a tone previews it once.
- With Sound off, only vibration and the lock-screen alert remain.

**Settings type changes.**
- Rename `autoStartBreaks` to `autoStartShortBreaks`.
- Add `autoStartLongBreak`, `autoStartNextBlock` (replaces `autoStartAfterLongBreak`), `carryTags`, `confirmDelete` and `streakThresholdMin` (default 120).
- Change `alertTone` to a union of the six tones.
- Remove `completedFocusCount`/`nextPhase` from Settings if convenient. They are runtime state, not settings.

## 4. Statistics (see `05 Statistics Live`)
**Periods.** Segmented D / W / M / Y. A dark summary card has ‹ › arrows to step through time.
- The back arrow stops at the first day of history. Days before first use are faint outlines: never "missed", and never counted in "N of M days".
- Weeks always start Monday. There is no setting for this.

**Headline stats.** Focus time, then Sessions with a blocks sub-line, then the Streak line.

**Activity grid.** The grid shows exactly the selected period.
- Day: no grid; the streak line moves into the dark card.
- Week: 7 cells.
- Month: calendar.
- Year: 12 month tiles; tapping one jumps to that month.
- Cells are **binary**: a day is counted when its focus time is at or above the threshold (default **2 h**). Today and future days are hollow until they count.
- Counted cells use the accent colour. Black is used only in the dark card.

**Reliability card.** A Sessions / Blocks toggle swaps between four stats: completion %, ended early, average length vs. setting, and longest run (Blocks has its own four). Tapping a stat opens a breakdown sheet.
- "Finished vs early" is judged **per block against the setup it started with**, so a mixed 25 m / 50 m history reads correctly.

**Tags card.**
- Shows the top tags with % and time, labelled "Tags can overlap". "All N tags" opens the full list, which ends with an **Untagged** row (untagged stretches + time from deleted tags).
- Long names truncate with an ellipsis.

**Streak detail** (tap the streak): current streak, best, run history, and a **Counted at** stepper. Changing the threshold deliberately recomputes every past streak.

**First launch** (zero sessions): today is the only day, the arrows are locked, and the stats collapse into one card: "Nothing to count yet" + "Start a session" button.

**Large numbers** shrink to fit. Use the file's Stress test tweak (5-digit sessions, 1 000+ h, 1 000-day streak) to check this.

## 5. History (see `06 History Live`)
**List.** Chronological, grouped by day, with a day sum. One card per **block**, showing:
- the time range
- the focus earned
- the segment bar (ochre = finished, split = early stop, track = never started)
- tag dots/names

**Block card, expanded.** Tapping a card opens the timeline: sessions, breaks, early stops, and each tag stretch.
- Tapping a stretch (row with a chevron) opens the tag sheet to retag it.
- The sheet has "Apply these tags to **Whole session** / **Whole block**". This copies one stretch's tags across and collapses the stretches into one.
- Past 3 tags, a stretch reads "first tag +N" with a capped dot trio.
- Past 3 stretches, a session shows two, then an "N more tag changes" row.

**Delete block** is the only delete. Single sessions can't be removed.
- It confirms first, unless the user ticked "Don't ask again". That is reversible in Settings → Confirm before deleting.
- Time boundaries are shown but **never editable**.

**Filter.** A filter glyph at top right opens a multi-select tag sheet. A block shows if it carries **any** of the checked tags.
- The active filter reads as a dot trio + count under the header, with a Clear button.
- Deleting a tag removes it from the filter. If it was the only one, the filter clears with the toast "Filter cleared — tag deleted".

**Rules.**
- Each block stores the setup it ran with (session length, count). A 50 m × 2 block shows two pills.
- A block that runs past midnight stays under the day it **started** ("+1" on the end time).
- A running block appears only once it ends.

## 6. Edge cases (see `07 Edge Cases`)
**Stopwatch digit steps.**
| Elapsed | Format | Digit size |
|---|---|---|
| < 1 h | `04:12.68` | 88 px |
| 1–10 h | `3:12:40` | 76 px, no hundredths |
| 10–24 h | `12:47:09` | 68 px |

**Laps.**
- Lap numbers pad to 3 digits past 99. Splits over an hour read `1:02:14.30`.
- With 8 or more laps, Fastest/Slowest become pinned cards above the list. The list scrolls on its own, newest first.

**24-hour cap.**
- The stopwatch auto-stops at 24:00:00 and shows "24 hours reached" with the lap count saved.
- If the app is in the background, a notification says the same.
- Buttons: **Start a new one** saves the old run as finished and starts from zero. **Stop** goes to the Stopped screen with Resume disabled.

**Small phone / large text** (375×667, Dynamic Type 130%).
- Dial shrinks to 232 px and the gaps tighten.
- Timer digits stay fixed (56 px on small phones) and do **not** scale with text size.
- Stopwatch digits drop to 76 px.
- Buttons grow in height, never width, and are never under 44 pt. End/Pause stack (Pause on top) above 160%.
- The 2-column stat grid becomes 1 column.
- Settings hint text wraps under the label; switches stay pinned right.
- Tag names truncate after one line.
- Header eyebrows shorten to one word (e.g. "Running").

## 7. Data model additions
- `Tag.color`.
- `SessionRecord.segments: {startedAt, endedAt, tagIds[]}[]`. Keep `tagIds` as the union for quick filtering.
- `Block {id, startedAt, endedAt, setup:{focusMin, shortMin, longMin, sessions}, sessionIds[]}` for History and Statistics.
- `ActiveTimer.segments` (the open segment has `endedAt: null`).
- Stopwatch runs persist their laps and tags.
- Settings additions as listed in §3. UI state gets `hubOpen` and `hubTab`.
- Deleting a tag removes its id from records. The remaining time shows as Untagged. Keep an undo snapshot for 5 s.

## 8. Design tokens
Unchanged from `TIMER-SPEC.md` → *Design tokens* (paper/ink/ochre/teal palette, Space Grotesk scale, 34 px inset, 58 px buttons, radius 10/14).

For new surfaces, copy values from the reference HTML. Common ones:
- card `#FBF9F4` with 1 px `#E4DDCF` border, radius 14
- sheet grabber and toast styles as drawn
- segmented track `#E8E3D8`
- destructive `#A8512B`

Bundle the Space Grotesk woff2 files (400/500/700) locally so the app works offline.

## Suggested build order
1. Header glyphs + hub shell (14A) + mode-switch confirm.
2. Settings (live spec) + the Settings type migration.
3. Tags: model + colour, handle, sheet, cut segments, delete/undo.
4. Blocks + segments in persistence.
5. History.
6. Statistics.
7. Edge cases + large-text pass.

Add tests alongside the existing ones for: segment cuts, overlapping-tag totals, Untagged after delete, per-block finished/early judgement, midnight filing, streak recompute and the stopwatch 24 h cap.

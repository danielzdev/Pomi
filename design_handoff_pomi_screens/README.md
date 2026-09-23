# Handoff: Pomi — "Amber Instrument" screen set (15 screens)

## Overview
Complete visual redesign of Pomi's timer UI: a Pomodoro timer (10 states), a stopwatch (3 states), and a settings sheet (2 scroll positions). Designed for iPhone (390 × 844 pt reference frame). Working sessions are **ochre**, breaks are **teal**, the primary action is always **one dark rectangle**, and every screen has exactly one accent moment that carries information.

## About the design files
Everything in `reference/` and `screenshots/` is a **design reference built in HTML** — not production code. The task is to **recreate these screens in Pomi's existing stack** (React 19 + TypeScript + Vite, packaged with Capacitor for iOS), replacing the current `App.tsx` UI and `styles.css` while keeping `src/domain/*` and `src/services/*` intact (timer math, persistence, notifications).

- `reference/Pomi Screens.dc.html` — open in a browser to inspect every screen live (DOM + inline styles are the ground truth for every measurement). `support.js` must sit beside it.
- `screenshots/01…15-*.png` — 2× PNG of each screen, for visual diffing.

## Fidelity
**High-fidelity.** Colours, type, sizes, spacing, radii, and copy are final. Match them 1:1. Where a value below conflicts with the HTML, the HTML wins.

## Mapping to Pomi's current code
| Pomi today | New design |
|---|---|
| `header` with brand mark + ⚙ | Removed. Replaced by the per-screen eyebrow label (top-left) + two 22 px header glyphs (top-right): stopwatch/clock glyph toggles Pomodoro ↔ Stopwatch mode; sun glyph opens Settings. |
| `.segmented` Pomodoro/Stopwatch toggle | Removed → header glyph. |
| `.timer-orb` | Replaced by the **ring** (conic-gradient dial) — see Components. |
| `.tag-picker` | Not in this design. Drop or hide it. |
| `.controls` (stacked) | Replaced by the **two-up action row** (see Components). |
| `nav` (Timer / Metrics tabs) | Not in this design; metrics tab out of scope. Remove the bottom nav. |
| Settings `.sheet` with number inputs | Replaced by full-screen Settings with stepper rows and toggles (screens 14–15). |
| `phaseName`, `formatClock` | Reuse. Add `formatStopwatch` (mm:ss + .cs). |
| `Settings.nextPhase`, `completedFocusCount`, `longBreakEvery` | Drive the **segment bar** and header "Session 0N". |
| New settings needed | `autoStartBreaks`, `autoStartSessions`, `autoStartAfterLongBreak`, `sound`, `alertTone`, `vibrate`, `notifyWhenClosed`, `keepScreenAwake`, `stopwatchKeepsRunning`. |

Remove the current `body` radial gradient and green palette entirely.

---

## Design tokens

### Fonts
Load **Space Grotesk** (weights 400, 500, 700) from Google Fonts. It is the only typeface on-device. Fallback: `sans-serif`.

### Colours
Paper (work screens)
- `--paper` `#F3F0EA` — work-screen background, ring inner disc, primary-button text
- `--paper-paused` `#EFECE4` — background on Paused (screen 03)
- `--paper-card` `#FBF9F4` — settings cards, summary card
- `--line` `#E4DDCF` — dividers, empty ring/segments on work screens
- `--line-strong` `#CFC7B8` — outlined-button border
- `--frame-border` `#DAD4C8`
- `--ink` `#1A1916` — primary text, primary button, status bar
- `--ink-2` `#6B6359` — secondary text, header eyebrow
- `--ink-3` `#8A8175` — tertiary text, section labels, "Slowest" tag
- `--ink-4` `#B4AFA2` — disabled text, hundredths at zero, chevrons
- `--paused-fill` `#B4AFA2` / `--paused-track` `#E0DBD0`

Ochre (work)
- `--ochre` `#B96A1A` — ring fill, filled segments, Resume button, running hundredths, toggles ON
- `--ochre-hover` `#A55E14`
- `--ochre-text` `#8A6420` — "Deep work" label, header when stopwatch running, "Fastest" tag, "4 of 4"
- `--ochre-pale` `#EAD8BA` — unspent ring + segments on Ready (screen 01)
- `--ochre-ground` `#9C5B12` / border `#7E4A0E` — full-ground takeover (screens 04, 05); text on it `#FFF6E8`, eyebrow `#F3D8AE`

Teal (rest)
- `--teal` `#58806F` — short-break ring
- `--teal-deep` `#2F5F57` — long-break ring, break-over takeover ground (border `#244A44`); text on it `#F0F7F3`, eyebrow `#A9CDBF`
- `--teal-text` `#3E6B5C` (short) / `#2F5F57` (long)
- `--teal-paper` `#F0F2EE` (short-break bg, border `#D4DAD2`, track `#DDE2D8`, eyebrow `#5D6B62`, outlined border `#C6CFC6`)
- `--teal-paper-deep` `#E9EFEA` (long-break bg, border `#CDD8D0`, track `#D3DCD5`, eyebrow `#4F6159`, outlined border `#C3CFC7`)

Misc
- Toggle OFF track `#D8D2C4`; knob `#FFFFFF`
- Stepper button bg `#EFEAE0`, hover `#E2DBCC`
- Icon-button bg `#E8E3D8`, hover `#DDD6C8`
- Destructive text link `#A8512B`, hover `#7E3A1D`

### Type scale (Space Grotesk)
- Timer digits: 66 px / 500 / letter-spacing −0.03em / line-height 1
- Stopwatch digits: 88 px / 500 / −0.04em; hundredths 44 px / 400
- Takeover headline: 44 px / 500 / −0.02em / lh 1.1 (manual) · 30 px (auto)
- Block-finished total: 112 px / 500 / −0.04em / lh 0.9
- Header eyebrow: 13 px / 700 / +0.22em / uppercase
- Phase label under digits: 14 px / 500 / +0.16em / uppercase
- Helper line under segments: 13 px / 500 / +0.04em
- Button label: 16 px / 700 / +0.04em
- Section label (settings): 12 px / 700 / +0.20em / uppercase
- Row label: 15 px / 500; row sub-label 12.5 px / 400; row value 15 px / 700
- Lap row: 16 px / 500; lap tag 11 px / 700 / +0.12em uppercase
- Status bar: 14 px / 700

### Spacing & shape
- Horizontal page inset: **34 px** (content + action row); header inset 30 px
- Header: `padding-top 26px` below status bar
- Ring ↔ segment bar gap: 40 px; segment bar ↔ helper text gap: 10 px
- Action row: `padding: 0 34px`, `gap 12px`, buttons **58 px** tall, radius **10 px**
- Bottom safe zone: **40 px** below the action row (home indicator lives inside it) — nothing tappable touches the gesture strip
- Cards: radius 14 px, `padding 2px 16px`, 1 px `--line` border, rows separated by 1 px `--line`
- Steppers: 32 × 32 px, radius 8 px; value slot min-width 64 px
- Toggle: 42 × 24 px, radius 12 px, 2 px padding, 20 px knob
- Icon button (close): 34 px circle
- Segment bar: 6 px tall pills, radius 3 px, gap 6 px, one per session in the block

---

## Components

### Ring (Pomodoro dial)
286 × 286 px circle, `conic-gradient(from 180deg, FILL 0deg Xdeg, TRACK Xdeg 360deg)`. Inner disc 266 px in the screen background colour (252 px on Long break → thicker ring). `X = remaining/total × 360`, so the ring **drains** clockwise from the bottom. Inside: digits (66 px) + phase label (14 px caps), gap 6 px.
- Ready: fill = track = `--ochre-pale` (full pale ring: unspent potential)
- Running work: fill `--ochre`, track `--line`
- Paused: fill `--paused-fill`, track `--paused-track`; digits & label go `--ink-2` / `--ink-3`
- Short break: fill `--teal`, track `#DDE2D8`
- Long break: fill `--teal-deep`, track `#D3DCD5`, ring thicker

### Segment bar
One pill per session (`longBreakEvery`). Completed = `--ochre`; current = ochre→track split at progress % via `linear-gradient(90deg, ochre 0 P%, track P% 100%)`; upcoming = track. On Ready all pills are `--ochre-pale`. On Paused ochre becomes `--paused-fill`. On break screens completed sessions stay ochre against the teal track. On takeovers, pills are `#FFF6E8`/`#F0F7F3` at 100% and 30% alpha.

### Action row
Primary = filled `--ink`, text `--paper`, hover `#33302A`. Secondary = transparent, 1.5 px `--line-strong` border, `--ink` text, hover `#E8E3D8`. Two-up: secondary `flex:1`, primary `flex:2` (equal halves on takeovers). Single action: full width.
**Ochre fill has exactly one meaning: "get moving again"** → Resume on Paused (03) and Stopwatch stopped (13) is `--ochre` bg with `--ink` text.

### Header
Left: eyebrow label. Right: two 22 px stroked glyphs, `stroke-width 2`, colour `--ink-2` (or the screen's eyebrow colour), gap 16 px. Glyph 1 = stopwatch (circle r8 at cy13, hands, top bar) on Pomodoro screens; clock (circle r9) on Stopwatch screens. Glyph 2 = sun/settings (circle r3.2 + 8 rays). Takeovers show only the settings glyph. Settings screens show a 34 px circular close button instead. Hover: opacity 0.6.

### Status bar (Capacitor)
Design assumes a light status bar with dark ink on paper screens and light ink on takeovers. Set the Capacitor StatusBar style per screen. Home-indicator area is part of the 40 px bottom zone.

---

## Screens

Screen numbers match `screenshots/`. All 390 × 844.

**01 Ready to start** — bg `--paper`. Eyebrow "NEW BLOCK". Ring full `--ochre-pale`, digits "25:00", label "DEEP WORK" `--ochre-text`. Segments all pale ochre. Helper "4 sessions · 25 min each · 2 h 5 m total". Single primary "Start session".

**02 Session running** — Eyebrow "SESSION 02". Ring ochre at remaining %, "17:42", "DEEP WORK". Segments: 1 done, 2nd at 30 %. Helper "1 h 12 m left in this block". Actions: End (secondary, flex 1) · Pause (primary, flex 2).

**03 Paused** — bg `--paper-paused`. Eyebrow "SESSION 02 · PAUSED". Ring greyed, digits `--ink-2`, label "PAUSED" `--ink-3`. Segments greyed. Helper "Paused for 1 m 24 s" (live). Actions: End · **Resume in `--ochre`**.

**04 Session over · manual** — full ground `--ochre-ground`. Eyebrow "SESSION 02 DONE" `#F3D8AE`; settings glyph only. Centre column (gap 34, inset 40): 96 px circle outline 2.5 px `#FFF6E8` with 46 px check; headline "25 minutes / of deep work" 44 px `#FFF6E8`; 1 px rule at 28 % alpha; "UP NEXT" eyebrow + "Short break · 5 min" 22 px; segment bar (2 done). Actions equal halves: "Skip ahead" (outlined, `rgba(255,246,232,.55)` border) · "Start break" (filled `#FFF6E8`, text `#7E4A0E`). Shown when `autoStartBreaks` is off.

**05 Session over · auto** — same ground. Headline 30 px; 212 px ring (inner 194 px, ground colour) draining in `#FFF6E8` over 26 % alpha track, digits "0:04" 56 px, label "SHORT BREAK STARTS" 12 px `#F3D8AE`; segments. Actions: "Start now" (outlined) · "Pause" (filled). Shown when `autoStartBreaks` is on; counts down ~5 s then goes to 06.

**06 Short break running** — bg `--teal-paper`. Eyebrow "SHORT BREAK" `#5D6B62`. Ring `--teal`, "03:55", "STAND UP" `--teal-text`. Segments: 2 ochre done, 2 teal-track. Helper "Session 03 next · 1 h 2 m left in this block". Actions equal halves: "Skip break" · "Pause".

**07 Break over · manual** — ground `--teal-deep`. Eyebrow "BREAK OVER" `#A9CDBF`. 96 px circle with 44 px up-arrow; headline "Back to it"; rule; "UP NEXT" + "Session 03 · 25 min"; segments. Single full-width "Start session 03" (filled `#F0F7F3`, text `#244A44`).

**08 Break over · auto** — same ground. "Break over" 30 px; 212 px ring draining `#F0F7F3`, "0:03", "SESSION 03 STARTS". Actions: "Start now" · "Pause".

**09 Long break running** — bg `--teal-paper-deep`. Eyebrow "LONG BREAK" `#4F6159`. Ring `--teal-deep`, inner disc 252 px, "11:18", "GET AWAY FROM IT" `#2F5F57`. Segments all 4 ochre. Helper "Block complete · 15 min earned". Actions: End (flex 1) · Pause (flex 2).

**10 Block finished** — bg `--paper`. Eyebrow "BLOCK COMPLETE". Centre column gap 30: "1h40" 112 px; "of deep work across 4 sessions" 16 px `--ochre-text`; segment bar all `--ochre` (18 px below the line); summary card (`--paper-card`, radius 14, `padding 4px 16px`) rows 12 px v-padding: "Sessions completed / **4 of 4** (`--ochre-text`)", "Breaks taken / 3 short · 1 long", "Started / 9:41". Actions: Done (flex 1) · Start another block (flex 2). Shown after the long break when `autoStartAfterLongBreak` is off.

**11 Stopwatch · zero** — bg `--paper`. Eyebrow "STOPWATCH". Header glyph 1 = clock. Centre: "00:00" 88 px `--ink` + ".00" 44 px `--ink-4`, baseline-aligned, gap 10 to "READY" 13 px caps `--ink-3`. Actions: Lap (disabled: bg `#E8E3D8`, text `--ink-4`, flex 1) · Start (primary, flex 2).

**12 Stopwatch · running** — Eyebrow "STOPWATCH · RUNNING" in `--ochre-text`. Digits block `padding 52px 30px 34px`: "04:12" + ".68" in `--ochre`. Lap table (inset 30): header "LAP / SPLIT" 12 px caps `--ink-3`, 1 px rules, rows `padding 15px 4px`, newest first. Fastest row: 700 weight, `--ochre-text`, tag "FASTEST"; slowest row: `--ink-2`, tag "SLOWEST" `--ink-3`. Action row has `padding-top 20px`. Actions: **Stop (secondary, flex 1) · Lap (primary, flex 2)** — Lap is the repeated action, so it is the dark primary.

**13 Stopwatch · stopped** — Eyebrow "STOPWATCH · STOPPED" `--ink-2`. Hundredths `--ink-2`. Laps persist. Actions: Reset (secondary) · **Resume in `--ochre`**.

**14 Settings · top** — bg `--paper`. Header "SETTINGS" + 34 px close circle (`#E8E3D8`, 17 px × glyph). Content `padding 20px 26px`, gap 20. Dark card `--ink`, radius 14, `padding 18px 18px 16px`: "YOUR BLOCK" 12 px caps `#A09A8E`; "2 h 5 m · 4 sessions" 24 px `--paper`; 8 px proportional bar (gap 4, radius 4): work `--ochre`, short break `--teal`, long break `--teal-deep`, flex weights = minutes. Section "DURATIONS" card: Session 25 min, Short break 5 min, Long break 15 min, Long break after 4 sess. — each row label + `– [value] +` stepper. Section "FLOW" card, toggle rows with sub-labels: Auto-start breaks (ON) "Off means you confirm each break"; Auto-start sessions (OFF) "After a short break ends"; Auto-start after long break (OFF) "Off means the block ends cleanly".

**15 Settings · scrolled** — header gains `border-bottom 1px --line` when content scrolls under it. Section "ALERTS": Sound (ON) "Soft chime"; Alert tone → "Wood block" + 16 px chevron `--ink-4`; Vibrate (ON) "Also when the phone is silenced"; Notify when closed (ON) "Lock-screen alert at each change". Section "WHILE RUNNING": Keep screen awake (OFF) "Dims but stays on"; Stopwatch keeps running (ON) "When you leave the screen". Then text button "Reset to defaults" 14 px `#A8512B`, left-aligned.

---

## Interactions & state

Pomodoro state machine (maps onto `ActiveTimer.status` / `Settings.nextPhase`):
`ready(01)` → Start → `running(02)` ⇄ Pause/Resume `paused(03)` → complete → `sessionOver(04 | 05)` → `break(06 | 09)` → complete → `breakOver(07 | 08)` → `running` … after long break → `blockFinished(10)` (or auto-restart if `autoStartAfterLongBreak`). End on 02/03/09 → 01 (record via `finishTimer(…, false)`).

- Auto takeovers (05, 08) count down 5 s; Pause freezes the countdown; Start now skips it.
- Ring and hundredths update on a 250 ms tick (existing `reconcile` interval is fine; use `requestAnimationFrame` for the stopwatch hundredths).
- Stopwatch: Start → 12; Lap prepends a row; Stop → 13; Resume → 12; Reset → 11 (clears laps). Tag fastest/slowest when ≥ 2 laps.
- Steppers: Session ±5 min (5–90), breaks ±1 min (1–30), Long break after ±1 (2–8).
- Hover/active: primary `#33302A`; secondary `#E8E3D8` (teal screens `#E3E8E1` / `#DDE5DF`); glyphs opacity 0.6; ochre `#A55E14`.
- No page transitions specified; a 200 ms colour cross-fade between paper↔takeover grounds is acceptable.
- Safe areas: the reference frame's 40 px bottom zone ≈ `env(safe-area-inset-bottom)` + home indicator; use `padding-bottom: max(40px, env(safe-area-inset-bottom))`.

## Assets
No raster assets. All glyphs are inline SVG (24 × 24 viewBox, stroke 2, round caps) — copy the `<svg>` paths verbatim from the reference HTML. Font: Space Grotesk via Google Fonts (or bundle the woff2 for offline Capacitor builds).

## Files
- `reference/Pomi Screens.dc.html` + `reference/support.js` — live reference, inline styles = spec
- `screenshots/01-ready-to-start.png` … `15-settings-scrolled.png` — 2× PNGs, 784 × 1692

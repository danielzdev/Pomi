Paste this into Claude Code / Codex with the Pomi repo open and this folder copied into it:

---

I'm building Pomi, an offline iPhone Pomodoro + stopwatch app (React 19 + TypeScript + Vite + Capacitor). The repo's `PLAN.md` is the build plan. The design is final and lives in `design_handoff_pomi_v2/`.

1. Read `design_handoff_pomi_v2/README.md` fully. It says which reference files and options are final, and it overrides `TIMER-SPEC.md` where they conflict.
2. The `reference/*.dc.html` files are HTML design references: their inline styles are the visual spec, and the `class Component` logic at the bottom of each file is the behaviour spec. Don't ship them. Rebuild the UI in `src/`, keeping and extending `src/domain` and `src/services`.
3. Work through the README's "Suggested build order" one step at a time. After each step: run the tests, run the build, briefly tell me what changed, and tick the matching item in `PLAN.md`.
4. Match colours, sizes, spacing and copy exactly. If something is ambiguous, pick the option closest to the reference HTML and note it. Don't add features beyond the README.
5. Then help me install the app on my iPhone and walk me through the real-device checks in `PLAN.md` §1 and §3.

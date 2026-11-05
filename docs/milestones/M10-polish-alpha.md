# M10 UX/UI Polish and Alpha

**Goal:** a distinctive, responsive, accessible, animated game with sound, released to a small alpha audience.
**Depends on:** M8 (T01 may start after M3). **Brief phase:** 8.
**Baseline skills for every task:** `/verification-before-completion`; `/test-driven-development` for logic. UI tasks use `/frontend-design`. Run `/requesting-code-review` at milestone end.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). Functionally complete MVP exists: local solo, ghost race, networked 1v1 race, accounts, validated leaderboards, ranked matches, staging deployment. The client renders the board on Canvas 2D behind `BoardRenderer` and talks to `GameSession`; design tokens are CSS variables. TETR.IO is a reference for polish and feel, not something to copy.
2. **Tasks:** M10-T01 to M10-T07, in order (T01 may begin earlier).
3. **Prerequisites and baseline:** tag `m8-complete` (and `m9-complete` for T07). Copy the actual exported signatures of `BoardRenderer`, `InputController`, `GameSession`, `StatsStore` and the token file layout before starting. Read `docs/a11y-findings.md` from M3-T08.
4. **Locked decisions:** ADR-001..014; Canvas 2D renderer stays unless a measured need appears; Tailwind with CSS-variable tokens; React; desktop-first with mobile support delivered here (D-08, ADR-015 in T04); audio and visuals must not change game logic or timing; ADR-016 (telemetry and privacy, D-13) is written in T07.
5. **Deliverables:** visual identity and design-system doc, animations, sound with `AudioController`, responsive layouts and touch controls, a WCAG 2.1 AA audit with fixes, performance work, alpha release.
6. **Acceptance:** keyboard-only and screen-reader play are viable; reduced-motion users get no motion; the game is playable on a phone; the expert board renders at a smooth frame rate on a mid-range laptop; Lighthouse accessibility and performance scores meet documented targets; an alpha deployment with feedback channel is live.
7. **Skills:** baseline; `/frontend-design`; `/design-system`; `/accessibility-review`; `/ux-copy`; `/design-critique` for review passes; `/deploy-checklist` for T07.
8. **Documents:** `ARCHITECTURE.md`, `docs/a11y-findings.md`. Update: new `docs/DESIGN_SYSTEM.md`, `ARCHITECTURE.md`, `DECISIONS.md` (ADR-015, ADR-016), `ROADMAP.md`, `CHANGELOG.md`.

---

### M10-T01 Visual identity and design system

- **Objective:** a coherent look that is recognizably this game.
- **Description:** define and document the visual language, extend tokens, restyle core screens.
- **Prerequisites:** M3 (may start early).
- **Implementation guidance:** run `/frontend-design` to pick a distinct aesthetic direction (avoid generic defaults), then `/design-system` to document tokens, typography, spacing, iconography, board themes (at least a light, a dark and a high-contrast theme), and component states. Choose fonts with licenses allowing self-hosting and a real fallback stack. Number colors must remain distinguishable for common color-vision deficiencies and meet contrast targets. Write `docs/DESIGN_SYSTEM.md`. Apply it to menu, board, HUD, result, lobby and account screens.
- **Expected output:** `docs/DESIGN_SYSTEM.md`, updated `tokens.css`, theme switcher, restyled screens, a `design-critique` pass recorded in the doc.
- **Testing requirements:** token coverage test (every theme defines every token); contrast unit tests for all text and number colors per theme; visual regression screenshots (Playwright) of key screens in each theme.
- **Acceptance criteria:** tests pass; design doc reviewed.
- **Relevant skills:** baseline; `/frontend-design`; `/design-system`; `/design-critique`.
- **Documentation updates:** `docs/DESIGN_SYSTEM.md`, `README.md` screenshots.

### M10-T02 Animations and transitions

- **Objective:** satisfying feedback without cost to speed or accessibility.
- **Description:** reveal cascades, flag placement, win and loss effects, screen transitions.
- **Prerequisites:** M10-T01.
- **Implementation guidance:** animations are driven by `GameEvent`s (Observer) inside the renderer or a presentation layer; they never delay input handling or game state. Cascade reveals animate outward by distance with a cap on total duration (for example under 400 ms). Respect `prefers-reduced-motion` and an in-game "reduce motion" setting: no motion, instant state. Budget: maintain 60 fps on the expert board during the largest cascade on a mid-range laptop; measure and record.
- **Expected output:** animation layer, settings toggle, tests, performance notes.
- **Testing requirements:** with reduced motion enabled, no animation timers are created (assert); input during an animation takes effect immediately; a deterministic animation clock in tests; frame-time benchmark for the maximum cascade.
- **Acceptance criteria:** budget met or documented exception; tests pass.
- **Relevant skills:** baseline; `/frontend-design`.
- **Documentation updates:** `docs/DESIGN_SYSTEM.md` (motion principles), `ARCHITECTURE.md`.

### M10-T03 Sound effects and `AudioController`

- **Objective:** audio feedback that helps and never annoys.
- **Description:** sound assets, an Observer-based controller, and settings.
- **Prerequisites:** M10-T01.
- **Implementation guidance:** `AudioController` subscribes to `GameEvent`s and the session lifecycle (countdown ticks, start, reveal, flag, cascade, win, loss, opponent finished) and plays sounds via Web Audio. Obey browser autoplay rules by unlocking audio on the first user gesture. Master volume and per-category mute persisted in local storage (try/catch). Sounds must be original or have a license that permits redistribution; record each asset's source and license in `docs/assets-licenses.md`. Rate-limit very frequent sounds during cascades.
- **Expected output:** `src/audio/`, assets, settings UI, license file, tests with a fake audio context.
- **Testing requirements:** events map to the expected sound ids; cascade sound throttling; muted categories play nothing; audio failures never throw into game code; settings persist and fall back when storage is unavailable.
- **Acceptance criteria:** tests pass; every asset has a recorded license.
- **Relevant skills:** baseline.
- **Documentation updates:** `docs/assets-licenses.md`, `ARCHITECTURE.md`.

### M10-T04 Responsive layout and touch controls (ADR-015)

- **Objective:** a good experience on phones and tablets.
- **Description:** responsive screens plus a touch input scheme.
- **Prerequisites:** M10-T02.
- **Implementation guidance:** layout breakpoints for phone, tablet and desktop; board scales to the viewport with pan and pinch-zoom for the expert board on small screens. Touch scheme: tap reveals, long-press flags (with haptic feedback where available), tap on a satisfied number chords, a flag/reveal mode toggle button as an alternative. Add `TouchInputController` implementing the same action mapping as `InputController`. Prevent accidental page zoom and scroll on the board. Decide and record platform scope in ADR-015 (D-08): mobile supported at launch or explicitly deferred for ranked play.
- **Expected output:** responsive CSS, `TouchInputController`, ADR-015, Playwright mobile-emulation tests.
- **Testing requirements:** gesture simulation tests for tap, long-press, double-tap and drag-pan; mobile-emulated e2e game; no horizontal page scroll at 320 px width; touch targets meet the minimum size on the preset the ADR supports on phones.
- **Acceptance criteria:** tests pass; ADR committed.
- **Relevant skills:** baseline; `/frontend-design`; `/architecture`.
- **Documentation updates:** `DECISIONS.md`, `README.md`, `docs/DESIGN_SYSTEM.md`.

### M10-T05 Accessibility audit and fixes

- **Objective:** meet WCAG 2.1 AA for the core experience.
- **Description:** audit with `/accessibility-review`, fix findings, retest.
- **Prerequisites:** M10-T04.
- **Implementation guidance:** audit all screens for contrast, keyboard navigation and focus order, focus visibility, screen-reader semantics for the board (a hidden structure or live announcements of the cursor cell's state and value), touch target sizes, motion and flashing, form labeling and error text, color-independence of information (numbers also differ by shape or pattern option). Add a "colorblind-safe" and "high contrast" theme option. Include the findings from `docs/a11y-findings.md`. Document known gaps honestly.
- **Expected output:** `docs/a11y-audit.md` with findings and status, fixes, automated axe checks in Playwright.
- **Testing requirements:** automated axe scan on every screen passes with no serious or critical violations; a manual screen-reader pass (record tool and result); keyboard-only completion of a race.
- **Acceptance criteria:** no open serious findings; document committed.
- **Relevant skills:** baseline; `/accessibility-review`.
- **Documentation updates:** `docs/a11y-audit.md`, `README.md` (accessibility statement).

### M10-T06 Performance optimization

- **Objective:** keep the game fast on modest hardware.
- **Description:** profile, set budgets, optimize where measured.
- **Prerequisites:** M10-T05.
- **Implementation guidance:** measure first: bundle size, time to interactive, input-to-paint latency on the expert board, memory over a long session (no leaks across restarts), and server CPU and memory with simulated matches. Set budgets (for example initial JS under a documented size) and enforce the bundle budget in CI. Optimize hot spots only: code-split lobby, account and leaderboard screens, dirty-rectangle rendering if the diff renderer is not enough, avoid per-frame allocations. Record before and after numbers.
- **Expected output:** `docs/performance.md` with measurements, CI bundle-size check, targeted optimizations, tests where behavior changed.
- **Testing requirements:** restart-loop test (100 restarts) shows stable memory; budgets enforced in CI; renderer benchmark remains within budget.
- **Acceptance criteria:** budgets met; numbers recorded.
- **Relevant skills:** baseline; `/systematic-debugging`.
- **Documentation updates:** `docs/performance.md`, `ARCHITECTURE.md`.

### M10-T07 Alpha release and telemetry decision (ADR-016)

- **Objective:** real people play it and tell you what breaks.
- **Description:** invite-only alpha with a feedback channel and a privacy-conscious telemetry policy.
- **Prerequisites:** M10-T06, M9.
- **Implementation guidance:** decide what, if anything, to measure (D-13): the minimum useful set (errors via Sentry in M11-T04, basic aggregate counts of matches and queue times) and what not to collect; record the policy in ADR-016, write a plain-language privacy note, and avoid third-party trackers. Add an in-app feedback link, a known-issues page, and a bug-report template that captures the match id. Deploy to a separate alpha URL or gate staging behind invites. Tag `v0.10.0`. Use `/deploy-checklist`. Triage feedback into `ROADMAP.md` as tasks.
- **Expected output:** alpha deployment, ADR-016, privacy note, feedback channel, release notes.
- **Testing requirements:** the post-deploy smoke test passes; a feedback submission path works; the privacy note matches what the app actually sends (verify network traffic in Playwright).
- **Acceptance criteria:** alpha live; ADR committed; tag `m10-complete` and `v0.10.0`.
- **Relevant skills:** baseline; `/deploy-checklist`; `/requesting-code-review`.
- **Documentation updates:** `DECISIONS.md`, `CHANGELOG.md`, `ROADMAP.md`, `README.md`.

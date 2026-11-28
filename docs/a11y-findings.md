# Accessibility findings

Written in M3-T08 with the `accessibility-review` checklist (WCAG 2.1 AA), for the solo client as it stands at the end of M3. M10-T05 (accessibility audit and fixes) starts from this file.

**What was and was not checked.** Checked: the markup, roles, names and key handling in jsdom tests; the compiled CSS of the production build (the skip link's classes); the contrast of the colors, computed (`tokens.test.ts`, `glyphContrast.test.ts`). **Not checked by anyone yet:** a real screen reader (NVDA, JAWS, VoiceOver, TalkBack), Chromium's real `:focus-visible` heuristics, the Playwright smoke tests (written in M3-T08, run by the developer and by CI), zoom to 200% and 400%, forced-colors mode, and a touch device. Every "Pass" below is a pass on paper unless it says otherwise.

## Accessibility Audit: solo client (menu, play, result)

**Standard:** WCAG 2.1 AA | **Date:** 2026-11-27

### Summary

**Open issues:** 7 | **Critical:** 0 | **Major:** 2 | **Minor:** 5

Decided and done in M3-T08: the board is a named `application` (it was a focusable `img`); the keyboard ring shows on keyboard focus; cursor moves, reveals, flags and the end of a game go to a live region; a skip link exists; `R` and `Shift+R` work only inside the game region (developer decision of 2026-11-27, option A of the three that M3-T06 listed).

### Findings

#### Perceivable

| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| P1 | The finished board (`role="img"`) is named with the outcome and size but does not describe the position (which cells are open, where the mines were). | 1.1.1 Non-text content | 🟢 Minor | Acceptable for now: the result list says the time, 3BV and cells cleared. M10-T05 may add a text summary of the final board if players ask for it. |
| P2 | In the dark theme an opened area is only a step lighter than the page background. The cell/background ratio is not a WCAG-required pair, but the board edge is hard to see at low vision. | 1.4.11 Non-text contrast | 🟢 Minor | Look at it in a browser. A thin border around the board (M10-T01) is the likely fix. |
| P3 | The board's size on a phone or at 400% zoom was never seen: below 16 CSS pixels a cell the wrapper scrolls sideways. A two-dimensional graphic is exempt from reflow (1.4.10), but the keyboard cursor must stay in view when the wrapper scrolls. | 1.4.10 Reflow | 🟢 Minor | Check in a browser at 400% zoom; scroll the cursor cell into view if it leaves the box (M10-T04/T05). |

#### Operable

| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| O1 | **Closed in M3-T08.** `R` and `Shift+R` were heard on the whole page (single printable character shortcut). They are now heard only while the focus is inside the game region (the board, the buttons and the heading of the play and result screens). | 2.1.4 Character key shortcuts (A) | ✅ was 🟡 Major | Done. Cost, taken knowingly: after a click on the empty page background the focus is on `body`, outside the region, and `R` does nothing until the player clicks or tabs back into the game. A visible "R: new board" hint is next to the board. |
| O2 | Cells are 16 to 40 CSS pixels. A mouse or touch target under 24 px fails WCAG 2.2 SC 2.5.8 (AA in 2.2, not in 2.1) and is far under the 44 px of 2.5.5 (AAA). Keyboard play has no such limit. | 2.5.5 / 2.5.8 Target size | 🟡 Major (for touch) | Belongs to M10-T04 (touch controls, ADR-015): larger minimum cell on touch devices, long-press to flag. The controller listens to mouse events only today. |
| O3 | A held key repeats cursor moves but not actions. There is no way to move to the start or end of a row (Home/End) or by pages, so crossing the expert board takes up to 29 presses. | 2.1.1 Keyboard | 🟢 Minor | Not required by the criterion (all functions are reachable). Consider Home, End, PageUp, PageDown in M10-T05. |
| O4 | Focus order on the play screen: skip link, theme button, (move-limit alert button), board, "Change difficulty". Logical. After `R` the board takes the focus again; after a game ends the result heading does. | 2.4.3 Focus order | ✅ Pass (on paper) | Verify with a keyboard in Chromium. |
| O5 | The focus indicator on the board is the cursor ring, drawn on the canvas, shown on keyboard focus (`:focus-visible`) and after the first key when the focus came from the mouse. Buttons and the skip link use the global `:focus-visible` outline. | 2.4.7 Focus visible | ✅ Pass (on paper) | The ring's contrast against the cells (3:1) is computed, not seen. |

#### Understandable

| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| U1 | Focus never changes the page: a keyboard focus only draws the ring and says nothing at start-up (so "New game: ..." is not overwritten). | 3.2.1 On focus | ✅ Pass | None. |
| U2 | The key help (arrows, Space, F, C/Enter, R, Shift+R) is the board's `aria-describedby`, so a screen reader reads it on every focus of the board, which is also after each restart. It may be too long to hear repeatedly. | 3.3.2 Labels or instructions | 🟢 Minor | Try it with a screen reader. If tiring, shorten it to "Arrow keys, Space, F, C. Help: H" and move the full text behind a key. |

#### Robust

| # | Issue | WCAG | Severity | Recommendation |
|---|-------|------|----------|----------------|
| R1 | The play board is `role="application"` named "Minesweeper board, 9 by 9". `application` makes most screen readers pass keys to the page, which the board needs, and hides the canvas's lack of structure. A real grid of buttons would give per-cell semantics but costs the Canvas renderer (ADR-005). | 4.1.2 Name, role, value | 🟡 Major (until tried) | Try NVDA+Firefox/Chrome, JAWS, VoiceOver. If `application` is poorly supported, add `aria-roledescription` or move to an offscreen `grid` that mirrors the view (decision for M10-T05). |
| R2 | At the end of a game the live region says "You hit a mine. Game over." or "You cleared the board in 12.3 seconds." and the result heading, which takes the focus, says "You hit a mine" or "You cleared the board". A screen reader may read both. | 4.1.3 Status messages | 🟢 Minor | Listen to it. If it is noisy, drop the end-of-game message from the region and keep the heading, or keep the time in the region only. |
| R3 | The HUD readouts (time, mines left) are plain text and not live (a tenth-of-a-second announcement would be noise). Mines left is not spoken when a flag is placed. | 4.1.3 Status messages | 🟢 Minor | Consider "Flag placed at row 3, column 4. 9 mines left." and a key that reads the clock. |
| R4 | Announcements are built from engine events only (`describeEvent`). A loss names no cell: `gameLost.mineIndex` stays out of every message, so the live region needs no race-specific code and cannot leak a mine position (D-14). | n/a | ✅ Pass | Keep it so when `RemoteSession` arrives (M5-T06); the leak test of M5-T05 should include the live region. |

### Color contrast check

Computed by the existing tests, not seen in a browser.

| Element | Ratio | Required | Pass? |
|---------|-------|----------|-------|
| Number glyphs 1 to 8 on the revealed cell, light and dark | at least 4.5:1 (`tokens.test.ts`) | 4.5:1 | ✅ |
| Flag pole and mine on hidden and revealed cells | at least 4.5:1 (`glyphContrast.test.ts`) | 3:1 | ✅ |
| Flag cloth and the wrong-flag cross | at least 3:1 (`glyphContrast.test.ts`) | 3:1 | ✅ |
| Cursor ring (accent) on hidden and revealed cells | at least 3:1 (`glyphContrast.test.ts`) | 3:1 | ✅ |
| Text, muted text, accent and danger on their surfaces | at least 4.5:1 (`tokens.test.ts`) | 4.5:1 | ✅ |
| Skip link: surface text on the accent when focused | follows the accent/surface pair above | 4.5:1 | ✅ (not seen) |

### Keyboard navigation

| Element | Tab order | Enter / Space | Escape | Arrow keys |
|---------|-----------|---------------|--------|------------|
| Skip link (play screen only) | 1 | Moves the focus to the board | - | - |
| Theme button | 2 | Cycles the theme | - | - |
| Board (canvas, `application`) | 3 | Space reveals, Enter or C chords, F flags (at the cursor) | not used | Move the cursor, stop at the edges |
| Move-limit "New board" (only when stuck) | before the board | Starts a new board | - | - |
| "Change difficulty" | after the board | Back to the menu | - | - |
| `R` / `Shift+R` | not a tab stop | New board / retry the same board, only while the focus is in the game region | - | - |

### Screen reader (expected, not heard)

| Element | Announced as (expected) | Issue |
|---------|-------------------------|-------|
| Board on focus | "Minesweeper board, 9 by 9, application", then the key help | See U2 and R1. |
| Arrow key | "Row 4, column 5, hidden" | Spoken through the polite live region, which a screen reader in focus mode may or may not read. |
| Space on a hidden cell | "Revealed 2 at row 4, column 5." or "Opened 14 cells." | None known. |
| F | "Flag placed at row 4, column 5." | R3: mines left is not said. |
| End of a game | "You cleared the board in 12.3 seconds." then the heading | R2. |
| Result board | image "Finished board, 9 by 9. You cleared the board." | P1. |

### Priority fixes

1. **Try the live region and the `application` role with a real screen reader** (R1, R2, U2) — affects blind and low-vision players and everything in this file that says "on paper". Do it before M10-T05 plans any redesign.
2. **Touch targets and touch controls** (O2) — blocks touch play and fails a 2.2 AA criterion; part of M10-T04.
3. Smaller: mines left in the flag message (R3), Home/End keys (O3), a board border in dark mode (P2), scrolling the cursor into view at high zoom (P3).

### Carried over from the earlier tasks

The M3-T03 to M3-T07 notes in `DECISIONS.md` listed material for this file; where it ended up: the focusable `img` (closed, R1); the ring shown only after the first key (closed for keyboard focus, O5); cursor moves not announced (closed); the global `R` (closed, O1); the skip link target (closed); the board's accessible name without the outcome on the result screen (closed, P1); the exploded mine is not marked on the board (still open, it needs a change to `GameView` or the renderer interface and a decision, and in a race it touches D-14); the "Your records" table dash for a missing number (still open, minor: some screen readers read "dash"); the stuck message `role="alert"` (kept).

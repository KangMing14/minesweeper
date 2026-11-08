# Decisions

Where decisions live: **architecture decision records (ADRs)** in `docs/adr/`, one file per decision, plus this index; **open decisions** in the table below until an ADR settles them; and the **dependency pins** at the end of this file, which are inputs to ADR-005.

## How decisions are recorded

- One file per decision: `docs/adr/ADR-0NN-short-title.md`. The ADRs are written by the tasks named in the index below; the first eight in M0-T06.
- **Append-only.** An accepted ADR is never edited. A changed decision gets a new ADR that supersedes the old one; the old file only gains a `Superseded by ADR-0NN` line in its status.
- A task that conflicts with an ADR stops and proposes a new ADR (see `CLAUDE.md`, rule 4).
- When an open decision is settled, its row below changes to `Settled by ADR-0NN` in the same task that writes the ADR, and the milestone close-out lists it in `CHANGELOG.md`.

### ADR template

```markdown
# ADR-0NN: <title>

- Status: Proposed | Accepted | Superseded by ADR-0NN
- Date: <YYYY-MM-DD>
- Task: <Mn-Tnn>
- Settles: <D-nn, or "none">

## Context
<The situation and the forces at play. What would go wrong without a decision?>

## Decision
<What was decided, in one or two paragraphs, in the present tense.>

## Consequences
<What becomes easier, what becomes harder, what must now be true. Include the known limits.>

## Alternatives
<The options considered and why each was not chosen.>
```

## ADR index

Source: master plan, "ADR plan". **None written yet**: the table is the plan, and every row stays `Planned` until its task commits the file.

| ADR | Decision | Task | Status |
|---|---|---|---|
| ADR-001 | Monorepo and modular monolith | M0-T06 | Planned |
| ADR-002 | Deterministic engine | M0-T06 | Planned |
| ADR-003 | Server-authoritative play | M0-T06 | Planned |
| ADR-004 | `GameSession` adapter | M0-T06 | Planned |
| ADR-005 | Technology stack (incl. Better Auth re-verification) | M0-T06 | Planned |
| ADR-006 | Git workflow | M0-T06 | Planned |
| ADR-007 | Code documentation | M0-T06 | Planned |
| ADR-008 | License | M0-T06 | Planned |
| ADR-009 | Cell rules: chording and flags (D-04) | M1-T05 | Planned |
| ADR-010 | Race rules and presets (D-01, D-02) | M4-T03 | Planned |
| ADR-011 | Disconnect grace period (D-05) | M6-T03 | Planned |
| ADR-012 | Auth methods (D-07) | M7-T02 | Planned |
| ADR-013 | Rating system (D-06) | M8-T04 | Planned |
| ADR-014 | Hosting provider (D-09) | M9-T02 | Planned |
| ADR-015 | Platform priority and touch (D-08) | M10-T04 | Planned |
| ADR-016 | Telemetry and privacy (D-13) | M10-T07 | Planned |

## Open decisions

D-01 to D-11 come from spec section 3, D-12 and D-13 from the master plan. The working assumption is what tasks may rely on until the owning task settles it.

| ID | Item | Working assumption | Owner | Status |
|---|---|---|---|---|
| D-01 | Board presets | Classic three: beginner 9x9/10, intermediate 16x16/40, expert 30x16/99. Ranked race preset undecided. | M4-T03 (ADR-010); working values in M1-T01 | Open |
| D-02 | Mine hit in a race | Hitting a mine ends your run (DNF). If both DNF, more safe cells revealed wins. Alternative: time penalty and continue. | M4-T03 (ADR-010) | Open |
| D-03 | Match format | Single round for the first networked race; best-of-N as a configurable `MatchRules` value later. | M5-T04 (single round); revisited in M8-T06 | Open |
| D-04 | Chording and flags | Chording allowed; flags allowed but never required to win; no question marks. | M1-T05 (ADR-009) | Open |
| D-05 | Disconnect grace period | 30 seconds to resume before forfeit. | M6-T03 (ADR-011) | Open |
| D-06 | Rating system | Glicko-2 behind a `RatingSystem` strategy; final choice at M8. | M8-T04 (ADR-013) | Open |
| D-07 | Auth methods | Guests plus email/password at launch; OAuth providers undecided. | M7-T02 (ADR-012) | Open |
| D-08 | Platform priority | Desktop-first; mobile and touch controls at M10. | M10-T04 (ADR-015) | Open |
| D-09 | Hosting provider | Single container on a VPS or PaaS; provider undecided. | M9-T02 (ADR-014) | Open |
| D-10 | Ping fairness | Higher-latency players are disadvantaged; pipelining and server timestamps mitigate but do not eliminate. Accepted for the MVP as a known limit. | Measured in M5-T08 and M11-T02; recorded in `ARCHITECTURE.md` | Accepted limit |
| D-11 | Capacity target | About 200 concurrent matches on one small instance. | Measured in M11-T02 | Open |
| D-12 | License | Open source or all rights reserved until launch. | M0-T06 (ADR-008) | Open |
| D-13 | Telemetry and privacy | Working idea: the minimum useful set (errors, basic aggregate counts of matches and queue times). What, if anything, is measured is decided in M10-T07. | M10-T07 (ADR-016) | Open |


## ADR-005 input: dependency pins

Versions were looked up on the npm registry on **2026-11-05**. Rule: the newest stable release at least 14 days old (published on or before 2026-10-22), within the major line of the registry's `latest`, unless a compatibility note says otherwise. Every version is exact (no `^` or `~`). "Latest" is what the registry tagged `latest` on that day.

Only the rows marked **installed** are in a `package.json` today. The rest are decided pins that the named task adds; that task re-verifies the version before adding it (plan, Global Constraints).

### Runtime and package manager

| Tool | Pin | Published | Latest on 2026-11-05 | Status and notes |
|---|---|---|---|---|
| `node` | 24 (LTS line); `engines.node` `>=24.15.0` | 24.22.1 is 14 days old | 26.12.x | **installed** via `.nvmrc` and `engines`. Node 26 became LTS on 2026-10-28, eight days ago, which is under the two-week preference. Node 24 is LTS until 2028-04-30. `eslint-plugin-jsdoc` requires `>=24.15.0` on the 24 line, which sets the floor. Revisit Node 26 once it is a few months old. |
| `pnpm` | 12.15.0 | 2026-10-21 | 12.16.1 (2026-10-27) | **installed** via `packageManager` (use `corepack enable`). |

### Language and types

| Tool | Pin | Published | Latest on 2026-11-05 | Status and notes |
|---|---|---|---|---|
| `typescript` | 6.0.3 | 2026-04-16 | 7.0.2 (2026-07-08) | **installed**. Deliberately not 7.x: `typedoc@0.28.20` accepts TypeScript up to 6.0.x and `typescript-eslint@8.72.0` accepts `<6.1.0`, so 7.x would break M0-T03 and M0-T04. Revisit when both support 7. |
| `@types/node` | 24.19.2 | 2026-10-09 | 26.6.6 | **installed** in `apps/server` and, from M0-T04, at the root (types for `vitest.config.ts` and for Vitest's own declarations). Packages keep `types: []`. Matches the Node 24 runtime line. |

### Client (M3-T01)

| Tool | Pin | Published | Latest on 2026-11-05 | Status and notes |
|---|---|---|---|---|
| `react` | 19.3.1 | 2026-10-14 | 19.3.1 | M3-T01 |
| `react-dom` | 19.3.1 | 2026-10-14 | 19.3.1 | M3-T01 |
| `@types/react` | 19.3.0 | 2026-09-09 | 19.3.0 | M3-T01 |
| `@types/react-dom` | 19.3.0 | 2026-09-09 | 19.3.0 | M3-T01 |
| `vite` | 8.3.5 | 2026-10-21 | 8.3.5 | **installed** at the root in M0-T04, because Vitest 5 takes `vite` as a peer dependency. M3-T01 adds the same version to `apps/web`. |
| `@vitejs/plugin-react` | 6.1.2 | 2026-10-05 | 6.2.1 (2026-11-02) | M3-T01. Peer: `vite ^8`. |
| `zustand` | 5.0.15 | 2026-08-13 | 5.0.16 (2026-10-22) | M3-T01 |
| `tailwindcss` | 4.3.3 | 2026-07-16 | 4.3.4 (2026-11-02) | M3-T01 |
| `@tailwindcss/vite` | 4.3.3 | 2026-07-16 | 4.3.4 (2026-11-02) | M3-T01. Keep equal to `tailwindcss`. |

Radix primitives are pinned per component when first used (M3, M10).

### Server and data (M5, M7)

| Tool | Pin | Published | Latest on 2026-11-05 | Status and notes |
|---|---|---|---|---|
| `fastify` | 5.12.7 | 2026-10-13 | 5.12.8 (2026-11-02) | M5-T03 |
| `ws` | 8.22.0 | 2026-09-26 | 8.22.1 (2026-10-31) | M5-T03 |
| `@types/ws` | 8.18.2 | 2026-09-29 | 8.18.2 | M5-T03 |
| `zod` | 4.6.7 | 2026-10-12 | 4.6.7 | M5-T01 |
| `pino` | 10.4.0 | 2026-10-02 | 10.4.0 | M5-T03 |
| `drizzle-orm` | 0.45.4 | 2026-10-08 | 0.45.4 | M7-T01 |
| `drizzle-kit` | 0.31.11 | 2026-09-21 | 0.31.11 | M7-T01 |
| `pg` | 8.23.1 | 2026-09-30 | 8.23.1 | M7-T01. The Postgres driver is confirmed in M7-T01. |
| `better-auth` | 1.7.12 | 2026-10-20 | 1.7.17 (2026-11-04) | M7-T02. Maintenance status, advisories and Drizzle adapter support are re-verified in M0-T06 (ADR-005). |
| `@sentry/node` | 11.8.0 | 2026-10-15 | 11.10.0 (2026-10-28) | M11. The browser SDK is looked up then. |

### Quality tooling (M0-T03, M0-T04, M3)

| Tool | Pin | Published | Latest on 2026-11-05 | Status and notes |
|---|---|---|---|---|
| `eslint` | 10.13.0 | 2026-10-16 | 10.14.0 (2026-10-30) | **installed** in M0-T03. |
| `@eslint/js` | 10.0.1 | 2026-02-06 | 10.0.1 | **installed** in M0-T03. Verified: pairs with `eslint` 10.13.0. |
| `typescript-eslint` | 8.72.0 | 2026-10-19 | 8.72.1 (2026-10-26) | **installed** in M0-T03. Peer: `typescript <6.1.0`. |
| `eslint-plugin-tsdoc` | 0.5.4 | 2026-09-29 | 0.5.4 | **installed** in M0-T03. |
| `eslint-plugin-jsdoc` | 65.4.0 | 2026-10-20 | 65.4.3 (2026-11-03) | **installed** in M0-T03. Node `^22.22.2 \|\| >=24.15.0`. |
| `prettier` | 3.9.10 | 2026-10-10 | 3.9.10 | **installed** in M0-T03. |
| `husky` | 9.1.7 | 2024-11-18 | 9.1.7 | **installed** in M0-T03. Verified in M0-T03: hooks run under pnpm 12.15.0. Caveat: `pnpm install` on an already up-to-date install skips `prepare`; run `pnpm prepare` to wire the hooks. |
| `lint-staged` | 17.6.0 | 2026-09-26 | 17.6.0 | **installed** in M0-T03. Node `>=22.22.1`. |
| `@commitlint/cli` | 21.2.4 | 2026-10-18 | 21.2.4 | **installed** in M0-T03. |
| `@commitlint/config-conventional` | 21.2.4 | 2026-10-18 | 21.2.4 | **installed** in M0-T03. Keep equal to the CLI. |
| `vitest` | 5.0.5 | 2026-10-15 | 5.1.0 (2026-11-02) | **installed** in M0-T04. Peers: `vite ^6.4 \|\| ^7 \|\| ^8`, `@types/node ^22 \|\| >=24`. |
| `@vitest/coverage-v8` | 5.0.5 | 2026-10-15 | 5.1.0 (2026-11-02) | **installed** in M0-T04. Must equal the `vitest` version. |
| `typedoc` | 0.28.20 | 2026-07-05 | 0.28.20 | **installed** in M0-T04. Peer: `typescript <=6.0.x`; this is why TypeScript stays on 6.0.3. |
| `@playwright/test` | 1.64.1 | 2026-10-14 | 1.64.1 | M3-T08 |

### M0-T03 verification notes

Re-verified on 2026-11-06 before adding: all ten packages exist at the pinned versions, none is deprecated, each was published on or before 2026-10-22, and all peer ranges are satisfied by `eslint` 10.13.0, `typescript` 6.0.3 and Node 24.

- **Known peer warning (accepted):** `pnpm install` reports `eslint-plugin-tsdoc@0.5.4` pulling its own pinned `@typescript-eslint/utils@8.56.1`, whose peer range is `typescript <6.0.0`. The plugin only uses it for parsing helpers; the `tsdoc/syntax` rule is pinned by fixtures and works on TypeScript 6.0.3. No override added. Revisit when `eslint-plugin-tsdoc` releases a newer version (input for ADR-005).
- **Prettier scope:** code and config files only (`ts, tsx, mts, cts, js, mjs, cjs, json, yml, yaml`). Markdown and text are excluded so hand-written docs are not rewritten.
- **Test runner for tooling:** the lint fixtures use Node's built-in `node:test`, so M0-T03 does not depend on Vitest (M0-T04).

### M0-T03 inputs for ADR-006 and ADR-007

No ADR was written in M0-T03 (the eight foundation ADRs are M0-T06) and no open decision was closed. These choices refine spec sections 7.1 and 7.2 and belong in those ADRs.

- **ADR-006 (git workflow):** commitlint allows the types `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci` and the optional scopes `engine`, `protocol`, `server`, `web`, `docs`. The subject must end with `[Mn-Tnn]` or `[chore]`; GitHub's ` (#n)` suffix after a squash-merge is allowed. The default `subject-case` rule is off because subjects often start with an acronym (`PRNG`, `ADR-001`); the type must still be lower case. Hooks are installed by `pnpm prepare`, which an up-to-date `pnpm install` skips.
- **ADR-007 (code documentation):** `tsdoc/syntax` runs on all TypeScript. `jsdoc/require-jsdoc` on exports is an error in `engine` and `protocol` and a warning in `apps/*` until M5-T03. `jsdoc/require-example` on exports is an error in `engine` and `protocol` (test files exempt) and only sees declarations exported in the same statement. `@param` and `@returns` completeness is not machine-enforced. TypeDoc arrives in M0-T04.

### M0-T04 verification notes

Re-verified on 2026-11-07 before adding: `vitest@5.0.5`, `@vitest/coverage-v8@5.0.5`, `typedoc@0.28.20`, `vite@8.3.5` and `@types/node@24.19.2` exist on the registry, none is deprecated, each was published on or before 2026-10-21 (at least 14 days old), and no peer range is violated by `typescript` 6.0.3 or Node 24. `vitest` and `@vitest/coverage-v8` 5.1.0 (2026-11-02) were skipped for being under two weeks old. The only peer warning is the accepted `eslint-plugin-tsdoc` one above; installing the new packages added none.

- **Vitest 5 has no workspace file.** The task text lists `vitest.workspace.ts`, but Vitest 5.0.5 throws on the removed `test.workspace` option and does not read workspace files. Projects are declared with `test.projects` in `vitest.config.ts` (one per package). Same intent, current API.
- **`vite` at the root.** Vitest lists `vite` as a peer, not a dependency, so it must be installed. It is the exact version already reserved for M3-T01.
- **Tests run against workspace source.** `vitest.config.ts` aliases `@minesweeper/engine` and `@minesweeper/protocol` to their `src/index.ts`. Reason: `exports` point at `dist/`, which does not exist on a fresh clone, and `--changed` needs the source module graph to see cross-package effects. Types still come from `dist/` through `tsc -b`.
- **TypeDoc** uses `entryPointStrategy: "packages"` and reads the TypeScript source through each package's tsconfig, so it works without a prior build. It runs with the defaults (unresolved links, unexported references) as errors. `validation.notDocumented` is deliberately not enabled: spec 7.2 requires comments on exported symbols, not on every member.
- **Coverage:** provider v8, reporters `text`, `json-summary`, `lcov`, no thresholds until M1.
- **Verification limit:** the workflow has not run on GitHub yet. It passes `actionlint` 1.7.12, and every step's command was run locally on a fresh copy with a frozen lockfile. The first real run is the pull request that adds it.

### GitHub Actions pins (M0-T04)

Pinned by full commit SHA in `.github/workflows/ci.yml`. Tag commit dates were all more than 14 days before 2026-11-07. All four run on the `node24` action runtime.

| Action | Tag | Commit SHA | Tag commit date |
|---|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-17 |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | 2026-10-07 |
| `actions/cache` | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | 2026-06-23 |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | 2026-10-07 |

`pnpm/action-setup` is not used: Corepack provides pnpm from the `packageManager` field.

### M0-T04 inputs for ADR-005, ADR-006 and ADR-007

No ADR was written in M0-T04 and no open decision was closed.

- **ADR-005 (stack):** Vitest 5 with `test.projects`, v8 coverage, TypeDoc 0.28 in `packages` mode, CI on GitHub Actions with Corepack-provided pnpm and SHA-pinned actions.
- **ADR-006 (git workflow):** the required status check is the single job `ci`; the PR title is linted in CI because squash-merge uses it as the commit subject; `pre-push` runs `test:affected` (tests affected since `origin/main`).
- **ADR-007 (code documentation):** TypeDoc warnings are errors in CI; the reference is a CI artifact (`ci-reports`), never committed.


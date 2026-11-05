# Decisions

> Stub created in M0-T02 with the dependency version table only. M0-T05 completes this document (ADR template, ADR list, open decisions D-01..D-13) and must keep the section below. ADRs themselves live in `docs/adr/` from M0-T06.

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
| `@types/node` | 24.19.2 | 2026-10-09 | 26.6.6 | **installed** in `apps/server` only. Matches the Node 24 runtime line. |

### Client (M3-T01)

| Tool | Pin | Published | Latest on 2026-11-05 | Status and notes |
|---|---|---|---|---|
| `react` | 19.3.1 | 2026-10-14 | 19.3.1 | M3-T01 |
| `react-dom` | 19.3.1 | 2026-10-14 | 19.3.1 | M3-T01 |
| `@types/react` | 19.3.0 | 2026-09-09 | 19.3.0 | M3-T01 |
| `@types/react-dom` | 19.3.0 | 2026-09-09 | 19.3.0 | M3-T01 |
| `vite` | 8.3.5 | 2026-10-21 | 8.3.5 | M3-T01 |
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
| `eslint` | 10.13.0 | 2026-10-16 | 10.14.0 (2026-10-30) | M0-T03 |
| `@eslint/js` | 10.0.1 | 2026-02-06 | 10.0.1 | M0-T03. Check it pairs with `eslint` 10.13.0 when added. |
| `typescript-eslint` | 8.72.0 | 2026-10-19 | 8.72.1 (2026-10-26) | M0-T03. Peer: `typescript <6.1.0`. |
| `eslint-plugin-tsdoc` | 0.5.4 | 2026-09-29 | 0.5.4 | M0-T03 |
| `eslint-plugin-jsdoc` | 65.4.0 | 2026-10-20 | 65.4.3 (2026-11-03) | M0-T03. Node `^22.22.2 \|\| >=24.15.0`. |
| `prettier` | 3.9.10 | 2026-10-10 | 3.9.10 | M0-T03 |
| `husky` | 9.1.7 | 2024-11-18 | 9.1.7 | M0-T03. No release for almost two years; check it still works with pnpm 12 hooks. |
| `lint-staged` | 17.6.0 | 2026-09-26 | 17.6.0 | M0-T03. Node `>=22.22.1`. |
| `@commitlint/cli` | 21.2.4 | 2026-10-18 | 21.2.4 | M0-T03 |
| `@commitlint/config-conventional` | 21.2.4 | 2026-10-18 | 21.2.4 | M0-T03. Keep equal to the CLI. |
| `vitest` | 5.0.5 | 2026-10-15 | 5.1.0 (2026-11-02) | M0-T04. Peer: `vite ^6.4 \|\| ^7 \|\| ^8`. |
| `@vitest/coverage-v8` | 5.0.5 | 2026-10-15 | 5.1.0 (2026-11-02) | M0-T04. Must equal the `vitest` version. |
| `typedoc` | 0.28.20 | 2026-07-05 | 0.28.20 | M0-T04. Peer: `typescript <=6.0.x`; this is why TypeScript stays on 6.0.3. |
| `@playwright/test` | 1.64.1 | 2026-10-14 | 1.64.1 | M3-T08 |

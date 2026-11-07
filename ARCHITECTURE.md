# Architecture

> Stub created in M0-T02 with the package layout only. M0-T05 completes this document (diagrams from the spec, canonical names, public interfaces). Source of truth until then: `docs/superpowers/specs/2026-11-04-competitive-minesweeper-design.md` section 4 and the plan's "Canonical names" table.

## Package layout

pnpm workspaces, strict TypeScript, ESM everywhere (`"type": "module"`). Spec section 4.2.

| Directory | npm name | Role | Depends on (workspace) |
|---|---|---|---|
| `packages/engine` | `@minesweeper/engine` | Pure, deterministic game logic. No DOM, Node APIs, clocks or `Math.random`. | nothing |
| `packages/protocol` | `@minesweeper/protocol` | Wire-message schemas and shared types. | `engine` (types only) |
| `apps/server` | `@minesweeper/server` | Authoritative game server (Fastify and `ws`). | `engine`, `protocol` |
| `apps/web` | `@minesweeper/web` | Browser client (React, Vite, Canvas 2D). | `engine`, `protocol` |

The `@minesweeper/` scope is a naming choice made in M0-T02; the plan's canonical-names table covers symbols, not package names.

## Dependency rule

```
engine  <-  protocol  <-  apps/server
                      <-  apps/web
```

Dependencies only point inward. `apps/server` and `apps/web` never depend on each other, and nothing depends on an app. This is enforced twice. By `package.json` and TypeScript project references (M0-T02): pnpm links only declared dependencies, so an undeclared import fails to typecheck (TS2307). By lint rules (M0-T03, `eslint.config.js`): `engine` may import nothing project-internal and no Node built-ins, `protocol` may import only `@minesweeper/engine`, and the two apps may not import each other, by package name or relative path. Each rule is pinned by a fixture in `tools/lint-fixtures/`.

## TypeScript configuration

- `tsconfig.base.json` holds the shared strict options: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
- The root `tsconfig.json` is solution-style (`files: []`, references to all four packages). `pnpm typecheck` and `pnpm build` both run `tsc -b`, which builds referenced projects first.
- `engine` and `protocol` are `composite` projects emitting to `dist/` (ignored by git), with `lib: ["ES2023"]` and `types: []`. With no DOM lib and no ambient `@types`, using `document`, `window` or `process` in them is a compile error. This backs the engine's purity rule (spec section 4.1) in addition to the lint bans from M0-T03 (`Math.random`, `Date`, `performance`, `window`, `document`, `process`, also through `globalThis`; test files may read the clock).
- `apps/server` uses Node module resolution (`NodeNext`) and `types: ["node"]`.
- `apps/web` uses `Bundler` resolution, the DOM lib, `jsx: react-jsx` and `noEmit`; Vite does the real build from M3-T01.
- Packages `engine` and `protocol` expose one public entry point through `exports` (`dist/index.js`, `dist/index.d.ts`); consumers import the package name, never a deep path.

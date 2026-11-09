# ADR-005: Technology stack

- Status: Accepted
- Date: 2026-11-09
- Task: M0-T06
- Settles: none

## Context

The stack was chosen in spec section 5 and its versions were looked up and pinned during M0-T02 to M0-T04. This record fixes the choices, states the rule that governs versions, and records the one assumption the spec marked as risky: that Better Auth is still a sound choice for accounts and guest sessions ("re-verify Better Auth's status at M0"). The project is built by one developer, so every dependency is also a maintenance and security commitment. The exact version of every package lives in `package.json` and in the pin tables of [DECISIONS.md](../../DECISIONS.md), not here, because pins change monthly and an accepted ADR is never edited.

## Decision

The stack is the following; the main alternative for each row is in "Alternatives".

| Layer | Choice |
|---|---|
| Repository and runtime | pnpm workspaces (pnpm provided by Corepack through `packageManager`), Node on the 24 LTS line (`.nvmrc`, `engines` `>=24.15.0`), strict TypeScript, ESM everywhere |
| Client | React and Vite, Zustand for client state |
| Board rendering | Canvas 2D behind `BoardRenderer` |
| Styling | Tailwind CSS with CSS-variable tokens, Radix primitives added per component |
| Server | Fastify for REST and `ws` for game sockets, in one process |
| Validation | Zod in `@minesweeper/protocol` |
| Database | PostgreSQL with Drizzle; no Redis at the MVP |
| Authentication | Better Auth (self-hosted, with its anonymous-session plugin for guests), kept inside one module of `apps/server` |
| Testing | Vitest with one project per package, Playwright from M3-T08 |
| Quality and CI | ESLint (flat config), Prettier, GitHub Actions with a single job named `ci` and every action pinned by commit SHA |
| Documentation tooling | TSDoc, enforced by ESLint, and TypeDoc (ADR-007) |
| Hosting | Docker on a VPS or PaaS with managed Postgres; the provider is decided in ADR-014 (D-09) |
| Observability | pino for logs, Sentry for errors |

### Rules for versions

- Every version is exact: no `^` or `~` on a tool or a dependency.
- A task that adds a package looks the version up again on the day it adds it. The default is the newest stable release that is at least 14 days old and within the major line the registry tags `latest`, because a young release has had little time for problems to surface.
- Two exceptions: a compatibility note (below), and a security fix. A version below the first patched release of a published security advisory is not eligible, however old it is, and the 14-day wait does not apply to the patched version. This second exception is new in this record.
- Deliberate hold-backs at the time of writing: TypeScript 6.0.x is kept, not 7.x (`typescript` 6.0.3), because `typedoc` 0.28.x accepts TypeScript only up to 6.0.x and `typescript-eslint` 8.72 accepts `<6.1.0`, so 7.x would break lint and the API reference until both support it. Node stays on the 24 LTS line while Node 26 is new. Revisit both when the tooling catches up.

### Better Auth re-verification (2026-11-09)

Method: package metadata and version history from the npm registry for `better-auth`, `@better-auth/core` and `@better-auth/drizzle-adapter`; the vendor's published changelog and security posts; GitHub's published advisory list for the repository; and the Vercel security bulletin on the November release. I also unpacked the 1.7.16 package to confirm the anonymous plugin ships in it.

- **Maintenance status.** Pass. MIT license, the latest release (1.7.18) was published on 2026-11-05, and 1.7.18 is not marked deprecated. Several release lines are maintained in parallel (1.6, 1.7, and a 1.8 beta).
- **Release cadence.** Very active: from April to October 2026 the registry shows between 4 and 17 published versions a month, counting pre-releases.
- **Open security advisories.** Not clean, which is why the pin changes. Advisory rounds were published at the end of May and in June 2026 (fixed from 1.6.11), on 2026-09-29 and 2026-09-30 (including one rated Critical in core, where an OAuth state value could be used as a magic link), and on **2026-11-03**, when a coordinated release fixed **12 advisories** in 1.7.16, one of them Critical (in `@better-auth/expo`). Every `better-auth` version below 1.7.16 is affected by that release. Most of those advisories are in plugins this project will not use (Expo, Electron, phone number, Stripe, passkey, organization, admin, SSO). The ones that reach what this project plans to use (email and password, anonymous guests, Drizzle on PostgreSQL) are: email-change links that stay valid after the address changes hands, an OAuth sign-in that can treat an unverified provider email as verified, revoked sessions that can stay valid with secondary storage or the cookie cache, and an anonymous user being linked on a sign-in that is still waiting for a second factor. A MySQL-only advisory in the Drizzle adapter does not apply to PostgreSQL. I found no advisory that names 1.7.18, and the 1.7.17 and 1.7.18 changelog entries describe bug fixes only.
- **Drizzle adapter support.** Pass. `@better-auth/drizzle-adapter` ships as a dependency of `better-auth` at the identical version, so it needs no separate pin. Its peer ranges (`drizzle-orm` `^0.45.2`, `drizzle-kit` `>=0.31.4`, `pg` `^8`) are satisfied by the pinned 0.45.4, 0.31.11 and 8.23.1, and its `zod` dependency range (`^4.5.4`) accepts the pinned 4.6.7. The `anonymous` plugin is present in the 1.7.16 package I unpacked.
- **Version decision.** `DECISIONS.md` pinned 1.7.12 (published 2026-10-20) on 2026-11-05 under the 14-day rule. That version is affected, because the fixed versions were then less than 14 days old. Applying the rule today would select 1.7.14, which is affected too. The developer decided to pin **1.7.18**, the current `latest` (published 2026-11-05, 4 days old), as a security exception to the 14-day rule, rather than 1.7.16, the first patched release.
- **Verdict.** Better Auth passes, with conditions: pin 1.7.18 or newer; keep every `@better-auth/*` package at the same version as `better-auth`; M7-T02 repeats this check on the day it installs the package; use only the core, email and password, and the anonymous plugin unless a task records a reason for another; and treat an upgrade for a security advisory as maintenance work that is due immediately.
- **Fallback if it fails.** If M7-T02 finds Better Auth unusable (an unpatched High or Critical advisory in the core it uses, abandonment, or a break with the Drizzle adapter), accounts move to self-managed sessions: password hashing with a maintained library, a sessions table through Drizzle, and guests as rows without credentials. Because Better Auth stays confined to one module inside `apps/server`, the change stays inside that module. It costs more security surface, so it is the fallback and not the plan. Lucia is no longer maintained, and Auth.js is in maintenance mode and also shipped four advisories in July 2026. Replacing Better Auth needs a new ADR that supersedes this one and ADR-012.
- **What could not be checked.** GitHub's repository API was rate-limited from my sandbox, so I did not read the archived flag, the open-issue count or the last-commit date directly; maintenance status rests on the registry and the vendor's own pages. I read the advisory list and the November release in detail, not every advisory from earlier rounds, and I did not confirm the fixed-in version of the Low-severity Drizzle adapter rate-limit advisory published on 2026-09-30. Nothing was installed or run here, so the anonymous plugin has not been exercised against Drizzle and PostgreSQL. That happens in M7-T02.

## Consequences

- The choices are stable, the pins are not: the exact versions are maintained in `DECISIONS.md` and `package.json`, and each task re-verifies what it adds.
- Accounts depend on a library that publishes security fixes often. That is a recurring cost for a solo developer: advisories must be watched and applied promptly, and the security review in M9-T05 should include the auth module.
- The Better Auth pin in `DECISIONS.md` changes from 1.7.12 to 1.7.18, and the pin rule there gains the security exception.
- Holding TypeScript on 6.0.x and Node on 24 delays newer language and runtime features in exchange for a working lint, test and documentation pipeline.
- No Redis and one process cap the project at a single instance until a broker is added. That is acceptable for a small launch and is measured in M11-T02.
- Inputs for later records are kept in `DECISIONS.md` ("M0-T06 inputs for ADR-012, ADR-016 and M7-T02").

## Alternatives

- **Svelte or Solid instead of React.** Lighter, but React has the larger ecosystem and more help available to a solo developer.
- **A DOM grid, or PixiJS, instead of Canvas 2D.** A DOM grid is simpler but runs into animation limits; PixiJS stays available behind `BoardRenderer` if Canvas proves too slow.
- **Socket.IO or Colyseus instead of Fastify and `ws`.** Socket.IO has a heavier protocol, and Colyseus's schema-based state sync fights a deterministic command-log engine (ADR-003).
- **Prisma instead of Drizzle.** More tooling and a heavier runtime.
- **Rolling our own sessions, Lucia or Auth.js instead of Better Auth.** More security surface to own, an unmaintained library, and a library in maintenance mode that had its own advisories in July 2026.
- **Jest instead of Vitest.** Needs more ESM configuration.
- **Biome instead of ESLint and Prettier.** The TSDoc and boundary rules of ADR-006 and ADR-007 rely on ESLint plugins.
- **Kubernetes instead of one container.** Premature for a small launch.
- **TypeScript 7.x or Node 26 now.** Rejected for the reasons in "Rules for versions".
- **Caret ranges for dependencies.** Rejected: exact versions keep installs reproducible and make each upgrade a deliberate, reviewable change.

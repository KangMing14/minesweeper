# ADR-008: License

- Status: Accepted
- Date: 2026-11-09
- Task: M0-T06
- Settles: D-12

## Context

D-12 left open whether the project is open source or keeps all rights reserved until launch. The repository is hosted on GitHub as a public repository, and a public repository with no license is already all rights reserved by default, only without saying so. The project plans a small public launch first and has no external contributors. Once code is published under an open license, that grant cannot be withdrawn for the copies already distributed, so the choice is easy to make later and hard to take back.

## Decision

All rights reserved until launch, to be revisited at the public launch, `v1.0.0`. The developer made this choice on 2026-11-09.

- A `LICENSE` file at the repository root states that all rights are reserved and that no permission to use, copy, modify or distribute the software is granted until a license is published.
- The root `package.json` and the four workspace `package.json` files declare `"license": "UNLICENSED"`, the value npm uses for software that grants no license.
- GitHub's own terms still allow other GitHub users to view and fork a public repository on GitHub. Nothing beyond that is granted.
- Changing the license is a new ADR that supersedes this one; this record is not edited.

## Consequences

- The project keeps every option open: it can go open source, stay closed, or choose a license that protects a hosted service, without having to undo a grant.
- Others may read the code but have no right to reuse it. External contributions are not accepted while the repository is unlicensed, because there is no license to accept them under.
- The `LICENSE` text does not name an individual copyright holder; it uses "the Minesweeper project authors". The developer can replace that with a legal name or an organization in a later change.
- This ADR concerns the project's own code. The licenses of dependencies are not audited here, and a dependency license review belongs in the launch checklist (M11-T05).
- D-12 is closed by this record and its row in `DECISIONS.md` reads `Settled by ADR-008`.

## Alternatives

- **MIT.** Permissive and simple, and it invites contribution, but it is irrevocable for everything already published and allows closed hosted forks.
- **AGPL-3.0.** A network copyleft license that discourages closed hosted copies of a game server, but it deters some contributors and is also irrevocable once code is published.
- **A source-available license.** Lets people read the code and restricts commercial use, but it is not open source and needs careful legal wording that the project cannot afford yet.
- **No `LICENSE` file at all.** Legally the same as all rights reserved, but ambiguous to a visitor, so it was rejected in favor of saying so.

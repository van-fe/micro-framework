# Project agent instructions

For every task that reads, changes, tests, builds, reviews, or documents this repository, load and follow `.agents/skills/micro-framework-engineering/SKILL.md` before taking task actions.

The project skill defines mandatory architecture boundaries, Bun/Vite presets, validation gates, and the iframe Realm + Shadow DOM invariants. User instructions still take precedence when they explicitly change a project decision.

## Local debugging and optimization handoff

- Local debugging, previews, acceptance checks, and benchmarks must not send Sentry telemetry, including telemetry from remote child applications. Disabling build uploads alone is insufficient. Install browser network interception before opening pages, block Service Workers, and verify zero delivery with a local fake receiver before using real applications. Page routes must not bypass this protection. Keep diagnostic metrics local.
- The deferred framework optimization goal is in `OPTIMIZATION_GOAL.md`, with progress and evidence in `OPTIMIZATION_LEDGER.md`. Start that work only when the user asks to start it; keep the ledger current once execution begins.

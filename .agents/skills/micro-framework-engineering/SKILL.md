---
name: micro-framework-engineering
description: Build, refactor, test, review, or document this micro-frontend framework using its mandatory layered architecture, Bun workspace presets, Vite toolchain, iframe Realm isolation, and Shadow DOM rendering constraints. Apply to every repository task; do not use for unrelated projects.
---

# Micro Framework Engineering

Use this skill for every task in this repository. Preserve the user's product decisions while keeping the implementation suitable for a large, long-lived multi-team codebase.

## Non-negotiable architecture

- Micro-application JavaScript executes inside a real, per-instance same-origin hidden iframe Realm. Passing iframe objects to code executing in the host Realm is not isolation.
- Micro-application DOM and CSS render inside an application-owned ShadowRoot.
- Do not replace the Realm boundary with a host-global Proxy sandbox, generated fake `window`/`document`, `eval`, `new Function`, `with`, Blob modules, or runtime source rewriting.
- Treat applications as trusted internal code; isolation prevents accidental pollution and is not a malicious-code security boundary.
- Native Runtime APIs and compatibility APIs must call the same Runtime Core and state machine. Compatibility adapters must not create a second runtime.
- HTML Entry and native ESM Entry are both first-class inputs. Internal resolved descriptors are not a developer-authored public protocol.
- Do not add excluded legacy brand names to source, packages, tests, examples, or documentation.

## Engineering structure

- Group code by capability and ownership, not by generic technical suffixes or convenience.
- Keep package dependencies one-directional. Import another workspace only through its public package export; never use cross-package `src/` or other deep imports.
- Public `index.ts` files are composition/export boundaries. Move orchestration, algorithms, adapters, and stateful implementation into named feature modules.
- A file should have one reason to change. When a file coordinates unrelated concerns or grows beyond roughly 250 lines, assess and normally split it by responsibility; do not split cohesive code merely to satisfy a number.
- Depend on contracts or ports at layer boundaries. Do not make low-level DOM, Entry, or Realm packages depend on Runtime Core or public facades.
- Keep framework-neutral core packages free of React, Vue, router-library, and application-specific dependencies.
- Prefer explicit lifecycle/state transitions, cancellation, idempotent cleanup, and typed error events over shared mutable global state.

Before changing package ownership or dependency direction, read [references/architecture-boundaries.md](references/architecture-boundaries.md).

## Component-library compatibility

- Treat failures involving Portal/Teleport, overlays, animation lifecycle, document-level CSS tokens, focus, or cross-Realm DOM checks as framework compatibility gaps until evidence shows that the application or component library is misconfigured.
- Fix the browser semantic once in the lowest owning layer (`dom-surface`, `dom-bridge`, `visual-bridge`, or `realm-host`). Do not first patch React, Vue 3, Vue 2, or Vanilla application components, examples, or adapters with conditional unmounts, injected motion tokens, library-specific selectors, timers, forced viewport positioning, or equivalent behavioral workarounds.
- Application and example changes may express business behavior, visual theming, or an explicit developer container choice. They must not conceal missing generic framework behavior.
- When a framework fix supersedes an earlier component-level workaround, audit the related examples and remove that workaround. Add a generic fallback for equivalent component implementations instead of retaining both paths.
- Preserve explicit developer intent: default document-body overlays may be normalized to the host viewport, while a developer-supplied container must retain its local positioning semantics.
- Prove compatibility changes in real browsers with representative React + Ant Design, Vue 3 + Element Plus, Vue 2 + Element UI, and Vanilla paths as applicable. One demo or framework pass is insufficient when the affected behavior is cross-framework.

## Build and repository presets

- Use the root Bun workspace and committed `bun.lock`. Do not add npm, pnpm, or Yarn lockfiles/workspace configuration.
- Use the exact stable Vite version pinned by the root project. Upgrade it only after checking the current official release and running the full build/browser matrix.
- Keep TypeScript strict and ESM-first. Workspace packages use `workspace:*` for internal dependencies.
- Package builds must emit ESM, declarations, declaration maps where public, and sourcemaps for executable framework code.
- Mark framework libraries `sideEffects: false` unless a package has documented import-time side effects.
- Externalize workspace packages and peer framework dependencies from library bundles; examples may bundle application dependencies normally.
- Pure unit tests use Vitest in Node. Package-level Browser/Realm/DOM contracts use Vitest Browser Mode with the Playwright provider; full application, routing, loading, and component compatibility use Playwright Test. DOM emulators do not prove Realm isolation.

For new packages, examples, build configuration, dependency updates, or scripts, read [references/build-presets.md](references/build-presets.md).

## Required workflow

1. Inspect the owning package, its public contract, dependants, tests, and relevant route in `RODEMAP.md`.
2. Place the change in the lowest layer that owns the behavior. Add a port or contract rather than importing upward.
3. Keep unrelated user changes intact. Refactor overlapping code deliberately and remove superseded duplicates.
4. Add verification at the correct level:
   - pure algorithms/state: unit tests;
   - package API/signature: contract tests;
   - iframe, global objects, DOM, and CSS package contracts: Vitest Browser Mode in Chromium, Firefox, and WebKit;
   - Portal/Teleport, routing, entry loading, component compatibility, and Runtime cleanup: Playwright E2E.
5. Run the architecture checker after package/import changes:

   ```bash
   bun run .agents/skills/micro-framework-engineering/scripts/check-architecture.ts
   ```

6. Run proportional gates, and before a milestone handoff run all of:

   ```bash
   bun install --frozen-lockfile
   bun run typecheck
   bun run build
   bun run test:unit
   bun run test:browser
   bun run test:e2e
   ```

7. Report actual evidence, remaining unsupported behavior, and browser-specific gaps. Never describe a planned or untested capability as complete.
8. Before completing each task, maintain the current version's net changes in root `UPDATES.md` and commit the task's changes following the rules below.

## Version notes and task commits

- The current project baseline is `0.0.1`. Root `package.json` is the version authority; keep workspace package versions aligned when explicitly changing the project version. Do not increment the version for every task, create a release tag, publish, or push unless requested.
- Maintain root `UPDATES.md` by version, newest first. Under the current version, merge this task's final additions, fixes, and intentional behavior changes into the existing entries. Describe the net result relative to the previous version; for `0.0.1`, summarize the initial delivered baseline. Remove duplicates, superseded descriptions, and changes reverted within the same version. Do not use a chronological task log, raw diff statistics, or count every upstream report as a distinct capability. Keep partial coverage and known release limitations explicit.
- After completing the applicable validation, review the diff and staged paths, include `UPDATES.md` with the task changes, and make a local Git commit before the final response. Commit subjects must use `type(scope): message`, for example `fix(dom-bridge): preserve application resource bases` or `docs(workflow): document task completion rules`; choose a meaningful type such as `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, or `chore`, and a scope identifying the affected capability.
- Inspect Git status at task start and stage only this task's changes, preserving unrelated work and existing staged changes. Do not blindly stage the entire working tree, amend prior commits, discard changes, bypass hooks, or invent an author identity. Record known failing gates accurately; a local commit does not imply release readiness.
- Pure read-only questions or tasks with no resulting file changes need no empty commit or artificial version-note entry. If committing is blocked by repository state, identity, permissions, or a failing hook, keep the completed edits and report the exact blocker instead of claiming a commit succeeded. Report the actual commit hash and validation outcome when a commit succeeds.

## Browser boundary checklist

When touching Realm, DOM, HTML loading, visual APIs, capabilities, storage, or cleanup, verify:

- the entry is imported or executed inside the iframe;
- host `window`, `document`, and prototypes are not patched;
- visible DOM is scoped to the correct ShadowRoot;
- script elements cannot accidentally execute in the host document;
- relative assets resolve from the application base URL;
- Portal/Teleport targets remain application-local;
- cross-Realm object identity assumptions are documented and tested;
- listeners, stores, timers, resources, iframe, and surface references are released on destroy;
- Chromium, Firefox, WebKit, and real Safari coverage status is explicit.

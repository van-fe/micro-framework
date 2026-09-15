# Bun and Vite build presets

Read this reference for new workspaces, examples, dependency upgrades, build scripts, or CI changes.

## Repository baseline

- Runtime: Bun `1.4.0` or the version in root `packageManager`.
- Workspace declaration: root `package.json#workspaces` with `packages/*` and `examples/*`.
- Source-time package resolution: root `tsconfig.base.json#compilerOptions.paths`; keep it synchronized when a workspace package is added or renamed.
- Bundler/dev server: exact root-pinned Vite version; currently `8.2.2`.
- Tooling workspaces that require an older incompatible Vite range, such as VitePress 1.x, must use their own nested Vite dependency. Never downgrade framework workspaces or force the root Vite version onto incompatible transitive tooling.
- Language: exact root-pinned TypeScript version; currently `6.0.3` because the Vue type-checking toolchain is not yet compatible with TypeScript 7.
- Unit tests: Vitest `4.1.11`.
- Package-level browser contract tests: Vitest Browser Mode `4.1.11` with `@vitest/browser-playwright`.
- Full application browser tests: Playwright Test `1.62.1`.
- Browser build target: `es2022` for framework packages unless the browser policy changes in `RODEMAP.md`.

Root versions are authoritative. If this reference becomes stale, update it in the same change that updates root versions.

## Library package preset

Each library package should normally have:

- `private: true` until the release plan is approved;
- `type: "module"` and `sideEffects: false` unless documented otherwise;
- `main`, `types`, and conditional `exports` targeting `dist`;
- `build` using Vite library mode plus `tsc --emitDeclarationOnly`;
- declaration output must stay in `dist`; generated `.d.ts` and `.d.ts.map` files must never be emitted beside `src/*.ts`;
- `typecheck` using strict root TypeScript configuration;
- workspace dependencies declared with `workspace:*`;
- exact shared tool versions matching the root;
- `build.rolldownOptions.external` for `@micro-framework/*` dependencies and peer frameworks.

Do not copy application-only plugins into framework packages. Do not bundle React or Vue into adapters.

## Example preset

- One independent Vite workspace per host or micro application.
- Micro applications must support independent development as well as lifecycle entry loading.
- Cross-origin development servers explicitly enable CORS.
- The host excludes linked framework packages from dependency optimization when the Realm bootstrap must remain a separately served ESM asset.
- Ports are deterministic and `strictPort` is enabled for browser tests.

## Commands

```bash
bun install --frozen-lockfile
bun run --workspaces --if-present build
bun run dev
bun run --filter @micro-framework/runtime typecheck
```

## Upgrade gate

For Vite, Bun, TypeScript, browser runners, React, or Vue upgrades:

1. Confirm the current stable release from the official project source.
2. Record Node/Bun engine and peer dependency changes.
3. Update root pins and all affected workspace manifests together.
4. Regenerate only `bun.lock` with Bun.
5. Run architecture, typecheck, build, unit, and full browser tests.
6. Verify Realm bootstrap remains an external JavaScript module with a correct MIME type.
7. Update this reference when baseline values change.

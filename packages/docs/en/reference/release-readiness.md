# Release readiness and external acceptance

Packages use the `@micro-framework` scope. Internal tarball preparation, GitHub Pages deployment, and npm publication workflows exist. Documentation is live; npm packages have not been formally published and the Runtime size gate still blocks release.

## Automatic documentation deployment

Set repository Pages source to GitHub Actions. docs.yml runs on default-branch pushes or manual default-branch dispatch; other branches do not overwrite production. Pages base-path output configures project subpaths/custom domains, while development uses `/`.

The [English documentation](https://van-fe.github.io/micro-framework/en/) and [Chinese documentation](https://van-fe.github.io/micro-framework/) deploy together. docs:build:site also builds the host and Vanilla/React/Vue 3/Vue 2 applications into playground. Both language demo pages embed that same deployment. Browser tests verify loading, language/market updates, overlays, isolation, and disposal before artifact upload, with proven telemetry interception and blocked Service Workers. An optional MICRO_FRAME_DEMO_URL repository variable selects a separately deployed demo.

See [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## npm publication

npm.yml publishes library packages after a GitHub Release is published, or accepts an existing tag manually with dry-run enabled by default. Root, documentation, and examples are never published. Public scoped staging packages omit private; source workspaces retain it. Ordinary pushes deploy docs only.

1. Obtain publishing rights for the scope. The repository uses MIT and includes LICENSE; confirm release metadata/version policy.
2. Configure the GitHub npm environment. A CI-capable granular NPM_TOKEN can bootstrap first publication. For existing packages, configure Trusted Publisher with owner van-fe, repository micro-framework, workflow npm.yml, and environment npm; then OIDC can replace the token. See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).
3. Align all workspace/root versions and the Bun lockfile, commit, and create a matching tag such as v0.0.1.
4. Run the publication workflow in dry-run mode first, then publish the release or explicitly disable dry-run.

Tags must equal `v` plus the root version. Stable versions use latest, prereleases next. Frozen installation, architecture, types, unit/release-script tests, framework builds, artifacts, and size checks gate publication. Validate browser/application gates on the same commit before release. The current size failure is not waived.

The npm-packages artifact and staging manifest record SHA-256. Scripts validate the whole batch before publishing in dependency order. Retries skip only identical published versions; differing content fails. Network/permission failures are not treated as missing packages. Multi-package publishing is not transactional; retry partial failures from the same job/source/artifacts.

```bash
# Local packaging and dry-run only; no publication. The size gate still applies.
bun run release:prepare:npm
RELEASE_TAG=v0.0.1 npm_config_offline=true node scripts/publish-npm.mjs --dry-run
```

## Local and CI checks

```bash
bun install --frozen-lockfile
bun run verify
bun run benchmark
```

verify runs architecture, types, workspace builds, artifact/size checks, unit/browser/E2E, mobile, production, and installed-tarball template checks. validate.yml runs on push/PR/manual requests; benchmark.yml runs scheduled/manual performance checks; safari.yml requires an unlocked self-hosted Mac with Remote Automation. Historical local runs are not evidence of new remote workflow runs. SW-dependent local tests remain subject to the repository's telemetry restrictions.

## Artifact and size budgets

check:artifacts checks exports, declarations/maps, and executable JS sourcemaps. AST analysis exempts pure re-export modules when Vite emits no executable map.

| Gzip measurement | Budget, bytes | Scope |
| --- | ---: | --- |
| Runtime Core file | 15,000 | Core orchestration with workspace externals |
| Default Runtime ESM | 50,000 | Reachable dependencies, excluding business renderers/adapters and bootstrap |
| Realm bootstrap | 5,000 | Native iframe startup entry |

These are regression budgets, not performance promises. Changes require evidence and reasons, not simply raising limits to pass.

Default Runtime excludes document-write and parse5, enforced through the actual module graph. The recorded split measured Core 9,144 B, Runtime 60,383 B, bootstrap 304 B, and optional document-write 53,243 B. Runtime fell roughly 46% from 112,016 B but still exceeds 50,000 B. Optional gzip cannot simply be added to another bundle to infer combined compression. Historical passing batches do not override this failure.

```bash
bun run release:prepare
bun run test:templates
```

release:prepare builds/checks 30 library tarballs, preserves their private flag, resolves workspace dependencies to the same batch version in staging, and includes dist/source for declaration maps without changing source versions or publishing. Its manifest records SHA-256.

Template acceptance installs the CLI tarball in a temporary consumer, runs the actual executable, generates all four apps using exact versions and a temporary registry, and checks unchanged manifests through installation, typecheck, build, and three-engine dev/production pages (24 scenarios). Only the CLI test consumer uses overrides; generated apps do not.

## External acceptance

Historical batches include a September 7 verify pass with 146 unit, 144 Browser Mode, 123 E2E, 4 mobile, 12 production, 24 templates, and 6 Angular/build-tool scenarios. Later upstream batches expanded coverage but failed size checks and did not rerun every external gate. Read current [status](/en/reference/implementation-status) and raw upstream reports rather than assuming a complete verify pass.

Before general release, complete real iOS/Android touch/keyboard/memory checks, business-specific component plugins, real Safari complex editor/map/WebGL combinations, separate-origin CDN/CSP/CORS/MIME/SRI and rollback acceptance, real weak-network/offline recovery, and at least one sustained 72-hour business pilot with agreed resource/error/performance thresholds.

Basic Angular/Webpack support is implemented. WebViews/Electron, extension-store release, and RSC/Suspense coordination remain separate work.

## Ownership review

DOM Surface exports are separated from creation/hydration; migration diagnostics from script AST scanning; Runtime context, LRU, and cancellable waits from state transitions. AppController and MicroRuntime remain cohesive owners of their respective state machines despite line-count warnings. Splitting solely to shorten files would expose mutable state or duplicate orchestration.

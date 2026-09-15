# Migration tools

`@micro-framework/migration-tools` provides side-effect-free configuration and source migration. It does not access DOM, fetch entries, create Runtime, or execute old configuration/source. Analysis uses TypeScript, Vue SFC/template, and PostCSS syntax trees.

It provides qiankun and wujie planners, JS/JSX/TS/TSX/Vue source scans, a narrowly scoped safe import codemod, structured diagnostics, formatting, and CI assertions.

## Plans instead of automatic startup

| Classification | Meaning | Plan status |
| --- | --- | --- |
| automatic | Preserves public configuration meaning | ready |
| review | Runnable output with known semantic changes | review |
| unsupported | No safe reliable conversion | blocked |

Blocked plans have no output, preventing use of partially converted configuration. Review plans retain output but require explicit acceptance.

## Result and diagnostic types

```ts
type MigrationPlan<T> =
  | {
      status: "ready" | "review";
      output: T;
      diagnostics: readonly MigrationDiagnostic[];
    }
  | {
      status: "blocked";
      diagnostics: readonly MigrationDiagnostic[];
    };
```

```ts
interface MigrationDiagnostic {
  source: "qiankun" | "wujie" | "source";
  code: string;
  classification: "automatic" | "review" | "unsupported";
  severity: "info" | "warning" | "error";
  path: string;
  message: string;
  recommendation: string;
}
```

Codes suit CI allowlists. Human interfaces should also show path, message, and recommendation.

## qiankun planner

```ts
const plan = planQiankunMigration({
  applications,
  startOptions,
});
```

Output:

```ts
interface QiankunMigrationOutput {
  registrations: readonly AppRegistration[];
  startOptions: StartOptions;
  prefetchAppNames: readonly string[];
}
```

The planner preserves qiankun's default enabled prefetch. Name lists become prefetchAppNames with review. Function scheduling, inline resources, and custom loading/template hooks block conversion. See [qiankun migration](/en/migration/from-qiankun).

## wujie planner

```ts
const plan = planWujieMigration({
  setup,
  preload,
  start,
  childLifecycle: "ready",
});
```

Output:

```ts
interface WujieMigrationOutput {
  registration: AppRegistration;
  mountMode: "manual";
  prefetchEntry: boolean;
  prewarmApplication: boolean;
  manualLifecycleHooks: readonly WujieLifecycleName[];
}
```

childLifecycle defaults to unknown because host config cannot prove exported guest lifecycles. Declaring ready requires entry contract evidence. Setup defaults and call overrides are merged, and preload/start consistency is checked. Alive becomes reviewed keepAlive; exec becomes prewarm intent. Replace, fetch, plugins, attrs, and degrade remain blockers. See [wujie migration](/en/migration/from-wujie).

## Source scan and codemod

```ts
import {
  codemodMigrationSource,
  scanMigrationSource,
} from "@micro-framework/migration-tools";

const scan = scanMigrationSource({
  filePath: "src/host.ts",
  sourceText,
});

const codemod = codemodMigrationSource({
  filePath: "src/host.ts",
  sourceText,
});
```

Diagnostics include precise original-file start/end/line/column. Rules cover legacy imports/protocols, host escapes, cookies/write, Web/Cache Storage, Service Workers, eval/Function, Vue template expressions, document-root and deep/global selectors, and external blocks. See [CLI](/en/reference/cli) for directory scans and safe writes.

SRC_DOCUMENT_WRITE is review, not blocked. It detects write/writeln on document and window/globalThis/self.document, including static string subscripts, excluding shadowed local bindings. It does not track arbitrary aliases/dynamic properties or library internals and does not rewrite calls. Verify external-script order and parser assumptions in browsers. CLI returns review code 1 unless accepted with allow-review.

## CI gates

```ts
import {
  assertMigrationReady,
  formatMigrationDiagnostics,
  planQiankunMigration,
} from "@micro-framework/migration-tools";

const plan = planQiankunMigration(migrationInput);

if (plan.status !== "ready") {
  console.error(formatMigrationDiagnostics(plan.diagnostics));
}

assertMigrationReady(plan);
// Here output is guaranteed by the type, with no review or unsupported items.
```

Accepted review codes can live in repository configuration with owners and expiration dates. Avoid blanket warning suppression.

## Boundaries

Inline JS/TS/JSX/TSX and Vue script/template/style are parsed, including CSS/PostCSS, SCSS, indented Sass, Less, and Stylus. External blocks require scanning the referenced files; unknown style languages require review. The tools do not rewrite wujie globals, host routes, or business communication, prove lifecycle exports, perform deployment checks, replace browser compatibility tests, or execute custom functions. Automatic writes stay within a small safe allowlist.

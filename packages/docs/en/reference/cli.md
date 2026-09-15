# CLI and application templates

`@micro-framework/cli` exposes the `micro-frame` executable, orchestrating migration and deployment tools without creating another Runtime.

## Deployment diagnostics

```bash
micro-frame diagnose --config micro-frame.deploy.json
micro-frame diagnose --config micro-frame.deploy.json --json --fail-on-warnings
```

Configuration matches scanDeployment:

```json
{
  "hostUrl": "https://shell.example.com/",
  "applications": [
    {
      "name": "orders",
      "entry": "https://apps.example.com/orders/entry.js",
      "type": "module",
      "integrity": "sha384-...",
      "manifest": {
        "url": "https://apps.example.com/orders/micro-frame-manifest.json",
        "integrity": "sha384-..."
      }
    }
  ]
}
```

CLI uses server mode to inspect CORS headers directly. Errors return exit code 2. Warnings normally do not block; fail-on-warnings returns 1 for warning-only reports.

## CORS plans

```bash
micro-frame cors-plan --config micro-frame.cors.json
micro-frame cors-plan --config micro-frame.cors.json --format vite
micro-frame cors-plan --config micro-frame.cors.json --format nginx
```

```json
{
  "hostOrigins": [
    "https://shell.example.com",
    "https://preview.example.com"
  ],
  "resourceOrigins": ["https://apps.example.com"],
  "allowCredentials": true,
  "maxAgeSeconds": 600
}
```

The default output is a full JSON plan. Vite output fits server.cors; Nginx output provides allowlisted Origin configuration. Wildcard origins are rejected and servers are not modified. Apply the reviewed plan, then diagnose actual responses.

## Source scans and safe writes

```bash
micro-frame scan-source src packages --json
micro-frame scan-source src --write
micro-frame scan-source src --allow-review
```

Recursive scans handle JS/JSX/TS/TSX and Vue SFC while ignoring generated directories. Syntax trees parse script/template/style, including CSS, SCSS, indented Sass, Less, and Stylus. Comments and ordinary template text are not executed or mistaken for code. External blocks and unknown style languages require review.

Automatic writing only replaces qiankun named import sources with `@micro-framework/compat-api` when every imported member is covered. Default/namespace imports, wujie APIs, business communication, and routing are not guessed.

Exit codes: 0 means no pending items, 1 means review, 2 means unsupported or command error. write changes only safe text ranges in scanned files.

## Create templates

```bash
micro-frame create apps/orders --framework vanilla
micro-frame create apps/dashboard --framework react --port 5180
micro-frame create apps/profile --framework vue
micro-frame create apps/legacy-profile --framework vue2
```

Templates include external ESM lifecycles, the appropriate adapter, Vite 8 and manifest plugins, development CORS, standalone pages, strict TypeScript, and build scripts.

Standalone pages use the real Runtime to load the same lifecycle into a hidden iframe and render into ShadowRoot. Development uses source; production reads the manifest entry and emitted Realm bootstrap. React includes DOM types, and Vue 2 uses Vue.extend for prop inference. Tarball consumer tests install, typecheck, build, and run all four templates in three-engine dev/production pages.

For standalone repositories, use an existing exact published version and optional scoped registry:

```bash
micro-frame create orders --framework react --framework-version 1.2.3 --registry https://registry.example.com/
cd orders
bun install
bun run dev
```

1.2.3 is illustrative and must exist in the selected registry. framework-version pins Runtime, adapter, and plugin together. registry requires a version and creates a scope-specific bunfig.toml; other dependencies retain the default registry. Consumers configure authentication separately; credential-bearing URLs are rejected. These packages have not yet been formally published.

In-repository templates default to workspace dependencies. Nonempty targets are rejected; force overwrites only template-owned files and does not delete other content. Targets cannot be the current workspace root or outside it.

## Local registry and integration proxy

```bash
micro-frame dev --config micro-frame.dev.json
```

```json
{
  "host": "127.0.0.1",
  "port": 5188,
  "applications": [
    {
      "name": "orders",
      "entry": "src/lifecycle.ts",
      "proxy": {
        "prefix": "/apps/orders/",
        "target": "http://127.0.0.1:5174/"
      }
    }
  ]
}
```

The registry at /micro-frame/registry.json rewrites entries to local proxy URLs. Only GET/HEAD/OPTIONS and configured prefix/target pairs are accepted, with development CORS. Binding defaults to loopback; remote binding requires explicit allowRemote. This is development tooling, not a production CDN/gateway policy.

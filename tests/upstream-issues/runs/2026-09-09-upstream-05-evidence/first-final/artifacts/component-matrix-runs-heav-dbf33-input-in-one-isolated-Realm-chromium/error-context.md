# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: component-matrix.spec.ts >> runs heavy editors, maps, Workers, WebGL, and multilingual input in one isolated Realm
- Location: tests/e2e/component-matrix.spec.ts:25:1

# Error details

```
Error: page.evaluate: SecurityError: Failed to construct 'Worker': Script at 'http://127.0.0.1:5180/src/matrix-worker.ts?worker_file&type=module' cannot be accessed from origin 'http://127.0.0.1:5173'.
    at new Worker (http://127.0.0.1:5173/@fs/Users/fanfangbo/workspace/micro-framework/packages/storage/dist/index.js:359:5)
    at Object.render (http://127.0.0.1:5180/src/lifecycle.ts:263:17)
    at mount (http://127.0.0.1:5180/@fs/Users/fanfangbo/workspace/micro-framework/packages/adapter-vanilla/dist/index.js:7:20)
    at http://127.0.0.1:5173/@fs/Users/fanfangbo/workspace/micro-framework/packages/runtime-core/dist/index.js:78:49
    at http://127.0.0.1:5173/@fs/Users/fanfangbo/workspace/micro-framework/packages/runtime-core/dist/index.js:29:68
    at async f (http://127.0.0.1:5173/@fs/Users/fanfangbo/workspace/micro-framework/packages/runtime-core/dist/index.js:30:10)
    at async _ (http://127.0.0.1:5173/@fs/Users/fanfangbo/workspace/micro-framework/packages/runtime-core/dist/index.js:77:7)
    at async #C (http://127.0.0.1:5173/@fs/Users/fanfangbo/workspace/micro-framework/packages/runtime-core/dist/index.js:198:4)
    at async S.mount (http://127.0.0.1:5173/@fs/Users/fanfangbo/workspace/micro-framework/packages/runtime-core/dist/index.js:184:4)
    at async L.mountApp (http://127.0.0.1:5173/@fs/Users/fanfangbo/workspace/micro-framework/packages/runtime-core/dist/index.js:991:11)
```

# Page snapshot

```yaml
- generic [active]:
  - main
```
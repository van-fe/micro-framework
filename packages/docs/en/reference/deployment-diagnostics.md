# Deployment diagnostics and browser reports

`@micro-framework/deployment-diagnostics` scans resources before release and collects browser policy reports. It does not change Runtime states or Realm/ShadowRoot boundaries.

## Pre-release scanning

```ts
import { scanDeployment } from "@micro-framework/deployment-diagnostics";

const result = await scanDeployment({
  hostUrl: "https://shell.example.com/",
  execution: "server",
  applications: [{
    name: "orders",
    entry: "https://apps.example.com/orders/entry.js",
    type: "module",
    integrity: "sha384-...",
    manifest: {
      url: "https://apps.example.com/orders/micro-frame-manifest.json",
      integrity: "sha384-...",
    },
  }],
});

if (!result.ok) {
  for (const item of result.diagnostics) {
    console.error(item.code, item.application, item.url, item.recommendation);
  }
}
```

The scanner fetches the host, entries, v2 manifests, and full resource graphs; validates HTTP status and JS/HTML/JSON/CSS MIME; checks allowed Origin and Vary headers in server mode; parses CSP source/report directives; verifies SHA-256/384/512 against actual response bytes; and emits stable code/severity/message/recommendation fields for CI.

Integrity metadata is required for entries, manifests, and resources by default. Set requireIntegrity false during migration if appropriate. Browser mode relies on actual CORS success rather than inaccessible response headers. Server/CLI mode audits headers directly.

## CORS configuration helper

```ts
import { createCorsConfigurationPlan } from "@micro-framework/deployment-diagnostics";

const cors = createCorsConfigurationPlan({
  hostOrigins: [
    "https://shell.example.com",
    "https://preview.example.com",
  ],
  resourceOrigins: ["https://apps.example.com"],
  allowCredentials: true,
});

cors.responseHeaders;
cors.viteServerCors;
cors.nginx;
cors.checks;
```

The helper rejects wildcards, origin paths/queries, non-HTTP(S) origins, and invalid header tokens. A single host produces a fixed origin; multiple hosts use allowlisted Origin echo. Output includes serializable Vite settings, Nginx snippets, and preflight/error/304/shared-cache review items. It never modifies a deployment. Apply through the responsible gateway/CDN owner and rescan real responses.

## Page policy reports

```ts
import { installBrowserReportCollector } from "@micro-framework/deployment-diagnostics";

const collector = installBrowserReportCollector(window, {
  maxReports: 200,
  onReport(report) {
    telemetry.send(report);
  },
});

collector.snapshot();
collector.clear();
collector.destroy();
```

The bounded collector deduplicates securitypolicyviolation and available Reporting Observer events for CSP, Permissions Policy, deprecation, intervention, and crash reports. Engines without Reporting Observer support still use standard CSP events; Reporting API is not a core correctness dependency.

Reports contain serializable fields. Before exporting, redact query parameters, source fragments, and other sensitive content according to organizational policy. Local tests keep diagnostics local.

## Boundaries

Server scans validate headers and bytes, but only target browsers establish actual CSP/module-loading behavior. Pair scanners with Browser Mode and full E2E, including real Safari where required.

import { describe, expect, it } from "vitest";
import { createCorsConfigurationPlan } from "./cors-configuration";

describe("CORS configuration assistant", () => {
  it("creates deterministic single-origin Vite and Nginx settings", () => {
    const plan = createCorsConfigurationPlan({
      hostOrigins: ["https://shell.example.com"],
      resourceOrigins: ["https://apps.example.com"],
    });

    expect(plan.mode).toBe("static-origin");
    expect(plan.responseHeaders).toMatchObject({
      "Access-Control-Allow-Origin": "https://shell.example.com",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      Vary: "Origin",
    });
    expect(plan.viteServerCors.origin).toEqual(["https://shell.example.com"]);
    expect(plan.nginx).toContain('add_header Access-Control-Allow-Origin "https://shell.example.com" always;');
    expect(() => structuredClone(plan)).not.toThrow();
  });

  it("uses an allowlisted origin echo for multiple credentialed hosts", () => {
    const plan = createCorsConfigurationPlan({
      hostOrigins: ["https://preview.example.com", "https://shell.example.com"],
      resourceOrigins: ["https://assets.example.com"],
      allowCredentials: true,
      methods: ["options", "get"],
      maxAgeSeconds: 3_600,
    });

    expect(plan.mode).toBe("validated-origin-echo");
    expect(plan.responseHeaders["Access-Control-Allow-Origin"]).toBe("$micro_frame_cors_origin");
    expect(plan.responseHeaders["Access-Control-Allow-Credentials"]).toBe("true");
    expect(plan.nginx).toContain('"https://preview.example.com" $http_origin;');
    expect(plan.nginx).not.toContain("Access-Control-Allow-Origin \"*\"");
  });

  it("rejects wildcard, non-origin and header-injection input", () => {
    expect(() => createCorsConfigurationPlan({ hostOrigins: ["*"] })).toThrow(/wildcard/);
    expect(() => createCorsConfigurationPlan({ hostOrigins: ["https://shell.example.com/path"] }))
      .toThrow(/path/);
    expect(() => createCorsConfigurationPlan({
      hostOrigins: ["https://shell.example.com"],
      allowedHeaders: ["X-Safe\r\nInjected"],
    })).toThrow(/invalid token/);
  });
});

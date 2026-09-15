import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCorsConfigurationPlan } from "@micro-framework/deployment-diagnostics";
import { runCli, type CliIO } from "./run-cli";
import { createApplicationTemplate } from "./templates";

const temporaryDirectories = new Set<string>();

async function workspace(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "micro-frame-cli-"));
  temporaryDirectories.add(path);
  return path;
}

function testIO(cwd: string): CliIO & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    cwd,
    output,
    errors,
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
}

afterEach(async () => {
  await Promise.all([...temporaryDirectories].map((path) => rm(path, { force: true, recursive: true })));
  temporaryDirectories.clear();
});

describe("micro-frame CLI", () => {
  it("generates adapter-native application templates for every supported framework", () => {
    for (const framework of ["vanilla", "react", "vue", "vue2"] as const) {
      const template = createApplicationTemplate({ name: `orders-${framework}`, framework });
      expect(template.files["vite.config.ts"]).toContain("microApplication");
      expect(Object.keys(template.files).some((path) => path.startsWith("src/lifecycle."))).toBe(true);
      expect(template.files["package.json"]).toContain(`@micro-framework/adapter-${framework}`);
    }
  });

  it("creates a complete template without overwriting the workspace root", async () => {
    const cwd = await workspace();
    const io = testIO(cwd);

    expect(await runCli(["create", "orders", "--framework", "react"], io)).toBe(0);
    expect(await readFile(join(cwd, "orders", "src", "lifecycle.tsx"), "utf8")).toContain(
      "createReactLifecycle",
    );
    expect(await runCli(["create", ".", "--force"], io)).toBe(2);
    expect(io.errors.at(-1)).toMatch(/workspace root/);
  });

  it("creates pinned standalone consumers with an optional scoped registry", async () => {
    const cwd = await workspace();
    const io = testIO(cwd);
    expect(await runCli(["create", "orders", "--framework", "vue", "--framework-version", "1.2.3-beta.1", "--registry", "https://registry.example.test/"], io)).toBe(0);
    const manifest = JSON.parse(await readFile(join(cwd, "orders/package.json"), "utf8"));
    expect(manifest.dependencies["@micro-framework/runtime"]).toBe("1.2.3-beta.1");
    expect(manifest.dependencies["@micro-framework/adapter-vue"]).toBe("1.2.3-beta.1");
    expect(manifest.devDependencies["@micro-framework/vite-plugin"]).toBe("1.2.3-beta.1");
    expect(await readFile(join(cwd, "orders/bunfig.toml"), "utf8")).toContain('"@micro-framework" = "https://registry.example.test/"');
  });

  it.each([
    ["--framework-version"], ["--framework-version", "--force"],
    ["--framework-version", "latest"], ["--registry", "https://registry.example.test"],
    ["--framework-version", "1.2.3", "--registry", "file:///tmp/registry"],
  ])("rejects invalid standalone options: %j", async (...args) => {
    const cwd = await workspace();
    expect(await runCli(["create", "orders", ...args], testIO(cwd))).toBe(2);
    await expect(readFile(join(cwd, "orders/package.json"))).rejects.toThrow();
  });

  it("scans source and applies only the safe import codemod", async () => {
    const cwd = await workspace();
    const file = join(cwd, "host.ts");
    await writeFile(file, 'import { registerMicroApps, start } from "qiankun";\n', "utf8");
    const io = testIO(cwd);

    const exitCode = await runCli(["scan-source", "host.ts", "--write"], io);
    expect({ exitCode, errors: io.errors }).toEqual({ exitCode: 0, errors: [] });
    expect(await readFile(file, "utf8")).toContain(`from "${"@micro-framework/compat-api"}"`);
    expect(io.output.some((line) => line === "UPDATED host.ts")).toBe(true);
  });

  it("discovers Vue SFC files recursively and rewrites only their script blocks", async () => {
    const cwd = await workspace();
    await mkdir(join(cwd, "src"));
    const file = join(cwd, "src", "App.vue");
    await writeFile(file, `<script setup lang="ts">
import { registerMicroApps } from "qiankun";
</script>
<template><p>qiankun remains ordinary template text</p></template>
<style>.app { color: red }</style>`, "utf8");
    const io = testIO(cwd);

    const exitCode = await runCli(["scan-source", "src", "--write"], io);
    const output = await readFile(file, "utf8");
    expect({ exitCode, errors: io.errors }).toEqual({ exitCode: 0, errors: [] });
    expect(output).toContain(`from "${"@micro-framework/compat-api"}"`);
    expect(output).toContain("qiankun remains ordinary template text");
    expect(io.output).toContain("UPDATED src/App.vue");
  });

  it("requires review for document.write compatibility and accepts --allow-review", async () => {
    const cwd = await workspace();
    await writeFile(join(cwd, "legacy.ts"), 'document.write("legacy");\n', "utf8");
    const io = testIO(cwd);

    const exitCode = await runCli(["scan-source", "legacy.ts", "--json"], io);
    expect({ exitCode, errors: io.errors }).toEqual({ exitCode: 1, errors: [] });
    expect(io.output.join("\n")).toContain("SRC_DOCUMENT_WRITE");
    expect(await runCli(["scan-source", "legacy.ts", "--allow-review"], testIO(cwd))).toBe(0);
  });

  it("retains a blocking exit code for unsupported source patterns", async () => {
    const cwd = await workspace();
    await writeFile(join(cwd, "legacy.ts"), 'navigator.serviceWorker.register("worker.js");\n', "utf8");
    const io = testIO(cwd);

    expect(await runCli(["scan-source", "legacy.ts", "--allow-review", "--json"], io)).toBe(2);
    expect(io.output.join("\n")).toContain("SRC_SERVICE_WORKER");
  });

  it("runs deployment diagnostics from a JSON configuration", async () => {
    const cwd = await workspace();
    await writeFile(join(cwd, "deploy.json"), JSON.stringify({
      hostUrl: "https://shell.example.com/",
      applications: [{ name: "orders", entry: "https://apps.example.com/entry.js" }],
    }), "utf8");
    const io = testIO(cwd);
    const scan = vi.fn(async () => ({
      ok: false,
      scannedAt: "2026-09-01T00:00:00.000Z",
      hostUrl: "https://shell.example.com/",
      diagnostics: [{
        code: "cors-missing" as const,
        severity: "error" as const,
        message: "missing",
        recommendation: "configure CORS",
      }],
      resources: [],
    }));

    expect(await runCli(["diagnose", "--config", "deploy.json", "--json"], io, {
      scanDeployment: scan,
      createCorsConfigurationPlan,
    })).toBe(2);
    expect(scan).toHaveBeenCalledWith(expect.objectContaining({ execution: "server" }));
    expect(io.output.join("\n")).toContain("cors-missing");
  });

  it("prints validated CORS plans for Vite and Nginx", async () => {
    const cwd = await workspace();
    await writeFile(join(cwd, "cors.json"), JSON.stringify({
      hostOrigins: ["https://shell.example.com", "https://preview.example.com"],
      resourceOrigins: ["https://apps.example.com"],
      allowCredentials: true,
    }), "utf8");
    const viteIO = testIO(cwd);
    const nginxIO = testIO(cwd);

    expect(await runCli(["cors-plan", "--config", "cors.json", "--format", "vite"], viteIO)).toBe(0);
    expect(viteIO.output.join("\n")).toContain('"credentials": true');
    expect(await runCli(["cors-plan", "--config", "cors.json", "--format", "nginx"], nginxIO)).toBe(0);
    expect(nginxIO.output.join("\n")).toContain("map $http_origin $micro_frame_cors_origin");
    expect(nginxIO.output.join("\n")).not.toContain('Access-Control-Allow-Origin "*"');
  });
});

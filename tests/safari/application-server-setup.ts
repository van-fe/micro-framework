import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";

interface ApplicationServer {
  readonly name: string;
  readonly process: ChildProcessWithoutNullStreams;
  readonly output: string[];
  readonly url: string;
}

const definitions = [
  { name: "react", directory: "../../examples/react-app", port: 5275, entry: "/src/lifecycle.tsx" },
  { name: "vue3", directory: "../../examples/vue-app", port: 5276, entry: "/src/lifecycle.ts" },
  { name: "vue2", directory: "../../examples/vue2-app", port: 5279, entry: "/src/lifecycle.ts" },
] as const;
const viteBinary = fileURLToPath(new URL("../../node_modules/.bin/vite", import.meta.url));
const servers: ApplicationServer[] = [];

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(server: ApplicationServer): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.process.exitCode !== null) {
      throw new Error(`${server.name} Vite server exited before becoming ready:\n${server.output.join("")}`);
    }
    try {
      const response = await fetch(server.url);
      if (response.ok) return;
    } catch { /* The port is not accepting connections yet. */ }
    await delay(50);
  }
  throw new Error(`${server.name} Vite server did not become ready:\n${server.output.join("")}`);
}

function stopServer(server: ApplicationServer): Promise<void> {
  if (server.process.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const force = setTimeout(() => {
      if (server.process.exitCode === null) server.process.kill("SIGKILL");
    }, 5_000);
    server.process.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
    server.process.kill("SIGTERM");
  });
}

export async function setup(): Promise<void> {
  for (const definition of definitions) {
    const output: string[] = [];
    const child = spawn(viteBinary, [
      "--host", "127.0.0.1",
      "--port", String(definition.port),
      "--strictPort",
    ], {
      cwd: fileURLToPath(new URL(`${definition.directory}/`, import.meta.url)),
      env: process.env,
      stdio: "pipe",
    });
    child.stdout.on("data", (chunk: Buffer) => output.push(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => output.push(chunk.toString()));
    servers.push({
      name: definition.name,
      process: child,
      output,
      url: `http://127.0.0.1:${definition.port}${definition.entry}`,
    });
  }
  try {
    await Promise.all(servers.map(waitForServer));
  } catch (error) {
    await teardown();
    throw error;
  }
}

export async function teardown(): Promise<void> {
  await Promise.all(servers.splice(0).map(stopServer));
}

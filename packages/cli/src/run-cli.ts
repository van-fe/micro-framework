import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  createCorsConfigurationPlan,
  scanDeployment,
  type CorsConfigurationOptions,
  type CorsConfigurationPlan,
  type DeploymentScanOptions,
  type DeploymentScanResult,
} from "@micro-framework/deployment-diagnostics";
import {
  codemodMigrationSource,
  type SourceCodemodResult,
} from "@micro-framework/migration-tools";
import { collectSourceFiles } from "./source-files";
import { startDevRegistryServer, type DevRegistryServerOptions } from "./dev-registry-server";
import {
  createApplicationTemplate,
  type ApplicationTemplateFramework,
} from "./templates";

export interface CliIO {
  readonly cwd: string;
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface CliDependencies {
  readonly scanDeployment: typeof scanDeployment;
  readonly createCorsConfigurationPlan: typeof createCorsConfigurationPlan;
}

const HELP = `micro-frame <command>

Commands:
  diagnose --config <file> [--json] [--fail-on-warnings]
  cors-plan --config <file> [--format json|nginx|vite]
  scan-source <path...> [--json] [--write] [--allow-review]
  create <directory> [--framework vanilla|react|vue|vue2] [--port 5174] [--framework-version <version>] [--registry <url>] [--force]
  dev --config <file>
`;

function optionValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positionalArguments(args: readonly string[], valuedOptions: readonly string[]): string[] {
  const values = new Set(valuedOptions);
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (values.has(value)) {
      index += 1;
      continue;
    }
    if (!value.startsWith("--")) result.push(value);
  }
  return result;
}

function isDeploymentConfig(value: unknown): value is DeploymentScanOptions {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<DeploymentScanOptions>;
  return typeof config.hostUrl === "string"
    && Array.isArray(config.applications)
    && config.applications.every((application) =>
      application && typeof application.name === "string" && typeof application.entry === "string",
    );
}

function printDeploymentResult(io: CliIO, result: DeploymentScanResult, json: boolean): void {
  if (json) {
    io.stdout(JSON.stringify(result, null, 2));
    return;
  }
  for (const item of result.diagnostics) {
    io.stdout([
      item.severity.toUpperCase(),
      item.code,
      item.application ?? "host",
      item.url ?? "",
      item.message,
      item.recommendation,
    ].filter(Boolean).join(" "));
  }
  io.stdout(`${result.ok ? "PASS" : "FAIL"} ${result.resources.length} resources, ${result.diagnostics.length} diagnostics`);
}

async function diagnoseCommand(
  args: readonly string[],
  io: CliIO,
  dependencies: CliDependencies,
): Promise<number> {
  const configPath = optionValue(args, "--config");
  if (!configPath) throw new Error("diagnose requires --config <file>.");
  const source = await readFile(resolve(io.cwd, configPath), "utf8");
  let value: unknown;
  try { value = JSON.parse(source); }
  catch (error) { throw new Error(`Invalid JSON in ${configPath}: ${error instanceof Error ? error.message : String(error)}`); }
  if (!isDeploymentConfig(value)) {
    throw new Error(`${configPath} must contain hostUrl and an applications array with name/entry.`);
  }
  const result = await dependencies.scanDeployment({ ...value, execution: "server" });
  printDeploymentResult(io, result, args.includes("--json"));
  if (!result.ok) return 2;
  return args.includes("--fail-on-warnings")
    && result.diagnostics.some(({ severity }) => severity === "warning") ? 1 : 0;
}

function isCorsConfiguration(value: unknown): value is CorsConfigurationOptions {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<CorsConfigurationOptions>;
  return Array.isArray(config.hostOrigins)
    && config.hostOrigins.every((origin) => typeof origin === "string")
    && (config.resourceOrigins === undefined
      || Array.isArray(config.resourceOrigins)
        && config.resourceOrigins.every((origin) => typeof origin === "string"));
}

function printCorsPlan(io: CliIO, plan: CorsConfigurationPlan, format: string): void {
  if (format === "nginx") {
    io.stdout(plan.nginx);
    return;
  }
  if (format === "vite") {
    io.stdout(JSON.stringify({ server: { cors: plan.viteServerCors } }, null, 2));
    return;
  }
  if (format !== "json") throw new Error(`Unsupported CORS plan format ${format}.`);
  io.stdout(JSON.stringify(plan, null, 2));
}

async function corsPlanCommand(
  args: readonly string[],
  io: CliIO,
  dependencies: CliDependencies,
): Promise<number> {
  const configPath = optionValue(args, "--config");
  if (!configPath) throw new Error("cors-plan requires --config <file>.");
  const value = JSON.parse(await readFile(resolve(io.cwd, configPath), "utf8")) as unknown;
  if (!isCorsConfiguration(value)) {
    throw new Error(`${configPath} must contain a hostOrigins string array.`);
  }
  printCorsPlan(
    io,
    dependencies.createCorsConfigurationPlan(value),
    optionValue(args, "--format") ?? "json",
  );
  return 0;
}

interface SourceFileReport {
  path: string;
  changed: boolean;
  result: SourceCodemodResult["scan"];
}

async function scanSourceCommand(args: readonly string[], io: CliIO): Promise<number> {
  const paths = positionalArguments(args, []);
  if (!paths.length) throw new Error("scan-source requires at least one file or directory.");
  const files = await collectSourceFiles(paths, io.cwd);
  const reports: SourceFileReport[] = [];
  for (const file of files) {
    const sourceText = await readFile(file, "utf8");
    const codemod = codemodMigrationSource({ filePath: relative(io.cwd, file), sourceText });
    if (args.includes("--write") && codemod.changed) await writeFile(file, codemod.output, "utf8");
    reports.push({ path: relative(io.cwd, file), changed: codemod.changed, result: codemod.scan });
  }
  if (args.includes("--json")) {
    io.stdout(JSON.stringify({ files: reports }, null, 2));
  } else {
    for (const report of reports) {
      for (const item of report.result.diagnostics) {
        io.stdout(`${item.severity.toUpperCase()} ${item.code} ${item.path} ${item.message} ${item.recommendation}`);
      }
      if (report.changed) {
        io.stdout(`${args.includes("--write") ? "UPDATED" : "CODEMOD"} ${report.path}`);
      }
    }
    io.stdout(`Scanned ${reports.length} source files.`);
  }
  if (reports.some(({ result }) => result.status === "blocked")) return 2;
  if (!args.includes("--allow-review") && reports.some(({ result }) => result.status === "review")) return 1;
  return 0;
}

async function directoryHasEntries(path: string): Promise<boolean> {
  const entries = await readdir(path).catch(() => []);
  return entries.length > 0;
}

async function createCommand(args: readonly string[], io: CliIO): Promise<number> {
  const [directory] = positionalArguments(args, ["--framework", "--port", "--framework-version", "--registry"]);
  if (!directory) throw new Error("create requires a destination directory.");
  const framework = optionValue(args, "--framework") ?? "vanilla";
  if (!["vanilla", "react", "vue", "vue2"].includes(framework)) {
    throw new Error(`Unsupported framework ${framework}.`);
  }
  const portValue = optionValue(args, "--port");
  const port = portValue === undefined ? 5174 : Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`Invalid port ${portValue}.`);
  const destination = resolve(io.cwd, directory);
  if (destination === resolve(io.cwd)) throw new Error("Refusing to create a template over the current workspace root.");
  const relativeDestination = relative(resolve(io.cwd), destination);
  if (relativeDestination.startsWith("..") || relativeDestination === "") {
    throw new Error("Refusing to create a template outside the current workspace.");
  }
  if (!args.includes("--force") && await directoryHasEntries(destination)) {
    throw new Error(`Destination is not empty: ${directory}. Use --force to overwrite template-owned files.`);
  }
  for (const option of ["--framework-version", "--registry"]) {
    if (args.includes(option) && (!optionValue(args, option) || optionValue(args, option)!.startsWith("--"))) {
      throw new Error(`${option} requires a value.`);
    }
  }
  const template = createApplicationTemplate({
    name: directory.split(/[\\/]/).filter(Boolean).at(-1) ?? "micro-application",
    framework: framework as ApplicationTemplateFramework,
    frameworkVersion: optionValue(args, "--framework-version"),
    registry: optionValue(args, "--registry"),
    port,
  });
  for (const [path, content] of Object.entries(template.files)) {
    const target = resolve(destination, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { encoding: "utf8", flag: args.includes("--force") ? "w" : "wx" });
  }
  io.stdout(`Created ${framework} micro application in ${relativeDestination}.`);
  return 0;
}

function isDevRegistryConfig(value: unknown): value is DevRegistryServerOptions {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<DevRegistryServerOptions>;
  return Array.isArray(config.applications)
    && config.applications.every((application) =>
      application && typeof application.name === "string" && typeof application.entry === "string",
    );
}

async function devCommand(args: readonly string[], io: CliIO): Promise<number> {
  const configPath = optionValue(args, "--config");
  if (!configPath) throw new Error("dev requires --config <file>.");
  const value = JSON.parse(await readFile(resolve(io.cwd, configPath), "utf8")) as unknown;
  if (!isDevRegistryConfig(value)) throw new Error(`${configPath} has an invalid development registry configuration.`);
  const server = await startDevRegistryServer(value);
  io.stdout(`Registry: ${server.registryUrl}`);
  await new Promise<void>((resolveShutdown) => {
    const shutdown = () => void server.close().finally(resolveShutdown);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
  return 0;
}

export async function runCli(
  args: readonly string[],
  io: CliIO = {
    cwd: process.cwd(),
    stdout: (message) => process.stdout.write(`${message}\n`),
    stderr: (message) => process.stderr.write(`${message}\n`),
  },
  dependencies: CliDependencies = { scanDeployment, createCorsConfigurationPlan },
): Promise<number> {
  const [command, ...rest] = args;
  try {
    switch (command) {
      case "diagnose": return await diagnoseCommand(rest, io, dependencies);
      case "cors-plan": return await corsPlanCommand(rest, io, dependencies);
      case "scan-source": return await scanSourceCommand(rest, io);
      case "create": return await createCommand(rest, io);
      case "dev": return await devCommand(rest, io);
      case "help":
      case "--help":
      case "-h":
      case undefined:
        io.stdout(HELP);
        return 0;
      default:
        throw new Error(`Unknown command ${command}.\n${HELP}`);
    }
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

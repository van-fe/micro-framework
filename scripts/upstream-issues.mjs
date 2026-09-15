import assert from "node:assert/strict";
import { readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const statuses = new Set([
  "collected", "test-not-written", "partial-coverage", "missing-reproduction-details",
  "contract-not-assessed", "verification-in-progress", "regression-passed", "fixed", "unsupported",
  "partially-unsupported", "out-of-scope",
]);
const unverifiedStatuses = new Set([
  "test-not-written", "partial-coverage", "missing-reproduction-details", "contract-not-assessed", "verification-in-progress",
]);
const selections = new Set(["bug-label", "supplementary"]);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const identity = (issue) => `${issue.repository}#${issue.number}`;
const key = (issue) => identity(issue).toLowerCase();
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const insideRoot = (path) => {
  const result = relative(root, path);
  return result !== ".." && !result.startsWith(`..${sep}`) && !isAbsolute(result);
};

async function validateIssues(issues) {
  assert(Array.isArray(issues), "issues must be an array");
  const seen = new Set();
  for (const issue of issues) {
    assert(issue && typeof issue === "object", "issue must be an object");
    assert(/^[\w.-]+\/[\w.-]+$/.test(issue.repository), "repository must be owner/name");
    assert(Number.isSafeInteger(issue.number) && issue.number > 0, "number must be a positive integer");
    assert.equal(issue.id, identity(issue), `id must match repository and number: ${issue.id}`);
    assert(!seen.has(key(issue)), `duplicate issue: ${issue.id}`);
    seen.add(key(issue));
    const url = new URL(issue.url);
    assert.equal(url.origin, "https://github.com", `${issue.id}: URL must use github.com`);
    assert.equal(url.pathname.toLowerCase(), `/${issue.repository}/issues/${issue.number}`.toLowerCase(),
      `${issue.id}: URL must match repository and number`);
    assert(Array.isArray(issue.labels) && issue.labels.every(nonempty), `${issue.id}: labels must be strings`);
    assert(selections.has(issue.selection), `${issue.id}: invalid selection`);
    assert(issue.selection !== "bug-label" || issue.labels.includes("bug"), `${issue.id}: missing exact bug label`);
    assert(statuses.has(issue.status), `${issue.id}: invalid status`);
    assert(Array.isArray(issue.tests), `${issue.id}: tests must be an array`);
    assert(typeof issue.resolution === "string", `${issue.id}: resolution must be a string`);
    for (const test of issue.tests) {
      assert(test && nonempty(test.path) && nonempty(test.title) && nonempty(test.runId),
        `${issue.id}: test evidence needs path, title and runId`);
      assert(!isAbsolute(test.path) && !test.path.includes("\\"), `${issue.id}: test path must be repository-relative`);
      const path = resolve(root, test.path);
      assert(insideRoot(path) && insideRoot(await realpath(path)), `${issue.id}: test path escapes repository`);
      assert((await stat(path)).isFile(), `${issue.id}: test path must name an existing file`);
    }
    if (["regression-passed", "fixed", "partial-coverage"].includes(issue.status)) {
      assert(issue.tests.length > 0, `${issue.id}: status requires executed test evidence`);
    }
    if (unverifiedStatuses.has(issue.status)) {
      assert(nonempty(issue.statusReason) && nonempty(issue.nextAction),
        `${issue.id}: unverified status requires statusReason and nextAction`);
    }
    if (issue.status === "test-not-written") {
      assert.equal(issue.tests.length, 0, `${issue.id}: unwritten scenario cannot have executed test evidence`);
    }
    if (issue.status === "missing-reproduction-details") {
      assert(Array.isArray(issue.missingDetails) && issue.missingDetails.length > 0
        && issue.missingDetails.every(nonempty), `${issue.id}: name the missing reproduction details`);
    }
    if (issue.status === "partially-unsupported") {
      assert(Array.isArray(issue.scenarioStatuses) && issue.scenarioStatuses.length >= 2,
        `${issue.id}: mixed issue requires individual scenario statuses`);
      for (const scenario of issue.scenarioStatuses) {
        assert(nonempty(scenario.scenario) && nonempty(scenario.resolution)
          && ["unsupported", "test-not-written"].includes(scenario.status),
        `${issue.id}: enumerate unsupported and untested scenarios explicitly`);
      }
      assert(issue.scenarioStatuses.some((scenario) => scenario.status === "unsupported")
        && issue.scenarioStatuses.some((scenario) => scenario.status === "test-not-written"),
      `${issue.id}: requires both an unsupported scenario and an untested scenario`);
    }
    if (["unsupported", "partially-unsupported", "out-of-scope"].includes(issue.status)) {
      assert(nonempty(issue.resolution), `${issue.id}: status requires a resolution`);
    }
  }
}

async function validateCatalog(catalog) {
  assert.equal(catalog.schemaVersion, 1, "unsupported schemaVersion");
  assert(nonempty(catalog.collectedAt) && Number.isFinite(Date.parse(catalog.collectedAt)), "invalid collectedAt");
  assert(Array.isArray(catalog.sources), "sources must be an array");
  await validateIssues(catalog.issues);
}

function summarize(issues) {
  const counts = {};
  for (const issue of issues) {
    const row = counts[issue.repository] ??= { total: 0, "bug-label": 0, supplementary: 0, statuses: {} };
    row.total += 1;
    row[issue.selection] += 1;
    row.statuses[issue.status] = (row.statuses[issue.status] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const args = process.argv.slice(2);
  let catalogPath = resolve(root, "tests/upstream-issues/catalog.json");
  const option = args.indexOf("--catalog");
  if (option >= 0) {
    assert(nonempty(args[option + 1]), "--catalog requires a path");
    catalogPath = resolve(args[option + 1]);
    args.splice(option, 2);
  }
  const [command, inputPath] = args;
  assert(["check", "list", "import"].includes(command)
    && args.length === (command === "import" ? 2 : 1),
  "Usage: bun scripts/upstream-issues.mjs [--catalog <path>] check|list|import <file>");
  const catalog = await readJson(catalogPath);
  await validateCatalog(catalog);
  if (command === "check") {
    console.log(`Valid catalog: ${catalog.issues.length} unique issues.`);
    return;
  }
  if (command === "list") {
    console.log(JSON.stringify(summarize(catalog.issues), null, 2));
    return;
  }
  const input = await readJson(resolve(inputPath));
  const incoming = Array.isArray(input) ? input : input.issues;
  await validateIssues(incoming);
  const known = new Set(catalog.issues.map(key));
  const added = incoming.filter((issue) => !known.has(key(issue)));
  if (added.length === 0) {
    console.log(`Imported 0; skipped ${incoming.length} existing issues. Catalog unchanged.`);
    return;
  }
  // Sources are historical collection snapshots; importing issues must not recalculate them.
  const next = { ...catalog, issues: [...catalog.issues, ...added] };
  await validateCatalog(next);
  const temporary = `${catalogPath}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(next, null, 2) + "\n", { flag: "wx" });
    await rename(temporary, catalogPath);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
  console.log(`Imported ${added.length}; skipped ${incoming.length - added.length} existing issues.`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

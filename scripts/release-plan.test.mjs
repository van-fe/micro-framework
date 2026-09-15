import { test } from "node:test";
import assert from "node:assert/strict";
import { publicationOrder, releaseVersion } from "./release-plan.mjs";

const pkg = (name, dependencies = {}) => ({ manifest: {
  name: `@micro-framework/${name}`, version: "0.0.1", dependencies,
} });

test("requires exact tag, aligned versions and the approved scope", () => {
  assert.equal(releaseVersion([pkg("runtime")], "0.0.1", "v0.0.1"), "latest");
  assert.equal(releaseVersion([], "0.0.2-beta.1", "v0.0.2-beta.1"), "next");
  assert.throws(() => releaseVersion([pkg("runtime")], "0.0.1", "main"));
  assert.throws(() => releaseVersion([pkg("runtime")], "0.0.2", "v0.0.2"));
  assert.throws(() => releaseVersion([{ manifest: { name: "@other/runtime", version: "0.0.1" } }], "0.0.1", "v0.0.1"));
});

test("publishes shared dependencies before dependants without duplicates", () => {
  const ordered = publicationOrder([
    pkg("runtime", { "@micro-framework/core": "workspace:*" }),
    pkg("adapter", { "@micro-framework/core": "workspace:*", react: "^19" }),
    pkg("core"),
  ]);
  assert.deepEqual(ordered.map(({ manifest }) => manifest.name.split("/")[1]), ["core", "runtime", "adapter"]);
});

test("rejects missing workspaces and circular release dependencies", () => {
  assert.throws(() => publicationOrder([pkg("runtime", { missing: "workspace:*" })]));
  assert.throws(() => publicationOrder([
    pkg("a", { "@micro-framework/b": "workspace:*" }),
    pkg("b", { "@micro-framework/a": "workspace:*" }),
  ]));
});

import assert from "node:assert/strict";

export function releaseVersion(packages, version, tag) {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(tag, `v${version}`, "Release tag must match root package.json version");
  for (const { manifest } of packages) {
    assert.equal(manifest.version, version, `Version mismatch: ${manifest.name}`);
    assert.ok(manifest.name.startsWith("@micro-framework/"), `Unexpected scope: ${manifest.name}`);
  }
  return version.includes("-") ? "next" : "latest";
}

export function publicationOrder(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];
  function visit(pkg) {
    const { manifest } = pkg;
    if (visited.has(manifest.name)) return;
    assert.ok(!visiting.has(manifest.name), `Dependency cycle: ${manifest.name}`);
    visiting.add(manifest.name);
    const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies };
    for (const [name, version] of Object.entries(dependencies)) {
      if (byName.has(name)) visit(byName.get(name));
      else assert.ok(!version.startsWith("workspace:"), `Missing workspace: ${name}`);
    }
    visiting.delete(manifest.name);
    visited.add(manifest.name);
    ordered.push(pkg);
  }
  for (const pkg of packages) visit(pkg);
  return ordered;
}

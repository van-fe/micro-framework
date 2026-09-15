import { appendFile, readFile } from "node:fs/promises";
import { root, workspacePackages } from "./workspace-packages.mjs";
import { releaseRequest } from "./release-plan.mjs";

const { version } = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
const { releaseTag, distTag } = releaseRequest(
  await workspacePackages({ includeDevelopment: true }), version,
  process.env.RELEASE_TAG, process.env.RELEASE_DRY_RUN === "true",
);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `release_tag=${releaseTag}\n`);
}
console.log(`Release ${version}, tag: ${releaseTag}, npm dist-tag: ${distTag}`);

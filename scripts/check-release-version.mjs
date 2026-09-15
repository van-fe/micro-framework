import { readFile } from "node:fs/promises";
import { root, workspacePackages } from "./workspace-packages.mjs";
import { releaseVersion } from "./release-plan.mjs";

const { version } = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
const tag = releaseVersion(await workspacePackages(), version, process.env.RELEASE_TAG);
console.log(`Release ${version}, npm dist-tag: ${tag}`);

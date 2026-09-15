#!/usr/bin/env node
import { runCli } from "./run-cli";

// This is the executable entry; the side-effect-free API lives in index.ts.
// Package managers invoke it through a .bin symlink, so argv[1] is not its module URL.
process.exitCode = await runCli(process.argv.slice(2));

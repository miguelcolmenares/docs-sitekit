#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runCli } from "./run-cli";

// The only file that knows where it is installed: dist/cli.js sits next to template/.
const templateRoot = fileURLToPath(new URL("../template/", import.meta.url));

process.exitCode = runCli(process.argv.slice(2), {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
  cwd: process.cwd(),
  templateRoot,
});

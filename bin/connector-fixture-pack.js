#!/usr/bin/env node
import { initBundle, lintBundle, renderReviewPack } from "../src/index.js";

const [command, target] = process.argv.slice(2);

async function main() {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (!target) {
    throw new Error(`Missing directory for ${command}.`);
  }

  if (command === "init") {
    const result = await initBundle(target);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "lint") {
    const result = await lintBundle(target);
    console.log(JSON.stringify({ ok: result.ok, findings: result.findings }, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "render") {
    process.stdout.write(await renderReviewPack(target));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function printHelp() {
  console.log(`connector-fixture-pack

Usage:
  connector-fixture-pack init <dir>
  connector-fixture-pack lint <dir>
  connector-fixture-pack render <dir>`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

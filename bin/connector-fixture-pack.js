#!/usr/bin/env node
import { initBundle, lintBundle, renderReviewPack } from "../src/index.js";

const usage = `connector-fixture-pack

Usage:
  connector-fixture-pack init <dir>
  connector-fixture-pack lint <dir>
  connector-fixture-pack render <dir>`;

class UsageError extends Error {}

function parseArgs(args) {
  if (args.length === 0) return { help: true };

  if (args.includes("--help") || args.includes("-h")) {
    if (args.length === 1) return { help: true };
    throw new UsageError("Help must be used without other arguments.");
  }

  const [command, target, ...extra] = args;
  if (!["init", "lint", "render"].includes(command)) {
    throw new UsageError(`Unknown command: ${command}`);
  }
  if (!target) {
    throw new UsageError(`Missing directory for ${command}.`);
  }
  if (target.startsWith("-")) {
    throw new UsageError(`Unknown option: ${target}`);
  }
  if (extra.length > 0) {
    const argument = extra[0];
    const label = argument.startsWith("-") ? "Unknown option" : "Unexpected argument";
    throw new UsageError(`${label}: ${argument}`);
  }

  return { command, target, help: false };
}

async function main() {
  const { command, target, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
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
}

function printHelp() {
  console.log(usage);
}

main().catch((error) => {
  console.error(error instanceof UsageError ? `${error.message}\n\n${usage}` : error.message);
  process.exitCode = 1;
});

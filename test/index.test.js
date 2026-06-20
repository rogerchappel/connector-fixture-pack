import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { initBundle, lintBundle, renderReviewPack } from "../src/index.js";

test("lints a complete CRM bundle", async () => {
  const report = await lintBundle("fixtures/crm-basic");
  assert.equal(report.ok, true);
  assert.deepEqual(report.findings, []);
});

test("renders a deterministic review pack", async () => {
  const markdown = await renderReviewPack("fixtures/crm-basic");
  assert.match(markdown, /Connector Fixture Review: crm-basic/);
  assert.match(markdown, /crm-create-note/);
  assert.match(markdown, /Lint status: pass/);
});

test("flags secret-like fixture values", async () => {
  const report = await lintBundle("fixtures/messaging-risky");
  assert.equal(report.ok, false);
  assert.equal(report.findings.some((item) => item.message.includes("Secret-like value")), true);
});

test("initializes a usable bundle", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-"));
  try {
    await initBundle(directory, { name: "tmp-bundle" });
    const report = await lintBundle(directory);
    assert.equal(report.ok, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

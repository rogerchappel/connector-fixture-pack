import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
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

test("lints a project-management dry-run bundle", async () => {
  const report = await lintBundle("fixtures/project-basic");
  assert.equal(report.ok, true);
  assert.deepEqual(report.findings, []);
});

test("flags secret-like fixture values", async () => {
  const report = await lintBundle("fixtures/messaging-risky");
  assert.equal(report.ok, false);
  assert.equal(report.findings.some((item) => item.message.includes("Secret-like value")), true);
});

test("flags responses and approvals that reference missing requests", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-refs-"));
  try {
    await initBundle(directory, { name: "bad-refs" });
    await writeFile(
      path.join(directory, "responses.json"),
      `${JSON.stringify([{ id: "response-1", requestId: "missing-request", status: "dry_run", body: {} }], null, 2)}\n`
    );
    await writeFile(
      path.join(directory, "approvals.json"),
      `${JSON.stringify([{ id: "approval-1", requestId: "missing-request", required: true, prompt: "Approve?" }], null, 2)}\n`
    );

    const report = await lintBundle(directory);
    assert.equal(report.ok, false);
    assert.equal(report.findings.filter((item) => item.message.includes("Unknown requestId")).length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("requires boolean true approval for write requests", async () => {
  for (const required of [false, "true", 1, null]) {
    const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-approval-"));
    try {
      await initBundle(directory, { name: "invalid-approval" });
      await writeFile(
        path.join(directory, "approvals.json"),
        `${JSON.stringify([{ id: "approval-1", requestId: "crm-create-note", required, prompt: "Approve?" }], null, 2)}\n`
      );

      const report = await lintBundle(directory);
      assert.equal(report.ok, false);
      assert.equal(
        report.findings.some((item) => item.message.includes("must set required to boolean true")),
        true
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("requires an approval entry for every write request", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-missing-approval-"));
  try {
    await initBundle(directory, { name: "missing-approval" });
    await writeFile(path.join(directory, "approvals.json"), "[]\n");

    const report = await lintBundle(directory);
    assert.equal(report.ok, false);
    assert.equal(
      report.findings.some((item) =>
        item.file === "approvals.json"
        && item.message.includes("POST request crm-create-note")
      ),
      true
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("requires approvals only for write requests in mixed bundles", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-mixed-approvals-"));
  try {
    await initBundle(directory, { name: "mixed-approvals" });
    await writeFile(
      path.join(directory, "requests.json"),
      `${JSON.stringify([
        {
          id: "crm-list-contacts",
          connector: "crm",
          operation: "list_contacts",
          method: "get",
          path: "/v1/contacts",
          body: {}
        },
        {
          id: "crm-create-note",
          connector: "crm",
          operation: "create_note",
          method: "post",
          path: "/v1/notes",
          body: {}
        }
      ], null, 2)}\n`
    );
    await writeFile(path.join(directory, "approvals.json"), "[]\n");

    const report = await lintBundle(directory);
    assert.equal(report.ok, false);
    assert.equal(report.findings.filter((item) => item.message.includes("requires an approval")).length, 1);
    assert.match(report.findings.at(-1).message, /POST request crm-create-note/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("accepts write requests with required approvals", async () => {
  const report = await lintBundle("fixtures/crm-basic");
  assert.equal(
    report.findings.some((item) => item.message.includes("requires an approval")),
    false
  );
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

test("CLI smoke renders a review pack", () => {
  const output = execFileSync(process.execPath, [
    "bin/connector-fixture-pack.js",
    "render",
    "fixtures/crm-basic"
  ], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });

  assert.match(output, /Connector Fixture Review: crm-basic/);
  assert.match(output, /crm-create-note/);
});

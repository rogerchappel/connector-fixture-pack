import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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

test("rejects malformed bundle metadata with field-specific findings", async () => {
  const invalidValues = [
    ["name", "", "non-empty string"],
    ["version", 1, "non-empty string"],
    ["connectors", [], "non-empty array"],
    ["connectors", ["crm", ""], "connectors[1] must be a non-empty string"]
  ];

  for (const [field, value, expected] of invalidValues) {
    const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-metadata-"));
    try {
      await initBundle(directory, { name: "invalid-metadata" });
      const metadata = {
        name: "valid-name",
        version: "0.1.0",
        connectors: ["crm"],
        [field]: value
      };
      await writeFile(path.join(directory, "bundle.json"), `${JSON.stringify(metadata, null, 2)}\n`);

      const report = await lintBundle(directory);
      assert.equal(report.ok, false);
      assert.equal(
        report.findings.some((item) =>
          item.file === "bundle.json" && item.message.includes(expected)
        ),
        true
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("reports non-object bundle metadata without throwing", async () => {
  for (const metadata of [null, [], "metadata"]) {
    const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-metadata-shape-"));
    try {
      await initBundle(directory, { name: "invalid-metadata-shape" });
      await writeFile(path.join(directory, "bundle.json"), `${JSON.stringify(metadata)}\n`);

      const report = await lintBundle(directory);
      assert.equal(report.ok, false);
      assert.deepEqual(report.findings[0], {
        severity: "error",
        file: "bundle.json",
        message: "Expected an object."
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("renders invalid collection shapes with all lint findings", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-render-shapes-"));
  try {
    await initBundle(directory, { name: "invalid-render-shapes" });
    await writeFile(path.join(directory, "bundle.json"), `${JSON.stringify({
      name: "invalid-render-shapes",
      version: "0.1.0",
      connectors: {}
    })}\n`);
    await writeFile(path.join(directory, "requests.json"), "{}\n");
    await writeFile(path.join(directory, "approvals.json"), "null\n");

    const report = await lintBundle(directory);
    const markdown = await renderReviewPack(directory);
    assert.equal(report.ok, false);
    assert.match(markdown, /Lint status: fail/);
    assert.match(markdown, /Connectors: none/);
    for (const item of report.findings) {
      assert.ok(markdown.includes(`${item.severity.toUpperCase()} ${item.file}: ${item.message}`));
    }
    assert.doesNotMatch(markdown, /\[object Object\]/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI lint and render handle non-object metadata and invalid collection shapes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-cli-shapes-"));
  try {
    await initBundle(directory, { name: "invalid-cli-shapes" });
    await writeFile(path.join(directory, "bundle.json"), "null\n");
    await writeFile(path.join(directory, "requests.json"), "{}\n");
    await writeFile(path.join(directory, "approvals.json"), "{}\n");

    const lint = spawnSync(process.execPath, ["bin/connector-fixture-pack.js", "lint", directory], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    assert.equal(lint.status, 1);
    assert.equal(lint.stderr, "");
    const lintResult = JSON.parse(lint.stdout);
    assert.deepEqual(lintResult.findings.filter((item) =>
      ["bundle.json", "requests.json", "approvals.json"].includes(item.file)
    ), [
      { severity: "error", file: "bundle.json", message: "Expected an object." },
      { severity: "error", file: "requests.json", message: "Expected an array." },
      { severity: "error", file: "approvals.json", message: "Expected an array." }
    ]);

    const render = spawnSync(process.execPath, ["bin/connector-fixture-pack.js", "render", directory], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    assert.equal(render.status, 0);
    assert.equal(render.stderr, "");
    assert.match(render.stdout, /Lint status: fail/);
    for (const item of lintResult.findings) {
      assert.ok(render.stdout.includes(`${item.severity.toUpperCase()} ${item.file}: ${item.message}`));
    }
    assert.doesNotMatch(render.stdout, /\[object Object\]|TypeError/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects malformed request fields with entry-specific findings", async () => {
  const invalidValues = [
    ["id", 7, "id must be a non-empty string"],
    ["connector", "", "connector must be a non-empty string"],
    ["operation", null, "operation must be a non-empty string"],
    ["method", {}, "method must be a non-empty string"],
    ["path", [], "path must be a non-empty string"],
    ["body", "not-an-object", "body must be an object"]
  ];

  for (const [field, value, expected] of invalidValues) {
    const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-request-shape-"));
    try {
      await initBundle(directory, { name: "invalid-request" });
      const request = {
        id: "crm-create-note",
        connector: "crm",
        operation: "create_note",
        method: "POST",
        path: "/v1/notes",
        body: {},
        [field]: value
      };
      await writeFile(path.join(directory, "requests.json"), `${JSON.stringify([request], null, 2)}\n`);

      const report = await lintBundle(directory);
      assert.equal(report.ok, false);
      assert.equal(
        report.findings.some((item) =>
          item.file === "requests.json" && item.message === `Entry 0 ${expected}.`
        ),
        true
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("rejects every request whose connector is not declared by the bundle", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-connectors-"));
  try {
    await initBundle(directory, { name: "undeclared-connectors" });
    const requests = [
      {
        id: "helpdesk-create-ticket",
        connector: "helpdesk",
        operation: "create_ticket",
        method: "GET",
        path: "/v1/tickets",
        body: {}
      },
      {
        id: "messaging-list-channels",
        connector: "messaging",
        operation: "list_channels",
        method: "GET",
        path: "/v1/channels",
        body: {}
      }
    ];
    await writeFile(path.join(directory, "requests.json"), `${JSON.stringify(requests, null, 2)}\n`);

    const report = await lintBundle(directory);
    assert.equal(report.ok, false);
    assert.deepEqual(
      report.findings.filter((item) => item.message.includes("is not declared")),
      [
        {
          severity: "error",
          file: "requests.json",
          message: "Entry 0 connector helpdesk is not declared in bundle.json connectors."
        },
        {
          severity: "error",
          file: "requests.json",
          message: "Entry 1 connector messaging is not declared in bundle.json connectors."
        }
      ]
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("accepts requests for multiple declared connectors", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-multi-connectors-"));
  try {
    await initBundle(directory, { name: "multiple-connectors" });
    const metadata = JSON.parse(await readFile(path.join(directory, "bundle.json"), "utf8"));
    metadata.connectors = ["crm", "helpdesk"];
    await writeFile(path.join(directory, "bundle.json"), `${JSON.stringify(metadata, null, 2)}\n`);
    const requests = JSON.parse(await readFile(path.join(directory, "requests.json"), "utf8"));
    requests.push({
      id: "helpdesk-list-tickets",
      connector: "helpdesk",
      operation: "list_tickets",
      method: "GET",
      path: "/v1/tickets",
      body: {}
    });
    await writeFile(path.join(directory, "requests.json"), `${JSON.stringify(requests, null, 2)}\n`);

    const report = await lintBundle(directory);
    assert.equal(report.ok, true);
    assert.deepEqual(report.findings, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not duplicate connector findings for malformed inputs", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-malformed-connectors-"));
  try {
    await initBundle(directory, { name: "malformed-connectors" });
    const metadata = JSON.parse(await readFile(path.join(directory, "bundle.json"), "utf8"));
    metadata.connectors = ["crm", ""];
    await writeFile(path.join(directory, "bundle.json"), `${JSON.stringify(metadata, null, 2)}\n`);
    const requests = JSON.parse(await readFile(path.join(directory, "requests.json"), "utf8"));
    requests[0].connector = "";
    await writeFile(path.join(directory, "requests.json"), `${JSON.stringify(requests, null, 2)}\n`);

    const report = await lintBundle(directory);
    assert.deepEqual(
      report.findings.filter((item) => item.message.includes("connector")),
      [
        {
          severity: "error",
          file: "bundle.json",
          message: "connectors[1] must be a non-empty string."
        },
        {
          severity: "error",
          file: "requests.json",
          message: "Entry 0 connector must be a non-empty string."
        }
      ]
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects malformed response fields with entry-specific findings", async () => {
  const invalidValues = [
    ["id", "", "id must be a non-empty string"],
    ["requestId", 7, "requestId must be a non-empty string"],
    ["status", "complete", "status must be one of: dry_run, mocked, blocked"],
    ["body", null, "body must be an object"]
  ];

  for (const [field, value, expected] of invalidValues) {
    const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-response-shape-"));
    try {
      await initBundle(directory, { name: "invalid-response" });
      const response = {
        id: "response-1",
        requestId: "crm-create-note",
        status: "dry_run",
        body: {},
        [field]: value
      };
      await writeFile(path.join(directory, "responses.json"), `${JSON.stringify([response], null, 2)}\n`);

      const report = await lintBundle(directory);
      assert.equal(report.ok, false);
      assert.equal(
        report.findings.some((item) =>
          item.file === "responses.json" && item.message === `Entry 0 ${expected}.`
        ),
        true
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("reports non-object request, response, and approval entries without throwing", async () => {
  const malformedEntries = [null, "scalar", []];

  for (const file of ["requests.json", "responses.json", "approvals.json"]) {
    const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-non-object-"));
    try {
      await initBundle(directory, { name: "non-object-entries" });
      await writeFile(path.join(directory, file), `${JSON.stringify(malformedEntries, null, 2)}\n`);

      const report = await lintBundle(directory);
      assert.equal(report.ok, false);
      assert.deepEqual(
        report.findings.filter((item) =>
          item.file === file && item.message.endsWith("must be an object.")
        ),
        malformedEntries.map((_, index) => ({
          severity: "error",
          file,
          message: `Entry ${index} must be an object.`
        }))
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("CLI lint and render preserve actionable findings for non-object entries", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-non-object-cli-"));
  try {
    await initBundle(directory, { name: "non-object-cli" });
    await writeFile(
      path.join(directory, "requests.json"),
      `${JSON.stringify([null, "scalar", []], null, 2)}\n`
    );

    const lint = spawnSync(process.execPath, [
      "bin/connector-fixture-pack.js",
      "lint",
      directory
    ], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    assert.equal(lint.status, 1);
    assert.equal(lint.stderr, "");
    assert.deepEqual(
      JSON.parse(lint.stdout).findings.filter((item) => item.file === "requests.json"),
      [0, 1, 2].map((index) => ({
        severity: "error",
        file: "requests.json",
        message: `Entry ${index} must be an object.`
      }))
    );

    const render = spawnSync(process.execPath, [
      "bin/connector-fixture-pack.js",
      "render",
      directory
    ], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    assert.equal(render.status, 0);
    assert.equal(render.stderr, "");
    assert.match(render.stdout, /Lint status: fail/);
    for (const index of [0, 1, 2]) {
      assert.match(render.stdout, new RegExp(`ERROR requests\\.json: Entry ${index} must be an object\\.`));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects malformed redactions with entry-specific findings", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-redactions-"));
  try {
    await initBundle(directory, { name: "malformed-redactions" });
    await writeFile(
      path.join(directory, "redactions.json"),
      `${JSON.stringify([
        null,
        [],
        "scalar",
        {},
        { path: "$.requests[0].body.owner" },
        { reason: "Personal data" },
        { path: 7, reason: "Personal data" },
        { path: "$.requests[0].body.owner", reason: false }
      ], null, 2)}\n`
    );

    const report = await lintBundle(directory);
    assert.equal(report.ok, false);
    assert.deepEqual(
      report.findings.filter((item) => item.file === "redactions.json" && item.severity === "error"),
      [
        "Entry 0 must be an object.",
        "Entry 1 must be an object.",
        "Entry 2 must be an object.",
        "Entry 3 is missing path.",
        "Entry 3 is missing reason.",
        "Entry 4 is missing reason.",
        "Entry 5 is missing path.",
        "Entry 6 path must be a non-empty string.",
        "Entry 7 reason must be a non-empty string."
      ].map((message) => ({ severity: "error", file: "redactions.json", message }))
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI lint and render preserve malformed redaction findings", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-redactions-cli-"));
  try {
    await initBundle(directory, { name: "malformed-redactions-cli" });
    await writeFile(
      path.join(directory, "redactions.json"),
      `${JSON.stringify([null, { path: [], reason: "Personal data" }], null, 2)}\n`
    );

    const lint = spawnSync(process.execPath, ["bin/connector-fixture-pack.js", "lint", directory], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    assert.equal(lint.status, 1);
    assert.equal(lint.stderr, "");
    assert.deepEqual(
      JSON.parse(lint.stdout).findings.filter((item) => item.file === "redactions.json"),
      [
        { severity: "error", file: "redactions.json", message: "Entry 0 must be an object." },
        { severity: "error", file: "redactions.json", message: "Entry 1 path must be a non-empty string." },
        { severity: "warning", file: "redactions.json", message: "Email-like fixture data should be covered by a redaction path." }
      ]
    );

    const render = spawnSync(process.execPath, ["bin/connector-fixture-pack.js", "render", directory], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    assert.equal(render.status, 0);
    assert.equal(render.stderr, "");
    assert.match(render.stdout, /Lint status: fail/);
    assert.match(render.stdout, /ERROR redactions\.json: Entry 0 must be an object\./);
    assert.match(render.stdout, /ERROR redactions\.json: Entry 1 path must be a non-empty string\./);
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

test("initializes all required files in an empty target", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-empty-"));
  try {
    const result = await initBundle(directory, { name: "empty-target" });
    assert.deepEqual((await readdir(directory)).sort(), result.files.sort());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a partially populated target without changing sibling files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-partial-"));
  const existing = path.join(directory, "bundle.json");
  try {
    await writeFile(existing, "custom bundle\n");
    await assert.rejects(
      initBundle(directory),
      /existing required file\(s\): bundle\.json/
    );
    assert.equal(await readFile(existing, "utf8"), "custom bundle\n");
    assert.deepEqual(await readdir(directory), ["bundle.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports every conflict in a populated target", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-populated-"));
  try {
    await initBundle(directory);
    await assert.rejects(
      initBundle(directory),
      /bundle\.json, requests\.json, responses\.json, approvals\.json, redactions\.json/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI init exits nonzero and preserves a conflicting target", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "connector-fixture-pack-cli-conflict-"));
  const existing = path.join(directory, "requests.json");
  try {
    await writeFile(existing, "custom requests\n");
    const result = spawnSync(process.execPath, ["bin/connector-fixture-pack.js", "init", directory], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /existing required file\(s\): requests\.json/);
    assert.equal(await readFile(existing, "utf8"), "custom requests\n");
    assert.deepEqual(await readdir(directory), ["requests.json"]);
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

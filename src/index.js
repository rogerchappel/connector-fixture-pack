import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_FILES = [
  "bundle.json",
  "requests.json",
  "responses.json",
  "approvals.json",
  "redactions.json"
];

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /ghp_[A-Za-z0-9_]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /Bearer\s+[A-Za-z0-9._-]{20,}/i,
  /AKIA[0-9A-Z]{16}/
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

export async function initBundle(directory, options = {}) {
  await mkdir(directory, { recursive: true });
  const name = options.name ?? path.basename(directory);
  const files = sampleBundle(name);

  for (const [file, content] of Object.entries(files)) {
    await writeJson(path.join(directory, file), content);
  }

  return {
    directory,
    files: Object.keys(files)
  };
}

export async function lintBundle(directory) {
  const findings = [];
  const bundle = {};

  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(directory, file);
    try {
      bundle[file] = await readJson(fullPath);
    } catch (error) {
      findings.push(finding("error", file, `Missing or invalid JSON: ${error.message}`));
    }
  }

  if (findings.some((item) => item.severity === "error")) {
    return result(directory, bundle, findings);
  }

  validateBundleMetadata(bundle["bundle.json"], findings);
  validateEntries("requests.json", bundle["requests.json"], findings, ["id", "connector", "operation", "method", "path", "body"]);
  validateEntries("responses.json", bundle["responses.json"], findings, ["id", "requestId", "status", "body"]);
  validateEntries("approvals.json", bundle["approvals.json"], findings, ["id", "requestId", "prompt", "required"]);
  validateRequestReferences(bundle["requests.json"], bundle["responses.json"], "responses.json", findings);
  validateRequestReferences(bundle["requests.json"], bundle["approvals.json"], "approvals.json", findings);
  validateApprovalRequirements(bundle["requests.json"], bundle["approvals.json"], findings);
  validateRedactions(bundle["redactions.json"], bundle, findings);
  scanSecretLikeValues(bundle, findings);

  return result(directory, bundle, findings);
}

export async function renderReviewPack(directory) {
  const report = await lintBundle(directory);
  const metadata = report.bundle["bundle.json"] ?? {};
  const requests = report.bundle["requests.json"] ?? [];
  const approvals = report.bundle["approvals.json"] ?? [];

  const lines = [
    `# Connector Fixture Review: ${metadata.name ?? path.basename(directory)}`,
    "",
    `- Version: ${metadata.version ?? "unknown"}`,
    `- Connectors: ${(metadata.connectors ?? []).join(", ") || "none"}`,
    `- Lint status: ${report.ok ? "pass" : "fail"}`,
    "",
    "## Requests",
    ""
  ];

  for (const request of requests) {
    lines.push(`- \`${request.id}\` ${request.method} ${request.path} (${request.connector}:${request.operation})`);
  }

  lines.push("", "## Approval Prompts", "");
  for (const approval of approvals) {
    lines.push(`- \`${approval.id}\` for \`${approval.requestId}\`: ${approval.prompt}`);
  }

  lines.push("", "## Findings", "");
  if (report.findings.length === 0) {
    lines.push("- No findings.");
  } else {
    for (const item of report.findings) {
      lines.push(`- ${item.severity.toUpperCase()} ${item.file}: ${item.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function sampleBundle(name = "sample-connector-fixture") {
  return {
    "bundle.json": {
      name,
      version: "0.1.0",
      description: "Synthetic connector fixture bundle for local agent-skill tests.",
      connectors: ["crm"],
      generatedBy: "connector-fixture-pack"
    },
    "requests.json": [
      {
        id: "crm-create-note",
        connector: "crm",
        operation: "create_note",
        method: "POST",
        path: "/v1/contacts/contact_demo_123/notes",
        body: {
          contactId: "contact_demo_123",
          note: "Follow up with the demo account next week.",
          owner: "agent@example.invalid"
        }
      }
    ],
    "responses.json": [
      {
        id: "crm-create-note-dry-run",
        requestId: "crm-create-note",
        status: "dry_run",
        body: {
          wouldCreate: true,
          externalWrite: false,
          previewId: "preview_note_001"
        }
      }
    ],
    "approvals.json": [
      {
        id: "approval-crm-create-note",
        requestId: "crm-create-note",
        required: true,
        prompt: "Approve creating a CRM note for contact_demo_123?"
      }
    ],
    "redactions.json": [
      {
        path: "$.requests[0].body.owner",
        reason: "Synthetic email placeholder documents where owner data would appear."
      }
    ]
  };
}

function validateBundleMetadata(metadata, findings) {
  if (!metadata.name) findings.push(finding("error", "bundle.json", "Missing name."));
  if (!metadata.version) findings.push(finding("error", "bundle.json", "Missing version."));
  if (!Array.isArray(metadata.connectors) || metadata.connectors.length === 0) {
    findings.push(finding("warning", "bundle.json", "Connectors should list at least one connector family."));
  }
}

function validateEntries(file, entries, findings, requiredKeys) {
  if (!Array.isArray(entries)) {
    findings.push(finding("error", file, "Expected an array."));
    return;
  }

  const ids = new Set();
  entries.forEach((entry, index) => {
    for (const key of requiredKeys) {
      if (!(key in entry)) {
        findings.push(finding("error", file, `Entry ${index} is missing ${key}.`));
      }
    }
    if (entry.id && ids.has(entry.id)) {
      findings.push(finding("error", file, `Duplicate id ${entry.id}.`));
    }
    if (entry.id) ids.add(entry.id);
  });
}

function validateRequestReferences(requests, entries, file, findings) {
  if (!Array.isArray(requests) || !Array.isArray(entries)) return;

  const requestIds = new Set(requests.map((request) => request.id).filter(Boolean));
  for (const entry of entries) {
    if (entry.requestId && !requestIds.has(entry.requestId)) {
      findings.push(finding("error", file, `Unknown requestId ${entry.requestId}.`));
    }
  }
}

function validateApprovalRequirements(requests, approvals, findings) {
  if (!Array.isArray(requests) || !Array.isArray(approvals)) return;

  const requestsById = new Map(requests.map((request) => [request.id, request]));
  for (const approval of approvals) {
    const request = requestsById.get(approval.requestId);
    if (!request?.method || SAFE_METHODS.has(String(request.method).toUpperCase())) continue;

    if (approval.required !== true) {
      findings.push(finding(
        "error",
        "approvals.json",
        `Approval ${approval.id ?? approval.requestId} must set required to boolean true for ${request.method} request ${request.id}.`
      ));
    }
  }
}

function validateRedactions(redactions, bundle, findings) {
  if (!Array.isArray(redactions)) {
    findings.push(finding("error", "redactions.json", "Expected an array."));
    return;
  }

  const paths = new Set(redactions.map((item) => item.path));
  for (const item of redactions) {
    if (!item.path || !item.reason) {
      findings.push(finding("error", "redactions.json", "Each redaction needs path and reason."));
    }
  }

  const serialized = JSON.stringify(bundle);
  if (serialized.includes("@") && ![...paths].some((item) => /owner|email|assignee|recipient|sender/i.test(item))) {
    findings.push(finding("warning", "redactions.json", "Email-like fixture data should be covered by a redaction path."));
  }
}

function scanSecretLikeValues(bundle, findings) {
  const serialized = JSON.stringify(bundle);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      findings.push(finding("error", "bundle", `Secret-like value matched ${pattern.source}.`));
    }
  }
}

function result(directory, bundle, findings) {
  return {
    directory,
    ok: !findings.some((item) => item.severity === "error"),
    findings,
    bundle
  };
}

function finding(severity, file, message) {
  return { severity, file, message };
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

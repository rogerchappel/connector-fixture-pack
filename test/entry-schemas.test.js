import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function schemaErrors(schema, value) {
  if (schema.type === "object" && (typeof value !== "object" || value === null || Array.isArray(value))) {
    return ["must be an object"];
  }

  const errors = [];
  for (const field of schema.required) {
    if (!(field in value)) errors.push(`missing ${field}`);
  }
  for (const [field, rules] of Object.entries(schema.properties)) {
    if (!(field in value)) continue;
    if (rules.type && typeof value[field] !== rules.type) errors.push(`${field} must be ${rules.type}`);
    if (rules.minLength && typeof value[field] === "string" && value[field].length < rules.minLength) {
      errors.push(`${field} is too short`);
    }
    if (rules.pattern && typeof value[field] === "string" && !new RegExp(rules.pattern, "u").test(value[field])) {
      errors.push(`${field} must match ${rules.pattern}`);
    }
  }
  return errors;
}

test("published approval schema accepts fixtures and rejects malformed fields", async () => {
  const schema = await readJson("schemas/approval.schema.json");
  const approvals = await readJson("fixtures/crm-basic/approvals.json");

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(schemaErrors(schema, approvals[0]), []);
  assert.deepEqual(schemaErrors(schema, { requestId: "request-1", prompt: "Approve?", required: true }), ["missing id"]);
  assert.deepEqual(schemaErrors(schema, { id: "approval-1", requestId: "request-1", prompt: "Approve?", required: "yes" }), ["required must be boolean"]);
  assert.deepEqual(schemaErrors(schema, { id: " ", requestId: "request-1", prompt: "Approve?", required: true }), ["id must match \\S"]);
});

test("published redaction schema accepts fixtures and rejects malformed fields", async () => {
  const schema = await readJson("schemas/redaction.schema.json");
  const redactions = await readJson("fixtures/crm-basic/redactions.json");

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(schemaErrors(schema, redactions[0]), []);
  assert.deepEqual(schemaErrors(schema, { path: "$.requests[0]" }), ["missing reason"]);
  assert.deepEqual(schemaErrors(schema, { path: 1, reason: "Fixture value" }), ["path must be string"]);
  assert.deepEqual(schemaErrors(schema, { path: "$.requests[0]", reason: " " }), ["reason must match \\S"]);
});

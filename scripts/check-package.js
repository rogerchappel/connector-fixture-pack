import { access, readFile } from "node:fs/promises";

const required = [
  "README.md",
  "SKILL.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "package-lock.json",
  "docs/PRD.md",
  "docs/TASKS.md",
  "docs/ORCHESTRATION.md",
  "schemas/bundle.schema.json",
  "schemas/request.schema.json",
  "schemas/response.schema.json",
  "schemas/approval.schema.json",
  "schemas/redaction.schema.json",
  "fixtures/crm-basic/bundle.json"
];

for (const file of required) {
  await access(file);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (!pkg.bin || !pkg.exports || !pkg.scripts?.smoke) {
  throw new Error("package metadata is missing CLI, exports, or smoke script");
}

const targets = [
  ...Object.values(pkg.bin),
  ...Object.values(pkg.exports).flatMap((value) => typeof value === "string" ? [value] : Object.values(value))
];
for (const target of targets) {
  if (typeof target !== "string" || !target.startsWith("./")) {
    throw new Error(`package target must be a relative path: ${target}`);
  }
  try {
    await access(target.slice(2));
  } catch {
    throw new Error(`package target does not exist: ${target}`);
  }
}

if (pkg.engines?.node !== ">=22") {
  throw new Error("package engines must require the supported Node.js 22+ baseline");
}

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("node-version: [22, 24]") || !workflow.includes("cache: npm") || !workflow.includes("run: npm ci")) {
  throw new Error("CI must use the supported Node.js 22/24 matrix and reproducible npm installs");
}

console.log("package check passed");

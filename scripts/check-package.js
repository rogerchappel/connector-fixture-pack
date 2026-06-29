import { access, readFile } from "node:fs/promises";

const required = [
  "README.md",
  "SKILL.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "docs/PRD.md",
  "docs/TASKS.md",
  "docs/ORCHESTRATION.md",
  "schemas/bundle.schema.json",
  "fixtures/crm-basic/bundle.json"
];

for (const file of required) {
  await access(file);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (!pkg.bin || !pkg.exports || !pkg.scripts?.smoke) {
  throw new Error("package metadata is missing CLI, exports, or smoke script");
}

console.log("package check passed");

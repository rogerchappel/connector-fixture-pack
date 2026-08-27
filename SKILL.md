# Connector Fixture Pack Skill

## When To Use

Use this skill when an agent needs reusable connector fixtures for CRM, project-management, messaging, or approval-flow tests without touching live accounts.

## Required Tools Or Inputs

- A local repository or workspace.
- Node.js 22 or newer (Node.js 22 and 24 are the supported release baselines).
- Sanitized examples of connector requests, dry-run responses, approvals, and redaction rules.

## Side-Effect Boundaries

The workflow is local-only. Do not call connector APIs, send messages, update CRMs, create tickets, or store credentials while preparing fixtures.

## Approval Requirements

Ask for explicit approval before using real customer data, exporting fixtures outside the workspace, or adding examples copied from private systems.

## Examples

```sh
connector-fixture-pack init fixtures/new-crm-case
connector-fixture-pack lint fixtures/new-crm-case
connector-fixture-pack render fixtures/new-crm-case > REVIEW_PACK.md
```

Pass exactly one directory to `init`, `lint`, or `render`; the CLI does not
accept additional targets or options. Run `connector-fixture-pack --help` (or
`-h`) as a standalone argument for usage. Invalid argument forms exit nonzero
before fixture files are read or written.

`render` always writes the complete Markdown review pack. It exits with status
`1` after rendering when the bundle has any error finding, and status `0` for a
valid bundle. Treat a nonzero render status as a release-blocking result without
discarding the generated review output.

## Validation Workflow

Run `npm test`, `npm run check`, and `npm run smoke`. Review lint findings and confirm every secret-like placeholder is covered by `redactions.json`.

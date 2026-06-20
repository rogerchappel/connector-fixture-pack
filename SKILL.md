# Connector Fixture Pack Skill

## When To Use

Use this skill when an agent needs reusable connector fixtures for CRM, project-management, messaging, or approval-flow tests without touching live accounts.

## Required Tools Or Inputs

- A local repository or workspace.
- Node.js 20 or newer.
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

## Validation Workflow

Run `npm test`, `npm run check`, and `npm run smoke`. Review lint findings and confirm every secret-like placeholder is covered by `redactions.json`.

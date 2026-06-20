# PRD: connector-fixture-pack

Status: in-progress
Decision: build now
Created: 2026-06-20

## Pitch

`connector-fixture-pack` creates sanitized fixture bundles for connector and action-planning skills: request shapes, dry-run responses, approval prompts, and redaction manifests that can be replayed in tests without touching live accounts.

## V1 Scope

- Local CLI and library API.
- `connector-fixture-pack init` scaffolds a fixture bundle.
- `connector-fixture-pack lint <dir>` validates request, response, approval, and redaction files.
- `connector-fixture-pack render <dir>` emits a Markdown review pack.
- JSON schema files for bundle entries.
- Fixtures for CRM, project-management, and messaging dry-run examples.

## Out of Scope

- Live connector calls.
- Credential storage.
- Runtime policy enforcement.

## Verification

- Schema validation tests.
- Fixture-backed lint/render tests.
- CLI smoke that builds and validates a sample bundle.

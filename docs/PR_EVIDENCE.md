# Release Candidate PR Evidence

## Verification Run

- `npm test` passed with 4 tests.
- `npm run check` passed package metadata and required-file checks.
- `npm run build` passed package checks.
- `npm run smoke` passed lint and rendered the CRM fixture review pack.
- `bash scripts/validate.sh` passed the full local validation sequence.

## Commit Groups

- Project scaffold, README, product docs, and skill instructions.
- Fixture bundle CLI engine and library API.
- Schemas, sample fixtures, tests, validation scripts, and release notes.

## Classification

Ship. The package is local-first, fixture-backed, and safe for public agent-skill validation workflows.

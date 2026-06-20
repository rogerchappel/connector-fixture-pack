# Release Candidate Notes

## 0.1.0

- Adds local-first CLI commands for `init`, `lint`, and `render`.
- Includes schemas for bundle, request, and response entries.
- Ships CRM and risky messaging fixtures for success and failure tests.
- Documents agent-skill boundaries in `SKILL.md`.

## Verification

```sh
npm test
npm run check
npm run build
npm run smoke
bash scripts/validate.sh
```

# Orchestration

Use this repo inside agent-skill validation loops where connectors must be demonstrated without live writes.

1. Create or update a fixture bundle with `connector-fixture-pack init <dir>`.
2. Replace placeholder requests and dry-run responses with sanitized examples.
3. Run `connector-fixture-pack lint <dir>` before committing.
4. Run `connector-fixture-pack render <dir>` and attach the Markdown to PR evidence.
5. Keep generated fixture bundles local unless every identifier and token has been reviewed.

The CLI performs no network calls and should be safe in CI.

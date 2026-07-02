# connector-fixture-pack

`connector-fixture-pack` creates and checks sanitized connector fixtures for agent skills. It is designed for local tests that need realistic request shapes, dry-run responses, approval prompts, and redaction manifests without touching live accounts.

## Quickstart

```sh
npm install
npm test
npm run smoke
node bin/connector-fixture-pack.js init tmp/sample-bundle
node bin/connector-fixture-pack.js lint tmp/sample-bundle
node bin/connector-fixture-pack.js render tmp/sample-bundle
```

## Release Verification

Run the release gate before tagging or publishing:

```sh
npm run lint
npm run release:check
```

The release gate runs package checks, tests, the fixture-backed CLI smoke, and a dry-run `npm pack` so schemas, fixtures, and runtime files are visible before publication.

## CLI

- `connector-fixture-pack init <dir>` scaffolds a safe fixture bundle.
- `connector-fixture-pack lint <dir>` validates bundle files and prints JSON.
- `connector-fixture-pack render <dir>` emits a Markdown review pack.

## Library

```js
import { lintBundle, renderReviewPack } from "connector-fixture-pack";

const report = await lintBundle("fixtures/crm-basic");
const markdown = await renderReviewPack("fixtures/crm-basic");
```

## Safety Notes

- The tool never calls external services.
- Fixture examples must use fake identifiers, placeholder tokens, and synthetic account data.
- Linting fails when obvious secrets, live-looking tokens, or missing redaction coverage are detected.
- Approval prompts are treated as documentation for tests, not as permission to execute live actions.

## Limitations

- The schema validator is intentionally small and local. It checks the V1 fixture shape, not every possible API schema.
- Secret detection is heuristic and should be paired with repository scanning before publication.
- Rendering is deterministic Markdown for review, not a compliance report.

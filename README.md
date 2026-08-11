# connector-fixture-pack

`connector-fixture-pack` creates and checks sanitized connector fixtures for agent skills. It is designed for local tests that need realistic request shapes, dry-run responses, approval prompts, and redaction manifests without touching live accounts.

## Quickstart

```sh
npm install
npm run lint
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

## Verification

Run the same checks used for release-readiness before publishing or opening a release PR:

```bash
npm run check
npm test
npm run build
npm run smoke
npm run release:check
npm pack --dry-run
```

## CLI

- `connector-fixture-pack init <dir>` scaffolds a safe fixture bundle.
- `connector-fixture-pack lint <dir>` validates bundle files and prints JSON.
- `connector-fixture-pack render <dir>` emits a Markdown review pack.

Each command accepts exactly one directory argument and no options. Use `--help`
or `-h` by itself to print usage. Extra targets, unknown options, combined help
arguments, unknown commands, and missing directories print concise usage to
standard error and exit nonzero before reading or writing fixture files.

`init` creates all five required files only when none already exist. If the target
contains any required fixture file, it exits nonzero, lists every conflict, and
leaves the target unchanged. Remove or move the conflicting files before retrying;
there is no implicit overwrite option.

`lint` exits with status `1` when the bundle has release-blocking findings. All
commands also exit nonzero for invalid CLI arguments or filesystem/runtime
errors, which makes them safe to use in CI and pre-release scripts:

```sh
node bin/connector-fixture-pack.js lint fixtures/crm-basic
```

The lint pass enforces the shipped V1 bundle, request, and response schemas. `bundle.json` must be an object, and bundle names, versions, and connector names must be non-empty strings. Every non-empty request connector must appear in the `bundle.json` `connectors` array; undeclared connectors are reported against their `requests.json` entry. Requests, responses, approvals, and redactions must be arrays, and every array member must be an object. A redaction has exactly two required fields for linting: `path` and `reason`, both non-empty strings. Request ids, connector names, operations, methods, and paths must be non-empty strings, and request bodies must be objects. Response ids and request ids must be non-empty strings, response bodies must be objects, and response status must be `dry_run`, `mocked`, or `blocked`. Findings identify the source file and entry index. The review renderer keeps malformed collections and members out of their summaries while preserving all findings in the Markdown output.

Linting also verifies that responses and approval prompts point at real request ids, so stale fixture edits fail before they become release examples. Every request whose HTTP method is not `GET`, `HEAD`, `OPTIONS`, or `TRACE` must have a corresponding approval entry with `required` set to the boolean `true`. Read-only requests do not require approval entries.

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
- Each write request must be documented by a required approval prompt; omitting that prompt is a release-blocking lint error.
- Approval prompts are treated as documentation for tests, not as permission to execute live actions.

## Limitations

- The schema validator is intentionally small and local. It enforces the published V1 fixture boundary, not connector-specific API payload schemas.
- Secret detection is heuristic and should be paired with repository scanning before publication.
- Rendering is deterministic Markdown for review, not a compliance report.

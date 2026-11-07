# JSON Schema references

The package ships five JSON Schema documents in `schemas/`. These are the canonical
sources; this directory documents how to inspect and validate them locally. It is
not a generated copy and nothing is published by these steps.

## Shipped schemas

| File | Describes | Required fields / constraints |
| --- | --- | --- |
| [`bundle.schema.json`](../../schemas/bundle.schema.json) | Fixture bundle manifest | `name`, `version`, and `connectors`; `connectors` contains at least one string |
| [`request.schema.json`](../../schemas/request.schema.json) | A recorded connector request | `id`, `connector`, `operation`, `method`, `path`, and object `body` |
| [`response.schema.json`](../../schemas/response.schema.json) | A dry-run or mocked response | `id`, `requestId`, `status`, and object `body`; status is `dry_run`, `mocked`, or `blocked` |
| [`approval.schema.json`](../../schemas/approval.schema.json) | Approval prompt fixture | `id`, `requestId`, `prompt`, and boolean `required` |
| [`redactions.schema.json`](../../schemas/redactions.schema.json) | Redaction manifest | one redaction entry with non-empty `path` and `reason` |

## Rebuild and verify locally

No generator or remote service is required: the schema files are maintained directly
as JSON. From the repository root, parse every shipped schema and print its title and
canonical path:

```sh
node --input-type=module <<'NODE'
import { readdir, readFile } from 'node:fs/promises';
for (const file of (await readdir('schemas')).filter((name) => name.endsWith('.schema.json')).sort()) {
  const schema = JSON.parse(await readFile(`schemas/${file}`, 'utf8'));
  console.log(`${file}: ${schema.title ?? '(untitled)'}`);
}
NODE
```

Confirm the files in the checkout match the inventory above, then run the package
checks and tests:

```sh
find schemas -maxdepth 1 -name '*.schema.json' -print | sort
npm run check
npm test
```

To produce a disposable local reference listing without modifying tracked files, rerun
the Node snippet and redirect it to a file under `/tmp`. Do not commit generated copies
unless the canonical schema files change and the references are deliberately refreshed.

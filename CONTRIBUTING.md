# Contributing

Thanks for improving `connector-fixture-pack`.

## Local Checks

Run these before opening a PR:

```sh
npm test
npm run check
npm run smoke
```

## Fixture Rules

- Use synthetic identifiers and placeholder domains.
- Do not include real tokens, customer records, private account IDs, or live API responses.
- Add a redaction entry for any field that represents sensitive data in real systems.
- Prefer small fixtures that prove one connector behavior at a time.

## PR Evidence

Include the rendered review pack when changing fixtures or schemas.

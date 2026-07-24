# Changelog

## [Unreleased]

- Enforce the published bundle, request, and response value constraints during fixture linting.
- Require every non-safe HTTP request to have an approval entry with `required: true`.
- Validate response and approval `requestId` references during fixture linting.
- Add release-readiness checks for package metadata, pack contents, and CI verification.
All notable changes to this project will be documented in this file.

## 0.1.0 - Initial release candidate

- Provides local connector fixture bundle scaffolding, linting, and Markdown review rendering.
- Ships schemas and sanitized example fixtures for dry-run connector workflows.
- Includes tests, fixture-backed smoke coverage, and release verification commands.

# Security

This project is for sanitized local fixtures. Do not report real credentials by adding them to issues, discussions, fixtures, or pull requests.

## Reporting

If you find a secret in a published fixture, open a private security advisory or contact the maintainer directly. Include the file path and commit SHA, but do not repeat the secret value.

## Boundaries

The CLI does not perform network calls or live connector writes. Treat any future feature that adds external access as a security-sensitive design change.

# Security Policy

## Supported version

Security fixes currently target the latest release on the `main` branch.

## Reporting a vulnerability

Please do not open a public issue for vulnerabilities that could expose API keys, resumes, account data, or unintended applications. Contact the maintainer through the email listed on the GitHub profile and include only the minimum redacted reproduction needed.

## Security invariants

- No arbitrary remote model endpoints.
- No `<all_urls>` host permission.
- No remote code execution or remotely hosted extension JavaScript.
- No unsafe rendering of job-site HTML in the extension UI.
- No application without an explicit batch confirmation.
- No CAPTCHA or access-verification bypass.
- No API keys, resumes, or personal data in logs, tests, or repository assets.

If a proposed change weakens one of these invariants, it should be discussed before implementation.

# Security Policy

## Supported version

Security fixes currently target the latest release on the `main` branch.

## Reporting a vulnerability

Please do not open a public issue for vulnerabilities that could expose API keys, resumes, account data, or unintended applications. Contact the maintainer through the email listed on the GitHub profile and include only the minimum redacted reproduction needed.

## Security invariants

- No arbitrary remote model endpoints; remote calls are restricted to Alibaba Cloud Model Studio, DeepSeek, and OpenAI.
- No required `<all_urls>` host permission. Generic form access is optional and requested for the current origin only after a user click.
- No remote code execution or remotely hosted extension JavaScript.
- No unsafe rendering of job-site HTML in the extension UI.
- No application without an explicit batch confirmation.
- No form submission, file selection, overwrite of existing values, or preselection of sensitive autofill fields.
- No model-generated fill values: AI semantic review may only select a path that already exists in the local profile.
- Work-to-internship cross-section mappings preserve the real work record and always require manual confirmation.
- Resume files are parsed locally; only extracted text is sent after an explicit profile-generation action.
- No CAPTCHA or access-verification bypass.
- No API keys, resumes, or personal data in logs, tests, or repository assets.

If a proposed change weakens one of these invariants, it should be discussed before implementation.

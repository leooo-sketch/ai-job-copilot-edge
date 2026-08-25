# Contributing

Thank you for helping make AI Job Copilot more useful and safer.

## Good first contributions

- Update a job-site selector after a verified DOM change.
- Add a fixture and regression test for a supported site.
- Improve translations or accessibility.
- Add a model adapter without broadening host permissions unnecessarily.
- Improve error messages and selector diagnostics.

## Local setup

1. Fork and clone the repository.
2. Use Node.js 18 or newer.
3. Run `npm run check` before making changes.
4. Load the repository folder from `edge://extensions` with Developer mode enabled.
5. Test with a small batch and never include real API keys, resumes, recruiter messages, or account data in screenshots and fixtures.

## Pull requests

- Keep each PR focused on one change.
- Explain which site/page and browser version you tested.
- Include a redacted screenshot or DOM fixture when changing selectors.
- Preserve explicit user confirmation before any real application action.
- Preserve CAPTCHA and access-verification stop behavior.
- Do not add CAPTCHA bypasses, credential collection, stealth automation, or `<all_urls>` permissions.
- Add or update tests where practical.

## Bug reports

Please include the site, page type, Edge version, extension version, expected behavior, actual behavior, and a redacted screenshot. Never paste an API key or unredacted resume.

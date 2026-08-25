<div align="center">

![AI Job Copilot hero](assets/hero.png)

# AI Job Copilot for Edge

**Filter jobs, match your resume with AI, review every decision, and apply from a persistent Edge side panel.**

[![GitHub stars](https://img.shields.io/github/stars/leooo-sketch/ai-job-copilot-edge?style=social)](https://github.com/leooo-sketch/ai-job-copilot-edge/stargazers)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-6654e8)
![Microsoft Edge](https://img.shields.io/badge/Microsoft%20Edge-Side%20Panel-0b84ff)
[![License: MIT](https://img.shields.io/badge/License-MIT-2fa978.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-6%20passing-2fa978)](#development)

[简体中文](README.zh-CN.md) · [Quick start](#quick-start) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

</div>

> A local-first, open-source alternative to opaque “auto apply” tools. You stay in control: jobs are filtered first, ranked against your real resume, and submitted only after an explicit review and confirmation.

## Why this project?

Job hunting is repetitive, but blind mass-application creates noise for both candidates and recruiters. AI Job Copilot automates the mechanical parts while keeping the important decisions visible:

```text
Job list → hard filters → AI resume/JD score → human review → rate-limited application
```

No hosted backend. No CAPTCHA bypass. No hidden application decisions.

## Features

- **Three-stage workflow** — collect, AI-match, then review and apply.
- **Hard filters first** — title, city, salary, company blacklist, and job blacklist.
- **Resume-aware scoring** — score, summary, strengths, gaps, risks, and a truthful greeting.
- **Multiple model options** — DeepSeek, OpenAI, or a local OpenAI-compatible endpoint.
- **Persistent Edge side panel** — keep the copilot next to the job site as you browse.
- **Explicit application confirmation** — no submission runs until you approve the batch.
- **Rate limiting and safety stop** — max 20 jobs per batch; stops on CAPTCHA or verification pages.
- **Local-first storage** — settings, resume text, API key, and logs stay in extension storage.
- **Scoped permissions** — no `<all_urls>` access; only supported job sites and model endpoints.

## Supported sites and models

| Category | Supported |
|---|---|
| Job sites | BOSS Zhipin, Liepin, Zhaopin |
| Cloud models | DeepSeek Chat Completions, OpenAI Chat Completions |
| Local models | OpenAI-compatible endpoints on `localhost` / `127.0.0.1` |
| Browser | Microsoft Edge with Manifest V3 Side Panel support |

Job sites regularly change their DOM. If a site opens but no jobs are found, its selectors may need an update. Contributions with refreshed selectors are welcome.

## Quick start

1. Download the repository or the latest release and unzip it.
2. Open `edge://extensions` in Microsoft Edge.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the folder containing `manifest.json`.
5. Pin **AI Job Copilot** to the toolbar and click its icon.
6. Sign in to a supported job site and open a job-search result page.

### First-run configuration

1. Paste your resume as plain text. TXT and Markdown files can be imported directly.
2. Set target roles, cities, salary range, and blacklists.
3. Optional: add a DeepSeek/OpenAI API key for semantic matching. Without a key, the extension uses conservative local keyword scoring.
4. Save, then run **Scan current page → AI Match → Review → Confirm and apply**.

Start with a batch of 1–3 jobs to verify that the current version matches the site's latest UI.

## Privacy and safety

- The project has no custom backend.
- Resume text and job descriptions are sent to a model provider only when AI matching is enabled.
- Remote model endpoints are allowlisted to DeepSeek and OpenAI; HTTP is allowed only for local endpoints.
- Job-site content is rendered with `textContent`, not unsafe HTML injection.
- API keys are masked in logs.
- CAPTCHA, slider, access-anomaly, and verification pages stop the batch. The project does not bypass them.
- Some sites treat clicking “Chat now” as an immediate application. Always review the selected jobs and final page state.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for details.

## Project structure

```text
manifest.json         Edge/Chromium Manifest V3 configuration
sidepanel.*           Side-panel UI and three-stage workflow
content-script.js     Job extraction and site action adapters
service-worker.js     Model calls, tab orchestration, and rate limiting
tests/                Manifest, syntax, filtering, and safety checks
assets/               Repository visual assets
```

## Development

Node.js 18+ is enough; there are no third-party runtime dependencies.

```bash
npm test
npm run check
```

## Roadmap

- More resilient site adapters and selector diagnostics
- Resume PDF/DOCX parsing with an explicit local-only mode
- Per-site preview mode before the first real application
- Exportable application history
- Extension-store packaging and signed releases
- Additional languages and job platforms

See the full [roadmap](ROADMAP.md) and vote with reactions on feature requests.

## Contributing

Bug reports, selector updates, model adapters, translations, and UX improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

If this project saves you time, **please star the repository** — it helps more job seekers discover the project.

## Disclaimer

This project is an independent open-source tool and is not affiliated with Microsoft, BOSS Zhipin, Liepin, Zhaopin, DeepSeek, or OpenAI. Users are responsible for following each platform's terms, rate limits, and application rules. Automated or repetitive applications may trigger account restrictions.

## License

[MIT](LICENSE) © 2026 [leooo-sketch](https://github.com/leooo-sketch)

<div align="center">

![AI Job Copilot hero](assets/hero.png)

# AI Job Copilot for Edge

**Filter jobs, match your resume with AI, and reliably preview-fill application forms from a persistent Edge side panel.**

[![GitHub stars](https://img.shields.io/github/stars/leooo-sketch/ai-job-copilot-edge?style=social)](https://github.com/leooo-sketch/ai-job-copilot-edge/stargazers)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-6654e8)
![Microsoft Edge](https://img.shields.io/badge/Microsoft%20Edge-Side%20Panel-0b84ff)
[![License: MIT](https://img.shields.io/badge/License-MIT-2fa978.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-21%20passing-2fa978)](#development)

[简体中文](README.zh-CN.md) · [Quick start](#quick-start) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

</div>

> A local-first, open-source alternative to opaque “auto apply” tools. You stay in control: jobs are filtered first, ranked against your real resume, and submitted only after an explicit review and confirmation.

## Why this project?

Job hunting is repetitive, but blind mass-application creates noise for both candidates and recruiters. AI Job Copilot automates the mechanical parts while keeping the important decisions visible:

```text
Job list → hard filters → AI resume/JD score → human review → rate-limited application
```

No hosted backend. No CAPTCHA bypass. No hidden application decisions.

## Releases and version track

| Release | Classification | What it represents |
|---|---|---|
| `v0.5.0` | Latest enhanced release | Fuzzy field recognition, DOM-based repeat-card grouping, confirmed async job suggestions, and native/ARIA/framework choice controls |
| `v0.1.0` | Initial public release | Edge side panel, supported job-site adapters, AI matching, review queue, and guarded application actions |
| `v0.4.1` | Reliable autofill release | Reliable application autofill, profile schema v3, local multi-resume parsing, Qwen review, dynamic repeat sections, and compatibility fixes |

Versions `0.2.0` through `0.4.0` are documented development milestones included in the `v0.4.1` source snapshot; they are not presented as separate source archives because no independent snapshots were preserved. See [CHANGELOG.md](CHANGELOG.md) for the complete, chronological breakdown.

## Features

- **Three-stage workflow** — collect, AI-match, then review and apply.
- **Reliable application autofill** — scan any normal HTTP(S) application page, review a field-level plan, then fill only what you selected.
- **Comprehensive profile v3** — education, work, internships, and projects are separate repeatable cards with dedicated fields for common enterprise application forms.
- **Dynamic section preparation** — safely exposes “add education/work/internship/project” cards before scanning, then keeps each page card aligned with one source record.
- **Anchor-aware record alignment** — existing school, company, or project names select the correct local record before other fields are planned; common hidden framework selects and readonly date controls are included.
- **DOM card isolation** — derives each repeat record from its real page container and labels previews with the source title, avoiding one experience being spread over multiple cards.
- **Confirmed async choices** — editable job-keyword comboboxes are typed, awaited, uniquely matched, and confirmed; failed attempts restore the original value.
- **Choice-control compatibility** — supports native radios without `name`, ARIA radio groups, and common Ant Design, Element, Arco, Semi, and iView structures with Chinese/English equivalents.
- **Conservative fuzzy recognition** — combines ARIA descriptions, nearby labels, and safe semantic attributes; typo-like matches remain visible for human review.
- **Multi-resume import** — locally extract PDF, DOCX, TXT, or Markdown, then let Qwen consolidate evidence-backed fields for review.
- **Qwen semantic review** — improve custom-field mappings without allowing the model to invent values; every fill value must resolve to an existing profile path.
- **Cross-section guardrail** — a real work record may be suggested for an internship-only form section, but stays labeled as work and is never preselected.
- **Conservative matching** — label, placeholder, HTML autocomplete, section, type, exclusions, confidence, and ambiguity checks work together.
- **Safety by default** — existing values are never overwritten; sensitive values are never preselected; file inputs and submit buttons are never automated.
- **Hard filters first** — title, city, salary, company blacklist, and job blacklist.
- **Resume-aware scoring** — score, summary, strengths, gaps, risks, and a truthful greeting.
- **Multiple model options** — Qwen through Alibaba Cloud Model Studio, DeepSeek, OpenAI, or a local OpenAI-compatible endpoint.
- **Persistent Edge side panel** — keep the copilot next to the job site as you browse.
- **Explicit application confirmation** — no submission runs until you approve the batch.
- **Rate limiting and safety stop** — max 20 jobs per batch; stops on CAPTCHA or verification pages.
- **Local-first storage** — settings, resume text, API key, and logs stay in extension storage.
- **Scoped permissions** — no `<all_urls>` access; only supported job sites and model endpoints.

## Supported sites and models

| Category | Supported |
|---|---|
| Job discovery sites | BOSS Zhipin, Liepin, Zhaopin |
| Application autofill | Normal HTTP(S) application pages; access is requested for the current site only |
| Cloud models | Qwen/Alibaba Cloud Model Studio, DeepSeek, OpenAI Chat Completions |
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
3. Add a Qwen API key manually or import it from a local text file. Without a key, job matching falls back to conservative local keyword scoring and form filling keeps deterministic rules only.
4. Save, then run **Scan current page → AI Match → Review → Confirm and apply**.

### Reliable application autofill

1. Switch the side panel from **Job Assistant** to **Application Autofill**.
2. Open **Profile Library** and review the structured data saved locally. You can extract only verifiable contact fields from the existing resume text or import/export JSON.
3. Open an application form and click **Scan current form**. The extension requests access to that origin only when you click.
4. Review every proposed mapping. High-confidence ordinary fields are selected; ambiguous or sensitive fields are not.
5. Click **Fill selected fields**, then verify the page yourself. The extension never submits the form.

Start with a batch of 1–3 jobs to verify that the current version matches the site's latest UI.

## Privacy and safety

- The project has no custom backend.
- The structured profile stays in `chrome.storage.local`. Deterministic mapping runs first; optional Qwen review receives only non-sensitive professional profile data, source paths, and visible field metadata.
- PDF/DOCX files are parsed locally with bundled PDF.js and Mammoth. Only the extracted text is sent after the user starts AI profile generation.
- Broad job-application access is optional. The extension asks for the current site's origin only when you initiate a scan.
- Existing form values are protected, private fields require explicit selection, and local files cannot be selected automatically.
- Resume text and job descriptions are sent to a model provider only when AI matching is enabled.
- Remote model endpoints are allowlisted to Alibaba Cloud Model Studio, DeepSeek, and OpenAI; HTTP is allowed only for local endpoints.
- Job-site content is rendered with `textContent`, not unsafe HTML injection.
- API keys are masked in logs.
- CAPTCHA, slider, access-anomaly, and verification pages stop the batch. The project does not bypass them.
- Some sites treat clicking “Chat now” as an immediate application. Always review the selected jobs and final page state.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for details.

## Project structure

```text
manifest.json         Edge/Chromium Manifest V3 configuration
sidepanel.*           Side-panel UI, job workflow, profile editor, and autofill preview
autofill-core.js      Tested profile schema, field rules, confidence, and conservative plan builder
autofill-content.js   On-demand page scanner and React/Vue-compatible safe value setter
resume-file-parser.js Local multi-file PDF/DOCX/TXT/Markdown text extraction
content-script.js     Job extraction and site action adapters
service-worker.js     Qwen/compatible model calls, path-only semantic review, tab orchestration
vendor/               Bundled PDF.js/Mammoth browser runtimes and licenses
docs/                 Autofill architecture and profile-v3 source model
tests/                Manifest, syntax, filtering, and safety checks
assets/               Repository visual assets
```

## Development

Node.js 18+ is required. PDF.js and Mammoth are bundled local runtime dependencies; see `THIRD_PARTY_NOTICES.md`.

```bash
npm test
npm run check
```

## Roadmap

- More resilient site adapters and selector diagnostics
- Local OCR for scanned PDFs
- Cross-origin iframe diagnostics and opt-in frame permissions
- Per-site preview mode before the first real application
- Exportable application history
- Extension-store packaging and signed releases
- Additional languages and job platforms

See the full [roadmap](ROADMAP.md) and vote with reactions on feature requests.

## Contributing

Bug reports, selector updates, model adapters, translations, and UX improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

If this project saves you time, **please star the repository** — it helps more job seekers discover the project.

## Disclaimer

This project is an independent open-source tool and is not affiliated with Microsoft, BOSS Zhipin, Liepin, Zhaopin, Alibaba Cloud, DeepSeek, or OpenAI. Users are responsible for following each platform's terms, rate limits, and application rules. Automated or repetitive applications may trigger account restrictions.

## License

[MIT](LICENSE) © 2026 [leooo-sketch](https://github.com/leooo-sketch)

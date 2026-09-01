# Reliable application autofill design

The autofill feature deliberately separates three concerns:

```text
reviewed local profile → local deterministic plan → optional Qwen path review → selected DOM writes
```

## Reliability rules

1. The profile is structured and reviewed once; raw resume prose is not blindly copied into arbitrary fields.
2. Field matching uses labels, placeholders, `name`/`id`, HTML `autocomplete`, section headings, control types, exclusion terms, and a confidence score.
3. Close competing matches are marked ambiguous even when the top score is high.
4. Only high-confidence, non-sensitive fields are selected by default.
5. Existing page values are never overwritten.
6. Sensitive information must already exist in the local profile and must be individually selected by the user.
7. File inputs are reported as manual because extensions cannot safely choose a local resume file without an explicit file chooser action.
8. Text, native select, radio, checkbox, contenteditable, and common React/Vue controlled inputs receive native setters and appropriate input/change events.
9. The content script contains no form-submit or `requestSubmit` path.
10. AI review receives a non-sensitive professional profile view and may only return existing profile paths; returned values are ignored.
11. A real work record can be proposed for an internship-only form section only when the local policy allows it. The item remains review-only, keeps its real `experienceType`, and is never preselected.
12. Repeatable education, work, internship, and project cards carry a section kind and record index so fields from different records are not mixed.
13. Before scanning, narrowly matched “add experience” controls may be used to expose missing record cards; a capture listener blocks accidental form submission during this step.
14. When a repeatable card already contains a reliable anchor such as school, company, or project name, that value selects the corresponding local record before the remaining empty fields are planned.
15. Framework select wrappers and readonly date/month inputs are scanned even when their internal input is visually hidden.

## Resume ingestion

- PDF.js and Mammoth.js extract PDF/DOCX text inside the extension; TXT and Markdown use the browser File API.
- Original resume files are not uploaded by the extension. The extracted text is sent only after the user starts Qwen profile generation.
- Qwen returns a schema-v3 profile patch with evidence snippets and conflict warnings. Education, work, internships, and projects are split into distinct records, sanitized, deduplicated, and merged without overwriting reviewed values by default.
- Scanned PDFs without a text layer are reported for manual OCR.

## GitHub research decisions

- [JSON Resume schema](https://github.com/jsonresume/jsonresume.org/tree/master/packages/schema) (MIT) informed the reusable categories for basics, work, education, skills, projects, awards, and narratives.
- [EasyApp](https://github.com/EasyApp-RPI/EasyApp) (MIT) was reviewed as an earlier job-form extension. Its LLM-first field answering and direct `.value` assignment were not adopted because they do not provide enough deterministic evidence, existing-value protection, or controlled-component compatibility for this project.
- [JobFill](https://github.com/23aaaa/jobfill) was reviewed for its local-first workflow and framework event handling. No source code was copied because the repository advertised MIT in its README but did not contain a license file at the time of review, and its roadmap still listed one-click field matching as unfinished.

All production matching and filling code in this repository is an original implementation. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for the schema attribution.

## Known boundaries

- Cross-origin iframes may require a separate future permission and frame-aware scan.
- Highly custom virtualized dropdowns can still require manual selection when no unique visible option exists.
- Dynamic forms can still invalidate a scan after the user manually changes experience sections; rescan in that case.

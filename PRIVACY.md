# Privacy

AI Job Copilot is local-first and has no project-operated backend.

## Stored locally

The Edge extension stores the following in `chrome.storage.local`:

- Resume text
- Structured application profile, including any optional sensitive fields the user explicitly enters
- Job preferences and blacklists
- Model provider, endpoint, model name, and API key
- Recently scanned jobs, AI analysis, selections, and run logs

This data remains in the browser profile unless the user removes it or uninstalls/clears the extension.

The profile JSON export is initiated locally by the user and may contain personal information. It should be stored and shared with care.

## Data sent externally

When AI matching is enabled, the extension sends resume text, target keywords, and the selected job description to the configured model provider. The remote allowlist is Alibaba Cloud Model Studio (Qwen), DeepSeek, and OpenAI. Local endpoints are limited to `localhost` and `127.0.0.1`.

When the user selects PDF, DOCX, TXT, or Markdown resumes, the files themselves are parsed inside the extension with bundled local libraries. After the user starts AI profile generation, the extracted text—not the original file—is sent to the configured provider. Qwen returns a profile draft, evidence snippets, and conflict warnings for user review.

When the user confirms a batch, supported job sites may receive the configured greeting and application action. Some sites treat the first “Chat” or “Apply” click as an immediate submission.

Application autofill always runs deterministic local matching first. When the user clicks **Scan current form**, the extension requests optional access to the current HTTP(S) origin and reads visible form metadata such as labels, placeholders, input types, options, and whether a value already exists. If AI reasoning is enabled and a key is configured, visible field metadata plus a non-sensitive professional view of the profile is sent to the configured model provider. Direct contact values, identity documents, family/emergency/reference records, and sensitive eligibility answers are excluded from this AI review. The provider returns profile paths and concise reasons, not fill values; the extension validates every path locally.

When the user clicks **Fill selected fields**, only the locally resolved, selected values are written into that page. The autofill feature does not submit the form. Model `reasoning_content` is not displayed, logged, or stored.

## Not collected

The project does not operate analytics, advertising, telemetry, or a custom server. It does not intentionally collect passwords, cookies, browser history, or payment information.

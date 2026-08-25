# Privacy

AI Job Copilot is local-first and has no project-operated backend.

## Stored locally

The Edge extension stores the following in `chrome.storage.local`:

- Resume text
- Job preferences and blacklists
- Model provider, endpoint, model name, and API key
- Recently scanned jobs, AI analysis, selections, and run logs

This data remains in the browser profile unless the user removes it or uninstalls/clears the extension.

## Data sent externally

When AI matching is enabled, the extension sends resume text, target keywords, and the selected job description to the configured model provider. The current remote allowlist is DeepSeek and OpenAI. Local endpoints are limited to `localhost` and `127.0.0.1`.

When the user confirms a batch, supported job sites may receive the configured greeting and application action. Some sites treat the first “Chat” or “Apply” click as an immediate submission.

## Not collected

The project does not operate analytics, advertising, telemetry, or a custom server. It does not intentionally collect passwords, cookies, browser history, or payment information.

# Roadmap

## 0.2 — Reliability

- [x] Structured local application profile
- [x] On-demand current-origin permission instead of required `<all_urls>` access
- [x] Field-level scan, mapping confidence, ambiguity review, and high-confidence selection
- [x] Existing-value protection, sensitive-field confirmation, attachment skip, and no-submit invariant
- [x] Redacted DOM fixture and mapping regression tests
- [ ] Per-site selector diagnostics
- [ ] Better error recovery when a page changes during a batch

## 0.3 — Resume and history

- [x] Local PDF/DOCX text extraction and multi-resume Qwen profile generation
- [x] Evidence-backed profile generation and work-to-internship review protection
- Local OCR for scanned PDFs
- Cross-origin iframe diagnostics and opt-in frame permissions
- Multiple resume profiles
- Exportable CSV/JSON application history
- Duplicate-company and duplicate-role detection

## 0.4 — Repeatable application records

- [x] Separate education, work, internship, and project collections
- [x] Card-based profile editor with common enterprise fields
- [x] Dynamic add-section preparation before form scanning
- [x] Stable record-index mapping for multiple projects and experiences
- [x] Single-textarea fallback for aggregate experience fields

## 0.5 — Ecosystem

- Additional job platforms
- English and Chinese UI switch
- Signed Edge Add-ons package
- Community-maintained adapter registry with strict review rules

## Non-goals

- CAPTCHA or anti-bot bypass
- Hidden, high-frequency, or stealth automation
- Scraping personal recruiter data
- Fabricating resume experience or application claims

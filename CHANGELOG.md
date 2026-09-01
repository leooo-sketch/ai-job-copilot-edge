# Changelog

All notable changes to this project will be documented in this file.

## [0.4.1] - 2026-08-29

### Fixed

- Detects framework select wrappers whose real input is hidden, including common Ant Design, Element, Arco, Semi, and iView structures
- Treats readonly date/month pickers as fillable controlled inputs instead of unsupported fields
- Aligns a repeatable form card to the matching local education/work/internship/project record using reliable existing page values such as school or project name
- Adds education mappings for research direction, professional courses, department ranking, degree type, education type, and overseas-study status
- Prevents an existing school in a page card from being combined with a different education record selected only by array position

### Verification

- Eighteen automated tests pass
- Browser fixture scans a hidden framework select, fills a readonly education date, preserves existing values, expands two project cards, and fills 21 fields with zero failures

## [0.4.0] - 2026-08-29

### Added

- Candidate profile schema v3 with separate repeatable education, work, internship, and project records
- Card-based profile editor with dedicated inputs for common enterprise education, employment, internship, and project fields
- Safe repeat-section preparation that exposes enough education/work/internship/project cards before scanning
- Record-kind and record-index metadata to keep multiple projects and employers aligned during deterministic and Qwen-assisted mapping
- Aggregate mapping for single textareas labelled “项目经历 / 项目经验”, “工作经历”, “实习经历”, or “教育经历”
- Seventeen automated regression and safety tests plus browser fixtures for dynamic project-card creation

### Fixed

- Project content was invisible to the scanner when a portal initially showed only an “添加项目经验” button
- Multiple resume imports no longer drop distinct projects when the local collection already contains records
- Legacy work records explicitly marked as internships now migrate to the dedicated internship collection

### Safety

- Add-section automation installs a temporary submit blocker and never clicks save, submit, or application actions
- Work-to-internship fallback remains review-only and unselected

## [0.3.0] - 2026-08-29

### Added

- Comprehensive candidate profile schema v2 based on common enterprise recruiting sections
- Local multi-file PDF/DOCX/TXT/Markdown extraction with bundled PDF.js and Mammoth.js
- Qwen/Alibaba Cloud Model Studio provider preset, API key file import, JSON output, and optional thinking mode
- Evidence-backed resume-to-profile generation with conflict warnings and legacy v1 migration
- Optional Qwen semantic review for custom application fields; returned mappings must resolve to existing local profile paths
- Research, campus, volunteer, publications, patents, work preferences, eligibility, family, emergency contact, and reference sections
- Twelve automated regression and safety tests

### Safety

- Original resume files remain local; only extracted text is sent after explicit user action
- Model reasoning is not logged or displayed, and AI review cannot provide fill values
- Work experience mapped into internship-only form sections is always review-only and never preselected

## [0.2.0] - 2026-08-29

### Added

- Reliable application-form mode with field-level scan and preview
- Structured local candidate profile with JSON import/export
- Deterministic Chinese/English field mapping with confidence and ambiguity review
- On-demand permission for the current application origin
- Native input/select/radio/checkbox/contenteditable filling and common React/Vue event compatibility
- Redacted browser fixture and nine automated regression/safety tests

### Safety

- Existing page values are never overwritten
- Sensitive profile values are never selected by default
- File inputs remain manual and the autofill path cannot submit a form

## [0.1.0] - 2026-08-25

### Added

- Edge Manifest V3 side-panel extension
- BOSS Zhipin, Liepin, and Zhaopin adapters
- Hard filters for role, city, salary, company, and job blacklists
- DeepSeek, OpenAI, and local OpenAI-compatible scoring
- Review queue with match score, strengths, gaps, risks, and greeting
- Explicit application confirmation, rate limit, and CAPTCHA stop
- Local storage, logs, endpoint allowlist, and security checks
- Six automated manifest, syntax, filtering, and safety tests

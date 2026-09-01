# Candidate profile schema v3

Schema v3 models repeatable application data as separate records instead of pipe-delimited prose. It keeps `education`, `work`, `internships`, and `projects` as distinct arrays so a form card can be mapped to one verified source record.

## Main changes from v2

- `internships` is independent from `work`. Existing v2 records whose `experienceType` explicitly says internship are migrated automatically.
- Education records cover institution type, college, major category, education level and degree, dates, GPA scale, ranking, education/student type, status, location, courses, thesis, advisor, honors, and summary.
- Work and internship records cover company, department, title, employment type, function, industry, company type/size, dates, location, team and reporting details, responsibilities, achievements, tools, reason for leaving, supervisor, compensation, and summary.
- Project records cover name/type, owner, department, role, industry, dates/location, URL, keywords, tools/methods, team/users, background, objective, responsibilities, deliverables, achievements, metrics, challenges, solution, and summary.
- Multiple uploaded resumes merge records by stable identity fields and fill missing attributes without discarding distinct schools, roles, internships, or projects.

## Form mapping

The content agent identifies repeated form groups and assigns a `repeatKind` and `repeatIndex` to each field. Before scanning, it may click narrowly matched “add education/work/internship/project” controls until the page exposes enough cards for the reviewed local records. A temporary capture listener prevents those add controls from submitting the form.

For a single textarea named “项目经历” or “项目经验”, the complete projects collection can be formatted as one value. For repeated cards, `projects.0.*`, `projects.1.*`, and later records stay aligned by index.

## Reliability policy

AI output is a draft. Every non-empty resume-derived field must have a quoted evidence path. During form mapping, AI may select only an existing local path and cannot generate the value. Sensitive fields and work-to-internship fallback remain unselected until the user confirms them.


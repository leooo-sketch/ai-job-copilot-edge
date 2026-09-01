# Candidate profile schema v2

> Legacy reference. The extension now uses [profile schema v3](PROFILE_SCHEMA_V3.md) and migrates v2 records automatically.

The v2 profile covers the reusable data groups commonly exposed by enterprise recruiting systems while keeping sensitive answers optional and review-only.

## Source model

- [SAP SuccessFactors candidate field definitions](https://help.sap.com/docs/successfactors-recruiting/setting-up-and-maintaining-sap-successfactors-recruiting/candidate-profile-field-definition-field-id-and-field-type) informed contact, address, availability, compensation, current title/company, source, documents, education, and work-history coverage.
- [Oracle Recruiting candidate application sections](https://docs.oracle.com/en/cloud/saas/talent-management/faush/add-info-to-job-applications-on-behalf-of-candidates.html) informed repeatable education, experience, languages, licenses/certifications, skills, preferred locations, questionnaires, and sensitive-information groups.
- [Oracle repeatable content sections](https://docs.oracle.com/en/cloud/saas/talent-management/25b/faimh/collect-candidate-data-using-multiple-content-sections.html) informed multi-record handling.

## Groups

- Identity and contact: Chinese/English name components, phones, emails, social/profile URLs, location, address, nationality, current employer/title.
- Job preferences: role, job family, industry, cities, compensation, availability, employment/work mode, relocation and travel preferences, source/referral.
- Optional sensitive data: identity documents, birth information, gender, ethnicity, health, marital/political status, household registration, disability/veteran status.
- Professional evidence: education, work/internships, projects, research, campus, volunteering, skills, languages, certificates, awards, publications, patents.
- Compliance: work authorization, sponsorship, non-compete, relatives, disciplinary/criminal history, conflicts, background-check consent.
- Contacts: family, emergency contacts, and professional references.
- Narrative answers: summary, strengths, interests, career plan, motivation, cover letter, and other information.

## Reliability policy

AI output is a draft, not an authoritative candidate record. A model may only populate information that appears explicitly in uploaded resume text and should attach an evidence snippet. During form mapping, the model may select only an existing profile path; the extension resolves the actual value locally. Sensitive and cross-section mappings remain unselected until the user confirms them.

# Project documentation

This directory contains project-wide operational guides, privacy documentation, and dated analysis. The root [README](../README.md) is the project entry point; server implementation references are organized separately in [`server/docs`](../server/docs/README.md).

## Guides

| Document | Purpose |
| --- | --- |
| [Complete production deployment guide](deployment/DEPLOYMENT.md) | Configure GitHub, MongoDB Atlas, Render, Netlify, SEO, storage, email, verification, and rollback. |
| [Public Privacy Policy](../client/src/pages/PrivacyPolicy.tsx) | Visitor-facing explanation of contact data, analytics, email processing, retention, providers, and privacy requests; served at `/privacy-policy`. |
| [Analytics privacy and retention](privacy/analytics-privacy.md) | Technical details of analytics collection, access controls, and the current until-reset retention behavior. |
| [Project analysis report](analysis/project-analysis-report.md) | Dated technical audit and implementation history; findings are historical, not live deployment status. |

## Document ownership

- Keep the root README concise and focused on project overview, local setup, commands, and links.
- Put deployment and hosting procedures in `docs/deployment/`.
- Put privacy and data-handling explanations in `docs/privacy/`.
- Keep the public-facing policy in `client/src/pages/PrivacyPolicy.tsx`; ensure it stays consistent with actual contact, analytics, and email-provider behavior.
- Keep dated audits and implementation evidence in `docs/analysis/`; do not treat their snapshots as current runtime measurements.
- Keep API, architecture, security, and admin implementation documents in `server/docs/`.

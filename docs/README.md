# Project documentation

This directory contains project-wide operational guides, privacy documentation, and dated analysis. The root [README](../README.md) is the project entry point; server implementation references are organized separately in [`server/docs`](../server/docs/README.md).

## Guides

| Document | Purpose |
| --- | --- |
| [Render + Netlify deployment](deployment/render-netlify.md) | Configure and deploy the frontend, API, database, and persistent storage. |
| [Analytics privacy and retention](privacy/analytics-privacy.md) | Explain collected analytics, access controls, and retention. |
| [Project analysis report](analysis/project-analysis-report.md) | Dated technical audit and implementation history; findings are historical, not live deployment status. |

## Document ownership

- Keep the root README concise and focused on project overview, local setup, commands, and links.
- Put deployment and hosting procedures in `docs/deployment/`.
- Put privacy and data-handling explanations in `docs/privacy/`.
- Keep dated audits and implementation evidence in `docs/analysis/`; do not treat their snapshots as current runtime measurements.
- Keep API, architecture, security, and admin implementation documents in `server/docs/`.

# Security and Credentials

Do not keep account passwords, PINs, API keys, database credentials, or setup tokens in this repository's Markdown files or source code.

For local development, copy `server/.env.example` to `server/.env` and add only the values required for the services you use. The root `.gitignore` excludes `.env` files. Do not commit or share `.env`. Never place server credentials in `client/.env`; Vite exposes `VITE_*` variables to the browser.

For production, provide secrets through the hosting platform's secret or environment-variable manager. Configure `MONGODB_URI`, `ADMIN_EMAIL`, a one-time `ADMIN_SETUP_TOKEN`, an HTTPS `APP_URL`, and working SMTP credentials for password reset delivery. Use a least-privilege MongoDB account. Remove the bootstrap token after initial provisioning.

## Production request security

- `APP_URL` and `CORS_ALLOWED_ORIGINS` must contain exact browser origins, including scheme and port where applicable. Do not use wildcards. CORS is not API authorization; protected routes still require authentication and CSRF validation.
- The production Content Security Policy restricts scripts to the application origin and limits API connections to the application and the weather providers used by the client. The embedded browsing proxy has a separate sandbox policy.
- Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies in front of Express. Leave it at `0` unless the hosting topology is known; forwarded IP headers are otherwise untrusted.
- Sensitive endpoint rate limits are stored in MongoDB, shared across server instances, and fail closed with HTTP 503 if the rate-limit store is unavailable. Ensure the production database is reachable and permits index creation.
- Request analytics retain only the configured 90-day window; MongoDB TTL cleanup is asynchronous. Analytics query values that can contain credentials, including URLs, are redacted.

## Uploads and backups

- Authenticated file uploads are limited to 50 MiB; administrator portfolio media must pass extension, MIME type, and file-signature checks. Camera archive uploads are separately capped at 100 MiB.
- The desktop's C: access-denied behavior is a client-side virtual-filesystem UX boundary, not an authorization mechanism. Server file routes enforce their own authentication, ownership, path-containment, and upload validation checks.
- Backup restore accepts only the documented JSON format, enforces a 70 MiB request limit, validates project/media records and binary signatures, and rolls back portfolio content if a later restore step fails.
- Full on-disk backups can contain account password hashes and contact records. Keep `server/storage/` private, restrict filesystem access, and do not publish or email backup JSON files. The portable backup export endpoint omits account and contact collections.
- Server build artifacts are produced without source maps. Existing local map files are not automatically deleted by build or ignore rules; do not deploy them as static assets.

If a real credential was committed or shared, treat it as compromised: revoke or rotate it at the issuing service. Removing the value from a file does not invalidate it or erase it from repository history.

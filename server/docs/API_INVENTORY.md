# Windows 11 Portfolio: Backend API Inventory & Authorization Matrix

This document provides a complete inventory of all Express routes, controllers, HTTP methods, access-control levels, parameter schemas, and error responses.

> `server/routes/portfolio.ts` exports a legacy `/api/portfolio/projects` router for isolated tests and compatibility assessment, but it is not mounted by `server/server.ts`. The active public projects API is `/api/projects`; do not treat the legacy route as a production endpoint or remove it until external integrations are checked.

---

## Authorization Tiers

- **Public**: Accessible by any unauthenticated visitor or client application.
- **Authenticated User (`requireAuth`)**: Requires a valid, non-revoked server-side session carried only in an HttpOnly cookie.
- **Resource Owner or Admin**: Requesters can only access, update, or delete records matching their `userId`, unless their session has `role: 'admin'`.
- **Administrator Only (`requireAdmin`)**: Requires a valid MongoDB-backed session for the administrator account.

---

## 1. Authentication & Session APIs (`/api/auth`)

| Endpoint                    | Method | Access Level       | Description                                                                                                       | Rate Limited |
| :-------------------------- | :----- | :----------------- | :---------------------------------------------------------------------------------------------------------------- | :----------- |
| `/api/auth/login`           | `POST` | Public             | Verifies administrator email/password with Argon2id and issues an HttpOnly session cookie.                        | Yes (20/15m) |
| `/api/auth/unlock`          | `POST` | Administrator Only | Re-verifies the current administrator session password; does not issue another session.                           | Yes (20/15m) |
| `/api/auth/logout`          | `POST` | Administrator Only | Revokes the current server-side session and clears session/CSRF cookies.                                          | Yes (CSRF)   |
| `/api/auth/me`              | `GET`  | Authenticated      | Returns the current account profile without password hashes.                                                      | No           |
| `/api/auth/profile`         | `PUT`  | Authenticated      | Updates the administrator profile (name, bio, avatar, settings).                                                  | Yes (CSRF)   |
| `/api/auth/forgot-password` | `POST` | Public             | Emails administrators a generic, single-use reset link that expires in 15 minutes; never returns the link secret. | Yes (5/15m)  |
| `/api/auth/reset-password`  | `POST` | Public             | Consumes the emailed link secret, updates the password hash, and revokes all active sessions.                     | Yes (5/15m)  |
| `/api/auth/change-password` | `POST` | Administrator Only | Changes the password and invalidates prior sessions.                                                              | Yes (CSRF)   |
| `/api/auth/change-email`    | `POST` | Administrator Only | Changes the administrator email after password verification; revokes current sessions.                            | Yes (CSRF)   |
| `/api/auth/users`           | `GET`  | Administrator Only | Lists account metadata without password hashes.                                                                   | No           |

---

## 2. Tasks & Planner APIs (`/api/tasks`)

| Endpoint         | Method   | Access Level   | Description                                                                     | Query / Body Params                                                                   |
| :--------------- | :------- | :------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------ |
| `/api/tasks`     | `GET`    | Authenticated  | Lists user tasks with pagination, filtering, and sorting. Admins see all tasks. | `status`, `priority`, `category`, `search`, `sortBy`, `order`, `page`, `limit`        |
| `/api/tasks`     | `POST`   | Authenticated  | Creates a new task. Automatically assigns `userId` to the requester.            | `title` (required, max 200), `description`, `priority`, `category`, `dueDate`, `tags` |
| `/api/tasks/:id` | `GET`    | Owner or Admin | Retrieves task details. Blocks access if user does not own task.                | Path: `id`                                                                            |
| `/api/tasks/:id` | `PUT`    | Owner or Admin | Updates task properties. Enforces resource ownership.                           | `title`, `description`, `status`, `priority`, `category`, `dueDate`, `tags`           |
| `/api/tasks/:id` | `DELETE` | Owner or Admin | Deletes task item from persistent database.                                     | Path: `id`                                                                            |

---

## 3. Virtual File System & Storage APIs (`/api/files`)

| Endpoint                  | Method   | Access Level   | Description                                                                            | Constraints & Security                                                              |
| :------------------------ | :------- | :------------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| `/api/files/upload`       | `POST`   | Authenticated  | Uploads file via Multipart Form or JSON base64.                                        | Max 50MB. Blocked extensions (`.exe`, `.bat`, `.cmd`, etc.). Path traversal guards. |
| `/api/files/list`         | `GET`    | Authenticated  | Lists files with filtering (`parentId`, `type`, `extension`, `search`) and pagination. | Non-admins only see files they created or public system templates.                  |
| `/api/files/download/:id` | `GET`    | Owner or Admin | Streams file content or binary download.                                               | Verifies path stays inside `server/storage/`; validates user ownership.             |
| `/api/files/:id`          | `GET`    | Owner or Admin | Retrieves metadata for a single stored file.                                           | Path: `id`                                                                          |
| `/api/files/:id`          | `PUT`    | Owner or Admin | Renames, moves, or modifies text file content.                                         | Updates disk copy and metadata timestamp safely.                                    |
| `/api/files/:id`          | `DELETE` | Owner or Admin | Deletes file record and unlinks physical disk file.                                    | Path traversal checked before unlinking disk file.                                  |
| `/api/files/sync`         | `POST`   | Authenticated  | Bulk synchronizes frontend VFS files to server.                                        | Validates array payload and applies `userId`.                                       |

Portfolio media referenced by published or draft content/projects cannot be deleted; deletion responds with `409` until references are removed. Public `/api/portfolio-media/:id` URLs are served only while referenced by published profile/resume, SEO image, or project content; authenticated administrators may also preview media referenced by their saved draft.

---

## 4. Contact & Inquiries APIs (`/api/contact`)

| Endpoint                  | Method   | Access Level | Description                                                                              | Details                                                                   |
| :------------------------ | :------- | :----------- | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| `/api/contact`            | `POST`   | Public       | Submits visitor message, saves to database, and triggers email pipeline.                 | Rate limited (5 req/min). Validates name, email format, subject, message. |
| `/api/contact/health`     | `GET`    | Public       | Diagnostic report of email provider status and stored message count.                     | Returns provider name, status, receiver email, diagnostics.               |
| `/api/contact/history`    | `GET`    | Admin Only   | Retrieves list of visitor inquiries with search, status filtering, and pagination.       | Parameters: `status`, `search`, `sortBy`, `order`, `page`, `limit`.       |
| `/api/contact/:id`        | `GET`    | Admin Only   | Retrieves full details of a specific contact inquiry.                                    | Path: `id`                                                                |
| `/api/contact/:id/status` | `PATCH`  | Admin Only   | Updates inquiry status (`delivered`, `replied`, `failed`), notes, and replied timestamp. | Body: `{ status, notes, replied }`                                        |
| `/api/contact/:id`        | `DELETE` | Admin Only   | Deletes inquiry record from database.                                                    | Path: `id`                                                                |

---

## 5. Analytics & Telemetry APIs (`/api/analytics`)

| Endpoint                   | Method | Access Level | Description                                                                 | Security                                                                              |
| :------------------------- | :----- | :----------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `/api/analytics/track`     | `POST` | Public       | Accepts page views, project views/clicks, and portfolio app opens. The client sends an anonymous persistent visitor ID when storage is available. | Rate limited; event names are allowlisted; recursively masks passwords, JWTs, hashes, and secrets from `metadata`. |
| `/api/analytics/dashboard` | `GET`  | Admin Only   | Returns lifetime visitor/project/lead summary and top projects, plus daily activity for the last seven days and app-open counts/recent opens. | Protected with `requireAdmin`; lifetime data is read from MongoDB when connected and otherwise from the in-memory cache. Unique visitor counts start after visitor IDs are deployed. |
| `/api/analytics/logs`      | `GET`  | Admin Only   | Returns portfolio interaction logs with pagination and optional category/search filters. | Protected with `requireAdmin`; excludes unrelated system telemetry.            |

Assistant-question analytics are returned for compatibility with the reference analytics dashboard; this portfolio currently has no visitor chat service, so the count remains zero unless that feature is added.

## 8. Admin Content, Preview & Account Management

All `/api/admin/*` routes require an administrator session. Mutating requests require CSRF validation.

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/admin/dashboard` | `GET` | Workspace counts, storage status, and recent audit entries. |
| `/api/admin/users` | `GET`, `POST` | List accounts without password hashes; create user/admin accounts. |
| `/api/admin/projects` | `GET`, `POST` | Read and stage project drafts. |
| `/api/admin/projects/:id` | `PUT`, `DELETE` | Update/remove a staged project; changes are not public until publish. |
| `/api/admin/projects/:id/visibility` | `PUT` | Set a staged project's `visible` state; requires a boolean and CSRF validation. |
| `/api/admin/projects/published` | `GET` | Read the complete published project set, including hidden entries, for private draft comparison and media-reference checks. |
| `/api/admin/content-studio` | `GET` | Retrieve published and draft portfolio content for authenticated editors. |
| `/api/admin/content-studio/status` | `GET` | Return current content-studio/service configuration status. |
| `/api/admin/content-studio/draft` | `PUT` | Validate and save draft content without publishing. |
| `/api/admin/content-studio/publish` | `POST` | Publish content and the staged project set together. |
| `/api/admin/content-studio/discard` | `POST` | Replace drafts with the current published content and projects. |
| `/api/admin/content-studio/revisions` | `GET` | List recent published revisions with detailed field and project diffs. |
| `/api/admin/content-studio/revisions/:id/restore` | `POST` | Restore a published revision into the private draft only. |
| `/api/admin/content-studio/revisions/:id` | `DELETE` | Delete a revision from history. |
| `/api/admin/content-studio/revisions/:id/delete` | `POST` | Method-compatible alternative for deleting a revision from history. |
| `/api/health/admin` | `GET` | Return administrator-only API, MongoDB, storage, runtime, and non-secret SMTP configuration status. |

The client route `/admin/preview` loads `/api/admin/content-studio` and `/api/admin/projects` under the administrator session. It is a private read-only page and is not a public API endpoint.
SMTP configuration status indicates that credentials exist; actual email delivery is only confirmed by a successful message reply.

---

## 6. Profile, Email Branding & External Services (`/api/profile`, `/api/email`, & `/api/browse`)

| Endpoint                    | Method | Access Level | Description                                                            | Notes                                                                           |
| :-------------------------- | :----- | :----------- | :--------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| `/api/profile`              | `GET`  | Public       | Returns portfolio owner's public information, bio, and social handles. | Cached static data.                                                             |
| `/api/profile/github`       | `GET`  | Public       | Retrieves live GitHub repositories and stats for specified username.   | Fallback cached metrics on rate limits.                                         |
| `/api/email/favicon`        | `GET`  | Public       | Serves the configured favicon image for outgoing email headers.        | Optional `id`; only configured/referenced favicon media is eligible. Returns inline image data, not an attachment. |
| `/api/browse/gemini-search` | `GET`  | Public       | Searches web using Gemini grounding or fallback local search index.    | Query: `q`                                                                      |
| `/api/browse/youtube`       | `GET`  | Public       | Retrieves YouTube video listings for search query and category.        | Query: `q`, `category`                                                          |
| `/api/browse/news`          | `GET`  | Public       | Retrieves latest developer and tech news.                              | Query: `q`                                                                      |
| `/api/browse/proxy`         | `GET`  | Public       | Fetches and sanitizes external web page for in-browser iframe viewing. | Blocks RFC 1918 private IPs, localhost, and cloud metadata (`169.254.169.254`). |

---

## 7. Documentation & Diagnostics (`/api/docs` & `/api/health`)

| Endpoint              | Method | Access Level | Description                                                    |
| :-------------------- | :----- | :----------- | :------------------------------------------------------------- |
| `/api/health`         | `GET`  | Public       | Basic ping endpoint returning server uptime and health status. |
| `/api/docs`           | `GET`  | Public       | Interactive Swagger UI API explorer.                           |
| `/api/docs/spec.json` | `GET`  | Public       | Full OpenAPI 3.0 specification in JSON format.                 |

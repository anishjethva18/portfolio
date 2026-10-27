# Architecture and Project Layout

This project keeps the client and API in separate top-level packages with independent dependency manifests and lockfiles.

## Client: `client/`

The React and TypeScript client lives in `client/src/`; `client/public/` contains static assets. Vite serves the client in development and writes production output to `client/dist/`.

The Admin Panel is part of the Windows desktop application, with focused admin components under `client/src/components/apps/`. `/admin/preview` is a protected standalone route that retrieves only saved admin drafts and renders a read-only portfolio preview; it does not change published content.

The Windows desktop's file views are a virtual file system, not direct access to the host computer. `client/src/hooks/useVirtualDDriveFiles.ts` combines local OS-context files with generated references to published portfolio content and projects. File Explorer and Notepad's Open/Save dialogs share this view; C: remains a simulated, restricted drive. Notepad filters its dialogs to text, Markdown, and supported programming formats.

## Server: `server/`

`server/server.ts` is the application entrypoint. The Express server mounts API routes, security and authentication middleware, data models, database configuration, service integrations, and test scripts. In development, it mounts Vite middleware; production serves the built client alongside the API.

Key directories:

- `config/`: authentication, database, and email configuration.
- `db/` and `models/`: database connection and domain models.
- `middleware/`: request validation, authentication, rate limiting, and security.
- `routes/`: HTTP API endpoints.
- `services/`: storage, authentication, and integration logic.
- `scripts/` and `tests/`: maintenance tools and server tests.
- `docs/`: API inventory and operational documentation.
- `storage/`: uploaded files and server-managed backups.

The storage root defaults to `server/storage/` and can be changed with `PORTFOLIO_STORAGE_DIR`. Backups default to its `backup/` subdirectory; media metadata and disk locations are handled by the storage services. `client/public/` is for shipped public assets, not private admin uploads.

## Package Configuration

- `client/package.json` and `client/package-lock.json`: client scripts and dependencies.
- `server/package.json` and `server/package-lock.json`: server scripts and dependencies.
- `client/vite.config.ts`: Vite setup and client source alias.
- `server/tsconfig.json`: server typecheck configuration.
- `server/.env.example`: names and examples for optional server runtime configuration.
- `netlify.toml`: deployment build and publish settings.

## Runtime Data and Secrets

MongoDB is the source of truth for application records. The configured private storage root contains uploaded files, camera archive data, and server-managed backups; preserve it with the database when moving or deleting the project. The former local JSON data and migration backups are not used by the current server. Keep local secrets in `server/.env`; never put passwords, tokens, or private connection strings in Markdown, source files, or public assets. See [Security and credentials](SECURITY.md).

## Common Commands

Run `npm --prefix client run dev` for local development (starts the server and its Vite middleware), `npm --prefix server test` for server tests, `npm --prefix client run typecheck` for client TypeScript checks, `npm --prefix server run typecheck` for server TypeScript checks, `npm --prefix client run build` for the client, and `npm --prefix server run build` for a production server bundle. Use `npm --prefix client run dev:vite` only when the server is already running separately; it proxies `/api` requests to port 3000 by default.

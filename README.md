<div align="center">
  <img src="client/public/avatar.png" alt="Anish Jethva" width="112" height="112" />
  <h1>Anish Jethva</h1>
  <p><strong>Full Stack &amp; AI Engineer · Interactive Windows 11 Portfolio</strong></p>
  <p>A full-stack portfolio experience built as a responsive Windows-style desktop, with native-feeling apps and a private content management workspace.</p>
  <p>
    <a href="https://github.com/anishjethva18"><img src="https://img.shields.io/badge/GitHub-anishjethva18-181717?style=for-the-badge&amp;logo=github" alt="GitHub profile" /></a>
    <a href="https://www.linkedin.com/in/anishjethva/"><img src="https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&amp;logo=linkedin" alt="LinkedIn profile" /></a>
    <a href="https://anishjethva.netlify.app"><img src="https://img.shields.io/badge/Portfolio-Visit-0A7EA4?style=for-the-badge&amp;logo=googlechrome&amp;logoColor=white" alt="Live portfolio" /></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&amp;logo=react&amp;logoColor=20232A" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5.8" />
    <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js 20 or later" />
    <img src="https://img.shields.io/badge/Express-4-000000?style=flat-square&amp;logo=express&amp;logoColor=white" alt="Express 4" />
    <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&amp;logo=mongodb&amp;logoColor=white" alt="MongoDB and Mongoose" />
    <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&amp;logo=vite&amp;logoColor=white" alt="Vite 6" />
  </p>
</div>

---

## ✨ At a glance

This is an interactive portfolio presented as a Windows 11-inspired desktop. Visitors can explore portfolio apps, open and arrange windows, and use the built-in tools. A separate administrator workspace manages portfolio content and publishes updates without replacing the desktop experience.

| 🖥️ Interactive desktop                                                                           | 📁 Native-feeling apps                                                                                   | 🛠️ Private admin workspace                                                                                |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Responsive Windows-style desktop with taskbar, Start menu, virtual desktops, and window snapping | About, Projects, Skills, Resume, Contact, File Explorer, Browser, Settings, Camera, Media, and utilities | Draft editing, preview, explicit publishing, revision history, uploads, project management, and analytics |

<details>
  <summary><strong>More included</strong></summary>
  <br />

- Light and dark themes, desktop personalization, touch interactions, and mobile-friendly layouts.
- Windowed apps, snap layouts, task management, a virtual file system, and built-in utility apps and games.
- Notepad Open/Save dialogs use the shared virtual D: contents and support text, Markdown, and programming-file formats; the simulated C: drive is shown as restricted.
- Opening an app dismisses the Widgets board. The Settings About page links to About, Projects, and Contact in that order.
- MongoDB-backed portfolio content, project drafts, revisions, user accounts, and analytics.
- Server-side administrator authentication with HttpOnly session cookies, CSRF checks, and Argon2id password hashes.
- Optional Gemini-powered features and SMTP email delivery.
- API health checks, audit history, manual backup and restore, and protected media handling.

</details>

## 🧰 Built with

| Area                  | Technologies                                 |
| --------------------- | -------------------------------------------- |
| Client                | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Server                | Node.js, Express 4, TypeScript               |
| Database              | MongoDB, Mongoose                            |
| UI and visualization  | Motion, Lucide, Recharts                     |
| Optional integrations | Google Gemini API, SMTP email                |

## 🗺️ How it fits together

```text
Visitor
  └──► React + TypeScript desktop (Vite)
         └──► Express API
                ├──► MongoDB / Mongoose
                │      ├── Published portfolio and projects
                │      ├── Private admin drafts and revisions
                │      └── Accounts, contacts, and analytics
                ├──► Protected file and media storage
                └──► Optional Gemini and SMTP integrations
```

Portfolio edits are saved privately as drafts. Publishing makes the draft public and records the previous published version. Restoring a revision changes the draft first; an administrator must publish it separately.

<details>
  <summary><strong>Repository map</strong></summary>
  <br />

```text
client/
  src/components/          Desktop, portfolio apps, and admin interface
  src/context/             Authentication and operating-system state
  src/data/                Initial portfolio and desktop data
  src/hooks/               Shared client data hooks, including virtual D: content
  src/utils/                Virtual drive, file, API, and UI helpers
  public/                  Images, videos, resume, and other static assets
docs/
  deployment/              Hosting and release procedures
  privacy/                 Analytics and data-handling documentation
  analysis/                Dated project reviews and implementation evidence
server/
  config/                  Database, authentication, and email setup
  models/                  MongoDB models
  routes/                  API endpoints
  services/                Content, auth, projects, and storage workflows
  scripts/                 Administrator bootstrap
  storage/                 Uploaded media and generated backups
  tests/                   Backend integration and end-to-end tests
  docs/                    Server architecture, API, security, and admin documentation
```

</details>

## 🚀 Run it locally

### Prerequisites

- Node.js **20 or newer** and npm.
- MongoDB for persistent admin accounts, sessions, portfolio content, and analytics. Run MongoDB locally or use MongoDB Atlas.
- A Gemini API key only if you want to enable Gemini-backed features.
- SMTP credentials only if you want live email delivery.

### 1. Install dependencies

Run these commands in PowerShell from the repository root:

```powershell
npm --prefix server ci
npm --prefix client ci
```

### 2. Configure the server

Create the local server environment file:

```powershell
Copy-Item server/.env.example server/.env
```

Set at least your MongoDB connection string and the local application URL in `server/.env`:

```dotenv
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/win11portfolio
```

Replace the example values with settings for your environment. `GEMINI_API_KEY` and the `EMAIL_*` settings are optional unless you use those integrations. Keep `.env` private; never put server credentials in client code, `client/.env`, or `VITE_*` variables.

In production, set `APP_URL` to the public HTTPS origin and set `CORS_ALLOWED_ORIGINS` to the exact comma-separated frontend origin(s) that need credentialed API access. If the frontend and API use different hosts, set `EMAIL_PUBLIC_BASE_URL` to the public HTTPS API origin so remote email clients can load the favicon image from the server endpoint. The API no longer trusts arbitrary `*.run.app` origins.

### 3. Create the first administrator

MongoDB must be running and reachable before creating an administrator. The password is entered through a hidden PowerShell prompt, passed only to the one-time process environment, and removed afterward. Use your intended administrator email in place of `admin@example.com`.

```powershell
$securePassword = Read-Host 'Admin password (at least 8 characters)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:PORTFOLIO_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  npm --prefix server run create-admin -- admin@example.com
  if ($LASTEXITCODE -ne 0) {
    throw 'Administrator creation failed.'
  }
} finally {
  Remove-Item Env:PORTFOLIO_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $securePassword.Dispose()
}
```

The password is stored as an Argon2id hash, not as plain text. Production requires a password of at least 8 characters, `ADMIN_EMAIL`, HTTPS `APP_URL`, MongoDB, and a one-time `ADMIN_SETUP_TOKEN` supplied through the deployment secret manager. Production bootstrap can run only once and its email must match `ADMIN_EMAIL`. Remove the setup token from the deployment environment after provisioning.

### 4. Start the app

Run the client development command from the repository root:

```powershell
npm --prefix client run dev
```

This starts the API first, waits for its health endpoint, then starts the standalone Vite development server. Open the portfolio at [http://localhost:5173](http://localhost:5173) by default (or the selected `--port`), then open **Admin Control Center** from the desktop to sign in. The Vite server proxies `/api` requests to the API on `PORT` (default `3000`); wait for the API-ready message before Vite starts. Keep using the Vite URL while this command is running.
When started by this command, opening the API root at `http://localhost:3000` redirects to the Vite frontend (including a custom `--port` value).

| Local endpoint              | URL                                                                  |
| --------------------------- | -------------------------------------------------------------------- |
| Portfolio and admin desktop | [http://localhost:5173](http://localhost:5173)                       |
| API health                  | [http://localhost:3000/api/health](http://localhost:3000/api/health) |
| API through Vite proxy      | [http://localhost:5173/api/health](http://localhost:5173/api/health) |
| Interactive API docs        | [http://localhost:3000/api/docs](http://localhost:3000/api/docs)     |

If port `5173` is already occupied, Vite exits instead of silently choosing a
different browser URL. Close the other process using that port or choose an
available port explicitly:

```powershell
npm --prefix client run dev -- --port 5174
```

## 🛠️ Admin workspace

The Admin Control Center is an app inside the desktop. It is not a public admin-registration page. Only an authenticated administrator can manage accounts and private content.

- **Overview and Analytics:** recorded visitor, page-view, project-interest, message, and activity metrics.
- **Site Content, Appearance, and SEO:** edit profile and portfolio details in a private draft, including the release label shown in Settings.
- **Projects:** manage project details and staged visibility before publishing.
- **Publish & History:** preview, publish, inspect revision changes, restore to draft, and manage prior versions.
- **Resumes & Media:** manage uploaded, referenced media through authenticated APIs.
- **Messages and Users & Roles:** review inquiries and administer authorized accounts.
- **Security & Status, Camera Archive, and Backup & Restore:** review health and audit activity, manage captures, and create or restore supported backups.

Admin sessions use server-side MongoDB storage and HttpOnly cookies; mutation requests also use CSRF protection. Admin APIs are protected by server-side role checks. Development requires an available configured MongoDB instance unless `ALLOW_IN_MEMORY_DB=true` is explicitly set for an isolated local fallback. Tests use their own isolated database; neither fallback is suitable for production.

## 🤖 Optional integrations

Gemini-backed capabilities are enabled when `GEMINI_API_KEY` is configured; otherwise features that depend on the provider may be unavailable or use their documented fallback. Configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, and `CONTACT_RECEIVER_EMAIL` for live SMTP delivery. Do not treat a configured SMTP account as tested until you verify it with an intended recipient.

## 🧪 Commands

| Command                                                                                                   | What it does                                            |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `npm --prefix client run dev`                                                                             | Start the API, then Vite at `http://localhost:5173`     |
| `npm --prefix client run dev -- --port 5174`                                                              | Start the API and Vite at a chosen available port       |
| `npm --prefix server run dev`                                                                             | Start the API with Vite middleware at `http://localhost:3000` |
| `npm --prefix server start`                                                                               | Start the built production server                       |
| `npm --prefix server run create-admin -- <email>`                                                         | Create the first admin using `PORTFOLIO_ADMIN_PASSWORD` |
| `npm --prefix server run bootstrap:admin -- <email>`                                                      | Alias for the administrator bootstrap command           |
| `npm --prefix server test`                                                                                | Run backend integration tests                           |
| `npm --prefix server run test:limitations`                                                                | Run backend limitation and security checks              |
| `npm --prefix server run test:e2e`                                                                        | Run backend walkthrough tests                           |
| `npm --prefix server run typecheck`                                                                       | Type-check server code                                  |
| `npm --prefix server run build`                                                                           | Build the production server bundle                      |
| `npm --prefix client run typecheck`                                                                       | Type-check client code                                  |
| `npm --prefix client run build`                                                                           | Build the frontend into `client/dist/`                  |
| `npm --prefix client run preview`                                                                         | Preview the built frontend                              |
| `npm --prefix client run test:capture-storage`                                                            | Run the isolated camera capture storage test            |
| `node --import=./server/node_modules/tsx/dist/loader.mjs --test client/src/utils/virtual-d-drive.test.ts` | Run virtual D: file-layout tests                        |

## 🔌 API map

All application APIs use the `/api` prefix. For endpoint details and access requirements, see the [API inventory](server/docs/API_INVENTORY.md) or open the local Swagger UI at `/api/docs`.

| Area                         | Examples                                                |
| ---------------------------- | ------------------------------------------------------- |
| Public portfolio             | `GET /portfolio-content`, `GET /projects`               |
| Authentication               | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| Content drafts and revisions | `/admin/content-studio`                                 |
| Admin and projects           | `/admin`, `/admin/projects`                             |
| Analytics and contacts       | `/analytics`, `/contact`                                |
| Files and captures           | `/files`, `/storage`, `/captures`                       |
| Tasks and health             | `/tasks`, `/health`                                     |

## ☁️ Production checklist

- [ ] Set `NODE_ENV=production`, MongoDB credentials, `ADMIN_EMAIL`, and a strong one-time `ADMIN_SETUP_TOKEN`.
- [ ] Serve the site over HTTPS and set the production `APP_URL`.
- [ ] Configure production email credentials if password recovery or message replies are enabled.
- [ ] Configure Gemini credentials only for enabled Gemini-backed features.
- [ ] Build the client with `npm --prefix client run build`; production static output is written to `client/dist/`.
- [ ] Build and start the server with `npm --prefix server run build` and `npm --prefix server start`.
- [ ] Use persistent, writable storage for uploaded media and server backups; back up MongoDB and files together.
- [ ] Verify admin sign-in, cookies, publishing, analytics, uploads, contact handling, and optional integrations in the deployed environment.

The root `netlify.toml` builds and publishes `client/dist/` for frontend hosting. The Express API must also be deployed to a Node.js host and configured for the production frontend origin and database.

## 📦 Data and uploads

MongoDB is the source of truth for account, portfolio, project, and analytics records. Uploaded portfolio media, resumes, and certificates are stored under the configured private storage root (by default `server/storage/`); server-managed backups and administrator camera archives use private subdirectories beneath that root unless explicitly configured otherwise. Do not confuse these with versioned visitor-facing starter assets under `client/public/` or generated files in `client/dist/`. Preserve the database and private storage together when moving the deployment, and keep backups in a secure location.

## 📚 Documentation

- [Documentation index](docs/README.md)
- [Render + Netlify deployment guide](docs/deployment/render-netlify.md)
- [Project analysis and implementation history](docs/analysis/project-analysis-report.md) (dated audit; historical measurements and deployment observations are not live status)
- [Analytics privacy and retention](docs/privacy/analytics-privacy.md)
- [Server documentation index](server/docs/README.md)
- [Server architecture](server/docs/ARCHITECTURE.md)
- [API inventory](server/docs/API_INVENTORY.md)
- [Admin panel structure and workflow](server/docs/ADMIN_PANEL_STRUCTURE.md)
- [Security and credentials](server/docs/SECURITY.md)

## 📄 License

No license is currently specified. Please contact the repository owner before reusing or redistributing this project.

<div align="center">
  <sub>Designed and built by <a href="https://github.com/anishjethva18">Anish Jethva</a>.</sub>
</div>

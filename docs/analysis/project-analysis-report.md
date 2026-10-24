# Windows 11 OS Portfolio — Project Analysis

**Initial review date:** 20 October 2026  
**Initial review type:** Read-only static project review  
**Initial scope:** Client, server, tests, documentation, build output, and local storage inventory  
**Initial change:** The original audit changed this report only. Follow-up implementation and validation are recorded in Sections 11–12; the initial findings below remain a historical baseline.

> Ratings below are engineering estimates from source/build inspection, not Lighthouse results, a load test, penetration test, or security certification. Runtime behavior also depends on MongoDB, hosting, network, and browser/device.

## 1. Executive summary

This is a substantial full-stack portfolio presented as a Windows-inspired desktop. It contains a React/TypeScript client, an Express/Mongoose API, MongoDB-backed publishing and administrator workflows, local persistent media and backup storage, and optional Gemini/SMTP integrations.

| Area | Assessment | Basis |
|---|---:|---|
| Overall implementation | **Good, broad feature coverage** | Separate client/server packages, persistence, admin draft/publish flow, many desktop apps, tests and operational docs |
| Performance | **6.5/10 — moderate to good (static estimate)** | App-level code splitting is present, but shared UI/vendor assets and the PDF worker are substantial; no runtime benchmark was run |
| Algorithmic complexity | **Generally linear to linearithmic for in-memory collection operations** | Collection scans/maps are typically O(n); sorting is O(n log n); no single Big-O describes the whole application |
| Security posture | **6/10 — moderate (heuristic)** | Strong admin-session and CSRF controls exist; CSP is disabled, one production CORS allowance is broad, and the rate limiter is process-local |
| Maintainability | **Moderate; higher risk in large files** | 199 TypeScript/TSX/JavaScript/CJS source files and 79,331 lines in the current scan; several UI/API modules are very large |
| Removable “extra” files | **Only some build outputs are clearly regenerable** | Uploads/backups are runtime data; some other files are possible orphans but need ownership/contract confirmation first |

### Highest-priority conclusions

1. **Protect data before cleanup.** `server/storage/` contains application media and backups. The root also contains a 6.16 MiB full-backup JSON file that is byte-identical to one in the archive. They are recovery data, not disposable build artifacts; retain at least one verified copy and do not remove either automatically.
2. **Improve security defense-in-depth.** The Express setup disables Helmet’s Content Security Policy; production CORS accepts any origin ending in `.run.app`; the in-memory rate-limit map does not coordinate across server replicas.
3. **Measure real performance.** The app has lazy-loaded applications, which is useful, but the shared client bundle and PDF worker are sizable. There are no current browser performance measurements in this report.
4. **Reduce maintenance risk gradually.** Large files such as `FileExplorerApp.tsx`, `MediaApp.tsx`, `NotepadApp.tsx`, and `server/routes/admin.ts` have thousands of lines. Their responsibility and test boundaries should be improved in later, separately validated work.
5. **Do not remove files based only on names.** `server/routes/portfolio.ts` is not mounted by the main server entrypoint, but tests explicitly mount it. It is a candidate for an API-contract decision, not a confirmed safe deletion.

## 2. What the project does

### Visitor-facing client

- Renders a Windows-like desktop, taskbar, Start menu, windows, snap layouts, virtual desktops, and mobile/touch interactions.
- Provides portfolio apps (About, Projects, Resume, Contact) and system-like apps (File Explorer, Browser, Terminal, Settings, Media, Camera, Notepad, Calculator, games, and others).
- Loads published profile, project, appearance, and media data from the API.
- Uses browser storage and application state for local/virtual OS behavior.

### Administrator and API

- An administrator signs in through the client and accesses protected management apps.
- Content and projects can be edited as private drafts, previewed, and explicitly published.
- MongoDB stores users, sessions, published content, drafts, revisions, projects, contacts, analytics, and file metadata.
- The server stores uploaded files and generated backups under `server/storage/`.
- Optional services provide email delivery, Gemini-backed search/assistant behavior, and GitHub profile information.

### Main request/data path

```text
Browser
  └── React + Vite client (client/src)
        └── Express API (server/server.ts)
              ├── MongoDB / Mongoose (server/models, server/db)
              ├── Uploaded media and backups (server/storage)
              └── Optional external services (Gemini, SMTP, GitHub, weather)
```

Development runs the API and Vite middleware in the same server process. Netlify’s current configuration builds and publishes `client/dist`; it does not show a production `/api` proxy to an Express host.

## 3. Repository and file map

The current source scan found **199 TypeScript/TSX/JavaScript/CJS files** (**126** under `client/src` and **73** under `server`) and **79,331 source lines** (52,829 client and 26,502 server), excluding dependencies, generated output, and storage data. These are workspace counts, not Git-tracked-file counts; this workspace did not expose a Git repository, so tracked/untracked status cannot be verified. Non-code content and generated output are inventoried separately below.

### Root

| File/folder | Purpose |
|---|---|
| `README.md` | Project overview, stack, architecture sketch, setup, and common operations |
| `.gitignore` | Excludes dependency/build directories, environment files, and `server/storage/` |
| `netlify.toml` | Builds the client and publishes `client/dist`; includes SPA fallback routing |
| `metadata.json` | Small project metadata file. Static source search did not find a runtime import/reference to this root copy; see “Extra files” before considering it for removal |
| `full-backup-2026-10-14T20-50-27-826Z.json` | A full backup artifact (6,454,767 bytes); its SHA-256 matches the copy in `server/storage/AdminArchive/Backups/`. Treat as sensitive recovery data |
| `client/` | Frontend application, static assets, and its independent package/lock files |
| `server/` | API, persistence, service integrations, tests, docs, and runtime data |

There is no root-level `package.json`; client and server dependencies/scripts are managed separately.

### Client package

| Path | Purpose |
|---|---|
| `client/package.json` / `client/package-lock.json` | Frontend dependencies and reproducible npm install; scripts include Vite build and TypeScript type-check |
| `client/vite.config.ts` | React/Tailwind Vite configuration, source alias, development API proxy, code chunk naming/splitting |
| `client/tsconfig.json` | TypeScript compiler configuration |
| `client/index.html` | Browser document shell, metadata, title, and React root |
| `client/public/` | Public static images, icons, downloadable documents and demo media served without application bundling; content here is copied into the public build |
| `client/dist/` | Generated production output. Rebuildable from client sources and assets; not source-of-truth |
| `client/node_modules/` | Installed dependencies; reproducible from lockfile |

### Client source

| Path | Main responsibility |
|---|---|
| `client/src/main.tsx` | React bootstrap, global error boundary, stylesheet import, removal of legacy service-worker cache |
| `client/src/App.tsx` | App-level providers/layout, desktop composition, route/shortcut handling, published settings sync, maintenance state |
| `client/src/index.css` | Global styles, Tailwind integration, theme rules, shared visual behavior |
| `client/src/types.ts` | Shared client data and OS/app types |
| `client/src/vite-env.d.ts` | Vite environment type declarations |
| `client/src/context/AuthContext.tsx` | Client authentication/session state and API interaction |
| `client/src/context/ConfirmDialogContext.tsx` | Shared confirmation dialog state/provider |
| `client/src/context/OSContext.tsx` | Central desktop/OS state: apps, windows, files, desktop icons, pins, settings, notifications and related operations. It is one of the largest client files |
| `client/src/data/portfolioData.ts` | Default profile, app catalogue, and seeded portfolio data |
| `client/src/data/initialFileSystem.ts` | Seed entries for the simulated virtual filesystem |
| `client/src/hooks/` | Reusable hooks: battery, network, responsive admin page sizing, and touch sensitivity |
| `client/src/services/storageService.ts` | Client-side persistence adapter for virtual OS state |
| `client/src/services/terminalEngine.ts` | Terminal command parsing and execution for simulated shell commands |
| `client/src/utils/` | Shared behavior: API calls, admin shortcut/draft state, analytics, browser helpers, camera filters, date formatting, file handling, haptics/sound, portfolio syncing, appearance, skills/icons, weather, and media upload |

#### Client UI groups

| Directory | Files / purpose |
|---|---|
| `client/src/components/desktop/` | `Desktop.tsx`, `DesktopIcon.tsx`, `ContextMenu.tsx`, `Wallpaper.tsx`, `LockScreen.tsx`, `AltTabOverlay.tsx` — desktop surface, icons, interaction menus, wallpaper, lock screen, and app switching |
| `client/src/components/window/` | `WindowFrame.tsx`, `SnapLayoutMenu.tsx`, `SnapDockPreviewOverlay.tsx` — window lifecycle, resizing/moving, snap UI |
| `client/src/components/taskbar/` | `Taskbar.tsx`, `StartMenu.tsx`, `SearchFlyout.tsx`, `NotificationCenter.tsx`, `SystemTrayPanels.tsx` — launcher, search, alerts, tray and taskbar |
| `client/src/components/common/` | Shared icons, thumbnails, media, keyboard, dialogs, status indicators, overlays, error boundary, and accessibility/interaction UI |
| `client/src/components/widgets/` | `WidgetsBoard.tsx` — desktop widgets surface |
| `client/src/components/easter/` | `BSODScreen.tsx` — simulated blue-screen experience |
| `client/src/components/apps/AppRegistry.tsx` | Maps app IDs to app components and lazy-loads app modules |
| `client/src/components/apps/` | Visitor apps plus admin app surfaces. Large modules include File Explorer, Media, Notepad, Settings, Camera, and Portfolio Management |
| `client/src/components/apps/admin/` | Admin dashboard/charting, saved-draft preview, advanced content management, assistant, media, and publishing/version UI |
| `client/src/components/apps/browser/` | Browser header/new tab, web content, search results, YouTube/Wikipedia/community views, lens and voice-search dialogs |

The app registry’s `React.lazy()` imports reduce the work needed to load every application up front. Its general Suspense fallback is `null`; an application’s first render can therefore show a blank area while its module loads.

### Server package

| Path | Purpose |
|---|---|
| `server/package.json` / `server/package-lock.json` | API dependencies, build/dev/start scripts, backend test scripts, and type-check |
| `server/server.ts` | Express entrypoint: configuration checks, Mongo connection, middleware, route mounting, public APIs, and dev/prod client serving |
| `server/tsconfig.json` | Server TypeScript settings; `strict` mode is disabled |
| `server/.env.example` | Names/example values for local configuration; safe template, not production credentials |
| `server/.env` | Local runtime secrets/configuration file exists in this workspace. `.gitignore` excludes `.env*`; its contents were not inspected |
| `server/loadEnv.cjs` / `server/testEnv.cjs` | Environment loading for server and isolated test execution |
| `server/server.bundle.cjs` | Generated server bundle produced by the server build command; not source-of-truth |
| `server/server.bundle.cjs.map` | Generated source map for the server bundle. It is not covered by the current `server/*.bundle.cjs` ignore rule |

#### Server directories and file roles

| Directory | Files / purpose |
|---|---|
| `server/config/` | `authConfig.ts`, `dbConfig.ts`, `emailConfig.ts` — production config validation, Mongo connection, email settings |
| `server/db/` | `database.ts` — Mongoose-backed application data interfaces/cache synchronization |
| `server/middleware/` | `auth.ts` — session, role and CSRF enforcement; `security.ts` — request logging/redaction and an in-memory rate limiter; `rateLimiter.ts` — endpoint limiters; `validation.ts` — request validation; `apiNotFound.ts` — JSON API 404 |
| `server/models/` | Mongoose schemas for `User`, `Session`, `PasswordResetToken`, `RevokedToken`, `Task`, `Contact`, `Project`, `FileMetadata`, `Capture`, `Analytics`, `SiteContent`, admin drafts/revisions, and audit logs; `index.ts` re-exports them |
| `server/routes/` | `admin.ts` — admin/settings, user, backup and management endpoints; `analytics.ts`, `assistant.ts`, `auth.ts`, `browse.ts`, `captures.ts`, `contact.ts`, `contentStudio.ts`, `docs.ts`, `files.ts`, `health.ts`, `portfolio.ts`, `profile.ts`, `storage.ts`, `tasks.ts` — HTTP endpoint groups |
| `server/services/` | `authService.ts`, `sessionService.ts` — authentication/session lifecycle; `contentStudioService.ts`, `projectDraftService.ts` — drafts, publishing and revisions; `fileService.ts`, `backupService.ts`, `windowsStorageService.ts` — uploaded files, recovery/backups, and storage; `emailService.ts`; `geminiSearchService.ts`; `searchService.ts`; `contentProxy.ts`; `githubService.ts`; `skillCatalog.ts` |
| `server/scripts/` | `bootstrapAdmin.ts` — first administrator provisioning; `migrateSkillCatalog.ts` — skill-catalog migration |
| `server/tests/` | Eleven test files covering backend integration/security, admin sessions, repair, capture persistence, limitations, end-to-end walkthrough, content visibility/publish, email, profile visibility, skill catalog and skill icons |
| `client/src/services/captureStorageService.test.ts`, `client/src/utils/virtualDDrive.test.ts` | Two client-side test files covering local capture storage and virtual D: mapping |
| `server/docs/` | `ADMIN_PANEL_STRUCTURE.md`, `API_INVENTORY.md`, `ARCHITECTURE.md`, `SECURITY.md` — operational and developer documentation |
| `server/utils/` | `base64.ts`, `dateTime.ts` — shared encoding and time helpers |
| `server/storage/` | Runtime data. Current inventory includes media and backups; preserve it when copying/moving the project |

### Individual large modules

| File | Observed size | Why it matters |
|---|---:|---|
| `client/src/components/apps/FileExplorerApp.tsx` | ~4,309 lines | Many filesystem views/actions in one component; changes can have broad UI/regression impact |
| `client/src/components/apps/MediaApp.tsx` | ~3,885 lines | Media gallery, uploads, camera/archive and related workflows are tightly co-located |
| `client/src/components/apps/NotepadApp.tsx` | ~3,565 lines | Editor, file and document actions are concentrated in a large module |
| `client/src/components/apps/SettingsApp.tsx` | ~2,647 lines | Numerous settings panels and forms in one module |
| `client/src/context/OSContext.tsx` | ~2,557 lines | Central state/action provider with a large responsibility surface |
| `client/src/components/apps/PortfolioManagement.tsx` | ~1,932 lines | Large admin content and appearance editor |
| `server/routes/admin.ts` | ~1,407 lines | Many privileged endpoint responsibilities in one router |
| `server/db/database.ts` | ~915 lines | Persistence/synchronization concerns are concentrated |
| `server/services/contentStudioService.ts` | ~586 lines | Core draft/publish/revision rules; high-value area for focused tests |

File size alone does not prove poor design or a bug. It does increase the cost of understanding and validating changes.

## 4. Files that are generated, data, or possible extras

“Extra” is not the same as “safe to delete.” This workspace is not reporting Git tracking state and no files were deleted.

| Item | Classification | Recommendation |
|---|---|---|
| `client/dist/` (57 files; 16.06 MiB) | Generated client build | Rebuildable from client sources and `client/public/`. Do not hand-edit; deployment either needs the generated output or runs the configured client build |
| `client/node_modules/`, `server/node_modules/` | Installed dependency trees | Re-creatable from each package lockfile. They may be omitted from source archives, but are not project source |
| `server/server.bundle.cjs` (433,707 bytes) | Generated server bundle | Rebuildable using the server build command. Do not confuse with `server/server.ts` |
| `server/server.bundle.cjs.map` (792,355 bytes) | Generated source map | Rebuildable, but currently not matched by the bundle ignore rule. Ensure it is not unintentionally committed or publicly deployed; source maps can reveal implementation details |
| `server/storage/` | Runtime uploads, media index and backups | **Not extra. Preserve and back up.** Current inventory: 5 files at the storage root (about 4.56 MB), 12 files under `Portfolio/` including `.media-index.json` (11 media files, about 5.78 MB), 8 archive backups (about 55.9 MB), and one skills-migration JSON under `Backups/` (about 0.18 MB) |
| `full-backup-2026-10-14T20-50-27-826Z.json` (6,454,767 bytes) | Backup data | **Not a build artifact. Preserve securely.** Its SHA-256 is identical to `server/storage/AdminArchive/Backups/full-backup-2026-10-14T20-50-27-826Z.json`; this is a duplicate copy, not proof that either can be removed without a recovery decision. At the time of the initial audit, the root ignore rules did not exclude this pattern; Section 12 records the follow-up ignore rule |
| Root `metadata.json` | Possible unused root metadata | No static runtime reference to this root file was found; `initialFileSystem.ts` contains a *virtual filesystem entry* also named `metadata.json`, which is not the same file. Confirm its origin/required tooling before removal |
| `server/routes/portfolio.ts` | Possibly unmounted route module | Not mounted from `server/server.ts` in the current startup path, but two test suites import and mount it. Treat as an API/legacy-contract decision, not confirmed dead code |
| `client/public/downloads/Windows_11.jpg` and `Windows11.jpg` | Static image assets | Both names are seeded/referenced in the virtual filesystem/default wallpaper flow. Their hashes differ, so they are not byte-identical duplicates |
| `client/public/videos/React_Debug_Walkthrough.mp4` | Static demo asset | Seeded into the virtual filesystem. It may be removable only if that demo is intentionally removed from the user-facing experience |

### Empty files, empty directories, and exact duplicates

The following were confirmed as zero bytes in the current workspace. Static source search found no references to these module names; they therefore appear to be unimplemented placeholders/orphans, but this report does not delete them. Check any external tooling or dynamic references before cleanup.

| Path | Finding |
|---|---|
| `client/src/components/apps/PortfolioAssistantWidget.tsx` | Empty component module; no source reference found |
| `client/src/components/apps/admin/AssistantConversations.tsx` | Empty admin component module; no source reference found |
| `server/models/AssistantConversation.ts` | Empty model module; no source reference found |
| `server/routes/assistant.ts` | Empty route module; no source reference found; it is not mounted in `server/server.ts` |
| `client/public/technology-icons/c.svg` | Empty SVG. The C# icon component actually requests `csharp.svg`; no reference to `c.svg` was found |

Empty directories:

| Path | Finding |
|---|---|
| `client/public/assets/` | Empty source directory. Vite's generated `client/dist/assets/` is a different, non-empty directory |
| `server/server/storage/` | Empty nested directory. Runtime storage paths inspected resolve to `server/storage/`, not this nested path |

Exact duplicate file-content groups (SHA-256 matches):

| Copies | Finding |
|---|---|
| `server/storage/1000153890-6a00fac0-c3924f93.png`, `server/storage/1000153890.png`, `server/storage/Portfolio/Media/1000153890-6a00fac0.png`, `server/storage/Portfolio/Media/1000153890.png` | Four names contain identical image bytes |
| `server/storage/Anish-Jethva-Data-Analyst.pdf` and `server/storage/Portfolio/Media/Anish-Jethva-Data-Analyst.pdf` | Identical PDF bytes in legacy root and portfolio media |
| `server/storage/Anish-Jethva-Full-Stack-Developer.pdf` and `server/storage/Portfolio/Media/Anish-Jethva-Full-Stack-Developer.pdf` | Identical PDF bytes in legacy root and portfolio media |
| `server/storage/Screenshot_2024-12-13_171640.png` and `server/storage/Portfolio/Media/Screenshot_2024-12-13_171640.png` | Identical image bytes in legacy root and portfolio media |
| Root `full-backup-2026-10-14T20-50-27-826Z.json` and `server/storage/AdminArchive/Backups/full-backup-2026-10-14T20-50-27-826Z.json` | Identical 6,454,767-byte backup JSON copies |

Identical hashes identify storage duplication, not safe deletion: the media index, database metadata, legacy path compatibility, backups, or deployment scripts may still rely on a particular path. Confirm references and restore a copy before any future deduplication. No files or folders were removed in this analysis.

### Storage and build structure: current state and recommended target

Current persistent layout is functional but inconsistent: uploaded portfolio media is mostly flat under `server/storage/Portfolio/Media/`; some older files remain at the `server/storage/` root; backups are split between `AdminArchive/Backups/`, `Backups/`, and a root backup; and the media index lives at `Portfolio/.media-index.json`. The current client build copies public static assets into `client/dist/`: 13 wallpapers (~3.01 MiB), 2 videos (~4.35 MiB), 4 audio files (~2.52 MiB), 3 downloads (~0.93 MiB), plus the application chunks and icons. Those shipped assets are not the same thing as private/admin uploads.

Recommended logical target (a recommendation only; **no move or migration was performed**):

```text
client/public/                      # Public, versioned starter/demo assets only
  wallpapers/  videos/  audio/  downloads/  technology-icons/
client/dist/                        # Generated build output only; never the upload source of truth
server/storage/
  Portfolio/
    Media/
      Resumes/  Profile/  Certificates/  SEO/  Wallpapers/  Audio/  Videos/
    Captures/
      Photos/  Videos/              # Only captures explicitly consented to server archive
    .media-index.json               # Retain/rebuild using the existing recovery flow
  AdminArchive/Backups/              # One documented canonical backup location
```

Keep visitor local-only camera captures in browser IndexedDB rather than server storage; a server copy belongs in the private archive only after consent. Keep profile photos, resumes, certificates, SEO/social images, and admin-uploaded media private behind the existing file-serving authorization rules where appropriate. Keep public starter/demo images and audio/video in `client/public/` only when they are intentionally shipped to every visitor.

Before implementing this layout, back up both filesystem and database, migrate paths and metadata together, preserve stable media IDs/URLs and old-path compatibility, verify index reconstruction and backup restore, then remove duplicate files only after reference checks. Do not move files directly into `client/dist/`; it is generated and can be cleared by a build. Standardize new backups in one documented private location, but preserve and validate legacy backup copies before any consolidation.

No other file was classified as definitely safe to remove. A full dead-code/dependency cleanup would require a reference graph, runtime checks, and a deployment-aware asset check.

## 5. Performance assessment

### What is working in the design

- Individual portfolio/system applications are lazy-loaded through `AppRegistry.tsx`.
- Vite emits separated app/vendor chunks rather than one monolithic JavaScript file.
- Database models define indexes for several common lookups, including users, tasks, projects, contacts, captures, analytics, files, and content revisions.
- Repeated external GitHub/proxy data has process-local TTL caches.
- Some API lists use limits/pagination, and session activity writes are debounced.

### Static build-size evidence

The latest successful Vite build recorded during the recent work reported approximate raw and gzip sizes:

| Chunk/asset | Raw | Gzip |
|---|---:|---:|
| Main `index.js` | 455 KB | 112 KB |
| Shared Lucide icon chunk | 854 KB | 158 KB |
| React core chunk | 224 KB | 69 KB |
| Motion chunk | 129 KB | 42 KB |
| Main CSS | 319 KB | 40 KB |
| Charts chunk | 368 KB | Not separately measured here |
| PDF worker | 1,376 KB | Not separately measured here |

The current `client/dist/` is 16.06 MiB across 57 files; `dist/assets/` accounts for about 4.88 MiB, while copied wallpapers, videos, and audio account for a large part of the remainder. These figures are **bundle/file-size indicators only**, not a measured page-load time. Some app chunks (such as the admin panel, PDF viewer and charts) are intended to be fetched only when needed. A browser network waterfall is needed to confirm exactly which assets load for the first desktop view.

### Performance score: 6.5/10 (static estimate)

Main positives are app code splitting and compressed production assets. Main concerns are the shared icon/UI footprint, the large PDF worker, many always-active desktop interactions/state subscriptions, and large UI modules. This is an interactive desktop simulation, so it naturally has more state and rendering work than a static portfolio page.

No Core Web Vitals, Lighthouse, CPU profile, memory profile, concurrent-user load test, or slow-device test was run for this report. Do not interpret the score as an observed response-time SLA.

## 6. Time and space complexity

There is no single project-wide Big-O value: a desktop render, a database query, an upload, and a backup have different inputs and cost models.

| Operation pattern | Approximate time | Additional space | Notes |
|---|---:|---:|---|
| Mapping/filtering a list of `n` in-memory items | O(n) | O(n) if a new list is created; O(1) extra for a streaming scan | Common in React list rendering and OS-state updates |
| Sorting a list of `n` items | O(n log n) | Usually O(n) or implementation-dependent | Used for ordered projects/history/catalogues |
| Keyed diff of two arrays of `n`/`m` items | O(n + m) average | O(n + m) | Builds maps/sets to identify changed, added and removed items |
| Stable comparison of a nested content object with `k` fields | O(k log k) in the worst case due to sorting object keys (plus value traversal) | O(k) for normalized copies/serialization | Exact cost depends on nested array/object size and serialized content |
| Database lookup with a matching index | Typically O(log N) index work plus returned records | Database-managed | Real cost depends on MongoDB indexes, selectivity, disk/cache, and document size |
| Unindexed full collection scan | O(N) | O(r) if results are materialized, where `r` is returned count | Some routes materialize results; inspect query plans before scaling |
| In-memory rate limiter cleanup | O(k) every cleanup interval | O(k) map entries | `k` is active IP/path buckets; process restart clears state |
| Backup including `b` bytes of media | O(b) I/O and encoding; base64 adds work | O(b) buffers/encoded JSON, potentially with multiple copies | Large backups can raise memory pressure; configured byte caps help |

The desktop icon arrays are small and do not represent the likely bottleneck. At scale, project/admin list query plans, large media operations, backup serialization, and browser asset loading are more important than the complexity of a single icon-list iteration.

## 7. Security assessment

### Existing controls observed

- Production startup requires configured MongoDB and validates administrator/security configuration.
- Password reset/bootstrap and admin setup are server-side workflows.
- Server-side sessions use random opaque session identifiers; the stored identifier is hashed.
- Admin access is checked on protected API routes. State-changing authenticated requests require a CSRF token, compared with a timing-safe comparison.
- The server supports production secure session-cookie naming and the README documents HttpOnly cookies.
- File handling includes name/path normalization and safe disk-path resolution; upload routes have size limits.
- Logs have recursive masking for keys/values resembling passwords, tokens and credentials.
- The root `.gitignore` excludes `.env*` and `server/storage/`; the server `.env` was not opened during this review.

### Risks and limitations observed

1. **CSP is disabled in Helmet configuration.** The source comments cite Vite inline HMR/media data URLs. This removes an important browser-side mitigation against script injection. Production and development CSP requirements should be separated rather than disabling it for both.
2. **Production CORS includes a broad `.run.app` suffix allowance.** This trusts every matching Cloud Run origin, not only a named deployment origin. Prefer an explicit allowlist where possible.
3. **Rate limiting is process-local.** `security.ts` uses a `Map`; it resets on process restart and is not shared between replicas. It is useful for one process but not a reliable distributed brute-force/abuse control.
4. **TypeScript strictness is disabled.** Both client and server configurations permit weaker type guarantees, increasing the chance that malformed/null data reaches runtime paths.
5. **Potential source/data exposure through artifacts.** The server source map is not excluded by the current bundle ignore pattern, and the root full-backup JSON is not covered by the root `.gitignore`. The workspace has no Git metadata, so whether either file is tracked or deployed cannot be established here.
6. **Privacy/analytics needs a clear operational policy.** Analytics events retain IP address and user-agent fields in their schema; dashboard queries filter to a 90-day window and the model defines TTL expiry via `expiresAt`. Confirm every event writer sets expiry, document visitor disclosure/access, and verify MongoDB TTL deletion is enabled in production.
7. **Large request bodies need deployment limits.** General JSON parsing permits bodies up to 20 MB, and backup restore permits up to 70 MB. These limits may be needed for media/backup operations, but they can increase per-request memory pressure; pair them with route-specific limits, rate controls, and hosting concurrency/resource limits.
8. **External-content proxy is a sensitive boundary.** It fetches remote URLs and transforms returned HTML. It has private-address guards and a timeout, but SSRF/XSS defenses for DNS resolution/redirects, address changes, and iframe sandbox/message origin should receive dedicated security tests before relying on it for arbitrary URLs.
9. **No dependency vulnerability scan or penetration test was run.** Package versions and lockfiles alone do not establish that the deployed dependency tree is currently vulnerability-free.

### Security score: 6/10 (moderate, not a certification)

Authentication, session handling, CSRF, protected admin routes, and storage path checks are meaningful strengths. The disabled CSP, broad CORS suffix, and in-process limiter are material defense-in-depth gaps. A production deployment review should additionally inspect actual cookie attributes, reverse-proxy configuration, MongoDB privileges/network rules, secrets management, backups, and deployed source-map/static-file exposure.

## 8. Current gaps and recommended improvements

### Priority 1 — protect production data and boundaries

- Keep `server/storage/` and the root full backup out of public deployments and source-control history; maintain a separate encrypted, access-controlled backup policy with restore drills.
- Add an explicit source-map/artifact policy for server deployments and ensure generated `.map` files are not published unintentionally.
- Replace the broad `.run.app` CORS suffix with specific trusted origins.
- Enable a production-appropriate CSP; retain any Vite-only exceptions in development configuration only.
- Move rate limiting to a shared store or edge/proxy layer for multi-instance deployments; ensure proxy IP trust matches the actual hosting topology.
- Review remote browser proxy redirect/DNS/private-address protections and add adversarial tests.

### Priority 2 — quality and performance evidence

- Add a repeatable Lighthouse/Web Vitals and mobile/slow-network baseline; track LCP, INP, CLS, JS transfer, and memory while switching apps.
- Inspect the real first-load chunk graph. Consider loading only the icons/features needed by the desktop shell and defer heavier icon/PDF/chart code until an app is opened.
- Expand client tests beyond the current capture-storage and virtual-D: mapping coverage to desktop state, draft changes, media preview/upload/recovery, and responsive behavior; the client has only one dedicated npm test script.
- Add a dependency audit and automated CI for client/server type-check, build, backend tests, and security checks.

### Priority 3 — maintainability

- Gradually split large modules by cohesive feature/state boundaries, with tests first; avoid moving code solely to reduce line count.
- Turn on stricter TypeScript options incrementally, starting with new or high-risk modules.
- Review database query plans and pagination for admin/history/analytics/file lists as data grows.
- Maintain one source of truth for API routes; decide whether the unmounted `portfolioRouter` endpoint is a supported compatibility API or legacy test-only code.
- Clarify Netlify deployment topology. Current `netlify.toml` publishes a static client and does not configure an API-host rewrite; document/provide the required production API origin or proxy.
- Keep README and metadata descriptions current. `metadata.json` describes JWT authentication while project docs/source describe server-side opaque sessions.

## 9. Validation and confidence

- Client and server TypeScript type-checks: **passed** in the Phase 1 baseline run on 20 October 2026.
- Client production build: **passed** when output was directed to a unique temporary directory; 57 files, 16,842,138 bytes (16.06 MiB). Existing `client/dist/` was not overwritten.
- Server production bundle: **passed** when bundle and map were directed to unique temporary paths; bundle 433,755 bytes and map 795,535 bytes. Existing server build artifacts were not overwritten.
- Client tests: **13 passed, 0 failed** across capture storage and virtual D: mapping.
- Server tests: all 11 discovered `server/tests/*.test.ts` files were run sequentially in test mode: **19 Node test-runner cases passed, 0 failed**. In addition, `npm run test:all` reported 177 backend, 17 limitations and 43 E2E checks passed (237 reported checks total). The seven remaining named server test scripts also exited successfully. These commands overlap in coverage and should not be added together as unique cases.
- Backup checks: all 9 JSON files under `server/storage/` and the root full backup parsed as valid JSON; the root full backup matched its archive copy by SHA-256. The isolated limitations suite exercised full backup creation and API restore using test data. **No existing user backup was restored**, because that would modify real data.
- No Lighthouse/Web Vitals, browser network waterfall, load test, dependency audit, or penetration test was run. Performance/security scores remain static estimates.

## 10. Final answer to “which files are extra?”

- **Clearly generated/re-creatable:** `client/dist/`, both `node_modules/` directories, and `server/server.bundle.cjs` (plus its source map).
- **Possible unused/legacy candidates requiring confirmation:** root `metadata.json` and the production-unmounted `server/routes/portfolio.ts`.
- **Do not classify as extra:** `server/storage/`, root full-backup JSON, `client/public/`, lockfiles, or seeded virtual-filesystem assets. Some may not be executable code, but they are runtime, recovery, deployment, or product data.

No cleanup was performed. This preserves the project exactly as requested.

## 11. Production excellence plan — Phase 1 baseline (20 October 2026)

This section records the baseline used before any production-excellence code changes. It is a point-in-time workspace audit; no production environment was contacted and no deployment or data mutation was performed.

### Workspace and data protection

- No `.git` directory is present in this workspace. Tracked/untracked state and a clean working-tree baseline therefore cannot be established.
- `server/.env` exists, but its contents were **not read**. The audit used only the checked-in environment example and source variable names. Do not copy local secret values into documentation or client variables.
- `server/testEnv.cjs` redirects test file and backup storage to a unique operating-system temp directory and removes that test directory at process exit. The test suites were run under this isolation.
- Current `server/storage/` inventory: 26 files, 66,934,154 bytes total. Ten JSON backup/migration files were checked (9 under server storage and 1 at project root); each parsed as JSON. The root full-backup and same-named archive backup have the same SHA-256. These checks establish readable JSON and byte identity only—not full schema compatibility or successful restoration of every historic archive.
- No backup, upload, index, public asset, or database record was moved, edited, or deleted.

### Restore verification and safe procedure

The currently tested restore path is the existing limitations integration suite:

```powershell
npm --prefix server run test:limitations
```

That suite creates a full backup from isolated test records, checks media/user/contact content, then posts that generated snapshot to the protected restore API and checks the restored records. `server/testEnv.cjs` sets a temporary storage root and test mode; it does not restore the user's archive.

Safe operational procedure before any real restore:

1. Preserve a separate copy of both the chosen backup JSON and the current database plus `server/storage/`; do not overwrite the only recovery copy.
2. Verify the copied JSON parses and record its SHA-256. Keep it private because full backups can contain users, contacts, and embedded media.
3. Restore the copy in an isolated staging database and isolated storage root first; verify the expected users, published/draft content, projects, media IDs, files, and application behavior.
4. Only after explicit authorization, use the authenticated Admin **Backup & Restore** workflow (or its protected API) against the intended target. A real archive restore was not authorized or attempted in this baseline.
5. Verify the restored app and retain the pre-restore database/filesystem backup until recovery has been confirmed.

### Build, tests, assets, and deployment baseline

| Check | Baseline evidence |
|---|---|
| Client type-check | Passed |
| Server type-check | Passed |
| Client production build | Passed in temp output; 57 files, 16,842,138 bytes (16.06 MiB) |
| Server production bundle | Passed in temp output; 433,755-byte bundle and 795,535-byte source map |
| Client tests | 13 passed, 0 failed |
| Server test-runner pass | All 11 test files loaded sequentially; 19 Node test-runner cases passed, 0 failed |
| `server test:all` suite counters | backend 177, limitations 17, E2E 43; 237 reported checks passed, 0 failed |
| Additional named server scripts | email, skills, skill-icons, profile-visibility, admin-session-lifecycle, capture-persistence, visibility-publish all exited successfully |
| Backup JSON | 10 files parsed; root/archive same-name copies are byte-identical |
| Public source assets | 28 files, 11,722,635 bytes (11.18 MiB), copied into production output |
| Lighthouse/Web Vitals | **Not measured**; no shared browser was available, and no local app/API was started against the secret-bearing environment |
| Production API connectivity | **Not verified**; `netlify.toml` defines static build/publish and SPA fallback, but no API origin/proxy is declared there |

The client build preserves the current app-level lazy-loading architecture. The current generated output contains a 454,841-byte entry JS file (110.81 KB gzip), 853,577-byte Lucide chunk (158.18 KB gzip), 368,024-byte chart chunk (107.79 KB gzip), 1,375,838-byte PDF worker, and 318,949-byte CSS (40.09 KB gzip). These are build-size measurements, not first-load transfer, render time, or Core Web Vitals.

### Configuration and route inventory

`server/.env.example` covers environment, port/time zone, MongoDB, administrator bootstrap, Gemini, SMTP, trust-proxy and optional local capture/archive roots. Static source additionally references `CLIENT_URL`, `PORTFOLIO_STORAGE_DIR`, `PORTFOLIO_BACKUP_DIR`, SMTP compatibility aliases, and Vite/dev toggles. Compare the template against the complete production environment before changing deployment configuration. `client/.env.example` only states that client variables must be public-safe `VITE_*` values; it defines none.

The production Express entrypoint mounts route groups for `/api/health`, `/api/auth`, `/api/tasks`, `/api/analytics`, `/api/docs`, `/api/contact`, `/api/browse`, `/api/files`, `/api/profile`, `/api/storage`, `/api/captures`, `/api/admin/content-studio`, and `/api/admin`, plus direct portfolio-content, projects, and media endpoints. `/api/admin/backup/restore` receives admin and CSRF middleware before its larger JSON parser. `portfolio.ts` is present but is not mounted by the main server entrypoint; tests mount it directly.

### Unverified baseline measurements

- No Lighthouse or repeatable browser benchmark was run, so baseline LCP, INP, CLS, first-load requests, app-switch latency, and browser memory are **unverified**.
- No live SMTP delivery, deployed API connection, dependency vulnerability report, production MongoDB TTL observation, or security penetration test was performed.
- Existing numeric performance/security assessments remain heuristics and are not certifications or evidence that all production controls are effective.

## 12. Production excellence plan — Phase 2 security remediation (20 October 2026)

Phase 2 changes were made in local source/configuration and isolated test storage. No deployment was performed, and no backup or persistent user upload was intentionally changed. During a later, aborted Phase 3 browser-profile attempt, the Vite preview inherited its `/api` proxy and emitted a possible analytics POST to a service already listening on port 3000. The service's environment and data impact could not be confirmed. The user directed that data be left untouched; no query or cleanup request was made, and all local test servers were stopped. Section 1 ratings and findings describe the pre-remediation baseline; this section records implementation evidence, not a security certification.

### Implemented

- Replaced the production `.run.app` suffix trust with exact origins from `APP_URL` and `CORS_ALLOWED_ORIGINS`; development retains its local flexible policy. CORS rejection does not replace route authentication or CSRF checks.
- Enabled production Helmet CSP with same-origin scripts, explicit weather API `connect-src` entries, and separate development directives for Vite. The embedded browser proxy uses an isolated sandbox CSP.
- Made `TRUST_PROXY_HOPS` parsing strict (only integer values 0–5 are accepted) and applied the configured hop count to Express IP resolution.
- Replaced per-process sensitive-endpoint rate counters with atomic MongoDB-backed fixed-window counters and TTL expiry. Storage errors are logged and fail closed with HTTP 503. Request analytics use the trusted Express IP and have a 90-day `expiresAt` TTL; query values with URL/credential keys are redacted.
- Hardened the external-content proxy: only credential-free HTTP(S) on standard ports, public DNS answers pinned for the request, every redirect revalidated, bounded redirects/time/response size, and bounded target URL input. Proxy errors escape HTML and only construct an external link for HTTP(S) URLs. Client iframe messages require the current opaque sandbox frame and validate protocol and size.
- Ensured the portable backup export omits user and contact collections even for a full asset export. Private on-disk full backups remain available for recovery and can contain password hashes/contact records.
- Removed source-map generation from the server build script and ignored the server bundle’s map path. Added an ignore rule for root-level `full-backup-*.json` recovery files. Existing local map and backup files were not deleted; without Git metadata, whether any file is already tracked cannot be verified.
- Documented production CORS/CSP/proxy-hop, rate-limit, analytics-retention, upload and backup handling in `server/docs/SECURITY.md`.

### Changed files

`server/config/httpSecurity.ts`, `server/server.ts`, `server/services/contentProxy.ts`, `server/routes/browse.ts`, `server/services/rateLimitService.ts`, `server/models/RateLimitBucket.ts`, `server/models/index.ts`, `server/middleware/security.ts`, `server/middleware/rateLimiter.ts`, `server/routes/admin.ts`, `server/package.json`, `server/.env.example`, `server/docs/SECURITY.md`, `server/tests/httpSecurity.test.ts`, `server/tests/sharedRateLimiter.test.ts`, `server/tests/analyticsRetention.test.ts`, `server/tests/authCookieSecurity.test.ts`, `server/tests/backupExportSecurity.test.ts`, `server/tests/comprehensive_limitations.test.ts`, `client/src/components/apps/browser/WebContentView.tsx`, `.gitignore`, and `README.md`.

### Validation evidence

| Check | Result |
|---|---|
| Focused Phase 2 Node tests | **15 passed, 0 failed** across CSP/CORS/proxy, shared rate-limit, analytics retention/redaction, cookie/CSRF and portable backup-export tests |
| Server `test:all` | **177 backend, 18 limitations, and 43 E2E checks passed; 0 failed**. Counters are suite-specific and overlap; do not sum as unique test cases |
| Client capture-storage test | **1 passed, 0 failed** |
| Admin session lifecycle | **7 named checks passed**, covering revoke, expiry, retry, visitor isolation and authorization |
| Server and client type-check | **Passed** |
| Isolated production client build | **57 files, 16,842,473 bytes**; output was written to and removed from a unique temp directory |
| Isolated server bundle | **441,810 bytes**; build generated no source map |
| Production dependency audits | `npm audit --omit=dev` for client and server: **0 vulnerabilities reported** |
| Backup/restore integration | Generated isolated full backup restored through the protected API; full portable export verified to omit users/contact records while retaining media |

### Remaining risks and unverified behavior

- Neither CSP nor CORS has been exercised against the deployed frontend/API. Production must set the actual HTTPS `APP_URL`, exact frontend origins in `CORS_ALLOWED_ORIGINS`, and the correct reverse-proxy hop count. Netlify still does not define an API rewrite/origin in `netlify.toml`.
- The planned Phase 3 browser baseline is **not valid or retained**: a local Vite preview inherited the dev API proxy and reached a service on port 3000. Browser profiling was stopped at the user's direction. A request may have recorded one analytics event; that possible event was intentionally left untouched, and no further request was made to inspect it.
- The rate-limit and analytics TTL/index paths passed isolated MongoDB tests, but no production cluster configuration or asynchronous TTL cleanup was observed. Rate-limit availability now depends on MongoDB and deliberately returns 503 when the shared store fails.
- Proxy tests inject DNS and HTTP behavior; no live external target was fetched. The proxy intentionally renders untrusted pages in a sandbox, and its network behavior still needs browser-level validation.
- Upload and restore validation use existing route/storage protections and isolated test fixtures. Historic user backups were not restored; no real user backup, existing media, production database, or deployment was modified.
- Dependency audit results are point-in-time package advisory checks, not a code audit or guarantee against undisclosed vulnerabilities.
- The existing limitations test suite invokes SMTP verification and test-send paths using reserved `.test.local` recipients; it reported `smtp` mode. No real inbox receipt was verified, so this is not evidence of successful delivery to a user.
- Lighthouse/Core Web Vitals, real network waterfalls, production API connectivity, database query plans, production TTL behavior, penetration testing, and a deployed mobile/browser regression run remain **unverified**.

Phase 2 was implemented and locally validated at the time of this report entry. The continuation below records subsequent Phase 3–6 work and supersedes its earlier statement that Phase 3 had not started.

## 13. Production excellence plan — continuation, Phases 3–6 (20 October 2026)

This continuation was performed against isolated local builds and test databases. No production deployment, production API, production MongoDB, real mailbox, historical backup restore, or persistent user storage was accessed or changed. The possible analytics request from the earlier profiling attempt remains deliberately untouched; its persistence and impact remain unknown.

### 13.1 Status of the six phases

| Phase | Status | Evidence and remaining scope |
|---|---|---|
| 1. Baseline and data protection | **Complete locally; production items unverified** | Existing baseline inventory and isolated restore test remain in Sections 11–12. Current builds/tests use unique temporary outputs and the isolated test database/storage. No historic user backup was restored. |
| 2. Security remediation | **Implemented and locally validated; deployment verification pending** | Security changes and focused tests are recorded in Section 12. Production origins, CSP behavior, proxy topology, live database indexes, and penetration resistance were not tested against deployment. |
| 3. Performance profiling | **Safe local profiling completed; optimization not justified** | Vite preview proxy isolation was corrected and verified against a disposable mock API. Isolated headless-browser smoke measurements are below. No Lighthouse/Core Web Vitals or representative production network measurements were obtained, so no performance optimization or score improvement is claimed. |
| 4. Maintainability | **Partially complete; broad refactoring deferred** | Authentication metadata and API inventory documentation now match the implementation. Large modules and strict-mode diagnostics were assessed; no extraction was made without focused regression coverage. TypeScript strictness and targeted decomposition remain incomplete. |
| 5. End-to-end validation | **Automated local coverage passed; production/manual checks incomplete** | `server/test:all`, the client capture-storage test, type-checks, builds, dependency audits, Vite preview isolation, and the isolated Puppeteer walkthrough passed. The feature matrix below distinguishes these from manual/deployed checks. |
| 6. Evidence-based report | **Complete for available evidence** | This section records current changes, exact commands/results, local measurements, test coverage, deployment/data-safety state, limitations, and ratings. Unavailable production evidence is explicitly marked. |

### 13.2 Current continuation changes

| File | Change |
|---|---|
| `client/vite.config.ts` | Added `preview.proxy: {}` so Vite preview cannot inherit the development `/api` proxy and forward API requests to an unknown local service. |
| `server/tests/e2e_walkthrough.test.ts` | Added `PORTFOLIO_E2E_DIST_DIR` support so E2E can serve a temporary build without overwriting `client/dist`; blocks browser requests to off-origin HTTP(S) endpoints and checks analytics requests stay same-origin; records local load/resource, media app-open, heap, drag, and resize smoke metrics. The window interaction test uses Calculator because non-calculator apps open maximized by design; Camera remains used for its settings-overlay bounds assertion. |
| `metadata.json` | Corrected the project description to state server-side administrator sessions rather than JWT authentication. |
| `server/docs/API_INVENTORY.md` | Clarified that `server/routes/portfolio.ts` is a legacy unmounted router and `/api/projects` is the active public endpoint; the legacy route remains in place pending integration compatibility checks. |
| `PROJECT_ANALYSIS_REPORT.md` | Added this Phase 3–6 evidence and status section. |

`server/docs/SECURITY.md` was reviewed and already documents the relevant CSP/CORS, trusted-proxy, shared rate-limit, analytics retention, upload, and backup controls; it did not require a change in this continuation. The workspace exposes no `.git` directory, so Git status, tracked-file state, and a verifiable Git diff remain unavailable.

### 13.3 Safe performance evidence

#### Proxy isolation

The earlier preview risk came from Vite preview's default behavior of inheriting `server.proxy` when `preview.proxy` is unset. The config now explicitly sets an empty preview proxy. A local preview test used an ephemeral preview port and an ephemeral disposable mock API port, with `API_PROXY_TARGET` set only to that mock:

| Check | Result |
|---|---|
| `GET /api/health` to isolated Vite preview | HTTP 200, served the local SPA fallback |
| Requests received by disposable mock upstream | **0** |
| Browser/API request sent to an unknown or production service | **No** |

This proves API routes are not proxied by preview; the SPA fallback is not an API response, so preview is intentionally not a substitute for an API-backed E2E server. The browser walkthrough used its own isolated Express test app and MongoMemoryServer, intercepted off-origin requests, and asserted analytics requests remained same-origin. No request was sent to port 3000 in this continuation.

#### Build sizes and browser smoke measurements

| Measurement | Current observation | Interpretation |
|---|---:|---|
| Client production output | **57 files; 16,842,473 bytes** | Built into a unique temporary directory; existing `client/dist/` was not overwritten. |
| Server bundle | **441,810 bytes** | Built into a unique temporary file; no source map was emitted. |
| Client entry JavaScript | **454,841 bytes** (110.81 KB gzip) | Generated build size, not initial transfer in every browser. |
| Lucide icon chunk | **853,577 bytes** (158.18 KB gzip) | Large shared chunk. Removing its manual split was tested and reverted because the entry grew to about 1.31 MB and the initial static JS closure did not shrink. |
| Chart chunk | **368,024 bytes** (107.79 KB gzip) | Current separate chunk. |
| PDF worker | **1,375,838 bytes** | Separate PDF worker asset; it was not pulled into the browser's initial measured resource set. |
| CSS | **318,949 bytes** (40.09 KB gzip) | Generated production stylesheet. |
| Isolated initial-load smoke | `DOMContentLoaded` 171.1 ms; `load` 172 ms; FCP 380 ms; same-origin resources 12; transfer bytes 1,998,005; heap 8,375,485 bytes | Final headless Edge run against the isolated test app/build. This is a diagnostic snapshot, not a repeatable benchmark. |
| LCP / CLS / INP | LCP unavailable; observed CLS 0; no Event Timing entries, so INP unavailable | Not a Lighthouse run; do not treat the zero CLS snapshot as a field/Core Web Vitals result. |
| Media open-to-content | **403 ms** | One automated app-open-to-visible-content interval in the final isolated browser run. |
| Window drag / resize | **735 ms / 261 ms** wall-clock; geometry changed as expected | Includes Puppeteer action time and an explicit 150 ms settling delay per interaction; not frame latency or INP. |

The initial report's earlier build snapshot was 16,842,138 client bytes and a 433,755-byte server bundle. Compared with those historical sizes, the current output is +335 client bytes and +8,055 server bytes; these are not controlled before/after performance results because security and test/configuration changes occurred between builds. The prior server output included a 795,535-byte source map; the current build does not. No optimization was retained based solely on chunk size. Lighthouse, consistent repeated runs, LCP/INP/CLS field measurements, app-switch profiling beyond the single smoke interval, long-session memory growth, and real network waterfalls remain unavailable.

### 13.4 Maintainability assessment

- `metadata.json` and `server/docs/API_INVENTORY.md` were reconciled with the actual session authentication and mounted project routes.
- The large UI/API modules remain coupled, broad files; no evidence justified a behavior-changing extraction during this continuation without narrower component-level regression tests.
- The current `client/tsconfig.json` and `server/tsconfig.json` both enable `strict: true`; the current client and server type-check commands pass with **zero compiler diagnostics**. This supersedes the earlier diagnostic count and configuration note recorded before strict mode was enabled.
- `server/routes/portfolio.ts` is retained because tests use it and external compatibility has not been checked. It is not a mounted production API.
- The `vendor-lucide` split experiment increased the entry chunk without reducing the initial static JS closure, so it was reverted. PDF, charts, and admin modules retain the current lazy/chunk structure; no source rewrite was made for line-count reduction.

Maintainability is therefore **partially addressed**, not complete. Suggested next work is focused client testing around desktop/window state and project/media workflows, followed by small extractions with behavior tests; this report does not claim that work was completed.

### 13.5 Exact validation commands and results

| Command/check | Result |
|---|---|
| `npm --prefix server run test:all` | **177 backend checks, 18 comprehensive limitations checks, and 48 E2E checks passed; 0 failed in each suite.** These are suite-specific assertion counters, not necessarily unique test cases. |
| `npm --prefix client run test:capture-storage` | **1 passed, 0 failed.** Local capture survives service recreation and archive-status updates. |
| `npm --prefix client run typecheck` | **Passed.** |
| `npm --prefix server run typecheck` | **Passed.** |
| `npm --prefix client run build -- --outDir <unique-temp-directory>` | **Passed; 57 files, 16,842,473 bytes.** Temp output removed after measurement. |
| `esbuild server/server.ts --bundle --platform=node --format=cjs --packages=external --outfile=<unique-temp-file>` | **Passed; 441,810 bytes; no source map.** Temp output removed after measurement. |
| `npm --prefix client audit --omit=dev` | **0 production dependency vulnerabilities reported.** |
| `npm --prefix server audit --omit=dev` | **0 production dependency vulnerabilities reported.** |
| Vite preview + disposable mock API isolation check | **Passed; preview served local SPA fallback and mock upstream saw 0 requests.** |

SMTP test paths use reserved `.test.local` recipients and do not prove delivery to an actual mailbox. No real email was sent.

### 13.6 End-to-end feature verification matrix

| Feature | Test/environment and evidence | Status | Remaining issue |
|---|---|---|---|
| Admin login, expiry, unauthorized access, logout/retry, multi-tab behavior | `server/test:all`: backend auth/session assertions plus isolated Puppeteer E2E; 48 E2E assertions passed, including cross-tab logout and retry after a simulated logout failure. | **Pass — automated local** | No deployed identity/session test or manual browser verification. |
| Draft privacy, preview, publish, and revisions | Backend integration suite exercises private drafts, public visibility, publish, discard, and revision restore. | **Pass — automated local** | No deployed database verification. |
| Project create/edit/delete and persistence | Backend project route/model coverage in the isolated test database; published-project virtual files were checked in E2E. | **Pass — automated local** | No production persistence verification. |
| Media upload, preview, retrieval, and recovery | Backend upload/storage/security and backup integration checks; E2E loaded a wallpaper preview from the built client. | **Pass — automated local** | No real user archive or deployed media recovery was exercised. |
| Virtual filesystem and File Explorer | Isolated Puppeteer E2E covered D: folders, Quick Access, selection, clipboard, create/rename/cut/delete, C: denial, and properties. | **Pass — automated local** | No manual device/browser matrix. |
| Camera local persistence, explicit consent, private archive separation | `capture-storage` client test and server capture-persistence tests passed; E2E verified settings bounds, not camera hardware capture. | **Pass — service/API tests** | Browser permission flow, real camera hardware, and deployed archive lifecycle remain unverified. |
| Backup integrity and restore | Backup JSON parse/identity inventory from Phase 1; limitations suite creates and restores a generated backup in isolated MongoDB/storage. | **Pass — generated test backup only** | Historic/user backup restore was not attempted; retain copies and stage before any authorized real restore. |
| Contact validation and email delivery | Backend validation and mock/test SMTP paths ran in `test:all`. | **Partial — automated local** | `.test.local` test recipients do not prove real SMTP delivery; no email sent to a real mailbox. |
| Frontend-to-API connectivity | E2E served the built client and test API from an isolated local Express app; network interception aborted off-origin HTTP(S). | **Pass — isolated local only** | Production API origin/proxy, CORS, and connectivity are unverified; Netlify does not currently declare an API rewrite. |
| Production configuration and deployment | Static configuration and security docs inspected; production audits passed. | **Not tested in deployment** | Set exact HTTPS `APP_URL`/CORS origins, trusted proxy hop count, MongoDB, SMTP, and frontend API routing in hosting configuration. |
| Responsive layout, keyboard, and error states | Isolated Puppeteer E2E tested mobile/tablet/desktop viewports, keyboard File Explorer shortcuts, denied-drive behavior, and simulated logout failure/retry. | **Pass — automated local** | No manual assistive-technology or physical-device verification. |
| App/project analytics persistence and dashboard | Backend integration assertions exercised idempotent app/project event ingestion, minimal metadata, counts, timestamps, pagination, and 90-day retention. | **Pass — automated local** | Browser E2E only verified requests stayed same-origin; its isolated app does not mount analytics, and deployed ingestion/dashboard behavior is unverified. |

### 13.7 Data safety, deployment, and remaining limitations

- No production deployment or live production API call was made. Existing `server/storage/`, backups, media indexes, database records, and public assets were not changed. Build outputs and server bundles used unique temporary destinations and were removed after measuring.
- The isolated browser used a MongoMemoryServer and test storage, blocked external HTTP(S) requests, and did not use a production API. Preview isolation was verified by observing zero requests at a disposable mock API.
- The possible analytics event from the earlier port-3000 preview incident remains **untouched by explicit user direction**. Its persistence and consequences remain unknown; this continuation did not query that service or the event.
- The existing local `client/dist/` was read by the E2E server but not overwritten. The repository has no accessible Git metadata, so tracked/untracked state and patch completeness cannot be independently confirmed with Git.
- Production API routing, real mailbox delivery, historic backup restore, production database index/TTL operation, deployed CSP/CORS behavior, live external proxy behavior, Lighthouse/Web Vitals, a production security assessment, and manual accessibility/device testing remain unverified.
- No migration, cleanup, deployment, or irreversible data action was performed. For real restore or deployment, use an independently preserved backup and isolated staging verification first.

### 13.8 Evidence-based ratings after this continuation

| Area | Rating | Basis |
|---|---:|---|
| Implementation | **8/10 — broad and locally tested** | Core apps, admin workflows, persistence, backup, VFS, and security changes have substantial automated coverage; production integration and manual verification remain open. |
| Performance | **6/10 — measurable build, limited runtime evidence** | Lazy chunks and isolated smoke timings are available, but icon/PDF assets are sizable, no controlled repeat benchmark or Lighthouse/Core Web Vitals was obtained, and no optimization was justified. |
| Security | **7/10 — improved local controls, deployment unverified** | CSP/CORS, shared rate limits, sessions, proxy validation, analytics retention, and backup protections have local tests; production configuration, penetration testing, and live topology are not verified. |
| Maintainability | **6/10 — useful structure, large-module risk remains** | Route/auth documentation is corrected and normal type-checks pass, but large modules remain, strict diagnostics remain, and targeted decomposition is incomplete. |

These are engineering judgments, not certifications or measured service-level scores. No 10/10 claim is made.

## 14. Final gap closure and release readiness (20 October 2026)

This section is the latest evidence snapshot and supersedes earlier incomplete Phase 3/4 statements and the one-run browser smoke measurements above where they conflict. Work remained local and non-destructive: no production deployment, live API/database access, historical backup restore, real email, or storage migration was performed. The contents of `server/.env` were not read.

### 14.1 Phase status

| Phase | Latest status | Evidence / outstanding work |
|---|---|---|
| 1. Baseline and data protection | **Complete for local inspection; production recovery unverified** | Current media index and backup inventory checked read-only; isolated generated-backup restore remains the only restore evidence. |
| 2. Security remediation | **Locally implemented and tested; deployment verification outstanding** | Existing CSP/CORS, shared rate limits, session, proxy, upload, and backup safeguards were preserved. No live production topology or penetration test was exercised. |
| 3. Performance | **Repeatable isolated mobile Lighthouse completed; production/field metrics outstanding** | Three Lighthouse runs against a temporary build, with localhost-only preview and a non-forwarding deny proxy for external destinations. Metrics and limitations are below. |
| 4. Maintainability | **Strict type diagnostics resolved; modular refactoring still incomplete** | Both compiler configs enable `strict`; both project type-checks pass. No large-file extraction was justified by a specific defect or an independently testable responsibility boundary during this pass. |
| 5. Critical workflows | **Automated local verification passed; manual and production verification outstanding** | Full backend/limitations/browser suites and capture-storage test passed using test isolation. Feature matrix distinguishes local evidence from blocked production work. |
| 6. Evidence-based report | **Updated** | Includes exact latest commands, repeated measurements, storage path findings, test evidence, ratings, and next actions. |

### 14.2 Isolated repeatable Lighthouse benchmark

**Environment and method:** Windows local workspace; Lighthouse **12.8.2**; Chrome **155**; Vite **6.4.3**; Lighthouse mobile emulation at 412 × 823, device scale factor 1.75, simulated throttling (150 ms RTT, 1,638.4 Kbps downlink, 4× CPU slowdown). The client was built into a unique temporary directory. Vite preview bound to loopback with `preview.proxy: {}`; its `/api/health` response was verified to be the local SPA fallback, not an API. `API_PROXY_TARGET` was pointed at a disposable loopback mock server. The Lighthouse browser used a loopback-only deny proxy that returned 403 to all off-origin HTTP and HTTPS CONNECT traffic and never forwarded requests.

An initial attempt using Chrome resolver flags was **discarded** after Lighthouse showed successful third-party Unsplash and Open-Meteo requests. Those measurements are invalid and are not used below. No request reached the unidentified port-3000 service; the final valid runs were repeated only after replacing the ineffective DNS approach with the deny-only proxy. In the final runs, 71 browser proxy requests across all runs were denied at the local proxy, every off-origin request in each Lighthouse report had status `-1` and zero transfer, and the disposable API mock received **0 requests**. Thus no third-party or unknown API service received the final benchmark's requests.

| Metric | Run 1 | Run 2 | Run 3 | Median |
|---|---:|---:|---:|---:|
| Lighthouse performance | 68 | 71 | 67 | **68 / 100** |
| Lighthouse accessibility | 92 | 92 | 92 | **92 / 100** |
| LCP (lab) | 3,911 ms | 3,914 ms | 3,914 ms | **3,914 ms** |
| CLS (lab) | 0.0447 | 0.0482 | 0.0482 | **0.0482** |
| FCP | 3,161 ms | 3,164 ms | 3,164 ms | **3,164 ms** |
| Total Blocking Time | 526 ms | 424 ms | 583 ms | **526 ms** |
| Transfer weight | 429,605 B | 429,605 B | 429,605 B | **429,605 B** |
| Request count | 17 | 17 | 17 | **17** |
| INP | unavailable | unavailable | unavailable | **Unavailable** |

These are repeatable **lab** results for a partially isolated static client, not field Web Vitals or a production measurement. INP is interaction-based and Lighthouse's navigation-only audit did not collect it. The API was deliberately not mounted; client API URLs returned the preview SPA fallback, so backend-dependent page content, analytics, authentication, and database behavior are not represented by this Lighthouse score. Lighthouse's accessibility score is an automated audit, not a manual assistive-technology review.

The temporary client build contained **57 files / 16,842,446 bytes**. A separate server esbuild bundle was **442,274 bytes** with no source map. These are actual output sizes, not a controlled before/after optimization comparison. Earlier single-run measurements used a different isolation state and are not a valid baseline. No optimization was applied because this pass did not establish a safe, representative before/after case.

### 14.3 TypeScript and maintainability

- `client/tsconfig.json` and `server/tsconfig.json` both currently specify `strict: true`.
- `npm --prefix client run typecheck` and `npm --prefix server run typecheck` both passed; each produced zero TypeScript compiler diagnostics.
- No module extraction was made. Large modules remain a maintenance risk, but no specific low-risk responsibility boundary with a focused behavior test was identified that justified refactoring in this validation pass. This is **not** a claim that large-file maintainability work is complete.
- Existing lazy-loaded apps, PDF/chart chunks, and API contracts were preserved. No compatibility or database schema change was introduced.

### 14.4 Storage, references, privacy, and migration status

Read-only inventory of the current on-disk state found:

| Check | Evidence |
|---|---|
| Portfolio media index | Version 1; **12 entries**, all relative paths safe and contained by the configured storage root; **0 missing/outside-root paths**. |
| Media file hashes | SHA-256 computed for all 12 indexed files; **10 distinct hashes**. Repeated content is a possible duplicate signal only; no file was removed or changed. |
| Backups | Canonical `server/storage/AdminArchive/Backups/` currently exists and contains **8 JSON files; all 8 parsed**. Parsing does not prove each historical backup can be restored. |
| Portfolio media directory | `server/storage/Portfolio/Media/` exists. No path migration or index rewrite was performed. |
| Historic restore | **Not performed.** The existing limitations suite restores a freshly generated test backup using isolated MongoDB and temporary storage; it does not prove compatibility of the user's historic backups. |

Source-path review found that portfolio uploads use `PORTFOLIO_STORAGE_DIR` or default to `server/storage`, media files are stored under `Portfolio/Media`, and the durable `.media-index.json` is under `Portfolio/`. `BackupService` uses `PORTFOLIO_BACKUP_DIR` or defaults to `server/storage/AdminArchive/Backups`. By contrast, camera archive files use `ADMIN_ARCHIVE_ROOT`; on Windows its code default is `C:\\WindowsPortfolio\\AdminArchive` (and visitor capture root defaults to `D:\\WindowsPortfolio\\UserCaptures`), while non-Windows defaults are under `uploads/`. These are distinct storage roots. Effective deployed override values are **unknown** because the local `.env` was intentionally not inspected.

Camera captures are first stored in browser IndexedDB with `local-only` status. The UI requires a checked consent control before uploading; the API rejects missing consent, checks type/size, stores the server archive privately, and records consent metadata. Deleting the local IndexedDB capture does not call the server archive delete flow. Archive listing, preview, download, and delete routes are admin-protected; capture download requires authentication and owner/admin authorization. These control paths have automated client/API tests, but a live browser camera permission flow and deployed filesystem permissions were not manually verified.

No migration is currently safe to execute: the code defaults span multiple roots, while actual environment overrides and all database references cannot be proven without reading configuration or connecting to the relevant live database. **No migration manifest was created and no files were moved.** Before any consolidation, decide and authorize a canonical capture root, then take a restorable database/storage backup, generate a manifest of source/destination paths and IDs, copy (not move), SHA-256 verify each file, validate database and media references in staging, test rollback, and retain source files until approval. No old files should be deleted as part of that process without explicit approval.

### 14.5 Critical workflow verification matrix

| Workflow | Evidence and environment | Status | Not verified |
|---|---|---|---|
| Admin login, session expiry, authorization, close/logout and multi-tab behavior | `npm --prefix server run test:all`; isolated backend integration and Puppeteer browser suite. Backend: 177 checks; E2E: 49 checks. | **Pass — automated local** | Deployed cookie/CSP/CORS behavior and manual browser use. |
| Draft privacy, preview, publishing and revisions | Isolated MongoDB integration assertions in backend suite. | **Pass — automated local** | Production database visibility/authorization. |
| Project create/edit/delete and persistence | Backend route/model integration tests and E2E published-project behavior. | **Pass — automated local** | Production data persistence. |
| Media upload, preview, retrieval and recovery | Backend storage/upload/backup tests; media index was inspected read-only. | **Pass — automated local** | User archive recovery and deployed media access. |
| Camera local persistence and consent-controlled archive | `npm --prefix client run test:capture-storage` (1 passed); server capture persistence/consent tests in `test:all`. | **Pass — automated client/API** | Physical camera permission and deployed private archive. |
| Backup integrity and restore | 8 existing JSON files parsed; isolated limitations suite creates/restores a generated backup. | **Pass for generated test backup; historical restore blocked** | Restore compatibility of any existing user backup. |
| Contact validation and email configuration | Backend validation and reserved `.test.local` mail test paths. | **Partial — automated local** | SMTP delivery to an authorized real mailbox; none was sent. |
| Virtual filesystem / File Explorer | Isolated Puppeteer walkthrough covers operations and access-denial paths. | **Pass — automated local** | Physical-device/manual browser checks. |
| Frontend-to-API connectivity | E2E suite uses its isolated Express test app; Lighthouse intentionally used static preview with API fallback. | **Pass — test API only** | Production API origin, routing, CORS, and database connectivity. |
| Keyboard, mobile and accessibility | Automated responsive/keyboard browser assertions; Lighthouse accessibility median 92/100. | **Partial — automated local** | Screen reader, manual WCAG review, and real mobile device checks. |
| Production config/deployment | Netlify config and env example inspected; Netlify only publishes static client and SPA fallback. | **Not deployed** | API rewrite/origin, exact CORS origins, HTTPS `APP_URL`, trusted proxy hops, MongoDB, secret provisioning, and SMTP configuration. |

### 14.6 Exact latest validation commands and outcomes

| Command / check | Result |
|---|---|
| `npm --prefix client run typecheck` | **Passed, 0 diagnostics; `strict: true`.** |
| `npm --prefix server run typecheck` | **Passed, 0 diagnostics; `strict: true`.** |
| `npm --prefix server run test:all` | **178 backend checks + 20 limitations/backup-restore checks + 51 E2E checks; 0 failed.** These are suite assertion counters and can overlap. |
| `npm --prefix client run test:capture-storage` | **1 passed, 0 failed.** |
| `npm --prefix server run test:capture-persistence` | **10 passed, 0 failed** against an isolated in-memory MongoDB and temporary storage roots. |
| `npm --prefix client audit --omit=dev` | **0 vulnerabilities reported.** |
| `npm --prefix server audit --omit=dev` | **0 vulnerabilities reported.** |
| `npm --prefix client run build -- --outDir <unique temporary directory>` | **Passed; 57 files, 16,842,351 bytes.** Temporary output was removed; existing `client/dist/` was not overwritten. |
| `npx --prefix server esbuild server\\server.ts --bundle --platform=node --format=cjs --packages=external --outfile=<unique temporary file>` | **Passed; 442,274 bytes; no source map.** |
| Lighthouse 12.8.2 × 3, Chrome 155, mobile simulated | **3 completed runs; metrics in Section 14.2.** External requests denied by local non-forwarding proxy; mock upstream count 0. |
| Read-only storage inventory | **12 media-index records; all indexed files resolve; 27 inventory entries reverified with matching byte sizes and SHA-256; 5 duplicate-content groups; 8/8 canonical backup JSON files parsed.** No file operations were performed and no names or file contents were copied to the report. |

### 14.7 Security, production readiness, and ratings

- Previously implemented security controls were preserved. Local audits and tests do not establish production CSP/CORS correctness, live MongoDB index/TTL behavior, external proxy safety under deployment, or penetration resistance.
- Netlify has no API origin/rewrite in `netlify.toml`. Before deployment, configure the production frontend-to-API route, exact HTTPS `APP_URL` and `CORS_ALLOWED_ORIGINS`, correct `TRUST_PROXY_HOPS`, MongoDB, and secrets in the host secret manager. Do not place server secrets in Vite variables. Production deployment was not attempted.
- The possible historical analytics event from the earlier port-3000 incident remains untouched and uninspected, per instruction. No request in this continuation was sent to port 3000.
- Real email delivery, historic backup restore, live production storage/database references, manual accessibility, deployed API connectivity, and deployment configuration remain **unverified**.

| Area | Latest evidence-based rating | Basis |
|---|---:|---|
| Implementation | **8/10** | Broad feature set with substantial isolated automated coverage; production integrations and manual checks remain open. |
| Performance | **6/10** | Repeatable mobile Lighthouse median is 68/100 (isolated static frontend); LCP is about 3.91 s and TBT about 526 ms. No representative production or before/after result. |
| Security | **7/10** | Significant local controls and test coverage; production topology, live configuration, deployment behavior, and penetration testing remain unverified. |
| Maintainability | **6/10** | Strict type-checks now pass with zero diagnostics; large modules remain and were not decomposed in this pass. |

Scores are engineering assessments, not certifications or production guarantees. No 10/10 claim is made.

## 15. Performance investigation, storage proposal, and staging blockers (20 October 2026)

This is the latest continuation. It supersedes the earlier single set of measurements where applicable. The local page shared on port 3000 was **not opened or contacted**. All runtime checks used a temporary client build, a loopback Vite preview with `preview.proxy: {}`, a disposable mock API target, and a loopback deny-only browser proxy. The deny proxy returned 403 and did not forward off-origin traffic. Its mock API observed zero requests. No deployment, real email, historical restore, or user-data migration occurred.

### 15.1 Verified performance bottlenecks and narrow optimization

The Lighthouse performance trace identified:

- **LCP element:** `h1.text-7xl` inside `#windows-lock-screen`, showing the lock-screen clock. Across the pre-change trace, its LCP breakdown attributed about **88% to render delay** and no image load delay. This is a text/UI render bottleneck, not an LCP image that should be preloaded.
- **Render-blocking resource:** `/assets/index.css`, 40,483 transferred bytes. Lighthouse reported roughly **905–1,064 ms** of blocking duration but **0 ms estimated savings**; this does not justify unsafe asynchronous CSS loading or a flash of unstyled layout.
- **Long tasks:** the largest reported tasks were on `vendor-react-core.js` (**312–514 ms** across observed traces), plus initial document work (**180–217 ms**). Main-thread time remained split among script evaluation, style/layout, and other startup work. App-level lazy loading was preserved; no evidence justified removing the current React or Lucide chunking.

The verified UI-specific, low-risk change removes the lock-screen clock's initial opacity/vertical-motion animation and the wrapper's initial fade. The unlock/exit motion remains, as do the lock-screen layout, clock, and interaction behavior. A regression assertion verifies the clock paints at full opacity and the Sign In action still unlocks the desktop. This avoids delaying the LCP text with a decorative entrance animation; it does **not** eliminate the larger React startup or stylesheet bottlenecks.

| Metric | Before — runs 1 / 2 / 3 | Before median | After — runs 1 / 2 / 3 | After median |
|---|---|---:|---|---:|
| Lighthouse performance | 70 / 71 / 71 | **71** | 71 / 74 / 77 | **74** |
| Lighthouse accessibility | 92 / 92 / 92 | **92** | 92 / 92 / 92 | **92** |
| LCP | 3,928 / 3,927 / 3,953 ms | **3,928 ms** | 3,844 / 3,927 / 3,808 ms | **3,844 ms** |
| LCP render delay | 3,464 / 3,464 / 3,498 ms | **3,464 ms** | 3,388 / 3,464 / 3,349 ms | **3,388 ms** |
| CLS | 0.04732 / 0.04820 / 0.04818 | **0.04818** | 0.02713 / 0.05035 / 0.04878 | **0.04878** |
| FCP | 3,178 / 3,177 / 3,203 ms | **3,178 ms** | 3,162 / 3,177 / 3,208 ms | **3,177 ms** |
| TBT | 453 / 425 / 415 ms | **425 ms** | 454 / 317 / 262 ms | **317 ms** |
| Transfer weight | 429,605 B each | **429,605 B** | 429,587 B each | **429,587 B** |
| Requests | 17 each | **17** | 17 each | **17** |

Runs used the same Lighthouse 12.8.2 / Chrome 155 / Vite 6.4.3 mobile emulation (412 × 823; 150 ms RTT; 1,638.4 Kbps configured download; 4× CPU slowdown) and the same deny-only network isolation. The post-change LCP median is **84 ms lower** and performance-score median **3 points higher**; there is run-to-run variability and overlapping ranges, so treat this as a modest lab result, not proof of a general or production gain. TBT also varied substantially. No further code optimization was justified by this evidence.

Event Timing was available in Chrome and separately observed during lock-screen unlock and Start-button interactions. Synthetic session INP candidates were **88, 80, and 80 ms** (median **80 ms**, three interaction groups in each run). This is a small automation sample, not a field INP percentile or a production Core Web Vital. It is reported separately from Lighthouse's navigation audit, which still does not provide INP. LCP, CLS, and accessibility are likewise lab results for a static preview, not field measurements.

An isolated client production build emitted 57 files totaling **16,842,351 bytes**. Relevant emitted chunks included `vendor-lucide.js` at 853.58 kB raw / 158.18 kB gzip, `vendor-react-core.js` at 223.65 / 69.41 kB, `PdfDocumentViewer.js` at 366.93 / 108.68 kB, `vendor-charts.js` at 368.02 / 107.79 kB, and `pdf.worker.min.mjs` at 1,375.84 kB raw. The Lighthouse initial navigation transferred about 430 kB across 17 requests, consistent with the PDF viewer/worker and charts not being pulled into that initial route. The Lucide chunk is sizable, but this trace did not isolate an icon-specific bottleneck; no shared-icon rewrite was made.

Changed performance/coverage files:

| File | Change |
|---|---|
| `client/src/components/desktop/LockScreen.tsx` | Removed decorative initial opacity/vertical motion from the LCP clock and initial lock-screen fade; kept the exit/unlock transition. |
| `server/tests/e2e_walkthrough.test.ts` | Added browser regression checks for immediate clock visibility and successful unlock. |
| `server/testEnv.cjs` | Redirected user-capture and admin-capture roots into a per-process temporary test directory; production defaults are unchanged. |
| `PROJECT_ANALYSIS_REPORT.md` | Recorded this evidence, storage proposal, test/isolation status, and remaining release blockers. |

### 15.2 Earlier storage direction and migration gate

**Earlier implementation target (superseded for the current migration manifest):**

1. Visitor captures remain in browser **IndexedDB** as the visitor's local copy; they do not create server files unless the visitor explicitly consents to archive that capture.
2. The earlier requested future-write location was **`server/storage/Portfolio/Captures/`**, separately from portfolio media and backups. The current user-designated target for a non-destructive migration manifest is **`server/storage/AdminArchive/Captures/`**. Keep `CaptureModel.adminArchivePath` as the durable file reference; keep capture metadata and consent timestamp in the database.
3. Portfolio-managed images/documents remain under **`server/storage/Portfolio/Media/`**, with `.media-index.json` as the durable media index.
4. Portfolio backups remain under **`server/storage/AdminArchive/Backups/`**.
5. The existing `/api/storage/capture` and `/api/storage/archive` APIs and their `USER_CAPTURE_ROOT` / `ADMIN_ARCHIVE_ROOT` overrides are legacy-compatible surfaces. Do not remove or repurpose these until their clients, existing paths, and records have been mapped and staged.

The current approval applies only to preparing and validating a non-destructive manifest; it does not authorize runtime path changes, copying, database updates, or deletion. The current code default for new consented uploads remains `server/storage/Portfolio/Captures/`. No existing archives, stored absolute paths, or database references have been moved or rewritten.

**Current implementation evidence:**

- Portfolio media uses `PORTFOLIO_STORAGE_DIR` (default `server/storage`); uploads are placed at `Portfolio/Media/` and metadata/index records use media IDs and relative disk paths.
- Backups use `PORTFOLIO_BACKUP_DIR` (default `server/storage/AdminArchive/Backups`).
- Consented camera archives use `CAPTURE_ARCHIVE_ROOT`, defaulting to `server/storage/Portfolio/Captures/` with `Photos/` and `Videos/` subfolders. `/api/storage/archive` and `/api/admin/archives` remain admin-gated legacy archive surfaces; capture downloads require authentication and owner/admin authorization. Capture records store the server path.
- The legacy authenticated `/api/storage/capture` writes to `USER_CAPTURE_ROOT` (Windows default `D:\\WindowsPortfolio\\UserCaptures`, otherwise `uploads/UserCaptures`) but is separate from the browser IndexedDB camera flow.
- Public portfolio media retrieval checks published profile/project references; unreferenced media is denied to visitors and can be fetched by an administrator. File Explorer downloads/previews enforce owner/admin rules for user files.
- `BackupService` captures portfolio content, projects, and portfolio media; its full backup also includes users and contacts. It does **not** include `CaptureModel` records or the separate camera archive files. Therefore, portfolio backup JSON alone is not a verified backup of camera archives.
- Current read-only inventory remains: 12 media-index entries with no missing/outside-root files; 12 hashes computed and 10 distinct values; 8/8 existing backup JSON files parsed. No historical file was moved or deleted.

**Required pre-migration approval and recovery process:**

1. Confirm all deployed environment overrides and the staging source roots before generating a data-specific manifest.
2. Take a separate, recoverable snapshot of the database's `CaptureModel` records plus every source archive root; retain the existing portfolio backup separately. The archive files are not included in current portfolio backup JSON.
3. Produce a reviewed migration manifest mapping capture ID, old path/root, new path, filename, byte length, SHA-256, database reference, consent status, and any missing/duplicate files. Do not include capture contents in the manifest.
4. In staging, copy (never move) each file to the destination, verify size and SHA-256, update only the staging `adminArchivePath`, and run list/preview/download/delete authorization tests against the staged paths.
5. Test rollback by restoring database references to the old paths while retaining both copies. Keep source files until the user approves cleanup separately.
6. The current approval names `server/storage/AdminArchive/Captures/` only for preparation of a non-destructive staging manifest. It does not authorize production access, runtime path changes, migration, or deletion. No source-root confirmation or staging database/filesystem snapshot has been supplied, so no data-specific capture manifest, migration, or deletion has occurred. A separate staging snapshot and explicit migration approval are still required.

IndexedDB is browser/device-local storage, not a server-retained archive: browser data clearing, device loss, or browser storage eviction can remove visitor-local captures. Server archival remains a separate explicit-consent action.

### 15.3 Test isolation and restore evidence

The prior `server/testEnv.cjs` redirected portfolio storage and backups but did not redirect `WindowsStorageService`'s `USER_CAPTURE_ROOT` and `ADMIN_ARCHIVE_ROOT`; capture tests could therefore target the Windows default roots. This was corrected for test processes only:

- `USER_CAPTURE_ROOT` now points inside the process-specific test temp root at `UserCaptures/`.
- `ADMIN_ARCHIVE_ROOT` points inside the process-specific test temp root at `AdminArchive/`; `CAPTURE_ARCHIVE_ROOT` points inside it at `Portfolio/Captures/`.
- The test harness removes its unique temporary root at process exit. Production defaults and existing data paths were not changed.

The latest `npm --prefix server run test:all` ran with `PORTFOLIO_E2E_DIST_DIR` pointing at the temporary test build and reported **178 backend + 20 limitations/backup-restore + 51 browser E2E assertions, 0 failed**. The limitations suite's generated backup restore ran with `NODE_ENV=test`, no `MONGODB_URI`, and temporary database/storage. It did not inspect or restore historical user backups. The client IndexedDB capture test passed (**1/1**), and the focused `npm --prefix server run test:capture-persistence` suite passed (**10/10**) against isolated MongoDB and storage.

### 15.4 Maintainability risks and disposition

- `server/routes/admin.ts` combines content/project administration, accounts/security, camera archive routes, and backup/restore logic. Its backup restore flow has cross-domain coupling between media file creation, media-reference rewriting, content/project writes, and rollback.
- `server/services/fileService.ts` combines upload/path safety, durable media-index persistence, legacy media recovery/import, and database index rebuilding.
- `client/src/App.tsx` centralizes auth/lock state, `/admin` routing, global maintenance polling, published favicon/layout synchronization, and top-level application rendering; `client/src/context/OSContext.tsx` remains the shared virtual-desktop state owner.

These are concrete refactoring candidates, but this pass made **no large-module extraction**: changing backup/restore or shared OS state without focused tests for rollback and cross-app behavior would create disproportionate data/UX risk. The two small LockScreen/E2E changes above are isolated and covered by regression. Follow-up modularization should start with pure backup restore validation/reference rewriting and route-level tests, then separately extract UI state with desktop/window behavior tests. Client and server strict TypeScript checks remain clean.

### 15.5 Staging requirements and unverified release checks

Production configuration evidence from `netlify.toml` shows only a static client build/publish and SPA fallback. Client requests use same-origin `/api` paths; there is no client API-origin setting found in source and no Netlify `/api` rewrite. A separate API host therefore requires an explicit same-origin `/api/*` reverse-proxy/rewrite, or a separately reviewed client API-origin implementation. Do not use the Vite development proxy in production.

For an isolated staging deployment, configure:

- Frontend origin on HTTPS and a route forwarding `/api/*` to the staging Express API without exposing private file/backup paths as static assets.
- `APP_URL` set to the HTTPS portfolio frontend origin; `CORS_ALLOWED_ORIGINS` set to the exact frontend origin(s), no wildcard.
- `TRUST_PROXY_HOPS` set to the provider's verified number of trusted reverse proxies (do not guess).
- `NODE_ENV=production`, provider `PORT`, a least-privilege staging `MONGODB_URI` pointing to a **separate staging database**, and private server-side secrets.
- `ADMIN_SETUP_TOKEN` only for one-time staging bootstrap, removed immediately afterward; a staging administrator account not reused in production.
- `PORTFOLIO_STORAGE_DIR`, `PORTFOLIO_BACKUP_DIR`, `USER_CAPTURE_ROOT`, and `ADMIN_ARCHIVE_ROOT` set to distinct staging-only storage paths if uploads/captures are tested.
- Back these paths with a durable private volume or suitable private object storage. A container's writable layer may be ephemeral, and per-instance local disks do not provide consistent reads/writes across multiple API instances.
- SMTP disabled for local/staging verification unless an explicitly authorized test mailbox and credentials are supplied. A successful connection/send API response alone is not proof of inbox delivery.

No production deployment or connectivity test was performed. No authorized test mailbox was provided, so real-mailbox delivery remains **blocked**; no real email was sent. Production HTTPS/CORS/cookie behavior, MongoDB connectivity/TTL/index operation, and API routing remain unverified.

### 15.6 Exact latest checks and ratings

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 1 — Baseline and data protection | **Complete locally; production data safeguards maintained** | Existing inventory and test storage are isolated. No live credentials, production data, or historical backup was touched. |
| 2 — Security remediation | **Previously completed locally; not repeated here** | Existing controls and regression checks are preserved. Live deployment/topology verification and independent penetration testing remain outstanding. |
| 3 — Performance optimization | **Partially complete** | Three-run isolated Lighthouse comparison and synthetic interaction timing are recorded above. Field metrics, representative production data, memory growth, and separate app-switch/drag/resize profiling remain unavailable. |
| 4 — Maintainability | **Partially complete** | Strict type-checks pass and coupling is documented. No large-module extraction was justified or performed in this pass. |
| 5 — End-to-end validation | **Locally validated in part** | Automated local suites and generated-backup restore passed. Historical restore, production connectivity, real mailbox delivery, and complete manual/accessibility workflows remain unverified. |
| 6 — Evidence-based report | **Updated locally** | This section adds exact local evidence, current blockers, storage proposal, staging prerequisites, and non-perfect evidence-based ratings. |

| Check | Result |
|---|---|
| `npm --prefix client run typecheck` | **Pass, 0 diagnostics, strict mode enabled.** |
| `npm --prefix server run typecheck` | **Pass, 0 diagnostics, strict mode enabled.** |
| `npm --prefix server run test:all` | **177 + 18 + 51 assertions passed, 0 failed**, with camera/archive and backup paths now isolated under test temp storage. |
| `npm --prefix client run test:capture-storage` | **1 passed, 0 failed.** |
| `$out = Join-Path $env:TEMP ('portfolio-client-build-verify-' + [guid]::NewGuid().ToString('N')); npm --prefix client run build -- --outDir "$out"` | **Pass; 57 files, 16,842,351 bytes.** The unique temporary output was removed afterward; existing `client/dist` was not overwritten. |
| `node -r .\server\testEnv.cjs -e "const path=require('path'); const base=process.env.PORTFOLIO_STORAGE_DIR; for (const key of ['PORTFOLIO_BACKUP_DIR','USER_CAPTURE_ROOT','ADMIN_ARCHIVE_ROOT']) { const rel=path.relative(base, process.env[key]); if (!rel || rel === '..' || rel.startsWith('..'+path.sep) || path.isAbsolute(rel)) throw new Error(key+' escapes test root'); console.log(key+'='+process.env[key]); } if (process.env.MONGODB_URI) throw new Error('test unexpectedly has MONGODB_URI'); console.log('ISOLATED_TEST_ENV=PASS');"` | **Pass**; backup, user-capture, and admin-capture paths resolved under a unique temporary root, with no database URI. |
| Isolated Lighthouse 12.8.2 / Chrome 155, mobile, 3 runs before and after | Results and per-run values recorded in Section 15.1; no external request received data; mock API count **0**. |
| Separate synthetic Event Timing | **88 / 80 / 80 ms**, median 80 ms; synthetic candidate only, not field INP. |
| Isolated generated-backup restore | **Pass within limitations suite's temporary test database/storage**; historic backup restore not attempted. |

| Area | Current rating | Evidence limitation |
|---|---:|---|
| Implementation | **8/10** | Broad local automated coverage; staging and production integrations remain unverified. |
| Performance | **6.5/10** | Repeatable isolated Lighthouse median 74/100 after a narrow LCP-animation change; main-thread startup/layout remains high and real-user data is unavailable. |
| Security | **7/10** | Local controls/tests remain; deployment configuration, live topology, and penetration assessment are unverified. |
| Maintainability | **6/10** | Strict checks pass and risky coupling is documented; large modules remain and were not broadly refactored. |

No 10/10 or production-readiness claim is made.

## 16. Storage architecture repair and safe migration status (21 October 2026)

The user-named `PROJECT_ANALYSIS_REPORT(2).md` was not present in this workspace. This phase used the existing `PROJECT_ANALYSIS_REPORT.md`, current source/configuration, and a new hash-only local storage inventory. I did not open the shared localhost browser page, read `.env`, connect to a configured MongoDB, or scan the legacy OS-level capture roots.

### 16.1 Before and after path map

**Before this code change (as derived from the prior implementation and existing files):**

```text
Browser
├─ client/public/                         intentionally static assets
├─ client/dist/                            generated frontend output
└─ IndexedDB: Win11PortfolioCameraCaptures local visitor photo/video blobs

Server
├─ PORTFOLIO_STORAGE_DIR (default server/storage/)
│  ├─ loose legacy media files
│  ├─ Portfolio/Media/                    uploaded media, flat path
│  └─ Portfolio/.media-index.json         stable IDs + relative paths
├─ PORTFOLIO_BACKUP_DIR                   default server/storage/AdminArchive/Backups/
├─ ADMIN_ARCHIVE_ROOT                     Windows default outside workspace:
│                                          C:\WindowsPortfolio\AdminArchive
└─ USER_CAPTURE_ROOT                      Windows default outside workspace:
                                           D:\WindowsPortfolio\UserCaptures
```

**After this change (new writes only; legacy paths and existing data are retained):**

```text
Browser
├─ client/public/                         public, version-controlled starter assets only
├─ client/dist/                            generated build output only
└─ IndexedDB: Win11PortfolioCameraCaptures visitor-local captures
   └─ optional, explicit consent → POST /api/captures

Server
└─ PORTFOLIO_STORAGE_DIR (default server/storage/)
   ├─ Portfolio/Media/                    managed portfolio media; existing flat paths/IDs
   ├─ Portfolio/.media-index.json         unchanged index location and v1 format
   ├─ Portfolio/Captures/
   │  ├─ Photos/                           consent-authorized server archive copies
   │  └─ Videos/
   ├─ UserCaptures/                        legacy authenticated file-upload API only
   └─ AdminArchive/
      ├─ Backups/                          private application JSON backups
      ├─ Manifests/                        private local storage audit manifest
      └─ legacy admin archive API files
```

`PORTFOLIO_BACKUP_DIR`, `PORTFOLIO_STORAGE_DIR`, `USER_CAPTURE_ROOT`, `ADMIN_ARCHIVE_ROOT`, and the new `CAPTURE_ARCHIVE_ROOT` remain configurable. The defaults now derive private server-owned roots from `PORTFOLIO_STORAGE_DIR`; old absolute paths saved in capture records are not rewritten. The `ADMIN_ARCHIVE_ROOT` override continues to serve the older archive API. New consented camera copies use `CAPTURE_ARCHIVE_ROOT` (default `server/storage/Portfolio/Captures/`) and are placed in `Photos/` or `Videos/`.

### 16.2 Actual inventory and private manifest

The pre-manifest inventory contained **26 files / 66,935,393 bytes** in `server/storage/` and the ignored root-level full-backup copy (6,454,767 bytes). A SHA-256 and byte count were recorded for each path; JSON files parsed without error. The private manifest was created afterward and is intentionally excluded from its own snapshot to avoid recursive inventory:

- Manifest recorded at audit time: `server/storage/AdminArchive/Manifests/storage-audit-2026-10-21.json` — **27 entries** (26 pre-existing server-storage files plus the project-root backup). The private manifest is not included in the current workspace.
- Manifest controls: database not inspected; external capture roots not inspected; **0 copied, 0 moved, 0 renamed, 0 deleted; no DB/index writes**.
- Original canonical `AdminArchive/Backups/`: **8 JSON files**, all parseable. Additional legacy `Backups/`: **1 JSON**; root-level backup: **1 JSON**. All ten backup JSON payloads parsed; parsing alone does not establish historical restore compatibility. The media-index JSON also parses.
- `Portfolio/.media-index.json`: v1, **12 entries**, **11 distinct relative paths**. One physical `Glossy_Cyan-Blue_AJ_Monogram__1_.png` path is referenced by both `file-221ecc3b-db21-4d4e-9589-e3ddf13ad687` and `file-2067ebc8-9a44-43e2-8c8f-ff52fa418ecc`. This is shared-path metadata, not proof the IDs can be merged; both IDs and the file are preserved.
- Eleven physical files were present under `Portfolio/Media/`; all twelve index entries resolved to existing files. Several loose legacy root files have byte-identical counterparts under `Portfolio/Media/`.
- Five equal-content groups were found by SHA-256 across the project storage and root backup: the four-file 1000153890 image group, the root/canonical full-backup pair, and the legacy-root/canonical pairs for the Data Analyst PDF, Full Stack Developer PDF, and screenshot. **No copies were deleted or deduplicated.** See every path, full hash, byte size, matching media IDs, and keep-in-place decision in the manifest.
- The project-root full backup and `AdminArchive/Backups/full-backup-2026-10-14T20-50-27-826Z.json` are an exact SHA-256 and size match. Both remain in place. The legacy `Backups/skills-migration-2026-10-16T21-55-29-679Z.json` also remains in its original folder.
- No zero-byte files or empty folders were found in the pre-manifest `server/storage` inventory. No camera archive files were present in that inventory; that does not establish that the uninspected external capture roots or database contain none.

The workspace-wide source/public scan separately found these **five zero-byte files**: `client/public/technology-icons/c.svg`, `client/src/components/apps/PortfolioAssistantWidget.tsx`, `client/src/components/apps/admin/AssistantConversations.tsx`, `server/models/AssistantConversation.ts`, and `server/routes/assistant.ts`. No source references to these exact symbol/file paths were found in the bounded search, but no deletion was made. They remain candidates only pending ownership/runtime confirmation. Two empty directories were found: `client/public/assets/` and `server/server/storage/`; neither was removed.

`client/public/` currently contains **28 files / 11,722,635 bytes**, with the zero-byte SVG noted above. `client/dist/` existed before this phase with **57 files / 16,842,138 bytes**; it had no filenames indicating backups, `.env`, indexes, captures, credentials, or secrets. A fresh build into a separate temporary output produced **57 files / 16,842,351 bytes** including application chunks and copied public assets; the existing dist was not overwritten. Netlify still publishes only `client/dist`. The root `.gitignore` excludes `server/storage/`, `client/dist/`, and `.env*`.

**Public resume caveat:** `client/public/downloads/resume.pdf` is the same SHA-256 and size as `server/storage/Portfolio/Media/Anish_Jethva_Resume_2026.pdf`, and the app's public-management default references `/downloads/resume.pdf`. Therefore, this particular resume is publicly served by design in the current fallback. No file was copied or removed. Confirm separately whether this file is an intended public portfolio download or must be privatized; privatizing it without updating the published reference/default would break the current resume experience.

### 16.3 Implementation changes

| File | Change |
|---|---|
| `server/services/windowsStorageService.ts` | Defaults user files and general admin archives under the private storage root; adds the distinct consented-capture root and photo/video subfolders. Writes use private permissions and exclusive creation to avoid overwrite. Traversal, containment, and symlink-resolved public-root checks are enforced. |
| `server/utils/privateStoragePath.ts` | Added shared validation preventing configured storage paths—including existing symlink ancestors—from resolving within `client/public` or `client/dist`. |
| `server/services/fileService.ts` | Applies the private-root guard before and after root creation; keeps the media index path and media IDs unchanged. |
| `server/services/backupService.ts` | Derives default backup root from the configured private storage root; emits version 3.1.0 SHA-256 integrity metadata; writes unique no-overwrite backup files and verifies the persisted JSON before reporting success. Existing version 3.0.0 backups remain accepted without a checksum. Portable backup export recalculates the digest after private collections are removed. |
| `server/routes/captures.ts` | Routes only the already-consented camera archive upload into `Portfolio/Captures/Photos` or `Videos`; browser-local capture flow is unchanged. |
| `server/routes/admin.ts` | Rejects restore payloads whose supported SHA-256 integrity digest does not match. Old checksum-less backup formats remain compatible. |
| `server/routes/storage.ts` | Corrected legacy endpoint comments to reflect private configurable roots; its route contracts are unchanged. |
| `server/testEnv.cjs` | Isolates the new `CAPTURE_ARCHIVE_ROOT` along with the existing storage roots in per-process temporary test storage. |
| `server/.env.example` | Documents the private storage defaults and new capture-root override. |
| `server/tests/backend.test.ts` | Covers storage-root privacy guard and archive-root health visibility; corrects old C:/D: storage wording. |
| `server/tests/capturePersistence.test.ts` | Covers consented photo path, photo/video separation, collision-safe writes, authorization, and retention of local-vs-archive copies. |
| `server/tests/comprehensive_limitations.test.ts` | Verifies no backup overwrite and rejects tampered checksummed restore data before restore work begins. |
| `server/tests/admin_repair.test.ts` | Verifies generated backup format, SHA-256 metadata, and legacy filename compatibility. |
| `server/tests/backupExportSecurity.test.ts` | Verifies portable-export checksum recalculation, tamper detection, and required checksum for format 3.1.0. |

No MongoDB schema or index changed. FileMetadata IDs, URL shape (`/api/portfolio-media/:id`), virtual `D:/` paths, IndexedDB database/store names, and `.media-index.json` v1 location remain unchanged. Existing stored absolute archive paths continue to be used when present. `client/public` and `client/dist` are the only static asset roots; Express does not mount `server/storage/` as static content.

### 16.4 Backup semantics, migration, and rollback

New application backups retain the canonical private location `server/storage/AdminArchive/Backups/` unless explicitly overridden. They include portfolio published/draft content, projects, and included media bytes; full application backups additionally include users and contacts. A v3.1.0 SHA-256 digest covers backup timestamp, version, type, and collections. New writes use exclusive filename creation (a numeric suffix resolves a same-second collision), flush and parse the written file, and fail rather than reporting an invalid file as successful. Restore rejects digest mismatches. Checksum-less older backups remain accepted for compatibility; a SHA-256 checksum detects accidental corruption but is not a signature against an administrator who can alter both content and digest.

The JSON backup is **not a complete MongoDB/filesystem backup**: it does not include `CaptureModel` records, server capture bytes, sessions, analytics, or all database collections. It does not recursively scan or copy the backup directory itself. Long-term recoverability of consented camera archives therefore needs a separately protected database + private-file backup policy; that policy must not silently broaden visitor capture consent.

**Migration disposition:** there was no necessary move for the listed root legacy media because same-hash candidates already exist under the canonical `Portfolio/Media/` path; the canonical backup directory already exists. The root duplicate, legacy `Backups/` JSON, and all duplicate media copies remain untouched. No migration script was run, no media ID or DB reference was rewritten, and no source was deleted. The manifest is safe inventory evidence, not a completed migration manifest for unknown external camera files or database paths.

To migrate external capture records when a staging-only export is available:

1. Snapshot the staging `CaptureModel` records and every configured old capture root; separately verify a staging MongoDB restore and filesystem backup. Do not use the application JSON backup as a substitute for either.
2. Confirm the staging source roots and exact `CAPTURE_ARCHIVE_ROOT`; create a reviewed manifest keyed by capture ID with old/new path, filename, byte length, SHA-256, media type, consent timestamp, and source existence.
3. Copy each file with exclusive creation; if a destination exists, compare hash and stop on mismatch. Do not rename/remove source files.
4. Verify every destination hash and preview/download/authorization behavior in staging. Update only staging `adminArchivePath` values after copy verification; preserve IDs and consent records.
5. Validate migration reruns as no-ops for already verified destinations. Test rollback by restoring old DB path values while retaining source copies and removing only migration-created destination files after a separate test-specific cleanup approval.
6. Provide the manifest and rollback report for review. No live DB export, external root scan, staging migration, or production operation was authorized or performed in this phase.

### 16.5 Validation and unresolved requirements

| Check | Result |
|---|---|
| `npm --prefix server run typecheck` | **Passed; strict TypeScript diagnostics: 0.** |
| `npm --prefix client run typecheck` | **Passed; strict TypeScript diagnostics: 0.** |
| `npm --prefix server run test:all` | Final run: **178 backend + 20 limitations/backup-restore + 51 E2E assertions passed, 0 failed.** |
| `npm --prefix server run test:capture-persistence` | **10 passed, 0 failed** against isolated MongoDB and temporary storage roots. |
| `npm --prefix client run test:capture-storage` | **1 passed, 0 failed.** |
| `node --import=./server/node_modules/tsx/dist/loader.mjs --test server/tests/backupExportSecurity.test.ts` | **1 passed, 0 failed.** |
| Fresh client production build to unique temp output | **Passed; 57 files, 16,842,351 bytes**; temp output removed; `client/dist` left untouched. |
| Storage inventory/manifest verification | **27/27 entries reverified** against recorded SHA-256 and byte size; **5 duplicate-content groups**; **0 copied/moved/renamed/deleted files**. Database and external OS-level roots are explicitly marked not inspected in the private manifest. |
| Generated backup restore | Prior isolated MongoMemoryServer suite verified generated backup restore; updated suite additionally rejected a tampered digest before applying restore. No historical user backup was restored. |
| Production/private path and upload verification | Local source and isolated route tests only. No external host, real database, or production filesystem was contacted. |

Unverified or blocked: source-root values from deployment `.env`; files in external legacy C:/D: capture roots; live MongoDB FileMetadata/CaptureModel references; historical backup restore compatibility; backup recovery of camera archives; production persistent-volume behavior; manual physical-camera/quota/browser tests; real deployment CORS/proxy/static routing; and whether the public fallback resume should remain public. The local migration manifest cannot settle these without a staging database export and confirmed source roots.

Rollback for the code-only defaults is to redeploy the preceding code and restore the prior environment root overrides; existing absolute record paths and source files were not altered. New files written after deployment under the new default require an explicit copy-and-hash plan before changing roots again. No destructive cleanup, deployment, or live-data migration occurred.

## 17. Synthetic-only camera capture migration manifest (21 October 2026)

### 17.1 Scope and inspected implementation

This phase prepared a **manifest-only** workflow for the approved destination `server/storage/AdminArchive/Captures/`. It did not connect to MongoDB, read `.env`, open the shared localhost page, scan any user/production capture directory, send email, deploy, or migrate/delete real files. The only input records and media bytes used below are synthetic dummy fixtures created under a unique OS temporary directory and removed after verification.

The audited capture contract is `CaptureData` in `server/db/database.ts` and `ICapture` in `server/models/Capture.ts`. The stable record key is `id` (also the capture/media ID); the durable server archive reference is `adminArchivePath`. The client-local copy is tracked separately as `userCapturePath`, and consent is represented by `archiveConsentAt` and `adminArchived`. The `/api/captures` upload path requires explicit consent and records metadata after writing a private archive. Admin preview/download routes resolve that stored path behind admin authorization. The migration manifest preserves all record metadata and proposes changing only `adminArchivePath`; no actual database write occurred.

`server/services/fileService.ts` and `server/storage/Portfolio/.media-index.json` concern portfolio media IDs and `Portfolio/Media` files, not camera captures. `BackupService` writes portfolio/application backup JSON under `PORTFOLIO_BACKUP_DIR` (default `server/storage/AdminArchive/Backups`), but its snapshot does not include `CaptureModel` records or camera archive bytes. A portfolio backup is therefore not a sufficient capture-migration recovery snapshot.

Current capture behavior and compatibility:

- A consented upload writes `cap_<uuid>_<safe-name>` under `CAPTURE_ARCHIVE_ROOT/Photos/` for photos and `.../Videos/` for videos. `CAPTURE_ARCHIVE_ROOT` defaults under `PORTFOLIO_STORAGE_DIR/Portfolio/Captures`; an override can change it. The proposed target for migration is separately `PORTFOLIO_STORAGE_DIR/AdminArchive/Captures/{Photos,Videos}`.
- Upload validation currently accepts photo extensions `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.heic` and video extensions `.mp4`, `.m4v`, `.webm`, `.mkv`, `.avi`, with a 100 MiB request cap. Admin preview/download resolves by capture ID to the stored archive path; it does not use the portfolio media ID or media index.
- Current-format DB references are absolute filesystem paths in `Capture.adminArchivePath` and `userCapturePath`; the schema does not encode a root/version. Older records can therefore contain different absolute Windows/POSIX paths from prior roots or overrides. The actual set of legacy formats and source roots is unknown until a staging-only record export is supplied. No source root is confirmed for actual user data.
- Owners/admins download via `/api/captures/:id/download`, which reads the relevant stored path. Admin preview/download use `/api/admin/archives/:id/preview` and `/download`; their resolver first accepts an existing stored `adminArchivePath`, then has a legacy fallback that searches only the top level of `ADMIN_ARCHIVE_ROOT` for a filename beginning with `<capture-id>_`. There is no general path-alias registry and no camera index entry to rewrite.
- During a copy-only stage, the original DB path remains unchanged and existing ID-based readers continue using it. Once a separately approved DB update points to the destination, those readers use the new stored path; if old files are ever removed later, any needed aliases must be deliberately implemented and verified first. Stable capture IDs and routes do not change.

### 17.2 Root resolution and missing staging inputs

Code determines default roots as follows; effective deployed values remain unknown because no `.env` or deployment secret/configuration was read:

| Purpose | Override | Code default |
|---|---|---|
| Shared private storage root | `PORTFOLIO_STORAGE_DIR` | `<process.cwd()>/server/storage` |
| New consented camera upload root | `CAPTURE_ARCHIVE_ROOT` | `<storageRoot>/Portfolio/Captures` (`Photos/` or `Videos/`) |
| Legacy user-copy root | `USER_CAPTURE_ROOT` | `<storageRoot>/UserCaptures` |
| Legacy/general admin archive root | `ADMIN_ARCHIVE_ROOT` | `<storageRoot>/AdminArchive` |
| Portfolio backups | `PORTFOLIO_BACKUP_DIR` | `<storageRoot>/AdminArchive/Backups` |
| Approved migration target for this manifest only | Not an application write override | `<storageRoot>/AdminArchive/Captures` (`Photos/` or `Videos/`) |

The current consented-upload code default (`Portfolio/Captures`) and the user-approved migration target (`AdminArchive/Captures`) differ. This task did **not** change runtime upload configuration or move data. Historical source roots cannot be inferred from these current defaults: each record stores its own absolute `adminArchivePath`, and older configuration overrides may have used other roots. A valid staging export must contain the record paths and a separate, operator-confirmed mapping of every old root actually present. Missing roots, unconfirmed paths, or paths outside supplied roots are conflicts, not reasons to guess.

Required staging-only JSON input contract (`capture-record-export-v1`):

```json
{
  "format": "capture-record-export-v1",
  "sourceEnvironment": "staging",
  "syntheticOnly": false,
  "exportedAt": "2026-10-21T00:00:00.000Z",
  "stagingSnapshots": {
    "database": {
      "artifactId": "staging-db-snapshot-id",
      "artifactPath": "C:\\staging\\snapshots\\capture-db-snapshot.json",
      "sha256": "<64-hex SHA-256 of the exact snapshot artifact>",
      "verified": true,
      "isolated": true
    },
    "filesystem": {
      "artifactId": "staging-filesystem-snapshot-id",
      "artifactPath": "C:\\staging\\snapshots\\capture-filesystem-snapshot.json",
      "sha256": "<64-hex SHA-256 of the exact snapshot artifact>",
      "verified": true,
      "isolated": true,
      "sourceRootIds": ["confirmed-staging-root-1"]
    }
  },
  "sourceRoots": [
    {
      "id": "confirmed-staging-root-1",
      "path": "C:\\staging\\confirmed-old-archive-root"
    }
  ],
  "records": [
    {
      "id": "stable-capture-id",
      "userId": "staging-user-id-or-visitor",
      "mediaType": "photo",
      "fileName": "capture.jpg",
      "userCapturePath": "",
      "adminArchivePath": "C:\\staging\\confirmed-old-archive-root\\Photos\\capture.jpg",
      "fileSize": 12345,
      "userSaved": false,
      "adminArchived": true,
      "archiveExpiry": "",
      "archiveConsentAt": "2026-10-20T12:00:00.000Z",
      "deleted": false,
      "timestamp": "2026-10-20T12:00:00.000Z"
    }
  ]
}
```

The root must explicitly set `sourceEnvironment: "staging"` and `syntheticOnly: false`; the generator rejects inconsistent values. Synthetic fixtures use `sourceEnvironment: "synthetic-test"` and `syntheticOnly: true` and are not accepted as staging evidence. Each record must contain the `CaptureData` fields: `id`, `userId`, `mediaType`, `fileName`, `userCapturePath`, `adminArchivePath`, `fileSize`, `userSaved`, `adminArchived`, `archiveExpiry`, `deleted`, and `timestamp`, plus optional `archiveConsentAt`, `deletedAt`, and `error` where present in the export. IDs must be unique; paths must be absolute; roots must be unique and explicitly confirmed. `stagingSnapshots.database` and `.filesystem` must identify isolated staging snapshot artifacts, their absolute artifact paths, and SHA-256 values matching the exact artifacts; both must be marked verified and isolated. The filesystem snapshot must enumerate exactly the confirmed source-root IDs. The generator checks that both snapshot files exist, are private paths, and match their SHA-256 values; the `verified`/`isolated` assertions themselves must be supplied by the staging operator. The export must not include image/video bytes, base64 data, credentials, or unrelated collections. `sourceRoots[].path` values must be resolved from staging-only configuration and checked against every record path. Do not use production data or environment values.

### 17.3 Generated synthetic manifest and verification

The reusable read-only implementation is `server/services/captureMigrationManifest.ts`; the disposable fixture generator is `server/scripts/createSyntheticCaptureMigrationManifest.ts`; regression tests are in `server/tests/captureMigrationManifest.test.ts`. Earlier synthetic artifacts were `server/storage/AdminArchive/Manifests/capture-migration-synthetic-2026-10-21-v6.json` and `server/storage/AdminArchive/Manifests/capture-migration-synthetic-2026-10-21-v7.json`. Those private artifacts are not included in the current workspace; neither represented real staging data.

The artifact is explicitly marked synthetic and manifest-only. It contains **4 dummy records**: 3 dummy source files verified at generation, 1 deliberately missing source record, 1 duplicate SHA-256 group (two separate dummy photo files), and 1 unreferenced dummy source file. It contains 1 unresolved conflict for the missing record. Every entry records file existence, proposed destination and destination existence, database lookup/path fields (`Capture.id` → `adminArchivePath` and `db.captures` cache), that `.media-index.json` does not reference camera captures, copy-time compatibility behavior, and the `adminArchivePath` rollback value. No destination collision was present in this synthetic manifest; the test suite separately created a dummy existing destination and proved it is marked as a conflict and left byte-for-byte unchanged, and tested case-insensitive generated-name conflicts. Dummy fixture and snapshot artifact paths are redacted to `<DISPOSABLE_TEMP_FIXTURE>` in the persisted artifact; hashes and verification counts were captured before fixtures were removed. Snapshot files used for the fixture were actually hashed and checked; their synthetic `verified`/`isolated` labels are test-only evidence, not staging evidence. No dummy media content is stored in the manifest.

Data inclusion/exclusion: **0 actual staging or production records/files included; 4 synthetic records included; all actual user/production records and media excluded.** Confirmed actual legacy roots: **none supplied**. The manifest's only source root was a disposable temporary fixture and is redacted. Synthetic DB/filesystem snapshots are not substitutes for real staging snapshots.

Verification results recorded in the artifact and independently checked after generation:

| Check | Result |
|---|---|
| Manifest format / synthetic marker | `capture-migration-manifest-v1`; `syntheticOnly: true` |
| Operation mode | `manifest-only-no-copy-no-database-write` |
| Destination root | All 4 proposed file paths are beneath the approved `server/storage/AdminArchive/Captures/` root, separated into `Photos/` and `Videos/` |
| Generation-time source verification | 3 dummy files with recorded byte sizes and SHA-256; 1 dummy record missing |
| Duplicate content | 1 dummy equal-hash group; both record IDs and both paths retained (no deduplication proposed) |
| Orphan scan | 1 unreferenced dummy file listed with size/hash; not deleted |
| Destination conflicts | 0 in persisted synthetic example; separate regression fixture confirms an existing destination is never overwritten |
| Case-insensitive planned filename collisions | Regression test flags both affected entries and blocks writes |
| Database, media-index, compatibility, rollback fields | Present in each manifest entry; no migration/update performed |
| Snapshot integrity | Synthetic DB export and filesystem inventory snapshot files existed and matched their recorded SHA-256 before cleanup |
| Persisted path validation | 0 paths outside destination root; source, rollback, and snapshot fixture paths redacted; temporary fixture no longer exists |
| Destination writes | 0 files created at the approved destination |
| Database/media-index operations | 0 reads or writes against MongoDB; no `.media-index.json` change |

Test commands and results:

| Command | Result |
|---|---|
| `node --import=./server/node_modules/tsx/dist/loader.mjs --test server/tests/captureMigrationManifest.test.ts` | **3 passed, 0 failed.** Covers explicit staging-vs-synthetic data-scope marking, source/destination containment, verified snapshot artifact SHA-256, metadata/database/index/rollback mapping, duplicate hashes, missing records, orphan files, pre-existing destination no-overwrite, case-insensitive filename conflicts, changed source detection, outside-root rejection, and duplicate IDs. All test data uses temporary storage. |
| `npm --prefix server run typecheck` | **Passed; 0 strict TypeScript diagnostics.** |
| `node --import=./server/node_modules/tsx/dist/loader.mjs server/scripts/createSyntheticCaptureMigrationManifest.ts` | **Completed; 4 entries; 3 source files verified; 1 missing record; 1 duplicate-hash group; 1 orphan file; 0 destination conflicts.** Synthetic DB/filesystem snapshot artifacts were hashed and verified; all fixture files were removed in `finally`. |
| Persisted manifest checks | **4/4 destination paths contained; 0 unredacted source/rollback/snapshot paths; fixture absent; 0 proposed destination files present.** |

The generated synthetic manifest is **not a staging migration manifest** and cannot authorize or perform a copy. It demonstrates the input schema, mapping, conflict handling, and verification protocol only.

The synthetic manifest includes only dummy records/files and synthetic snapshot artifacts. **No actual CaptureModel IDs, staging records, personal media, or confirmed live/staging source roots were included.** Actual capture records were excluded because the required isolated export was not supplied; no data-specific migration eligibility or source completeness can be inferred from the fixture.

### 17.4 Conflicts, metadata update, and rollback requirements

- Missing source file: leave the record unchanged, list the record as unresolved/orphaned, and stop migration for that record until staging verifies the correct source or approves a documented exception.
- Duplicate SHA-256: retain every path and record ID. Hash equality is evidence for review only; it never merges IDs or deletes a copy.
- Unreferenced file: list it with source root, size, and hash; do not remove it without independent ownership/reference review.
- Existing destination: mark as a hard conflict and stop for that entry. The copy phase must use exclusive creation; never replace, truncate, rename, or delete the destination.
- Path outside confirmed source roots, invalid/symlink-resolved path, or size/hash change: mark unresolved and stop; do not read or migrate from a guessed location.
- Proposed database update after a separately approved, hash-verified staging copy: update only the matching `CaptureModel.id` record's `adminArchivePath` to the manifest destination. Preserve `id`, `userId`, consent, media type, timestamps, deletion/archive flags, and all other fields. Validate list/preview/download authorization and database persistence before declaring staging success.
- Rollback: retain all old source files; restore the captured staging database snapshot or set each affected `adminArchivePath` back to its manifest `adminArchivePathFrom`; verify old path access; leave copied destinations untouched until a separately authorized cleanup decision. No live/production rollback or migration was attempted.

**Remaining blocker:** no staging-only `CaptureModel` export, confirmed effective staging root configuration, or recoverable staging database/filesystem snapshot was supplied. To produce a data-specific manifest, provide those three inputs using the contract above. Actual copying, database updates, backup cleanup, or source deletion requires separate explicit authorization. The previously mentioned possible analytics event remains untouched and uninspected.

## 18. Staging-input availability check (21 October 2026, 00:53 local)

The workspace search found only the previous synthetic manifest artifacts; it found no staging `capture-record-export-v1` file, database snapshot artifact, filesystem snapshot artifact, or confirmed staging source-root mapping. No live database was contacted, no `.env` or secret was read, and no user/production storage root was inspected. Consequently:

- **Data-specific staging manifest:** not generated; no actual capture records or media were available.
- **Confirmed actual source roots:** none. The code-derived defaults are not evidence of deployed/staging values and were not used as source paths.
- **Staging database snapshot:** not supplied; synthetic test snapshot only.
- **Staging filesystem snapshot:** not supplied; synthetic test snapshot only.
- **Synthetic verification:** retained only as a test fixture. The audit-time artifact `server/storage/AdminArchive/Manifests/capture-migration-synthetic-2026-10-21-v6.json` was marked `sourceEnvironment: "synthetic-test"` and `syntheticOnly: true`; it is not present in this workspace or staging data.
- **Next required inputs:** (1) staging-only CaptureModel export in the schema above, explicitly marked `sourceEnvironment: "staging"` and `syntheticOnly: false`; (2) non-secret staging values for `PORTFOLIO_STORAGE_DIR` and whichever source-root overrides are actually set (`CAPTURE_ARCHIVE_ROOT`, `ADMIN_ARCHIVE_ROOT`, `USER_CAPTURE_ROOT`), plus a confirmed absolute mapping for every legacy root found in `adminArchivePath`; (3) verified, isolated database and filesystem snapshot artifacts with SHA-256 hashes covering those records and roots. `PORTFOLIO_BACKUP_DIR` is not a substitute for these snapshots because the application backup omits CaptureModel and camera archive files; provide it only if needed to locate a separately verified recovery artifact. Supply no secrets or production values. Once present, validate roots, snapshot digests, every referenced file, destination collisions, duplicates, orphans, and rollback mapping before generating a data-specific dry-run manifest.
- **No data operation:** 0 copies, 0 database updates, 0 media-index writes, 0 destination directories/files created, and 0 deletions. Actual migration or deletion remains separately approval-gated.

The current generator validation and strict typecheck passed after adding explicit staging-vs-synthetic identification. The isolated manifest suite remains **3 passed, 0 failed**; no staging-data tests can run until the required safe inputs are supplied.

## 19. Staging migration input handoff and procedure (21 October 2026, 00:56 local)

### 19.1 Workspace artifact check

Only the project-scoped private location `server/storage/AdminArchive/Manifests/` and the expected project-scoped staging-input location below were checked. No personal directories, external drives, unknown locations, `.env`, or database were inspected. The staging-input location did not exist and all five specifically expected input files were absent:

`server/storage/AdminArchive/StagingInputs/2026-10-21/`

| Expected exact filename | Present |
|---|---:|
| `capture-record-export.staging.json` | No |
| `capture-database-snapshot.archive.gz` | No |
| `capture-filesystem-snapshot.zip` | No |
| `staging-source-roots.json` | No |
| `capture-filesystem-inventory.json` | No |

The latest synthetic artifact at the time of that report was `server/storage/AdminArchive/Manifests/capture-migration-synthetic-2026-10-21-v6.json`, **11,151 bytes**, SHA-256 `b6fea13b3730b3517afcd5d3f8c4bf2313acc208900ba22e354759d8dc71ac06`. It was synthetic-only, not staging evidence, and is not present in this workspace. No data-specific manifest was generated.

### 19.2 Exact Capture model fields

The export's `records[]` must serialize the existing `CaptureData` / `ICapture` fields without renamed or invented model properties:

| Field | Model requirement | Migration relevance |
|---|---|---|
| `id` | Required; unique indexed string | Stable capture/media identifier and Capture lookup key |
| `userId` | Required string | Ownership reference; redact in any human-readable report, preserve only in private export |
| `mediaType` | Required enum: `photo` or `video` | Selects `Photos/` or `Videos/` target |
| `fileName` | Required string | Stored display name; destination name is separately derived safely |
| `userCapturePath` | Required string | Separate user-copy path; do not confuse with archive source |
| `adminArchivePath` | Required string | Current server archive path and migration source reference |
| `fileSize` | Number, schema default `0` | Compare to actual source byte count |
| `userSaved` | Boolean, schema default `true` | Preserve metadata |
| `adminArchived` | Boolean, schema default `true` | Preserve archive status |
| `archiveExpiry` | Required string | Preserve retention metadata |
| `archiveConsentAt` | Optional string | Preserve consent evidence; do not infer or fabricate |
| `deleted` | Boolean, schema default `false` | Preserve state; deleted records need explicit review, not automatic inclusion/exclusion |
| `deletedAt` | Optional string | Preserve where present |
| `error` | Optional string | Preserve in the private export where present; redact from report |
| `timestamp` | Required string | Preserve capture time |

The Mongoose schema has `timestamps: false`, `versionKey: false`; it does not define additional model fields. Mongoose's database `_id` is not part of `CaptureData` and is not required by the manifest input. The staging export must include each model field above; optional model fields may be omitted only when absent. The export is an envelope with provenance/snapshot fields described below, not a different Capture schema.

### 19.3 Safe staging-only export procedure

Do not run these steps against production. A staging operator should use a separate staging account/DB and a protected private workspace, pause staging capture writes for the snapshot window, and keep all paths beneath the isolated staging storage boundary. Do not put credentials in JSON, command history, this report, or manifest. The current manifest generator's approved destination remains `<PORTFOLIO_STORAGE_DIR>/AdminArchive/Captures/Photos/` and `Videos/`; it only inspects whether these paths exist and does not create them.

**Required handoff location and exact files** (create this directory only on the authorized staging workstation; it was not created here):

`<project>\server\storage\AdminArchive\StagingInputs\2026-10-21\`

1. `staging-source-roots.json` — non-secret staging provenance: environment label `staging`, staging DB name/cluster label (no URI or credentials), the actual non-secret values of `PORTFOLIO_STORAGE_DIR` and any set `CAPTURE_ARCHIVE_ROOT`, `ADMIN_ARCHIVE_ROOT`, and `USER_CAPTURE_ROOT`, plus a list of confirmed source roots with stable IDs and absolute paths. Include the resolved target storage root. Do not include `PORTFOLIO_BACKUP_DIR` unless it is needed to locate a separately verified recovery artifact; the application's portfolio backups omit CaptureModel and camera bytes.
2. `capture-database-snapshot.archive.gz` — `mongodump` archive of the isolated staging database while capture writes are paused. Prefer the full staging DB to preserve a recoverable point-in-time state; do not substitute a portfolio JSON backup.
3. `capture-filesystem-snapshot.zip` — non-destructive snapshot/archive of every confirmed capture source root, preserving relative paths. Use a consistent volume/filesystem snapshot or quiesce writers during the copy. Do not use mirror/synchronization options that delete destination files.
4. `capture-filesystem-inventory.json` — snapshot contents indexed by source-root ID and relative path, with file length and SHA-256 for every regular file. Exclude symlinks or list them as unresolved; do not follow them outside confirmed roots.
5. `capture-record-export.staging.json` — generator input envelope containing the staging `CaptureData` records plus the two snapshot artifact paths/hashes, source-root IDs/paths, and provenance. Do not embed image/video bytes, base64, credentials, or unrelated collections.

The checked-in model is named `Capture`; importing it locally without connecting to a database resolved `CaptureModel.collection.name` to **`captures`**. This confirms the current code's Mongoose collection name only; it does not establish a staging database's identity or configuration. Confirm the same collection name in the isolated staging app before export. On the isolated staging database, a staging operator can export the collection with Mongo Database Tools (substitute the confirmed staging database name; use the protected staging URI from that operator's secret provider, never a production URI):

```powershell
$inputRoot = '<project>\server\storage\AdminArchive\StagingInputs\2026-10-21'
$env:STAGING_MONGODB_URI = '<retrieve only from the staging secret provider; do not echo or save>'
$env:STAGING_DATABASE_NAME = '<confirmed staging database name>'
$captureCollection = '<CaptureModel.collection.name confirmed on staging>'
mongodump --uri="$env:STAGING_MONGODB_URI" --db="$env:STAGING_DATABASE_NAME" --archive="$inputRoot\capture-database-snapshot.archive.gz" --gzip
mongoexport --uri="$env:STAGING_MONGODB_URI" --db="$env:STAGING_DATABASE_NAME" --collection="$captureCollection" --type=json --jsonArray --fields=id,userId,mediaType,fileName,userCapturePath,adminArchivePath,fileSize,userSaved,adminArchived,archiveExpiry,archiveConsentAt,deleted,deletedAt,error,timestamp --out="$inputRoot\capture-records.raw.json"
```

`capture-records.raw.json` is a temporary staging output used to assemble `capture-record-export.staging.json`; it is not an extra manifest schema and should stay private. Wrap its `CaptureData` records with the exact envelope:

```json
{
  "format": "capture-record-export-v1",
  "sourceEnvironment": "staging",
  "syntheticOnly": false,
  "exportedAt": "<UTC ISO-8601 time>",
  "stagingSnapshots": {
    "database": {
      "artifactId": "staging-capture-database-snapshot",
      "artifactPath": "<absolute path to capture-database-snapshot.archive.gz>",
      "sha256": "<SHA-256 of that exact file>",
      "verified": true,
      "isolated": true
    },
    "filesystem": {
      "artifactId": "staging-capture-filesystem-snapshot",
      "artifactPath": "<absolute path to capture-filesystem-snapshot.zip>",
      "sha256": "<SHA-256 of that exact file>",
      "verified": true,
      "isolated": true,
      "sourceRootIds": ["<all and only IDs in sourceRoots>"]
    }
  },
  "sourceRoots": [
    {"id": "<confirmed-root-id>", "path": "<absolute confirmed staging source root>"}
  ],
  "records": ["<CaptureData objects exported from the staging Capture collection>"]
}
```

The `verified` flags are operator attestations, not proof by themselves. Before handoff, test restoring `capture-database-snapshot.archive.gz` into a **different disposable staging verification database**, verify the Capture count and representative record IDs/fields against the export, and verify the filesystem snapshot/inventory by rechecking every path, byte length, and SHA-256. Do not restore over the staging source DB.

### 19.4 Hash and consistency verification commands

After staging writes are paused and snapshots/exports are complete, run on the authorized staging workstation:

```powershell
$inputRoot = '<project>\server\storage\AdminArchive\StagingInputs\2026-10-21'
Get-FileHash "$inputRoot\capture-database-snapshot.archive.gz" -Algorithm SHA256
Get-FileHash "$inputRoot\capture-filesystem-snapshot.zip" -Algorithm SHA256
Get-FileHash "$inputRoot\capture-record-export.staging.json" -Algorithm SHA256
Get-FileHash "$inputRoot\capture-filesystem-inventory.json" -Algorithm SHA256
```

Record the exact first two hashes in the export envelope, and keep all four artifact hashes in the private staging handoff record. Verify each inventory entry against the extracted read-only snapshot/source roots:

```powershell
$inventory = Get-Content "$inputRoot\capture-filesystem-inventory.json" -Raw | ConvertFrom-Json
foreach ($item in $inventory.files) {
  $sourceRoot = $inventory.sourceRoots | Where-Object id -eq $item.sourceRootId
  $file = Join-Path $sourceRoot.path $item.relativePath
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing snapshot file: $($item.sourceRootId)/$($item.relativePath)" }
  $actual = Get-Item -LiteralPath $file
  $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual.Length -ne [long]$item.fileSize -or $hash -ne $item.sha256.ToLowerInvariant()) {
    throw "Snapshot size/hash mismatch: $($item.sourceRootId)/$($item.relativePath)"
  }
}
```

Any missing source, mismatch, unconfirmed root, outside-root path, symlink ambiguity, or existing/case-insensitive destination-name conflict blocks that entry from migration. The generator preserves duplicates as separate references, reports source orphans, and will not overwrite an existing destination. It does not make a staging snapshot consistent itself: pause writes and confirm both snapshots correspond to the same maintenance window.

### 19.5 Exact current status and next user action

The project-scoped presence check confirmed the five expected real-staging input filenames are absent. No staging database connection, export, source-root scan, destination directory creation, file copy, database update, or index update was performed. A persistent synthetic-only fixture and matching snapshots are now available as test evidence; they are **not** evidence about staging captures.

**Next required user action:** provide the five staging-only artifacts listed above at the private project-scoped handoff directory, with non-secret root configuration and confirmed `CaptureModel.collection.name`, or provide an equivalent isolated staging handoff using the same fields. Do not provide `.env`, credentials, production paths/data, or media content in chat. Once these exact inputs are present, the read-only generator can validate them and produce a separate data-specific manifest. Actual migration/deletion remains separately unauthorized.

### 19.6 Synthetic snapshot package and verification (not staging evidence)

To exercise snapshot integrity without any production or real-staging data, `server/scripts/createSyntheticCaptureMigrationManifest.ts` now creates dummy database-export and filesystem-snapshot artifacts under the private `server/storage/AdminArchive/Manifests/SyntheticCaptureFixture/` directory. The disposable source fixture is removed at script exit; the persisted archive contains only dummy photo/video/orphan bytes. Output creation is exclusive and refuses to overwrite any existing manifest or snapshot. The approved `AdminArchive/Captures/` destination is only checked and is not created.

Generated outputs:

| Artifact | SHA-256 |
|---|---|
| `server/storage/AdminArchive/Manifests/SyntheticCaptureFixture/synthetic-capture-database-snapshot.json` | `16b017bc48b5a68b400e048747dae74764d1c5ef46115a4b92ad3aedf3b554ab` |
| `server/storage/AdminArchive/Manifests/SyntheticCaptureFixture/synthetic-capture-filesystem-snapshot.tar.gz` | `c9a4e0e4647fc31ba2900af2c9bd62f20f7bbda144970230909f7d31b4c3edf3` |
| `server/storage/AdminArchive/Manifests/SyntheticCaptureFixture/synthetic-capture-filesystem-inventory.json` | `28c1ac409d4322d227bc166c2ee1f3ba16e68a84aa6f2a85ece8374d4aa2dcc5` |
| `server/storage/AdminArchive/Manifests/capture-migration-synthetic-2026-10-21-v7.json` | `1b08c6669c1a9c708b63dea8dd4780f04c4024f6966f2d0292c1f310e2d38f97` |

The database artifact is a synthetic JSON export in the `captures` collection shape, not a MongoDB binary dump or an actual staging database backup. It contains four dummy capture records and is marked synthetic in the manifest input; it must never be treated as staging evidence. The filesystem inventory/archive has four dummy files: three referenced media files and one orphan. The dry-run manifest reports **4 records; 3 source files verified; 1 intentionally missing source; 1 duplicate-content group; 1 orphan file; 0 destination conflicts**. Duplicate dummy files remain distinct. The missing source and orphan are intentional test cases, not repair claims.

Independent verification performed:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'server\storage\AdminArchive\Manifests\SyntheticCaptureFixture\synthetic-capture-database-snapshot.json'
Get-FileHash -Algorithm SHA256 -LiteralPath 'server\storage\AdminArchive\Manifests\SyntheticCaptureFixture\synthetic-capture-filesystem-snapshot.tar.gz'
Get-FileHash -Algorithm SHA256 -LiteralPath 'server\storage\AdminArchive\Manifests\SyntheticCaptureFixture\synthetic-capture-filesystem-inventory.json'
tar.exe -tzf 'server\storage\AdminArchive\Manifests\SyntheticCaptureFixture\synthetic-capture-filesystem-snapshot.tar.gz'
```

The archive listing contained `Photos/dummy-photo.jpg`, `Photos/dummy-photo-copy.jpg`, `Videos/dummy-video.mp4`, and `orphan-dummy.bin`. The generator re-opened both persisted snapshots and verified their hashes before writing the manifest. Independent `Get-FileHash` checks reproduced the recorded database, archive, and inventory digests. The focused `captureMigrationManifest.test.ts` suite passed **3/3**, and `npm --prefix server run typecheck` passed with **0 diagnostics**. The approved destination path `server/storage/AdminArchive/Captures/` remains absent. No real files were copied, moved, renamed, or deleted; no capture records or media indexes were changed.

This procedure is reproducible in a fresh isolated workspace by running `node --import=./server/node_modules/tsx/dist/loader.mjs server/scripts/createSyntheticCaptureMigrationManifest.ts`; it will refuse to replace these named outputs, so use a separately reviewed new fixture version/output name for another run. A real data-specific manifest remains blocked on the five explicitly supplied staging-only inputs and confirmed non-secret roots documented above.

### 19.7 Isolated synthetic staging handoff fixture

The required real-staging input names were checked at the exact handoff directory `server/storage/AdminArchive/StagingInputs/2026-10-21/`. All five remain absent there. To resolve the test-fixture portion without fabricating real staging evidence, a separate, explicitly labelled package was generated under `server/storage/AdminArchive/StagingInputs/2026-10-21/SyntheticFixture-2026-10-21-v2/`. It uses the five required basenames but is nested under `SyntheticFixture-2026-10-21-v2`, and its export/root/inventory data explicitly identify `sourceEnvironment: "synthetic-test"` and `syntheticOnly: true`. Do not move these files into the handoff root or treat them as staging evidence.

The generator `server/scripts/createSyntheticStagingHandoff.ts` creates a temporary `mongodb-memory-server` instance using only a loopback URI and database name `synthetic_capture_fixture`; it binds the existing `Capture` schema, verifies the collection is `captures`, inserts four dummy records, reads those records back from that isolated database, and stops the instance. Its binary cache and source fixture are contained in a unique temporary directory that is removed on exit. No `.env`, external database URI, production database, or existing capture data is read. The exact Capture fields are the model fields documented in Section 17.2: required `id`, `userId`, `mediaType`, `fileName`, `userCapturePath`, `adminArchivePath`, `fileSize`, `userSaved`, `adminArchived`, `archiveExpiry`, `deleted`, `timestamp`; optional `archiveConsentAt`, `deletedAt`, `error`.

The `.archive.gz` synthetic database artifact contains a gzip-compressed JSON logical export of the four in-memory test records, with an internal synthetic marker; it is **not** a MongoDB Database Tools `mongodump --archive --gzip` binary archive and is not a real database snapshot. The filesystem ZIP is a real archive of four dummy files (two duplicate-content photos, one video, one orphan). A separate inventory maps all four files by the explicit dummy root ID, relative path, byte size, and SHA-256. The record export and root/inventory artifacts also carry synthetic markers. Temporary absolute fixture paths in the persisted export and manifest are redacted as `<DISPOSABLE_SYNTHETIC_TEMP>` after verification.

| Synthetic fixture artifact | SHA-256 |
|---|---|
| `capture-record-export.staging.json` | `4fd6440c854029f074f7423b1dc6351220fabd37e96fac692022eae9c416f507` |
| `capture-database-snapshot.archive.gz` (synthetic gzip JSON, not mongodump) | `5f8cf1a298588548be7ff51e17139067e1e6591104766be1657c39ebca69be4b` |
| `capture-filesystem-snapshot.zip` | `da5167c95eaa736dc73fd015c1f8409eace6cca62f28b7da86c44967953d9e33` |
| `staging-source-roots.json` | `72b2c92630c3c9c4c9c38f938e6dab51e19b5bfb1408006c37d93aa4c733d6f9` |
| `capture-filesystem-inventory.json` | `09c2d8a3a6ca04036bff1d82587b1ef1b1898d50f0353fccdecc020284ba8667` |
| `capture-migration-manifest.synthetic.json` | `451dbb8f2b5d6403af37d68d7e828b29f83c3fbd769c3ef49f81acf07cf0b78a` |

Verification evidence:

| Check | Result |
|---|---|
| `node --import=./server/node_modules/tsx/dist/loader.mjs server/scripts/createSyntheticStagingHandoff.ts` | Completed against an isolated loopback MongoDB test process; `captures` collection; 4 dummy DB records and 4 inventory entries. |
| Gzip payload inspection | Synthetic marker present; `sourceEnvironment: synthetic-test`; collection `captures`; 4 records. Not a mongodump-format archive. |
| ZIP extraction + inventory comparison | **4/4** dummy entries exist and match inventory byte sizes and SHA-256 hashes. |
| Synthetic manifest generation | 4 records; 3 source files verified; 1 intentionally missing record; 1 duplicate hash group; 1 orphan file; 0 destination conflicts. |
| `node --import=./server/node_modules/tsx/dist/loader.mjs --test server/tests/captureMigrationManifest.test.ts` | **3 passed, 0 failed.** |
| `npm --prefix server run typecheck` | **Passed; 0 strict TypeScript diagnostics.** |
| Exact real staging handoff names at parent directory | **5/5 absent**; synthetic files exist only in the separately named child fixture. |
| Approved target | `server/storage/AdminArchive/Captures/` remains absent; no target directories or files were created. |

The synthetic package demonstrates the documented record shape and manifest validation but does not satisfy the real staging database archive requirement, prove any real source root, or identify staging records/media. Next action: supply the five actual staging-only artifacts at the parent handoff directory, created from the isolated staging system by its operator; ensure the database archive is a restorable MongoDB Tools snapshot, filesystem snapshot and inventory correspond to the same paused-write window, roots are confirmed from non-secret staging configuration, and all exported records have their actual `CaptureModel` fields. Do not provide production paths, credentials, `.env`, or personal media. Until then, no data-specific manifest or migration is complete; actual migration/deletion remains separately unauthorized.

### 19.8 Final staging readiness status

The current evidence is **synthetic only**: `capture-migration-synthetic-2026-10-21-v7.json` records `sourceEnvironment: "synthetic-test"` and `syntheticOnly: true`. It is not a data-specific migration manifest. The real input check at `server/storage/AdminArchive/StagingInputs/2026-10-21/` found all five required top-level files absent; the separately nested `SyntheticFixture-2026-10-21-v2/` package is explicitly excluded from the real handoff.

Required real staging handoff files and expected contents:

| Exact filename | Required format/schema |
|---|---|
| `capture-record-export.staging.json` | JSON `capture-record-export-v1` envelope: `sourceEnvironment: "staging"`, `syntheticOnly: false`, UTC `exportedAt`, `stagingSnapshots.database` and `.filesystem` evidence (artifact IDs, exact absolute artifact paths, SHA-256, `verified: true`, `isolated: true`; filesystem also lists all `sourceRootIds`), confirmed `sourceRoots: [{id,path}]`, and `records` from the `captures` collection. Every record uses the exact Section 17.2 `CaptureData` fields; `archiveConsentAt`, `deletedAt`, and `error` are optional. No media bytes, credentials, or unrelated collections. |
| `capture-database-snapshot.archive.gz` | Genuine restorable MongoDB Database Tools archive made from the isolated staging database with `mongodump --archive=... --gzip`; verify restore into a separate disposable verification DB and compare collection/count/records. A gzip JSON file is not equivalent. |
| `capture-filesystem-snapshot.zip` | Consistent, read-only archive of all confirmed old capture roots, preserving paths. Quiesce writes or snapshot at the same maintenance window as the DB export; do not use mirror/delete behavior. |
| `staging-source-roots.json` | JSON provenance/map identifying each unique root ID and absolute staging path, with an explicit staging-only source and confirmation. Roots must be supplied/confirmed by the staging operator from non-secret staging configuration; no `.env`, production config, credentials, or guessed paths. |
| `capture-filesystem-inventory.json` | JSON inventory keyed by `sourceRootId` and relative path, including file size and SHA-256 for each regular file; no-follow symlinks or mark unresolved, and account for missing, duplicate-content, and unreferenced files. Must correspond to the filesystem snapshot. |

Safe handoff: the staging operator pauses capture writes, confirms the isolated staging DB identity and effective capture roots from explicitly supplied non-secret staging configuration, creates the database and filesystem snapshots during the same consistency window, exports only the `captures` records using the exact schema above, and records SHA-256 for each exact artifact. The operator restores the DB archive into a different disposable database and independently checks filesystem inventory hashes. Place the five verified artifacts in the private project-scoped handoff directory; do not send secrets or media in chat. The local review will validate provenance markers, matching hashes, root containment, record/source presence, duplicates/orphans, and destination conflicts using the existing read-only generator. A mismatch or unresolved root/file blocks affected entries.

No genuine staging artifacts were supplied, so a data-specific manifest is **blocked** and **no real migration has been validated**. The approved target remains `server/storage/AdminArchive/Captures/Photos/` and `Videos/`; it was not created. Existing readers must continue using each record's stored `adminArchivePath` until separately approved copy and verification; the manifest preserves the old path as the rollback value. This readiness pass did not copy, move, rename, overwrite, or delete files, update capture records or media indexes, deploy, or perform any real migration. Any migration or deletion still requires separate explicit approval.

### 19.9 Read-only validation attempt for supplied staging handoff

Checked only the explicitly requested directory `server/storage/AdminArchive/StagingInputs/2026-10-21/`. The five exact required top-level files were each absent:

| Required artifact | Present |
|---|---|
| `capture-record-export.staging.json` | No |
| `capture-database-snapshot.archive.gz` | No |
| `capture-filesystem-snapshot.zip` | No |
| `staging-source-roots.json` | No |
| `capture-filesystem-inventory.json` | No |

The only child directories observed in that handoff directory were `SyntheticFixture/` and `SyntheticFixture-2026-10-21-v2/`; neither was inspected or used as a substitute because synthetic inputs are not genuine staging evidence. With all five actual artifacts missing, provenance, export/snapshot consistency, source-root identity, and artifact SHA-256 checks cannot be performed; the data-specific read-only manifest generator was therefore **not run**. No source paths, hashes, capture records, inventory findings, or conflict results are claimed for staging.

The approved `server/storage/AdminArchive/Captures/` destination was confirmed absent. The existing generator's planned compatibility/rollback contract remains: retain the original stored `adminArchivePath` while copying, keep existing readers on that path until metadata is separately updated, require an explicit alias if a source is later removed, and preserve the original `adminArchivePath` as rollback value; source deletion is not authorized. Destination containment and overwrite-conflict evaluation for real records remain unverified until the genuine export and confirmed roots are supplied.

**Blocker / next action:** the staging operator must place all five genuine, mutually consistent, staging-only artifacts at the exact handoff directory. The database file must be a restorable MongoDB Tools archive (not synthetic gzip JSON); the database export, filesystem snapshot, root mapping, and inventory must share a verified staging provenance and consistency window, and snapshot hashes must match. Then the existing read-only generator can be run without creating destination directories or changing records/files. Until that happens, there is no real staging manifest and no real migration has been validated.

### 19.10 Local isolated setup plan (not executed)

No separate local staging environment is explicitly configured. `server/config/dbConfig.ts` accepts any supplied `MONGODB_URI`; in development with no URI it tries the ordinary local `win11portfolio` database. Its opt-in memory fallback in development uses the project storage path `server/storage/.development-db`. Therefore, do not start the application with its default environment for a staging rehearsal, and do not enable `ALLOW_IN_MEMORY_DB` for this purpose. `server/loadEnv.cjs` loads `server/.env` when the normal development script starts; no `.env` values were read for this assessment.

`server/testEnv.cjs` is useful precedent: tests remove `MONGODB_URI`, force `NODE_ENV=test`, and direct storage under a process-specific OS temporary directory. The current `createSyntheticStagingHandoff.ts` similarly starts a dedicated `MongoMemoryServer` with a loopback URI and the database name `synthetic_capture_fixture`, and creates dummy source media under a unique OS temp directory. Its original fixed output path under `server/storage/AdminArchive/StagingInputs/...` was not suitable for the requested isolation. Following explicit approval, the runner now accepts `--output-dir` and defaults to a unique directory under the OS temp folder; it rejects paths outside the OS temp root or inside the project workspace. Manifest destination paths are calculated under a synthetic storage root within that isolated output tree, and the approved project destination is not created. `assertPrivateStoragePath` alone blocks public build directories but does not itself ensure separation from ordinary portfolio storage. The gzip JSON artifact remains synthetic data and is not a restorable MongoDB Tools archive.

Safest local rehearsal plan, subject to explicit approval before setup:

1. Use the existing in-memory Mongo test pattern, not a connection to the normal or any hosted database. Use a synthetic-only DB label such as `win11portfolio_staging_fixture` and verify the generated URI is loopback-only before connecting. Do not set `MONGODB_URI`; do not enable memory fallback through the server startup path.
2. Use a unique private temporary root outside the repository, e.g. `$env:TEMP\windows-portfolio-staging-fixture-<unique-id>`, for dummy media, snapshot staging files, and generated outputs. Do not use `server/storage`, `client/public`, or `client/dist`. Explicitly set every storage override used by a future fixture runner (`PORTFOLIO_STORAGE_DIR`, `USER_CAPTURE_ROOT`, `ADMIN_ARCHIVE_ROOT`, `CAPTURE_ARCHIVE_ROOT`, and `PORTFOLIO_BACKUP_DIR`) beneath that one temporary root, and confirm canonical paths remain contained before any write.
3. The runner's output-root isolation is now implemented. It still refuses all pre-existing artifact names and marks records/snapshots synthetic. Its generated artifacts remain after the invocation in the selected temporary output folder; its separate MongoDB binary cache and working fixture are cleaned up at exit.
4. Generate one synthetic CaptureModel dataset and its four dummy media files; derive the export, database fixture snapshot, filesystem ZIP, root map, and file inventory from that same dataset/root. The runner must write a clear `sourceEnvironment: "synthetic-test"` and `syntheticOnly: true` marker, extract the ZIP to another temporary subdirectory, and compare every inventory relative path, byte count, and SHA-256. Generate the read-only manifest using the existing generator, retaining its source-path compatibility and rollback mappings.
5. Keep the real staging handoff path reserved for actual staging-only artifacts. A real MongoDB Tools archive, actual staging roots, and actual captures can be asserted only by the staging operator; a synthetic rehearsal cannot create or prove them.

To generate a new synthetic-only fixture after the user separately approves running it:

```powershell
$stageRoot = Join-Path $env:TEMP ('windows-portfolio-staging-fixture-' + [guid]::NewGuid().ToString('N'))
# This only chooses an isolated temporary output location; it does not represent real staging data.
node --import=./server/node_modules/tsx/dist/loader.mjs server/scripts/createSyntheticStagingHandoff.ts --output-dir "$stageRoot"
```

The output directory must be under the Windows OS temp directory and outside the project workspace. The runner uses `MongoMemoryServer`, not a persistent local or hosted database. On first execution, the package may need to obtain its MongoDB test binary; if that prerequisite is unavailable, stop rather than substitute a configured database. The runner was type-checked after the output-root change, but it was deliberately not executed here: no temp output directory was created, no synthetic database started, and no snapshots were regenerated. No real staging configuration is implied.

### 19.11 Approved synthetic rehearsal execution (21 October 2026)

After explicit approval limited to running the synthetic rehearsal, the runner's path check was inspected before execution:

- The command supplied a fresh unique directory under Windows `%TEMP%`: `C:\Users\ANISHJ~1\AppData\Local\Temp\windows-portfolio-staging-fixture-ed5c3fab0d9d422ba0998b9f693dac53`.
- The runner canonicalizes the requested output path and rejects paths outside `os.tmpdir()` and paths inside the project workspace. Relative paths and unknown arguments are rejected.
- The six generated artifacts are written only under that temporary output directory. Its manifest points to a synthetic storage root inside that same directory. It does not use the project's normal `server/storage`, `client/public`, `client/dist`, or the approved real destination.
- The runner starts a dedicated `MongoMemoryServer` with database name `synthetic_capture_fixture`, checks its URI is loopback-only, and inserts only four hard-coded dummy records. Four hard-coded dummy media files are created in its disposable temporary working area. It does not call the application's `connectMongo`, inspect environment configuration, or connect to a persistent database.

Execution completed successfully:

```powershell
$stageRoot = Join-Path $env:TEMP ('windows-portfolio-staging-fixture-' + [guid]::NewGuid().ToString('N'))
node --import=./server/node_modules/tsx/dist/loader.mjs server/scripts/createSyntheticStagingHandoff.ts --output-dir "$stageRoot"
```

Generated artifact checksums (independently recomputed with `Get-FileHash -Algorithm SHA256`):

| Artifact | SHA-256 |
|---|---|
| `capture-record-export.staging.json` | `12da53504d520db93aa2d3b58f30b928c2d9fd07e0c221b94aae61581633f904` |
| `capture-database-snapshot.archive.gz` | `5725b9ea4100683ecfceba7254fa47382441d674374cb65f2ecaa3f8fb90641f` |
| `capture-filesystem-snapshot.zip` | `13dc9a3f88cb245587fd521d186bc13b171b1e085400699ffc00eb3d27d2b045` |
| `staging-source-roots.json` | `7b054870e63ec43a911421b86a2a8ef0030878afa3be5c0340c3e2d9b1edec26` |
| `capture-filesystem-inventory.json` | `573ce005339d9da57ec32779b4c69761ee4df60e6dfe3367bb0c6f183523c63a` |
| `capture-migration-manifest.synthetic.json` | `ce7d390a0863da1c44db525f45fb3e66db8a3e161719c4c2aa147c7728eb35f3` |

Independent verification confirms the export and DB snapshot are marked `synthetic-test` / `syntheticOnly: true`; the gzip payload identifies `synthetic_capture_fixture`, collection `captures`, and 4 dummy records. The filesystem ZIP was extracted to a separate verification temp directory and all **4/4** inventory entries matched their byte sizes and SHA-256 hashes. The manifest says `sourceEnvironment: synthetic-test`, `syntheticOnly: true`, and `manifest-only-no-copy-no-database-write`; it contains 4 entries, 3 verified dummy sources, 1 intentionally missing source, 1 duplicate group, 1 orphan, and 0 destination conflicts. The generated manifest destination is under the synthetic storage root only.

Follow-up checks: `npm --prefix server run typecheck` passed with 0 diagnostics; the focused `captureMigrationManifest.test.ts` suite passed **3/3**. The project-approved destination `server/storage/AdminArchive/Captures/` remains absent. No persistent DB, real staging input, project storage directory, public/build directory, capture record, media index, or real file was changed. No real migration was validated. The generated artifacts are synthetic rehearsal outputs only and do not replace the five required genuine staging inputs.

## 20. Production-readiness baseline audit (21 October 2026)

### Scope and evidence limits

This is a read-only baseline. It did not read `.env` files, credentials, or production configuration; connect to a database or external service; inspect the previously mentioned analytics event; change application code/configuration; deploy; or modify user data. Existing synthetic migration evidence remains synthetic-only and is not evidence about staging or production. The workspace has no Git repository metadata available, so tracked/untracked status and remote CI configuration could not be verified.

The following safe checks ran during this audit:

| Check | Result |
|---|---|
| `npm --prefix server run typecheck` | Passed; exit 0. |
| `npm --prefix client run typecheck` | Passed; exit 0. |
| `node --import=./server/node_modules/tsx/dist/loader.mjs --test server/tests/httpSecurity.test.ts` | Passed 10/10. Tests cover production CORS/CSP, trusted-proxy parsing, proxy address/redirect policy, and response bounds. A deliberate oversized-response test emitted its expected `[ContentProxy] Fetch failed` diagnostic; the test passed. |
| Client production build to a newly generated `%TEMP%` directory | Passed; Vite 6.4.3 transformed 2,775 modules and emitted 57 files (16,842,351 bytes total). No `.map` files were present. The exact temporary output was removed after inspection. |
| `npm --prefix server audit --offline --json` | Exit 0; reported 0 vulnerabilities across 322 dependency entries. Offline/cached advisory coverage and freshness are unknown; this is not a current online advisory check. |
| `npm --prefix client audit --offline --json` | Exit 0; reported 0 vulnerabilities across 240 dependency entries. Offline/cached advisory coverage and freshness are unknown; this is not a current online advisory check. |
| CI configuration discovery | The workspace root listing showed no `.github` directory or recognized root CI YAML/Jenkinsfile; `.github/workflows` was absent. This bounded check does not establish whether an external CI service is configured. |

The database-backed test scripts were not run: the package scripts preload `server/testEnv.cjs`, which in turn loads the environment file. Running those scripts would conflict with the explicit no-`.env` constraint. The focused HTTP suite was invoked directly and did not use that preload. The previous synthetic rehearsal checks remain valid historical evidence; they were not repeated.

### Findings

Status meanings: **verified** means directly supported by code/configuration or a completed check; **partial** means protections exist but do not close the full operational or failure case; **unknown** means this workspace-only audit could not establish the fact; **failed** means a check did not pass. Severity describes practical risk, not proof of exploitation.

| ID / area | Status / severity | Evidence and practical impact | Next action | Safe local verification |
|---|---|---|---|---|
| S1 — Authentication and admin authorization | **Partial / Medium** | `server/middleware/auth.ts`, `server/services/sessionService.ts`, and `server/services/authService.ts` implement server-side sessions, role checks, CSRF validation, and session revocation. The current reset flow marks a token used before updating the password and revoking sessions; a later storage failure can consume the token or leave existing sessions active after a password change. This is a reliability/security edge case, not evidence of an observed incident. | Make password update, token consumption, and session invalidation failure-safe (transaction where supported or an explicit recoverable sequence); surface partial failure without reporting success. | Isolated MongoDB tests with injected failures at each reset step; do not use a persistent database. |
| S2 — Capture upload resource controls | **Partial / High** | `server/routes/captures.ts` exposes `POST /api/captures` through `optionalAuth`; uploads use Multer memory storage with a 100 MB per-file cap. Consent is required and extension/MIME are checked, but this route has no route-specific rate/concurrency budget and accepts generic `image/*`, `video/*`, or `application/octet-stream` based on client-provided MIME (no content signature check). Concurrent anonymous requests can consume substantial memory, and MIME alone is not proof of file type. | Add shared per-IP and concurrency/aggregate-byte limits before buffering; consider bounded streaming to private storage and media signature validation; add monitoring and a clear retention policy. | Local HTTP tests with dummy files for rate limits, concurrency, MIME spoofing, and byte ceilings. |
| S3 — Backup restore atomicity | **Partial / Medium** | `server/routes/admin.ts` validates backup type, SHA-256 integrity, project IDs, media base64, signatures, and byte ceilings. The restore path updates content/projects, then contacts/users; rollback restores content/projects and attempts to remove new media, but does not restore contact/user updates if a later operation fails. A partial failure can therefore leave a mixed dataset. No restore-failure-injection test was run in this audit. | Snapshot/restore every changed collection or use a database transaction where deployment topology supports it; keep file rollback explicit and report incomplete rollback. | Run a restore success/failure matrix only against isolated disposable MongoDB and temp storage, with injected failures after each write stage. |
| S4 — Deployment/API topology | **Unknown / High release blocker if Netlify is the only host** | `netlify.toml` builds and publishes only `client/dist` and has a catch-all SPA rewrite; it contains no `/api` proxy or server function configuration. The Vite `/api` proxy is development-server-only (`client/vite.config.ts`). Therefore the inspected Netlify config alone does not deploy the Express API. | Confirm the intended API host, durable database/storage, TLS, origin allowlist, proxy hop count, and explicit `/api` routing before release. Do not deploy until the frontend/API topology is documented and tested. | Use an isolated staging deployment or local reverse proxy with dummy data; verify API routes, cookies, CSRF, and health behavior end to end. |
| S5 — Database and durable storage topology | **Unknown / High operational blocker** | `server/config/dbConfig.ts` accepts a supplied `MONGODB_URI`; development otherwise targets the ordinary local `win11portfolio` DB, with an opt-in local disk fallback. The project does not establish from inspected configuration that a separate staging database or durable production storage volume exists. The five genuine staging handoff artifacts remain absent per Section 19.9. | Obtain operator-confirmed staging/production topology and durable-volume, backup, restore, and rollback evidence. Keep real migration blocked until the genuine staging package is supplied and validated. | Verify only in a separately identified staging environment with disposable restore targets; synthetic rehearsal cannot prove real topology or data. |
| S6 — Dependency advisories | **Partial / Low residual uncertainty** | Both offline `npm audit` commands exited successfully and reported zero advisories; package manifests/lockfiles were not changed. Offline cache freshness and completeness are unknown. | Run a current advisory check in an approved environment before release and record the date/lockfile identity. | Yes, using the package manager in a network-approved non-production environment; no install or automatic fix during this audit. |
| S7 — Build artifacts and performance | **Partial / Medium** | The TEMP production build succeeded and emitted no source maps. It produced 57 files totaling about 16.8 MB before compression; the logged `vendor-lucide.js` chunk was about 854 KB and the PDF worker about 1.38 MB. No browser/network performance trace was run, so user-perceived performance is unknown. | Measure route-level transfer/parse costs on representative devices; consider icon imports and PDF worker loading only if measurements justify it. | Local browser performance profiling against the production build. |
| S8 — Sensitive backup/build artifacts | **Partial / Medium** | `.gitignore` excludes `full-backup-*.json`, `server/storage/`, `client/dist/`, and server bundles/maps. A root-level file matching the full-backup naming pattern was present in the directory listing; its contents were deliberately not opened. The ignored pattern is protective if Git is later used, but the absence of Git metadata means tracked status and contents are unknown. Netlify publishes only `client/dist` in the inspected configuration. | Treat the root backup as sensitive; verify locally that it is stored privately and excluded from any future source-control/hosting upload. Do not publish its contents. | Check repository/index and deployment artifact membership in the actual version-control/deployment environment without opening the backup. |
| S9 — Public content proxy | **Partial / Medium** | `server/services/contentProxy.ts` contains public-IP/redirect/port checks and time/response bounds, and the 10 focused HTTP security tests passed. The audit did not verify a route-level quota or production abuse monitoring for the user-controlled public-content proxy. | Confirm request quotas, caching, and monitoring are appropriate for the intended public endpoint. | Local route tests with a stubbed resolver/fetcher and bounded request volume. |
| B1 — MongoDB startup and configuration | **Partial / High operational dependency** | `server/config/dbConfig.ts` fails startup when required persistence is unavailable rather than claiming a persistent write succeeded. The ordinary development fallback and arbitrary URI setting mean environment identity still depends on supplied runtime configuration, which was intentionally not inspected. | Make deployment configuration identify database name/host and storage roots through reviewed non-secret deployment metadata; test startup failure and readiness against isolated dependencies. | Local isolated startup tests with explicit test-only values and no `.env` preload. |
| B2 — File/path handling | **Partial / Medium** | Private storage/path containment and upload bounds exist in `server/services/fileService.ts`, `server/services/windowsStorageService.ts`, and `server/routes/files.ts`; admin portfolio media additionally checks MIME, extension, and magic bytes. Generic authenticated virtual-file uploads use memory buffering up to 50 MB, reject a blocked-extension list, and normalize path text; the full range of VFS retrieval/serving behaviors was not exhaustively exercised here. | Keep VFS paths as logical metadata only; test traversal, symlink, overwrite, and served-content behavior end to end before release. | Yes, using temp-root tests and dummy files. |
| B3 — Retention and backup coverage | **Partial / Medium** | `BackupService.isAutomatedScheduled()` returns `false`; backup creation is manual. `run30DayRetentionCleanup()` is invoked from an admin route, not shown as a scheduled job. Portfolio backups protect integrity but do not establish backup/recovery of the separate Camera `CaptureModel` archive. | Document an operator-run backup schedule, off-host retention, restoration cadence, RPO/RTO, and separate camera archive backup/recovery policy. | Restore drill with disposable database and storage snapshots; never test by overwriting live data. |
| F1 — Frontend routes, loading/errors, accessibility, responsive layout | **Partial / Medium evidence gap** | Client TypeScript and production build pass. `client/src/components/common/ErrorBoundary.tsx` exists, and targeted component searches show ARIA/error/loading affordances, but this audit did not perform a route-by-route keyboard, screen-reader, viewport, or browser error-state review. | Run a documented route/device accessibility and responsive test pass, and add automation for critical journeys. | Yes, with local browser/Playwright against dummy data. |
| O1 — Health/readiness and monitoring | **Partial / Medium** | `/api/health` returns `status: ok` without checking database/storage; `/api/health/admin` checks DB ping and storage and is admin-protected. This is useful process liveness plus private diagnostics, but no deployment-specific readiness integration, alerting, log retention, or monitoring evidence was supplied. | Provide a readiness endpoint suitable for the selected host without exposing internals publicly; define structured logs, alerts, and incident/restore ownership. | Local dependency-down tests plus a staging health-check integration test. |
| O2 — CI and release gates | **Unknown / Medium** | No recognized root CI file or `.github/workflows` directory appeared in the bounded workspace listing. Package scripts provide TypeScript checks and several tests, but the principal server test scripts load `server/testEnv.cjs`, which loads the environment file. No CI execution evidence was available. | Confirm the actual CI provider, then add safe secret-free checks for typechecks, focused tests, build, and dependency advisories. Provide an isolated test environment that does not read developer `.env` files. | Yes, in CI with ephemeral services and synthetic fixtures. |

### Existing protections confirmed

- Production HTTP security configuration explicitly builds CSP directives, exact configured-origin CORS, and proxy-hop validation; `server/server.ts` enables Helmet and defaults proxy trust to disabled. The focused suite passed 10/10.
- Authentication is based on opaque server-side sessions, backend role checks, CSRF validation, and hashed session identifiers; reset/change-password flows attempt to revoke sessions.
- File and portfolio media uploads have explicit byte ceilings; portfolio media also checks file signatures. Private-storage containment and exclusive backup creation/integrity checks are implemented.
- The read-only capture migration generator and synthetic rehearsal are isolated; the rehearsal is explicitly synthetic-only and no real migration has been validated.
- Client and server TypeScript checks pass; the client production build passes in TEMP and emitted no source maps.

These controls reduce risk but do not prove security, recoverability, or production readiness by themselves.

### Superseded historical statements

The initial executive summary in Section 1 says CSP is disabled, production CORS accepts any `.run.app` origin, and the rate limiter is process-local. Those statements are historical and are superseded by later implementation and test evidence: current `server/config/httpSecurity.ts` configures production CSP and exact origins, and the current shared rate-limit service uses MongoDB buckets. Do not use those old statements as current findings. This dated baseline is the current evidence summary; earlier staging sections remain valid only for the synthetic rehearsal and the missing-real-input status.

### Prioritized Phase 2 fixes

1. **P0 — Confirm and test the real deployment topology.** Identify the API host/rewrite, database, persistent storage, TLS, allowed origins, proxy hops, secret delivery, and health/readiness integration. The checked Netlify configuration alone serves the static client and does not establish an API deployment.
2. **P1 — Bound public capture-upload resource use.** Add route-level rate/concurrency/aggregate limits and stronger content validation before large memory allocation; cover it with dummy-file tests.
3. **P1 — Make restore/reset failure handling complete.** Ensure all affected DB collections, files, reset tokens, and sessions are either completed or recoverable after injected failures.
4. **P1 — Define real backup/recovery operations.** Establish scheduled/off-host backups, retention, camera archive coverage, and a tested isolated restore/rollback runbook with measured RPO/RTO.
5. **P2 — Establish CI and secret-free test execution.** Ensure test commands do not load developer `.env` files; run typechecks, focused tests, build, and current dependency checks in an ephemeral CI environment.
6. **P2 — Validate frontend quality and operational observability.** Perform keyboard/screen-reader/responsive/browser tests, performance measurement, readiness integration, log retention, and alerting.
7. **P2 — Verify source-control and artifact hygiene.** Resolve the root-level backup's private handling and verify build/deployment artifact contents in the actual release system.

### Critical/high blockers and remaining unknowns

- No confirmed production API deployment/routing, database identity, durable storage, secret management, monitoring, or recovery drill is available in the inspected workspace. **Do not treat the portfolio as release-ready until these are confirmed.**
- The checked Netlify configuration is static-client-only; if that is the only hosting configuration, API-dependent production behavior is not established.
- Public camera capture uploads accept up to 100 MB into memory and lack route-specific rate/concurrency controls in the inspected route.
- Restore rollback does not cover every collection modified by the restore flow.
- Genuine isolated staging database/media roots and all five genuine staging handoff artifacts remain unconfirmed/missing; the synthetic fixture is not a substitute and no real migration has been validated.
- There are no findings classified critical in this bounded audit. Lack of a critical finding is not a security guarantee. The offline dependency results do not establish current vulnerability-free dependencies.

### Safest next step

Before any fixes or deployment, have the deployment/staging operator provide a short, non-secret environment map identifying the intended API host and routing, isolated staging database identity, durable media-storage root, health-check integration, and backup/restore owner—without sharing credentials or `.env` contents. Review that map before connecting to or changing any environment. Keep real migration and deletion blocked pending genuine staging artifacts and separate authorization.

## 21. Phase 1A environment readiness map (21 October 2026)

### Confirmed from checked-in documentation/configuration

| Topic | Evidence-based finding | Status / limits |
|---|---|---|
| Frontend hosting | Root `netlify.toml` builds with `npm --prefix client run build` and publishes `client/dist/`, with a catch-all SPA rewrite to `/index.html`. `README.md` explicitly describes this as the frontend hosting arrangement. | **Documented.** No live Netlify account/site or deployed version was inspected. |
| API hosting and routing | `README.md` says the Express API must also be deployed to a Node.js host and configured for the production frontend origin and database. The checked `netlify.toml` contains no API proxy/function route. `client/vite.config.ts` proxies `/api` to `http://127.0.0.1:3000` for Vite development only. | **Documented intent; actual API host, production URL, and frontend-to-API routing remain unknown.** The Vite proxy is not a production route. |
| Staging database | `server/config/dbConfig.ts` accepts `MONGODB_URI`; otherwise, non-production/non-test development attempts `mongodb://127.0.0.1:27017/win11portfolio`. No separate staging DB name/URI is identified in the inspected non-secret configuration or docs. | **Unknown / not explicitly configured in checked evidence.** No database was contacted and no `.env` was read. The synthetic rehearsal DB is isolated test data, not staging. |
| Private media/storage roots | `server/services/windowsStorageService.ts` defaults its base root to `server/storage` (relative to `process.cwd()`), overridable by `PORTFOLIO_STORAGE_DIR`. Derived roots are `UserCaptures`, `AdminArchive`, and `Portfolio/Captures`; `USER_CAPTURE_ROOT`, `ADMIN_ARCHIVE_ROOT`, and `CAPTURE_ARCHIVE_ROOT` can override those. `server/services/backupService.ts` places backups at `AdminArchive/Backups` under the base root unless `PORTFOLIO_BACKUP_DIR` overrides it. The README also documents `server/storage/` or configured roots for uploads/backups. | **Path derivation verified; effective runtime paths unknown.** No `.env` or runtime values were inspected. |
| Durable storage | `README.md` production checklist says to use persistent, writable storage for uploaded media and server backups, and to back up MongoDB and files together. | **Required, not established.** No cloud volume, mount, backup target, or durability test was identified. |
| Health/readiness endpoints | `server/routes/health.ts` exposes public `GET /api/health` as a simple process response (`status: ok`). Admin-protected endpoints include `/api/health/admin` (DB ping + storage status and other operational details), `/api/health/storage`, and `/api/health/db`. `README.md` lists local `http://localhost:3000/api/health`. | **Endpoints verified; hosting integration/automated probes unknown.** The public endpoint is liveness, not a dependency-aware readiness check. Admin endpoints require a valid administrator session. |
| Local health check procedure | `README.md` starts the local combined app using `npm --prefix client run dev` and documents `http://localhost:3000/api/health`. It also documents `npm --prefix server run dev` for the API alone. | **Documented command only.** Not run as part of this task. These commands may load local environment configuration and connect to the configured/default development database; do not run them until the operator confirms the local target. A safe read-only HTTP check after an intentionally isolated local setup is `Invoke-RestMethod http://localhost:3000/api/health`; do not use the admin endpoint without a known local test account. |
| Backup creation | `README.md` describes manual backup/restore. `server/routes/admin.ts` exposes protected `/api/admin/backup/run`, download/export endpoints; `server/services/backupService.ts` writes integrity-protected JSON with exclusive file creation and SHA-256 verification. `isAutomatedScheduled()` returns `false`. Backup storage defaults to `AdminArchive/Backups` under the private storage root, or `PORTFOLIO_BACKUP_DIR`. | **Manual creation implemented; automated schedule not configured.** Backup includes portfolio data/assets as defined by the service, not proof of a complete MongoDB + all media recovery plan. |
| Restore and rollback | Protected `POST /api/admin/backup/restore` checks supported type, integrity digest, project/media fields, media signatures and size limits. On a later failure it attempts to restore portfolio content and projects and remove newly created media. The current recovery path does not restore contact/user writes if those have already succeeded before a later failure. | **Partial rollback coverage.** No restore was run and no restore drill/evidence is documented here. |
| Recovery owner | Checked README, architecture/security docs, API inventory, and backup implementation describe admin/operator features but do not assign a named person or explicit role/on-call owner for backup scheduling, restore approval, or incident recovery. | **Unknown / not documented.** Do not infer that the application administrator is the recovery operator. |

### Operator/user confirmations required

Provide only non-secret values; do not send connection strings, credentials, tokens, `.env` contents, private media, or backup contents.

1. **Frontend:** confirm the intended Netlify site/domain and whether `netlify.toml` is the active production build configuration.
2. **API:** identify the Node.js host, public API origin, `/api` routing mechanism, TLS termination, and the configured exact frontend CORS origin(s). Confirm the reverse-proxy hop count through deployment metadata, not by sharing secrets.
3. **Database:** confirm whether a distinct staging database exists; provide only its environment label and database name/host identity (no URI or credentials), and confirm it cannot address production. Production and staging identities remain unverified.
4. **Storage:** confirm the effective private media, capture archive, and backup roots from non-secret deployment settings; say whether each is on durable storage, how it is backed up, and whether restore preserves files and permissions. The default `server/storage` path is not evidence of a persistent deployment volume.
5. **Health:** identify the host’s configured health probe, expected path/status, and whether it needs true readiness semantics (DB/storage dependencies), in contrast to the current public liveness endpoint.
6. **Recovery:** identify the person/role responsible for approving and executing recovery, backup cadence and off-host location, retention, tested restore date, and target RPO/RTO. Keep all secret material out of the response.

### Smallest safe Phase 2 implementation proposal (not approved or started)

Changes should be delivered as two focused, independently reviewable slices. No live migration, production connection, deployment, scheduled job, or real-data restore is included.

1. **Capture-upload resource limits first**
   - Add an explicit shared per-IP rate limit and a bounded in-flight/aggregate-byte budget for the public consented capture upload, enforced before Multer buffers large bodies where possible.
   - Keep current consent requirement, supported media extensions/types, response shape/status behavior, and the existing 100 MB single-file maximum unless a separately approved product decision changes it.
   - Add local isolated regression tests for anonymous consented upload success, absent consent, rejected media type/extension, exactly-at-limit and over-limit sizes, request-rate exhaustion, concurrent uploads, and cleanup after storage/metadata failure. Use dummy bytes, loopback-only test services, and temporary storage; assert existing successful behavior remains intact.
   - Prefer a shared existing limiter and common error conventions; any required behavior change (for example a new 429 response) must be explicitly documented and tested.
2. **Backup-restore rollback coverage**
   - Make the restore operation failure-safe for every collection it mutates (portfolio content, projects, contacts, users, media metadata/files); use a transaction only if supported by target MongoDB topology, otherwise snapshot and restore affected state with explicit incomplete-rollback reporting.
   - Keep SHA-256/format/media validation and existing successful restore semantics. Do not broaden which user records may be restored or delete unrelated files.
   - Add isolated regression tests for successful restore, invalid/integrity-failed backup (no writes), and injected failure after each write stage, asserting database collections, media files/index, and current administrator/session remain consistent or explicitly report a recoverable incomplete rollback.
3. **Gate before implementation:** get confirmation of the environment map and explicit approval for these code changes. Run the focused suites only against an isolated disposable database/storage harness that does not load `.env`; do not use configured persistent MongoDB or real backup/media data.

No code, configuration, tests, deployment, or data were changed for this Phase 1A update. No endpoint or database was contacted. The current check-in evidence does not establish a separate staging DB, durable deployment storage, live API routing, health-probe integration, or recovery ownership. **Wait for user/operator confirmation and explicit Phase 2 approval before proceeding.**

## 22. Phase 2A capture-upload hardening (21 October 2026)

### Scope and implementation

Only the consented capture-upload middleware and its focused persistence test were changed. Backup/restore code, global HTTP middleware, unrelated upload routes, deployment configuration, and the supported 100 MiB file-size maximum were not changed.

In `server/routes/captures.ts`:

- Kept `MAX_CAPTURE_UPLOAD_BYTES` at **100 MiB** and added a **100 MiB + 64 KiB** total multipart request limit. Declared `Content-Length` is rejected before Multer; streaming bodies are counted and rejected with HTTP 413 once the request limit is exceeded.
- Restricted the capture form parser to one file, two text fields (the existing consent and media type), 1 KiB per field, three total multipart parts, 100-byte field names, and 20 header pairs. Existing supported types, consent requirement, JSON response shape, and normal success status remain unchanged.
- Limited capture uploads to **one in-flight request per server process**. Additional uploads receive HTTP 429 with `Retry-After: 1` and the standard `{ success: false, error }` shape. The slot is released on response completion/disconnect.
- Preserved Multer memory storage; no temporary upload files are created. Oversized streamed input is unpiped from the multipart parser and drained after the 413 response; Multer also enforces the unchanged per-file 100 MiB cap.
- On persistence failure after the private archive is written, the route now attempts to remove any capture metadata and in-memory index entry before unlinking the archive file. If metadata rollback cannot be confirmed, it retains the private file rather than knowingly leaving a database record pointing to a deleted file, logs the failure, and returns an explicit recovery warning. File cleanup failures are also logged and surfaced as incomplete rollback.

### Focused regression verification

Ran `server/tests/capturePersistence.test.ts` directly with `tsx`, not through the package script that preloads `server/testEnv.cjs`. The test process set `NODE_ENV=test`, removed `MONGODB_URI`, disabled MongoMemoryServer runtime downloads, used an isolated loopback MongoMemoryServer, and directed every storage override to a unique `%TEMP%` fixture. Only dummy bytes were used; the exact fixture directory was removed after the run.

**Result: exit 0; all 15 focused assertions passed**, including:

- Exact 100 MiB dummy file accepted and persisted (compatibility boundary).
- Declared total request over the 100 MiB + 64 KiB request cap rejected with HTTP 413.
- Streamed file at 100 MiB + 1 byte rejected with HTTP 413.
- A concurrent upload during a delayed isolated metadata write rejected with HTTP 429/`Retry-After: 1`, while the first valid upload completed with HTTP 201.
- Existing unsupported format and explicit-consent errors preserved (HTTP 415 and 400); unauthenticated private listings/actions remain HTTP 401.
- Existing valid visitor capture behavior and admin archive behavior remain successful.
- Simulated unacknowledged metadata persistence returned HTTP 500 and removed the newly created archive file.
- Existing collision-safe archive naming and photo/video directory behavior passed.

`npm --prefix server run typecheck` passed after the final code changes with exit 0 and no diagnostics. No client code changed, so the client typecheck/build were not repeated.

### Compatibility and remaining risks

- The per-file maximum remains **100 MiB**; it has not been silently reduced. The total request allowance is slightly larger to account for multipart framing and existing fields.
- The new intentional behavior is serialization: only one capture upload can be actively parsed/persisted per server process; concurrent uploads receive 429 and should be retried. This avoids multiplying a 100 MiB memory buffer under concurrent requests but may reduce throughput.
- Concurrency accounting is process-local, not shared between multiple server replicas. A deployment with multiple workers can therefore admit one large upload per worker. No deployment topology or memory budget was supplied, and this audit did not connect to or profile production.
- There is no time-window limit on repeated sequential uploads in this slice. Storage quotas/retention, aggregate sustained bandwidth, and production abuse monitoring remain unverified.
- Memory storage remains in use, so a single accepted upload still has significant memory cost. The checks cap bytes and concurrency but do not replace a future measured decision about streaming to private storage.
- If MongoDB is unavailable during rollback after a persistence attempt, metadata removal cannot be confirmed; the route now explicitly warns and retains the archive for recovery. The focused test verified the unacknowledged-write cleanup path, not an actual database outage during rollback.

Phase 2A is complete and stopped here. **No backup-restore changes were made**; those remain Phase 2B and require separate approval. No production/external service was contacted, no `.env` or credentials were read, and no real media, records, indexes, or migration destinations were touched.

## 23. Phase 2B backup-restore rollback reliability (21 October 2026)

### Scope and implementation

Phase 2B changes are limited to the backup-restore route, the content-studio restore service, its isolated regression test, and this report. Phase 2A capture-upload behavior remains unchanged.

- `server/routes/admin.ts` serializes restore operations within one Node.js process. A concurrent request receives HTTP 409 and `Retry-After: 1`.
- Before the first restore mutation, the route snapshots the current published content, draft, complete project collection, and only the contacts/users whose IDs the backup will update. The currently authenticated administrator is excluded from user restoration.
- If a restore stage fails, compensation independently attempts to restore published content, draft, projects, targeted contacts/users, and the in-memory database indexes. It removes any revision created during the failed restore and attempts cleanup of newly restored media files, metadata, and media-index entries.
- Rollback steps are attempted independently. Failures are logged by affected area only; the error response is generic and contains no backup payload. If any compensation step fails, the endpoint returns a distinct incomplete-rollback warning rather than suggesting a clean rollback.
- `server/services/contentStudioService.ts` now waits for both published-content and draft writes to settle before propagating either failure. This prevents rollback from racing with an unfinished sibling write.
- Backup SHA-256 verification and existing compatibility behavior were retained: supported older backups without a digest remain accepted, while version `3.1.0` still requires a valid digest.
- `server/tests/backupRestoreRollback.test.ts` uses dummy records, an ephemeral loopback `MongoMemoryServer`, and a unique `%TEMP%` storage fixture. The test normalizes the legacy fallback skills into the current schema and waits for the ephemeral HTTP listener before sending requests. It does not load `.env`, use a persistent database, or use real media.

### Verification evidence

Commands run after the final Phase 2B changes:

- `node --import=./server/node_modules/tsx/dist/loader.mjs --test --test-reporter=spec server/tests/backupRestoreRollback.test.ts` — **exit 0; 8/8 tests passed** (the outer test plus seven subtests). Coverage includes successful checksummed restore, supported legacy no-checksum restore, corrupted-checksum rejection before mutation, rollback after media/content/project/contact/user mutations, delayed sibling content-write failure, rollback-failure reporting without backup contents, and concurrent restore rejection. Rollback assertions check database records, in-memory indexes, the dummy media file, and the media index.
- `node --import=./server/node_modules/tsx/dist/loader.mjs --test --test-reporter=spec server/tests/backupExportSecurity.test.ts` — **exit 0; 1/1 test passed**, preserving portable-backup redaction and checksum behavior.
- `npm --prefix server run typecheck` — **exit 0**, TypeScript strict typecheck passed.

The isolated restore test intentionally injects failures; its generic `[BackupRestore]` log messages and one explicitly injected rollback-failure log are expected test evidence. The test fixture is removed by teardown. No Phase 2A test was repeated because these changes do not alter the capture-upload path.

### Reliability limits and remaining risks

- MongoDB transactions were not introduced: transaction support is not verified for the eventual deployment topology. Compensation is best-effort recovery, not a database-wide atomic transaction. A process crash, database outage, or filesystem failure during restore/compensation can still leave state requiring operator inspection.
- The concurrency guard is process-local. It prevents overlapping restores within one server process, but does not coordinate separate workers or API replicas; a multi-instance deployment needs a shared lock or deployment-level single-writer control before relying on the guard across instances.
- The regression suite exercises the intended mutation stages with isolated faults, including a deliberately failed rollback. It cannot establish production storage durability, production database behavior, multi-replica locking, or recovery from real infrastructure failures.
- A failed restore that has an incomplete rollback returns HTTP 500 with an explicit instruction to inspect database and media state before further edits. Do not retry blindly in that state.

Phase 2B implementation and local verification are complete. No production or external service was contacted; no `.env`, credentials, real backups/media, user records, indexes, migration destinations, or the previously mentioned analytics event were accessed or changed. Stop here for user review; deployment and further recovery hardening require separate approval.

## 24. Admin analytics pagination and future asset storage layout (21 October 2026)

### Implemented

- The admin analytics dashboard requests **10 recently opened app events per page** instead of 50. Its existing previous/next controls and server pagination metadata are unchanged; this makes those controls appear once there are more than 10 events.
- The default video poster SVG now lives at `client/public/videos/video-placeholder.svg`, beside the bundled video files. `MediaThumbnail` uses the new URL. The audio cover SVG remains inside `client/public/audio/`; wallpaper assets remain under `client/public/wallpapers/`.
- Rebuilt the frontend with Vite. `client/dist/` remains generated deployment output copied from `client/public/`; it is not a second editable source tree and is intentionally retained per the user’s choice.
- Added an allowlisted private `storageCategory` for new portfolio media uploads. Physical destinations under `server/storage/` are `Resume/`, `Profile/`, `Profile/Wallpapers/`, `Certificates/`, and `Project/`. Existing virtual media paths and `/api/portfolio-media/:id` URLs are preserved for compatibility. The matching directory is created when a file is written; no empty category placeholder files were added.
- Resume uploads from Media Management use `Resume/`; avatar, favicon, social image and skill-icon uploads use `Profile/`; default wallpaper uploads use `Profile/Wallpapers/`; certificate uploads use `Certificates/`; project images use `Project/`.
- New consented camera captures now default to `server/storage/AdminArchive/Captures/Photos/` or `.../Videos/`. Backup files already use `server/storage/AdminArchive/Backups/`; admin camera archive uploads already use the private `AdminArchive/` root.
- Updated legacy-media reconciliation to leave new categorized files where they were saved instead of moving them back into `Portfolio/Media/`.

### Explicitly preserved / not implemented

- Per the user’s selection, **existing storage is future-only**: no existing upload or other file was moved, renamed, or deleted. Existing files at the storage root and in `Portfolio/Media/` remain there. No claim is made that existing records have been reorganized.
- Backups, the verified synthetic capture-migration evidence, and unknown/unverified files were preserved. No duplicate file was deleted based solely on its name or apparent contents.
- Project Markdown remains the existing read-only virtual D: representation in the client. Per the user’s selection, it is **not** persisted as physical `server/storage/Project/*.md`; that folder is for project media uploads.
- `client/dist/` still contains generated copies of public assets after the build. This is expected Vite deployment behavior and is not a second source of static content.

### Verification

- `npm --prefix client run typecheck` — passed.
- `npm --prefix client run build` — passed; Vite regenerated `client/dist/`.
- `npm --prefix server run typecheck` — passed.
- `node --import=file:///E:/College/portfolio/windows-11-os-portfolio/server/node_modules/tsx/dist/loader.mjs --test --test-reporter=spec server\tests\fileStorageCategories.test.ts` — passed; verifies categorized private physical paths, original media URL/path compatibility, legacy default storage behavior, the capture-root default, and that startup legacy reconciliation does not move categorized files.
- Isolated `server/tests/capturePersistence.test.ts` run without `.env` preload, with `NODE_ENV=test`, `MONGODB_URI` removed, MongoMemoryServer runtime downloads disabled, and a unique `%TEMP%` storage root — passed all 15 capture assertions. Confirms the supported 100 MiB behavior, consent/authentication, cleanup and private archive behavior with the new default capture-root configuration.
- Build output contains the relocated video poster under both source `client/public/videos/` and generated `client/dist/videos/`, as expected.

## 25. Existing media migration preparation and test naming (21 October 2026)

This section supersedes Section 24's statement that the storage-category change is future-uploads-only. The migration mechanism is now implemented, but **no existing portfolio media has been migrated and no storage files, backups, or synthetic artifacts have been deleted**.

### Migration safeguards implemented

- `server/routes/admin.ts` exposes authenticated local-development-only endpoints at `/api/admin/storage/media-migration-plan` (read-only plan) and `/api/admin/storage/media-migration` (execution). Both require `NODE_ENV=development` and a MongoDB connection host of `localhost`, `127.0.0.1`, or `::1`; execution also rejects concurrent restore/migration operations in the process.
- The plan uses currently published/draft portfolio content and project references to map media IDs to the approved private categories. It rejects missing media metadata/files, unsafe source paths, duplicate destination paths, and existing destination conflicts without creating destination directories. It reports unclassified media separately.
- Execution rechecks source hashes, creates destinations exclusively, verifies SHA-256 after writing, updates MongoDB `diskPath` and the durable media index before removing source copies, and reports cleanup failures. If database/index rollback is incomplete, destination copies are retained so a record that may point to a new path does not lose its file.
- Virtual `Portfolio/Media/...` paths and `/api/portfolio-media/:id` URLs remain unchanged. The existing startup index recovery test confirms categorized files are not copied back into the legacy media folder.
- The migration is compensation-based, not transactionally atomic. It requires a single local server process and a recoverable local MongoDB/storage state; interruption or infrastructure failure still requires operator review.

### Test filename cleanup

- Renamed all **19** project-owned server tests in `server/tests/` and both client tests to descriptive kebab-case names.
- Updated the affected server/client `package.json` test-script paths. No dependency test files were renamed.
- The renamed isolated migration regression is `server/tests/file-storage-categories.test.ts`; it covers category paths/URL compatibility, legacy reconciliation, an isolated MongoMemoryServer migration, metadata/index recovery, repeated planning, pre-existing destination conflict, and missing-reference rejection.

### Validation and safety outcome

| Check | Result |
|---|---|
| Renamed isolated storage/migration test, run directly without the package environment preloader | **1 passed, 0 failed.** |
| Client capture-storage and virtual-D: tests, run directly | **13 passed, 0 failed.** |
| Server typecheck | **Passed.** |
| Client typecheck | **Passed.** |
| Existing `npm --prefix server run test:all` package runner | **178 backend, 20 comprehensive, and 51 E2E checks reported passed.** The package runner emitted that dotenv injected values from `server/.env`; no values were displayed or inspected, but this run is not evidence of a no-`.env` test environment and is not repeated. |
| Read-only project test inventory | **19 server and 2 client test files** are present under their renamed paths; package script references were checked. |

The focused migration test used a unique disposable temporary storage root and MongoMemoryServer test database with synthetic bytes. It does **not** validate or represent the user's actual local portfolio database or media.

No migration plan was obtained from the currently running local application, and no migration execution was attempted. The migration route and its authentication/development-host guard have not yet been exercised over HTTP. Section 26 records the subsequently approved backup and synthetic-artifact cleanup. Existing media, loose duplicate files, media indexes, and database records were not changed; the unclassified storage-audit report remains preserved.

**Safest next action:** start/restart the local development server with the updated code, then review the authenticated read-only `/api/admin/storage/media-migration-plan` result against the existing files before authorizing any move. Do not treat the synthetic service test as proof of a real migration.

No `.env` or credentials were read; no persistent database or external service was contacted. No deployment or media migration was performed.

## 26. Approved backup and synthetic-artifact cleanup (21 October 2026)

The user explicitly requested removal of the listed backup files and synthetic migration evidence, while preserving normal portfolio media and behavior. Before deletion, the existing private `.media-index.json` was parsed without opening backup contents: version **1**, **8 entries**, and every relative path resolved inside `server/storage/` to an existing file. This verified that the currently indexed media files remain available; it does not prove database/index agreement or provide a replacement restore point.

### Exact cleanup performed

- Deleted **9 backup JSON files**:
  - `server/storage/AdminArchive/Backups/backup-2026-10-14T20-50-12-050Z.json`
  - `server/storage/AdminArchive/Backups/backup-2026-10-14T20-50-33-559Z.json`
  - `server/storage/AdminArchive/Backups/full-backup-2026-10-11T20-08-01-900Z.json`
  - `server/storage/AdminArchive/Backups/full-backup-2026-10-14T20-50-27-826Z.json`
  - `server/storage/AdminArchive/Backups/portfolio-full-backup-2026-10-16T18-12-22-636Z.json`
  - `server/storage/AdminArchive/Backups/portfolio-full-backup-2026-10-16T18-40-40-854Z.json`
  - `server/storage/AdminArchive/Backups/portfolio-full-backup-2026-10-16T18-48-28-384Z.json`
  - `server/storage/AdminArchive/Backups/Windows-11-Portfolio-Backup-17-10-2026_03-31-00-AM.json`
  - `server/storage/Backups/skills-migration-2026-10-16T21-55-29-679Z.json`
- Deleted **22 synthetic-only files**: the three `synthetic-capture-*` files under `AdminArchive/Manifests/SyntheticCaptureFixture/`; the seven `capture-migration-synthetic-2026-10-21[-v2 through -v7].json` manifests under `AdminArchive/Manifests/`; and all six files in each of `StagingInputs/2026-10-21/SyntheticFixture/` and `SyntheticFixture-2026-10-21-v2/`.
- Only those 31 files were removed. No parent directories were recursively deleted. The unclassified `server/storage/AdminArchive/Manifests/storage-audit-2026-10-21.json` was preserved.

### Post-cleanup checks and compatibility impact

- All 9 named backup paths and all 22 named synthetic-file paths were verified absent.
- `.media-index.json` remains present; all **8/8** indexed paths still resolve to files contained within private `server/storage/`.
- No portfolio media file, duplicate loose file, database record, media index, source code, or destination directory was changed by this cleanup.
- Normal portfolio media serving and UI code were left unchanged. **The deleted backups are no longer available as historical download/restore points**, and startup recovery can no longer use those deleted snapshots as a fallback. This is an intentional consequence of the requested backup deletion; create a fresh backup before the next restore/recovery operation. The report does not claim that backup-history behavior is unchanged.
- No additional tests were run because this cleanup removed only the explicitly named data files and changed no application code. The earlier isolated migration and typecheck results remain as recorded above.

## 27. Storage layout, asset discovery, project Markdown, and email follow-up (21 October 2026)

This section records the latest implementation state and supersedes the older folder names and future-only upload-path details in Sections 24–25. Section 26 remains a historical record of the explicitly approved cleanup.

### Implemented

- New profile photos, favicon/social images, certificates, resumes, project media, consented captures, and backups now use these private roots:
  - `server/storage/Profile/`
  - `server/storage/Certificates/`
  - `server/storage/resume/`
  - `server/storage/Project/`
  - `server/storage/AdminArchive/CaptureImage/`
  - `server/storage/AdminArchive/CaptureVideo/`
  - `server/storage/Backup/`
- Startup services create the allowlisted category folders. The current read-only directory check confirmed all seven requested folders exist. This check did not inspect their contents.
- New legacy-backup listing still reads the existing supported legacy backup folders. The local migration plan now includes referenced media, archived captures, and supported legacy backups. An authenticated admin-only Backup panel control previews the counts and conflicts before a separately confirmed execution.
- Project draft Markdown is generated into `server/storage/Project/project-<id>.md` when draft projects are read/saved/published. Files contain an ownership marker; the synchronizer refuses to overwrite unrelated Markdown and only removes stale files carrying its own marker. The existing virtual D: project documents remain available.
- The Vite public-media manifest discovers supported files in `client/public/audio`, `videos`, `wallpapers`, and `downloads` at build time and watches for changes during development. These remain public source files and are referenced in the simulated D: drive; this does not move data from the computer’s physical C: drive.
- Removed the `client/public/technology-icons/` folder and rebuilt generated `client/dist/`; both source and generated folders are now absent. C# remains rendered from its inline icon and Anaconda remains available through the existing bundled Simple Icons catalogue.
- The admin reply and password-reset HTML templates now include mobile-responsive layout rules.

### Migration boundary and remaining work

- No existing media, capture, or backup file was moved by this implementation. No database record or media index was changed by the storage migration flow. Use the authenticated local-development preview first, inspect its listed file names/categories/conflicts, then explicitly confirm the migration in the Backup panel if the plan is correct.
- The migration endpoint is restricted to development with a loopback MongoDB host and revalidates the plan before it copies, hashes, updates references/indexes, and removes old copies. That local guard is not proof that an arbitrary local database is disposable or the intended database.
- The current migration plan classifies records already represented by portfolio metadata, capture records, and supported legacy backup names. Loose or unindexed files outside those records—including old storage-root duplicates—are not automatically classified or moved. Keep them until their ownership/category and destination conflicts are reviewed; do not assume the button organizes every file in `server/storage/`.
- The previous backup cleanup remains intentional and historical backups removed in Section 26 are not recoverable. Create a new backup before any restore or data-changing operation.

### Verification and safety notes

| Check | Result |
|---|---|
| Server TypeScript typecheck | **Passed.** |
| Client TypeScript typecheck | **Passed.** |
| Isolated storage-category, email-template, and virtual D: tests | **23 passed, 0 failed.** |
| Isolated generated Project Markdown tests | **2 passed, 0 failed.** Covers update, stale owned-file cleanup, preservation of unrelated files, and refusal to overwrite an unowned file. |
| Capture persistence regression | **Passed** against MongoMemoryServer with `NODE_ENV=test`, `MONGODB_URI` unset, runtime downloads disabled, and a unique temporary storage root; all capture assertions passed. |
| Skill catalogue and icon API tests | **2 passed, 0 failed.** The icon test verified 132 bundled brand SVGs and no failures after removing the public icon folder. |
| Vite production build | **Passed** using the Vite build API with an empty temporary `envDir`; project `.env` files were not loaded. The build regenerated `client/dist/` without `technology-icons/`. |
| Requested storage-folder/source-icon paths | **All seven private folders exist;** `client/public/technology-icons/` and `client/dist/technology-icons/` are absent. |

One earlier grouped test invocation accidentally ran `capture-persistence.test.ts` without `NODE_ENV=test`; its startup log confirms that it connected to the default local MongoDB database rather than an isolated memory server. The test's `finally` block attempts to remove only the fixtures it creates and deletes its generated capture files, but I did not independently inspect the database after that run, so I cannot claim its final database state was independently verified. That test was subsequently rerun only with MongoMemoryServer and a unique temporary storage root, passed, and disconnected cleanly. No `.env` contents or credentials were read. Treat the earlier run as a test-isolation mistake, not production or staging evidence.

**Next safe action:** open the local authenticated Admin → Backup panel, choose **Preview storage plan**, and review each proposed source/destination and any unclassified items. Do not press **Organize existing storage** until the plan clearly matches the intended local data. No actual storage migration has been validated or completed.

## 28. Storage recheck and verified duplicate cleanup (21 October 2026)

After the local server restart, the authenticated read-only storage migration plan was requested again. The endpoint returned **HTTP 409** and refused to create a plan because a registered archived capture points to a missing/out-of-root file. The admin archive list contains five archived capture records whose saved paths begin `C:\WindowsPortfolio\AdminArchive\`; none of their five exact basenames exists anywhere under the current project’s `server/storage/`. The out-of-project path was not inspected. No capture records were changed or deleted.

Because the full migration plan is blocked, no indexed portfolio media, capture, or backup was moved. The preview does not provide a safe way to proceed with only some categories, and no manual bypass was used.

### Exact duplicate cleanup

The five loose files at the `server/storage/` root were confirmed byte-for-byte identical by SHA-256 to separate files already present in `server/storage/Portfolio/Media/`. All five loose copies were removed, and each indexed counterpart was rechecked after removal and remained present with the same SHA-256:

| Removed loose duplicate | Preserved counterpart |
|---|---|
| `1000153890-6a00fac0-c3924f93.png` | `Portfolio/Media/1000153890-6a00fac0.png` |
| `1000153890.png` | `Portfolio/Media/1000153890.png` |
| `Anish-Jethva-Data-Analyst.pdf` | `Portfolio/Media/Anish-Jethva-Data-Analyst.pdf` |
| `Anish-Jethva-Full-Stack-Developer.pdf` | `Portfolio/Media/Anish-Jethva-Full-Stack-Developer.pdf` |
| `Screenshot_2024-12-13_171640.png` | `Portfolio/Media/Screenshot_2024-12-13_171640.png` |

The media index still lists eight records whose `relativeDiskPath` values point under `Portfolio/Media/`; all eight indexed files were present during the read-only verification. No media index or database record was edited.

### Static assets and remaining blocker

The static source assets remain in their existing `client/public/audio/`, `videos/`, `wallpapers/`, and `downloads/` folders and are exposed in the simulated D: view through the dynamic Vite manifest; physical C: drive files were not moved.

**Next required user action:** recover or explicitly place the five missing capture source files into the intended private `server/storage/AdminArchive/` tree, then request a fresh preview. If those files are unavailable, explicitly authorize a partial migration of referenced media and legacy backups while leaving the five capture records untouched; otherwise the all-category migration remains blocked. Do not delete those database records as part of file organization.

### Storage migration completion — 2026-10-21

This section supersedes the preceding storage-migration blocker. The authenticated local migration plan was reviewed before execution and contained eight indexed media files, five registered archived captures, no legacy backup moves, and no unclassified media. The plan kept every destination inside the project’s `server/storage` tree. The migration completed successfully:

| Area | Result |
|---|---|
| Existing portfolio media | 8/8 moved with SHA-256 verification: four PDFs to `resume/`, four image assets to `profile/`; metadata and the durable `.media-index.json` were updated. |
| Registered camera archives | 5/5 moved from the explicitly named C: archive to `AdminArchive/CaptureImage/` (4 photos) and `AdminArchive/CaptureVideo/` (1 video); database paths were updated and source hashes verified before source removal. |
| Backups | No legacy backup move was needed. The existing `Windows-11-Portfolio-Backup-21-10-2026_10-29-40-PM.json` (7,587,418 bytes) was already in `backup/`; its contents were not opened. |
| Generated project Markdown | Three existing generated Markdown files were present under `project/`; no copy was required. |
| Final storage folders | Exactly `AdminArchive/`, `backup/`, `certificates/`, `profile/`, `project/`, and `resume/`; `AdminArchive/` contains only `CaptureImage/` and `CaptureVideo/`. `.media-index.json` remains at the storage root. |
| C: archive | After verifying all five registered capture sources were absent from C: and all 13 migrated media/capture destinations matched their planned SHA-256 hashes, the explicitly prohibited `C:\WindowsPortfolio\AdminArchive\` directory was removed. It contained 90 additional unregistered entries, including `admin_backup.zip` and `cap_test_*.png`; these were removed with the explicitly approved directory deletion. |

The migration-plan endpoint was rechecked afterward: **8/8 media already organized, 5/5 captures already organized, 0 unclassified files, and 0 missing archive sources**. Independent filesystem verification found **13/13 destination hashes matched**, the exact six requested storage folders, and `C:\WindowsPortfolio\AdminArchive\` absent.

Before migration, the authenticated missing-source inventory found 25 archive metadata records with no resolvable source file. The user explicitly approved metadata-only removal of these exact entries; the new admin-only endpoint rechecked that each source was missing and removed only the corresponding database record. It did not delete associated files. The first three were `expired_1792166713447.png`, `active_1792166713447.png`, and `independent_1792166713459.png`. The other 22 were `expired_1792166884617.png`, `active_1792166884617.png`, `independent_1792166884626.png`, `expired_1792168893281.png`, `active_1792168893281.png`, `independent_1792168893295.png`, `expired_1792171941245.png`, `active_1792171941245.png`, `independent_1792171941259.png`, `expired_1792173686952.png`, `active_1792173686952.png`, `independent_1792173686973.png`, `expired_1792173899351.png`, `active_1792173899351.png`, `independent_1792173899373.png`, `expired_1792175920283.png`, `active_1792175920283.png`, `independent_1792175920309.png`, `expired_1792180034572.png`, `active_1792180034572.png`, `independent_1792180034583.png`, and `independent_1792181487357.png`. The inventory now reports zero missing sources.

Implementation and validation:

- New uploads and generated Markdown use the requested private storage categories; Windows directory casing is normalized during the authenticated local migration.
- Added an admin-authenticated inventory for missing archive sources and a metadata-only removal route that refuses to remove a record if its archive file resolves. It never deletes a user-capture file.
- `server` and `client` TypeScript checks passed.
- Focused storage, project-Markdown, and backup-restore tests passed: **11/11**. The isolated capture-persistence suite passed all **18 assertions**, including metadata-only cleanup and refusal when the archive file exists.
- Rebuilt `server/server.bundle.cjs` to include the migration safeguards.
- One initial `npm run test:capture-persistence` invocation used the package preload, which loaded `server/.env`; no values were inspected or output. That run used the test harness’s isolated `MongoMemoryServer`. The capture suite was then rerun directly without dotenv, with `MONGODB_URI` unset, runtime downloads disabled, and a unique temporary storage root; it passed. No further env-loading commands were used.

**Unexplained inventory difference:** an earlier read-only listing showed `AdminArchive/Manifests/storage-audit-2026-10-21.json`; the final storage tree no longer contains `AdminArchive/Manifests/`. The migration cleanup code removes only empty directories and does not unlink files, so the reason that earlier file is absent could not be established. Restore it from an existing backup if it is still required. This storage move does not change the separate synthetic-vs-real staging conclusions above.

### Admin storage UI copy removal — 2026-10-21

Removed the extra “Private storage folders” section and storage migration preview/action controls from Backup & Restore. Simplified the Camera consent modal and success notification to say “administrator-managed server archive” / “admin archive” instead of “private” archive. Explicit consent and the notice that only the portfolio administrator can view or delete the separate copy remain. No storage paths, access controls, or upload behavior changed.

Validation: `npm --prefix client run typecheck` passed; `npm --prefix client run build` passed. Searches of `client/src`, `client/public`, and `client/dist` found none of the removed storage-section, migration-button, or Camera archive wording.

## 22. Documentation alignment and current client behavior (23 October 2026)

This update records current documentation corrections and the current client behavior; it does not replace the dated workspace, security, storage, or deployment observations in earlier sections. Earlier measurements and environment readiness notes remain historical snapshots and are not live deployment status.

- Updated the root README to describe the shared virtual D: filesystem used by File Explorer and Notepad, restricted simulated C: drive, Widgets dismissal on app launch, current About-page links, current package test commands, private storage versus public static assets, and the documentation index.
- Updated the Render + Netlify guide to clarify that SMTP is optional for server startup but required for actual email delivery, and to identify the current project-local private storage and backup defaults. External storage-root overrides are ignored in production.
- Updated the architecture, admin-panel, and security documentation to describe shared virtual-drive data in Notepad dialogs, supported text/programming file filters, private upload roots, email favicon preference, and the distinction between simulated C: UI behavior and server-side authorization.
- Updated the API inventory with the public email-favicon endpoint and the analytics privacy note to clarify that Notepad text, virtual-file contents, and media bytes are not analytics payloads.
- The dated analysis report is intentionally retained as an audit trail; its historical inventory and deployment facts should not be read as current runtime measurements.

The client implementation was verified on 23 October 2026 with `npm --prefix client run typecheck` and `npm --prefix client run build`; both passed. Documentation-only edits did not require a separate test run.

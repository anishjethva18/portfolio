# Windows 11 Admin Panel Structure

The reference `portfolio-mern.zip` is a separate React/Express/Mongoose CMS. Its workflows are adapted into the existing Windows 11 desktop app; its React Router shell, CSS bundle, authentication, and server are not copied into this project.

## Frontend

```text
client/src/components/apps/
  AdminPanelApp.tsx                 Admin tab orchestration inside the Win11 app window
  AdminPanelLayout.tsx              Grouped Workspace / Portfolio / Audience / Administration navigation
  AdminLoginScreen.tsx              Admin sign-in and password recovery
  PortfolioManagement.tsx           Structured profile, skills, experience, education and appearance editor
  admin/
    PublishingManagement.tsx        Draft status, explicit publish, revision history and restore-to-draft
    MediaManagement.tsx             Authenticated media library and staged multi-resume manager
    AdvancedContentManagement.tsx   Validated JSON editor for MongoDB content drafts
  ProjectManagement.tsx             Staged project editor, visibility, screenshots and case-study details
  ContactManagement.tsx             Visitor inquiry management
  AnalyticsDashboard.tsx            Usage and portfolio analytics
  FileExplorerApp.tsx                Existing Windows file manager and VFS
  DatabaseManagement.tsx            MongoDB status and metrics
  SystemHealth.tsx                   Service health
  SecurityManagement.tsx             Password and security controls
  CameraArchive.tsx                  Camera archive management
```

## Backend

```text
server/models/
  SiteContent.ts                     Published portfolio content
  AdminContentDraft.ts               Private editable draft in MongoDB
  AdminContentRevision.ts            Previous published snapshots
server/services/
  contentStudioService.ts             Content validation, sensitive-field stripping, publish/restore workflow
server/routes/
  contentStudio.ts                    Admin-only draft, publish and revision API
  admin.ts                            Existing users, projects, messages, files, analytics and system APIs
```

## Reference-to-Windows-11 Mapping

| Reference workflow               | Existing Windows 11 surface                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Overview                         | Overview; real metrics and activity use the existing analytics API                   |
| Site content editor              | Site Content; existing structured content editor                                    |
| Appearance                       | Existing Appearance editor and desktop settings                                     |
| SEO and sharing                  | SEO & Sharing editor (title, description, canonical URL, portfolio release label, public social image preview) |
| Draft, publish, revision history | Publish & History; existing MongoDB draft/revision and staged-project workflows     |
| Projects                         | Projects; existing project management and staged publish path, including draft-only visibility |
| Media uploads                    | Resumes & Media; authenticated existing VFS upload/download APIs                    |
| Leads/messages                   | Messages; existing contact/inquiry API and configured email delivery                |
| Analytics                        | Analytics; existing analytics endpoint, with honest empty/error states              |
| Advanced content editing         | Advanced JSON; validates and saves a private draft only                             |
| Security and service status      | Security & Status; existing account/session controls and protected health endpoint  |
| Windows-specific administration | Users & Roles, Camera Archive, and Backup & Restore remain available; desktop File Explorer remains a Windows app |

All publishing state is stored in MongoDB. Restoring a revision changes the draft only; publishing remains an explicit admin action. Admin sign-in uses the existing server-side session/authentication system and requires MongoDB; private media is accessed through authenticated APIs. Device-specific panel-lock preferences are stored in the browser and are not authorization controls.

Resumes & Media stores ordered resume entries (`id`, `title`, secure `file` URL, and `active`) in the private content draft. The CV app offers active resumes for selection after publish. The existing `profile.resumeUrl` remains as a compatibility fallback for older content. Uploaded resumes use the existing authenticated upload policy, and portfolio media references prevent deletion until removed from content/projects.

Projects continue to use the staged project service. In addition to the existing title, description, category, links, image, technologies, featured state, and publishable visibility, the editor supports slug, type, stack, overview, summary, screenshot URLs, and a case-study goal, approach, architecture, engineering highlights, and delivered result. Screenshot paths cannot target private file-download or admin APIs.

Portfolio media is managed through authenticated admin upload and media-library workflows. Uploaded media uses the configured private storage root (normally `server/storage/`); it is not served by making that directory a public static root. File metadata and media references remain in the database. The Windows desktop's C: drive is a simulated, restricted VFS entry and is not an operating-system disk.

The admin UI does not add AI Assistant or AI Conversations sections. The existing Windows desktop and its other app-specific capabilities remain separate from the portfolio administration workflows. The admin's former VFS File Explorer panel is not exposed in the navigation.

The Overview reports the analytics service's recorded unique visitor identifiers, page views, project interactions, and unread inquiry count; unavailable analytics are shown as an error instead of fabricated metrics. Security & Status polls the existing administrator-only health endpoint for API, database, storage, runtime, and memory status. The SEO editor saves title, description, canonical URL, an administrator-chosen portfolio release label (default `1.0.0`), an optional public social image, and the email-favicon preference to the private draft; those values affect public metadata and email branding after publication. The social image field rejects private admin/file-download paths. The SEO preview uses the currently edited draft values.

The separate Windows Notepad app uses the same published and local virtual D: contents in its Open, Save, and Save As dialogs. Those dialogs limit visible/selectable files to text, Markdown, and supported programming formats; images, audio, video, and executables are excluded. The C: drive is displayed as restricted and produces an in-dialog access-denied notice if selected.

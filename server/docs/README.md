# Server documentation

Server-specific implementation and operations documentation lives here. For the project overview and setup, see the root [README](../../README.md); for deployment and privacy references, see the [project documentation index](../../docs/README.md).

| Document | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Client/server layout, runtime data flow, storage, and common commands. |
| [API inventory](API_INVENTORY.md) | HTTP route inventory, access levels, and endpoint behavior. |
| [Admin panel structure](ADMIN_PANEL_STRUCTURE.md) | Admin workflows and how they connect to existing client/server services. |
| [Security and credentials](SECURITY.md) | Secrets, production request controls, uploads, and backup safety. |

Update these documents when server routes, authorization, storage behavior, or deployment assumptions change. Never include credentials, private media, or backup contents in documentation.

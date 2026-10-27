# Portfolio analytics privacy and retention

Portfolio analytics records page views, app opens, and project selections. Admin dashboard summaries cover the most recent 90 days and refresh every 30 seconds while the dashboard is open; a recorded event also prompts an immediate refresh in the current browser tab.

## Data collected

- Each event has a server-generated UTC timestamp, event type, page, and a client-generated event ID used only for duplicate suppression.
- App-open events store the app ID and display name. Project events store the project ID and title.
- A pseudonymous visitor ID is held in that browser's local storage and included so the dashboard can estimate unique visitors and engagement. It is not an account identifier.
- New client analytics events do not store the request IP address or user-agent. Server request rate limiting may inspect network information transiently.
- Metadata is allowlisted per event; arbitrary client fields, credentials, and unrelated personal data are not recorded by the event endpoint.
- Notepad document text, virtual-file contents, and uploaded media bytes are not analytics event data. Analytics are limited to the allowlisted interaction metadata above.

## Retention and access

New analytics events expire 90 days after creation through MongoDB TTL cleanup. Existing events without an expiry are assigned an expiry based on their original timestamp during database synchronization; malformed legacy timestamps are assigned a 90-day expiry from migration time. MongoDB TTL deletion is asynchronous, so an expired record may remain briefly after its expiry time.

Only authenticated administrators can read dashboard analytics or reset the portfolio analytics event set. The public event-ingestion endpoint accepts a small allowlist of event types and is rate-limited. Reset deletes portfolio analytics immediately and does not delete contacts or system audit records.

## Duplicate suppression and refresh

The client creates an event ID for each intentional open/selection action. The server stores the event using that ID as a unique key, so retrying the same request returns the original event instead of incrementing counts again. Separate intentional opens receive separate IDs. Admin analytics poll every 30 seconds and refresh shortly after an event notification in the active tab.

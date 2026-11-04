# Portfolio analytics privacy and retention

Portfolio analytics records page views, app opens, and project views/clicks. The administrator dashboard refreshes every 30 seconds while open; a recorded event also prompts a refresh in the current browser tab. Dashboard totals use the recorded event set; the daily activity chart can display a selected 7-, 14-, 30-, or 90-day period. This chart range is not a data-retention period.

## Data collected

- Each event has a server-generated UTC timestamp, event type, page, category, and a client-generated event ID used for duplicate suppression.
- App-open events store the app ID and display name. Project events store the project ID and title.
- A pseudonymous visitor ID is held in that browser's local storage and included so the dashboard can estimate unique visitors and engagement. It is not an account identifier.
- Analytics event records set the IP address to `not-collected` and leave the user-agent empty. This is separate from contact submissions, which record request IP address and user-agent; see the [public Privacy Policy](../../client/src/pages/PrivacyPolicy.tsx).
- Metadata is allowlisted per event; arbitrary client fields, credentials, and unrelated personal data are not recorded by the event endpoint.
- Notepad document text, virtual-file contents, and uploaded media bytes are not analytics event data. Analytics are limited to the allowlisted interaction metadata above.

## Retention and access

Analytics records do not have a fixed automatic expiry. The application removes an existing analytics TTL index and the administrator can clear portfolio analytics through the reset action. This reset does not delete contact records or system audit records. Database or hosting backups may retain data separately according to their configured retention.

Only authenticated administrators can read dashboard analytics or reset the portfolio analytics event set. The public event-ingestion endpoint accepts a small allowlist of event types and is rate-limited. Reset deletes portfolio analytics immediately and does not delete contacts or system audit records.

## Duplicate suppression and refresh

The client creates an event ID for each intentional tracked action. The server stores the event using that ID as a unique key, so retrying the same request returns the original event instead of incrementing counts again. Separate intentional actions receive separate IDs. Admin analytics poll every 30 seconds and refresh shortly after an event notification in the active tab.

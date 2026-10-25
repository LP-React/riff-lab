# Firebase catalog setup

## Current connection step

Project: `riff-lab-maps`, Firestore Standard, default database in `southamerica-west1` (Santiago), Spark plan.

`GET /api/catalog` reads public metadata from `songs` through the unauthenticated Firestore REST API. This obeys Firestore Security Rules, requires no Firebase SDK or private Admin credentials, and cannot write data. The checked-in `firestore.rules` must also be published through the Firebase console; adding the file does not deploy it.

The server explicitly caches the upstream POST query with Next.js `fetch`, `force-cache`, and `next.revalidate: 86400`. Revalidation is driven by requests after expiry, not a daily scheduled job; the first stale response can precede the background refresh. Errors return HTTP 502 rather than masquerading as an empty catalog. Browsers receive `Cache-Control: no-store` so they do not add another daily cache. Next.js server hosting is required; static export cannot provide this endpoint/cache. Development hard reloads can bypass the data cache.

The default project ID is `riff-lab-maps`. Optionally copy `.env.example` to `.env.local` or configure `FIREBASE_PROJECT_ID` in the deployment environment to select another project.

## First document

Collection: `songs`. Document: `f726df32cc0b8440`.

| Field | Firestore type | Initial value |
| --- | --- | --- |
| schemaVersion | number | 1 |
| title | string | Megitsune |
| artist | string | Babymetal |
| album | string | Babymetal |
| charter | string | Nightmare Lyre & Mathespio |
| duration | number | 251.036 |
| published | boolean | false |

The query includes `published == true`, matching the rules. Drafts are not returned. A database with only this draft therefore returns an empty `songs` array, which is a successful connection. All fields on published documents are publicly readable directly through Firestore; do not store secrets there. The application endpoint additionally exposes only its explicit metadata fields.

## Remaining migration steps

- Host audio, artwork and processed chart files separately; Cloud Storage requires Blaze, so the Spark prototype will use Firebase Hosting for static assets within its quotas. Uploading assets there requires a Hosting deployment, independently of deploying Next.js.
- Extend the document/export schema with versioned file URLs, available difficulties and song presentation. Validate the complete package before publishing.
- Replace the local manifest source in the session, Home, catalog and chart loader, including empty/error states and cross-origin audio configuration. These views still intentionally use the existing local songs during this connection step.
- Add an authenticated cache invalidation workflow for urgent withdrawals. Daily cache expiry alone does not provide immediate removal, and hiding metadata does not revoke hosted file URLs.

Do not mark the sample as published yet. No assets have been uploaded, no Firebase rules have been deployed from this repository, and the UI migration is not complete.

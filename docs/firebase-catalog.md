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

## Static asset preparation (Spark)

Firebase CLI is a local development dependency. Run commands from the repository root:

1. `pnpm firebase:login` authenticates interactively with your Google account. Do not paste authorization codes or tokens into chat.
2. `pnpm hosting:prepare f726df32cc0b8440` exports the first sample package locally, leaving source files unchanged.
3. After login, `pnpm exec firebase hosting:sites:list --project riff-lab-maps` checks whether the default Hosting site exists. If absent, provision it with `pnpm exec firebase hosting:sites:create riff-lab-maps --project riff-lab-maps`. If the ID is unavailable, update both the site in the config and the export base URL to the chosen site ID.
4. When ready to publish the reviewed files, `pnpm hosting:deploy` targets only Hosting in project `riff-lab-maps`, using `firebase.assets.json`. It does not deploy Next.js or Firestore rules. No `firebase init` is needed.

`hosting-assets/` is the only public deployment directory, containing `songs/<id>/<content-version>/chart.json` and media. `hosting-metadata/<id>.json` holds the corresponding Firestore draft outside the public directory. Both generated directories and Firebase's local cache are ignored by Git. Export does not write to Firestore and leaves `published: false`. The complete remote schema/UI integration is still pending.

The first local sample contains three files totaling approximately 2.7 MB. Hosting sends public cross-origin headers for audio/JSON downloads, with a one-hour HTTP cache independent of the daily catalog data cache. Firebase CLI's `protobufjs` and optional native `re2` build scripts are explicitly disabled; CLI startup is verified.

Exports add versions without deleting earlier packages. Each Hosting deployment publishes the whole local directory: preserve all intended packages when adding songs, and intentionally remove obsolete assets before deploying a withdrawal. Old deployments, browser caches and downloaded files may retain copies. Do not deploy an incomplete or empty directory over an existing library.

## Remaining migration steps

- Authenticate the Firebase CLI and deploy the reviewed static files; Cloud Storage requires Blaze, so the Spark prototype uses Firebase Hosting within its quotas, independently of deploying Next.js.
- Extend the document/export schema with versioned file URLs, available difficulties and song presentation. Validate the complete package before publishing.
- Replace the local manifest source in the session, Home, catalog and chart loader, including empty/error states and cross-origin audio configuration. These views still intentionally use the existing local songs during this connection step.
- Add an authenticated cache invalidation workflow for urgent withdrawals. Daily cache expiry alone does not provide immediate removal, and hiding metadata does not revoke hosted file URLs.

Do not mark the sample as published yet. No assets have been uploaded, no Firebase rules have been deployed from this repository, and the UI migration is not complete.

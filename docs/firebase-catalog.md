# Firebase catalog setup

## Current integration

Project: `riff-lab-maps`, Firestore Standard, default database in `southamerica-west1` (Santiago), Spark plan.

`GET /api/catalog` reads complete published song entries from `songs` through the unauthenticated Firestore REST API. This obeys Firestore Security Rules, requires no Firebase SDK or private Admin credentials in the web app, and cannot write data. The checked-in `firestore.rules` must also be published through the Firebase console; adding the file does not deploy it.

The root Server Component provides the cached catalog to the client session. Home, catalog, loaders and gameplay share this remote list. Menu navigation refreshes it through the cached endpoint, without updating it during gameplay. Empty catalogs show a retry state; failures show an error, preserving an already loaded remote list without falling back to local songs. Selected song/difficulty remain valid when the list changes. The chart cache uses both song ID and versioned chart URL, and media elements use anonymous CORS for Web Audio.

Development/build clear only the ignored, generated legacy `public/songs` directory and no longer copy local song packages. Original packages and imported charts remain available for the offline tooling. They are not used as the runtime catalog.

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

These were the initial draft fields. The sample is now published with the complete exported document, including `chartUrl`, `artwork`, `preview`, `previewStart`, `stems`, `reactiveGuitar`, `difficulties`, and `version`. Optional presentation fields include `theme`, `background`, `description`, `genre`, `year`, and `openNotes`. See the generated `hosting-metadata/<id>.json` for the complete draft schema.

The query includes `published == true`, matching the rules. Drafts are not returned; incomplete or malformed published documents produce an error rather than a playable entry. All fields on published documents are publicly readable directly through Firestore; do not store secrets there. The application query/endpoint additionally whitelist public fields.

## Static asset preparation (Spark)

Firebase CLI is a local development dependency. Run commands from the repository root:

1. `pnpm firebase:login` authenticates interactively with your Google account. Do not paste authorization codes or tokens into chat.
2. `pnpm hosting:prepare f726df32cc0b8440` exports the first sample package locally, leaving source files unchanged.
3. After login, `pnpm exec firebase hosting:sites:list --project riff-lab-maps` checks whether the default Hosting site exists. If absent, provision it with `pnpm exec firebase hosting:sites:create riff-lab-maps --project riff-lab-maps`. If the ID is unavailable, update both the site in the config and the export base URL to the chosen site ID.
4. When ready to publish the reviewed files, `pnpm hosting:deploy` targets only Hosting in project `riff-lab-maps`, using `firebase.assets.json`. It does not deploy Next.js or Firestore rules. No `firebase init` is needed.

`hosting-assets/` is the only public deployment directory, containing `songs/<id>/<content-version>/chart.json` and media. `hosting-metadata/<id>.json` holds the corresponding Firestore draft outside the public directory. Both generated directories and Firebase's local cache are ignored by Git. Export does not write to Firestore and leaves the local draft as `published: false`.

After uploading, `pnpm hosting:publish <id>` checks asset availability, CORS and chart difficulties without writing. `pnpm hosting:publish <id> --publish` creates or updates and publishes the Firestore entry. Existing records use an update-time precondition and field mask to preserve unrelated fields and prevent concurrent edits being overwritten; new records require that the ID not already exist. No manual draft creation is required. This local administration script reuses the Firebase CLI login through its internal auth module; retest it when upgrading the CLI. It does not expose credentials to the web app or terminal output. Normal publication follows the daily cache policy, so it is not guaranteed to appear immediately in an already-running deployment.

## Bulk publication

For the complete imported catalog, run these commands in order:

```sh
pnpm hosting:prepare --all
pnpm hosting:deploy
pnpm hosting:publish --all --publish
```

If new folders were added to `src/musics`, run `pnpm import:songs` first to regenerate the imported catalog. `--all` selects the IDs in `src/generated/songs/manifest.json`, excluding stale or unrelated JSON files in the export directory. Preparation writes only local generated files, Hosting deploy uploads the files, and the last command creates/updates the Firestore documents with `published: true`. It can also republish a previously unpublished ID, so use a single song ID when only adding one song.

`pnpm hosting:publish --all` validates the uploaded files without making Firestore writes. All assets are validated before any document changes. Lists of 1–400 songs and at most 8 MiB of encoded metadata are committed atomically: a missing file or concurrent edit stops the operation, rather than partially publishing the list. Larger lists must be split into smaller publications. A network timeout can leave the result uncertain; check Firestore before repeating. Spark read/write quotas still apply. These are ordinary document writes, not Firebase's managed import/export service, which requires Blaze.

The first local sample contains three files totaling approximately 2.7 MB. Hosting sends public cross-origin headers for audio/JSON downloads, with a one-hour HTTP cache independent of the daily catalog data cache. Firebase CLI's `protobufjs` and optional native `re2` build scripts are explicitly disabled; CLI startup is verified.

Exports add versions without deleting earlier packages. Each Hosting deployment publishes the whole local directory: preserve all intended packages when adding songs, and intentionally remove obsolete assets before deploying a withdrawal. Old deployments, browser caches and downloaded files may retain copies. Do not deploy an incomplete or empty directory over an existing library.

## Current verification and remaining work

- All 15 imported songs are uploaded to Hosting (47 files, 53.39 MiB) and published in Firestore. The public reader validates all 15 and matches their IDs against the imported manifest. Hosting publication must precede metadata publication; otherwise the validator rejects missing assets with HTTP 404 and writes no documents.
- Browser verification covers remote preview playback, Home playback, entering a prepared game, pausing and returning to the menus. Full-song completion and every difficulty have not been playtested.
- The Next.js application changes are local until its usual deployment is updated; uploading static song files does not deploy the web app.
- Add an authenticated cache invalidation workflow for urgent withdrawals. Daily cache expiry alone does not provide immediate removal, and hiding metadata does not revoke hosted file URLs.

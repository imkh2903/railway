# Railway Production Runbook — v10

## Status

This release is the **Railway-ready hardening phase** of the current Gudep application.

It intentionally keeps the existing JSON data model and UI/API behavior intact. Persistent production data is moved to a Railway Volume through `DATA_DIR=/data`.

A PostgreSQL migration should be treated as a separate phase after the current production smoke test; it is not silently mixed into this release because the current application uses synchronous JSON reads/writes throughout the API.

## What changed

- Railway Config-as-Code via `railway.json`
- `/api/health` is a minimal public readiness endpoint
- `/api/health/details` is authenticated and contains operational statistics
- `DATA_DIR` can point to a mounted Railway Volume
- First boot copies the bundled `data/db.json` seed into an empty persistent volume
- First boot copies bundled upload files into an empty persistent upload directory
- graceful SIGTERM/SIGINT shutdown
- `X-Powered-By` disabled
- production verification script
- `.env.example`
- package version 10.0.0

## Important data rule

Do **not** attach an empty Railway Volume to `/data` and then delete the seed files before the first boot. The application uses the repository's `data/db.json` as its initial seed when `/data/db.json` does not exist.

After the first boot, `/data/db.json` becomes the live database.

## Railway setup

1. Create a Railway project.
2. Create a Web Service from the GitHub repository.
3. Railway detects Node/Express automatically.
4. Attach a **Volume** to the Web Service.
5. Set the Volume mount path to:

```text
/data
```

6. Add service variable:

```text
NODE_ENV=production
DATA_DIR=/data
SESSION_TTL_HOURS=8
MAX_UPLOAD_MB=10
```

Railway injects `PORT`; do not replace it with a fixed production port.

7. Deploy.
8. Confirm deployment health is `healthy`.
9. Open the generated public domain.
10. Test `/api/health`.

Expected:

```json
{
  "ok": true,
  "status": "ready"
}
```

## Current production architecture

```text
Browser
   |
   v
Railway Web Service
   |
   +-- Node + Express
   |
   +-- /data/db.json       <-- Railway Volume
   |
   +-- /data/uploads       <-- Railway Volume
```

This is intentionally a **single-service, single-volume** architecture. Railway notes that services with volumes cannot use replicas and redeploys with a volume have a small amount of downtime. Do not enable multiple replicas for this release.

## Backup

Before important releases:

- use Railway Volume backups
- download a database backup when appropriate
- keep the source repository separate from the live `/data` volume

The application also keeps `db.json.bak` when its normal database write path performs a backup.

## Deploy from local machine

After connecting the project:

```bash
npm install
npm run check
npm run verify:production
npm start
```

Then:

```bash
railway up
```

## GitHub workflow

Recommended:

```text
feature branch
    |
    v
local smoke test
    |
    v
pull request
    |
    v
staging environment
    |
    v
production branch
    |
    v
Railway production
```

## Do not do yet

Do not configure horizontal replicas for this JSON/Volume release.

Do not move `db.json` manually into the container after the Volume is attached.

Do not store secrets in `.env` committed to Git.

Do not expose `/api/health/details` publicly.

## Next production phase

After the v10 smoke test passes, migrate:

- members
- users
- publications
- events
- registrations
- achievements
- media metadata
- documents metadata
- analytics

to Railway PostgreSQL, and move uploaded binary files to S3-compatible object storage. That migration should be done with an explicit import/export step and verification, not as an opaque startup migration.

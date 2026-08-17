# Production v10 — Gudep MAN 1 Padang Pariaman

## Implemented

- Dynamic Struktur Organisasi from database with admin CRUD.
- Seeded the supplied initial organization data.
- Public `/struktur.html` now renders live organization data.
- Publication Studio supports Warta, Resource, Download, Gallery, Video, Dokumen, and Link.
- Video publication can use a public video URL or uploaded video media.
- Document publication can reference uploaded `dokumen_surat` records.
- Existing media can be selected as publication media and promoted to thumbnail.
- Thumbnail validation accepts public HTTP(S) URLs and local `/media/` or `/assets/` paths.
- Public newsroom adds search, type filtering, publication counters, featured cards, video/gallery indicators, and real published data.
- Publication detail renders uploaded image/video media and document downloads.
- Admin dashboard adds real-data distribution charts for publications, members, registrations, and event categories.
- Dashboard data-health cards show real media/document/organization/member counts.
- Purna Anggota Pramuka logo added to the homepage hero as a responsive glassmorphism visual.
- Existing bulk member Excel/CSV, batch media, and batch document upload flows remain intact.
- `validClientUrl` remains defined in the Publication Studio and static cache-busting query parameters were added to admin/public JS references.
- Startup log reports the number of backend-managed admin accounts and lists their usernames/roles.

## Data integrity

The dashboard and public website do not introduce hard-coded operational counters. Values are derived from the active JSON database and public publication visibility rules.

## Railway

Keep the existing single-service/single-volume architecture for the JSON database release:

```text
DATA_DIR=/data
```

The application bootstraps `/data/db.json` and `/data/uploads` from the repository seed only when those persistent paths are empty.

Do not enable multiple replicas for this JSON + Volume architecture.


If an existing Railway Volume has an empty `organization` array, startup migration seeds the supplied initial structure once. Existing non-empty organization data is preserved.


## v10.1 execution pass

- Fixed the Publication Studio `validClientUrl is not defined` runtime failure by defining the validator in `admin.js` itself; the editor no longer depends on another script's global scope.
- Replaced large dashboard distribution panels with compact SVG donut/bar visualizations. Values remain derived exclusively from `/api/analytics` and the active database.
- Added structure-person photo support: admin can upload a photo directly or select an existing image from Media Admin.
- Structure records can retain `photoMediaId` + `photoUrl`; backend validates the referenced media and prevents deletion while it is used by a structure record.
- Structure public rendering keeps initials as a safe fallback when no usable photo is configured.

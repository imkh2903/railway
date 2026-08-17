# Production Audit v8

## Baseline
Source: Gudep-MAN1-Padang-Pariaman-Production-v7-Publication-Studio-FIX.zip

## Findings before v8
- The application had a real-data JSON backend with authentication, publications, registrations, members, media, and documents.
- Publication Studio had the previously fixed `validClientUrl()` and publication scheduling logic.
- Media and document upload endpoints accepted only one file at a time.
- Member management had only manual single-record CRUD; there was no Excel import or template.
- Every HTML page still used the literal `⚜` brand mark even though `public/assets/logo-gudep.webp` already existed.
- `package.json` did not contain the XLSX parser required for server-side Excel import.

## v8 changes
1. Branding only: all `brand-mark` literals are replaced with `/assets/logo-gudep.webp`; isolated image CSS added.
2. Members:
   - Excel `.xlsx` and `.csv` preview endpoint.
   - All-or-nothing import endpoint.
   - Duplicate NIS detection against the existing database and within the uploaded file.
   - Required fields: Nama, NIS, Kelas, Status.
   - Status allowed: aktif / nonaktif.
   - Downloadable Excel template.
3. Media:
   - Batch upload up to 50 files per request.
4. Documents:
   - Batch upload up to 50 document files per request.
   - Document-only extension filter.
5. Package:
   - Added `xlsx` dependency.
   - Removed the stale lockfile because it did not contain the new dependency; run `npm install` to generate a fresh lockfile for the deployment environment.

## Regression constraints
No changes were made to:
- `data/db.json` records
- authentication/session logic
- publication API semantics
- publication scheduling semantics
- registration workflow
- analytics data model
- existing single-record CRUD routes
- public page routing

## Important deployment note
The source package now requires `xlsx`. Run:

```bash
npm install
npm start
```

Do not use `npm ci` until a fresh lockfile has been generated and committed by the deployment environment.

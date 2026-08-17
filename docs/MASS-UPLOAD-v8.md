# Mass Upload v8

## Member Excel format

Download `Template Excel` from Admin > Anggota.

Canonical columns:

- Nama
- NIS
- Kelas
- Status

Status values:
- aktif
- nonaktif

Import is transactional: if any row has an error or duplicate NIS, the import is rejected and no member rows are written.

## Media
Admin > Media accepts multiple files, maximum 50 files per request and 10 MB per file.

## Documents
Admin > Dokumen Surat accepts multiple document files, maximum 50 files per request and 10 MB per file.

Supported document extensions:
PDF, DOC, DOCX, XLS, XLSX, ZIP.

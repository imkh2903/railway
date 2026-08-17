# Gudep MAN 1 Padang Pariaman — Production v4

## Fokus v4
- Real-data dashboard; tidak memakai counter legacy palsu.
- Admin bootstrap dipanggil otomatis.
- Fix kritis route `/api/publications/all` vs `/:slug`.
- Publication Studio terintegrasi dengan CRUD, media, dokumen, scheduling, featured, SEO.
- Registrations admin lengkap: detail, catatan, status, delete.
- Backend-managed accounts di `data/db.json`, password plain akan dimigrasikan ke PBKDF2 saat startup.
- Upload validation, referential integrity, CSRF, session, rate limiting login sederhana.
- `/api/health` dan smoke-test checklist.

## Run
```bash
npm install
npm start
```

Login di `/admin/login`. Akun dikelola backend melalui `data/db.json`; tidak ada pendaftaran akun publik.

## Data
Semua angka dashboard dihitung dari collection aktual: `members`, `events`, `publications`, `achievements`, `registrations`, `media`, `dokumen_surat`.


## Production v8 additions
- Gudep logo is sourced from `public/assets/logo-gudep.webp` across public and admin HTML.
- Admin > Anggota supports `.xlsx`/`.csv` preview and transactional bulk import.
- Admin > Media and Dokumen Surat support batch uploads (up to 50 files/request).
- Excel support uses the `xlsx` package. Run `npm install` before `npm start`.


## Production v10 additions

See `docs/PRODUCTION-V10-CHANGES.md` for dynamic organization management, real-data dashboard charts, video/document publication, enhanced newsroom, and homepage Purna Anggota visual integration.

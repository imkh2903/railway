# Audit & Remediation — Gudep Production v4

## Temuan kritis pada v3.1

1. **Route conflict Express**: `/api/publications/:slug` dideklarasikan sebelum `/api/publications/all`. Request `/api/publications/all` diperlakukan sebagai slug `all` dan mengembalikan `NOT_FOUND`. Ini menjelaskan error `app.js:... Error: NOT_FOUND` ketika modul manajemen publikasi memanggil `loadPublications()`.
2. **`initAdmin()` tidak pernah dipanggil** di v3.1, sehingga bootstrap admin tidak dijalankan secara deterministik.
3. **`/api/auth/setup` tidak tersedia** walaupun `setup.html` memanggil endpoint tersebut.
4. **Route `/admin/setup` tidak tersedia**.
5. **Dashboard memiliki sumber data legacy `stats.members=65`** yang bertentangan dengan `members: []`. v4 menghapus counter legacy dan seluruh statistik diturunkan dari collection aktual.
6. **Modul pendaftaran admin hanya memiliki status update sederhana** dan tidak memiliki detail/catatan/hapus yang layak untuk workflow verifikasi. v4 menambahkan detail, catatan admin, status pending/approved/rejected, dan delete.
7. **Editor publikasi tidak sepenuhnya terhubung** karena `loadPublications()` selalu gagal akibat route conflict. v4 menghubungkan editor ke `/api/publications/all`, media, dokumen, dan CRUD publikasi.
8. **Referensi media/dokumen tidak divalidasi server-side**. v4 memeriksa referensi sebelum publikasi disimpan.
9. **Penghapusan dokumen/media yang masih dipakai publikasi** dapat membuat data orphan. v4 menolak penghapusan dengan HTTP 409.
10. **Konten profil/struktur sebagian hard-coded**. v4 mengambil visi, misi, nilai, dan struktur dari database; bila kosong ditampilkan sebagai belum diisi, bukan data rekaan.

## Verifikasi statis v4

- `node --check server.js`
- `node --check public/js/app.js`
- `node --check public/js/admin.js`
- JSON parse `data/db.json`
- pemeriksaan endpoint route order dan ID target HTML/JS

## Batas verifikasi

Environment audit tidak berhasil menyelesaikan `npm install` dalam batas waktu, sehingga end-to-end browser test terhadap Express tidak dapat diklaim telah dijalankan di environment audit. Sebelum production, jalankan `npm install`, `npm start`, lalu lakukan smoke test di `docs/PRODUCTION-SMOKE-TEST.md`.

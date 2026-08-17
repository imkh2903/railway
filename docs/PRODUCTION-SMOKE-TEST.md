# Production Smoke Test

1. `npm install`
2. `npm start`
3. Pastikan terminal mencetak jumlah akun admin, anggota, agenda, publikasi terbit, draft, pending registration, dokumen, media.
4. Buka `/api/health` dan pastikan `ok: true`.
5. Buka `/admin/login`, login dengan akun yang ada di `data/db.json`.
6. Dashboard: semua counter harus sama dengan collection database.
7. Publikasi: buka menu, pastikan daftar muncul (khusus v3.1 bug: `/api/publications/all` harus tidak lagi NOT_FOUND).
8. Create publikasi draft. Edit. Publish. Pastikan tampil di `/publikasi.html`.
9. Buat scheduled publication di masa depan dan pastikan belum tampil publik.
10. Upload media dan dokumen. Pilih keduanya pada Publication Studio.
11. Gallery wajib punya media; Download/Resource wajib punya dokumen; Link wajib URL http/https.
12. Hapus media/dokumen yang masih direferensikan: harus ditolak dengan pesan penggunaan.
13. Buka `/bergabung.html`, kirim pendaftaran.
14. Admin → Pendaftaran: record harus muncul sebagai pending. Buka Detail, ubah catatan/status.
15. Hapus pendaftaran dan pastikan hilang.
16. Anggota: create/edit/delete dan cek Quick Counter.
17. Agenda: create/edit/delete dan cek agenda terdekat.
18. Prestasi: create/edit/delete dan cek halaman publik.
19. Analytics: buka halaman publik beberapa kali, lalu cek page views.
20. Logout → halaman admin harus kembali ke login.

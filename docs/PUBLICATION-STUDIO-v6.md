# Production v6 — Publication Studio Fix

## Perbaikan utama

1. `datetime-local` Waktu terbit sekarang selalu dapat diakses.
2. Mengisi Waktu terbit otomatis mengaktifkan Jadwalkan publikasi.
3. Nilai waktu edit dikonversi ke waktu lokal browser, bukan UTC mentah.
4. Menambahkan `thumbnailUrl` pada setiap publikasi.
5. Publikasi yang diterbitkan wajib mempunyai thumbnail yang valid.
6. Publikasi lama yang belum mempunyai thumbnail diberi fallback `/assets/publication-default.svg`.
7. Manajemen publikasi menampilkan thumbnail pada tabel admin.
8. Halaman Newsroom menampilkan thumbnail untuk setiap card.
9. Halaman detail publikasi menampilkan thumbnail hero.
10. Tambah fallback image jika URL thumbnail gagal dimuat.

## Workflow thumbnail

Admin > Manajemen Publikasi > Buat/Edit Publikasi > Media & resource > Thumbnail newsroom.

Gunakan URL foto `http://` atau `https://`.

## Workflow jadwal

- Tanpa centang `Jadwalkan publikasi`: Published = terbit segera.
- Centang `Jadwalkan publikasi`: gunakan `Waktu terbit`.
- Mengisi waktu terbit otomatis mencentang jadwal.
- Draft tidak pernah tampil di website publik.

## Catatan produksi

`thumbnailUrl` disanitasi di backend dan hanya menerima URL HTTP/HTTPS atau fallback internal.

# Akun Admin Backend

Admin tidak perlu daftar dari website.

1. Buka `data/db.json`.
2. Isi `users` dengan username dan `password` biasa (minimal 10 karakter).
3. Jalankan/restart `npm start`.
4. Server otomatis mengubah password menjadi PBKDF2 hash dan menghapus plaintext.
5. Login di `/admin/login`.

Jika ingin mengganti password, edit `users[].password` dengan password baru tanpa tanda `:` lalu restart server.

Role:
- `superadmin`: akses seluruh admin termasuk manajemen akun.
- `admin`: akses operasional tanpa manajemen akun superadmin.


## Akun langsung dari `data/db.json`

Akun admin tidak perlu dibuat dari halaman setup. Tambahkan object ke array `users`:

```json
{
  "id": "admin-2",
  "username": "operator",
  "password": "password-anda",
  "name": "Operator Gudep",
  "role": "admin"
}
```

Password plaintext di `db.json` hanya digunakan sebagai input konfigurasi awal. Saat `npm start`, server otomatis mengubahnya menjadi hash PBKDF2. Password dengan panjang berapa pun yang belum berbentuk hash akan dimigrasikan.

Saat startup terminal menampilkan jumlah akun yang tersedia, misalnya:

```text
Akun admin tersedia : 3 user
Daftar akun yang dapat login:
  1. admin (superadmin)
  2. operator (admin)
  3. pembina (admin)
```

Angka tersebut berarti ada 3 akun yang terdaftar dan dapat mengakses `/admin/login` (selama username/password benar). Ini berbeda dari jumlah sesi yang sedang online.

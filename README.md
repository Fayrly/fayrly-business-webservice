# Fayrly Business

Dashboard kerja untuk penyelenggara event: mengelola event, jadwal, harga tiket, ulasan, laporan, dan akun. Terpisah dari `frontend-public` (situs pembeli) dan hanya memakai API nyata dari gateway.

## Stack

- Angular 22 standalone (`@if`, `@for`, signals, lazy `loadComponent`)
- Tailwind CSS v4 (`@theme` + `@layer components`), palet mint/crimson/canvas
- Poppins self-hosted (`@fontsource/poppins`), ikon `lucide-angular`
- Reactive Forms, functional route guards, HTTP interceptor untuk token + refresh

## Menjalankan

Backend (gateway `:8080`, auth `:8081`, user `:8082`, event `:8083`, report `:8084`, Postgres host `:5433`):

```bash
cd /Users/eosmaci7/Projects/fayrly/backend-service
docker compose up -d
docker compose ps
```

Frontend:

```bash
cd /Users/eosmaci7/Projects/fayrly/frontend-business
npm install
npm start          # http://localhost:4300, proxy /api -> http://localhost:8080
```

Build produksi:

```bash
npm run build      # output: dist/fayrly-business
```

Hentikan backend:

```bash
cd /Users/eosmaci7/Projects/fayrly/backend-service
docker compose down
```

## Rute

| Rute | Isi |
| --- | --- |
| `/masuk` | Login penyelenggara (guest-only) |
| `/lupa-password` | Lupa dan reset kata sandi lewat kode |
| `/ringkasan` | Metrik event, hal yang perlu perhatian, jadwal terdekat, status, ulasan, donasi |
| `/events` | Daftar event milik pengguna, filter status/pencarian, aksi terbitkan/batalkan/hapus |
| `/events/baru`, `/events/:id/ubah` | Form 4 langkah: Info dasar, Waktu & lokasi, Tiket, Tinjau; simpan draf atau terbitkan |
| `/events/:id` | Detail event, status, peserta, ulasan, aksi pengelolaan |
| `/jadwal` | Agenda per bulan (WIB), tab Mendatang / Sudah lewat / Semua |
| `/harga` | Ringkasan harga tiket per event + pintasan ke langkah Tiket |
| `/ulasan` | Ulasan peserta per event dengan pagination |
| `/laporan` | Daftar laporan, filter status/jenis, alur draf → kirim → tinjau |
| `/akun` | Profil, daftar izin, ubah kata sandi, keluar |
| `/tanpa-akses` | Halaman untuk akun tanpa izin penyelenggara |

Semua rute selain auth dijaga `authGuard` + `organizerGuard`; rute tertentu memakai `permissionGuard` (misal `report:read`, `event:read`). Form event memakai `unsavedChangesGuard`.

## Endpoint yang dipakai

Auth:
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/password`
- `POST /api/v1/auth/password/forgot|verify|reset`

Event:
- `GET /api/v1/events/mine?q&status&page&page_size`
- `GET /api/v1/events/:id`
- `POST /api/v1/events`
- `PATCH /api/v1/events/:id`
- `POST /api/v1/events/:id/status` (`published`, `ongoing`, `completed`, `cancelled`)
- `DELETE /api/v1/events/:id`
- `GET /api/v1/events/:id/reviews?page&page_size`

Laporan:
- `GET /api/v1/reports?q&status&type&mine&page&page_size`
- `GET /api/v1/reports/:id`
- `POST /api/v1/reports`
- `PATCH /api/v1/reports/:id`
- `POST /api/v1/reports/:id/submit`
- `POST /api/v1/reports/:id/review`
- `DELETE /api/v1/reports/:id`

Format respons: daftar `{ data, pagination }`, tunggal `{ data }` (kecuali `/auth/me` → `{ user }`), error `{ error: { code, message, details?, request_id? } }`. Batas `page_size` = 100.

## Struktur

```
src/app/
  core/
    api/        auth, event, report, review service
    auth/       guard, permission helper, unsaved-changes guard
    models/     tipe API (event, report, review, auth, pagination)
    util/       format id-ID/WIB, error message
  layout/       sidebar + topbar
  features/     overview, events, event-form, event-detail, schedule,
                pricing, reviews, reports, account, login, forgot-password,
                no-access
  shared/ui/    confirm-dialog, empty-state, error-state, status-badge
```

## Catatan & gap backend

- **Promo/voucher**: belum ada field maupun endpoint. Halaman Harga & Promo menandainya "Segera hadir"; harga tiket diatur di langkah Tiket pada form event.
- **Kategori tiket, pesanan, penjualan**: tidak ada endpoint, jadi dashboard tidak menampilkan angka pendapatan/terjual. Metrik yang tampil hanya yang benar-benar tersedia: jumlah event, status, kapasitas, ulasan/rating, donasi (dari target & terkumpul event amal), dan antrean laporan.
- **Unggah poster**: hanya URL poster; tidak ada endpoint upload.
- **Check-in peserta**: belum tersedia.
- **Unpublish**: event terbit tidak bisa kembali ke draf; hanya pembatalan.
- **Urutan daftar** ditentukan backend; UI tidak mengirim parameter sort.
- **Donasi** bukan data pembayaran; berasal dari `donation_target`/`donation_collected` pada event amal.
- **Hapus laporan** memakai izin `report:write` di UI, sementara seed backend menyediakan `report:delete`.
- **Periode laporan** tidak bisa dikosongkan lewat PATCH.
- **Nama/email profil** tidak bisa diubah sendiri; halaman Akun mengarahkan ke administrator.
- **OAuth** (Google/Apple) belum dikonfigurasi.
- **Tim & Akses** sengaja tidak ada: dashboard ini untuk bisnis/penyelenggara, bukan konsol admin pengguna/peran.

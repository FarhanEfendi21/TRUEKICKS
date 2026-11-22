# Dokumentasi Pembersihan Legacy Code & Struktur Repo (Bagian C) — TrueKicks

Dokumen ini mencatat seluruh perbaikan struktur repositori Git, pembersihan file legacy/tidak terpakai, serta penyatuan konfigurasi PWA (Bagian C) pada project **TrueKicks**.

---

## Ringkasan Perbaikan

| # | Kategori Masalah | Status | Perubahan Utama |
| :-: | :--- | :---: | :--- |
| 1 | Nested Git Repositories (`backend/.git` & `frontend/.git`) | Fixed | Menghapus folder `.git` lama di dalam `backend/` dan `frontend/` sehingga seluruh project berada dalam satu monorepo Git (`TRUEKICKS.git`). |
| 2 | Stub serverless lama (`frontend/api/index.js`) | Fixed | Menghapus `frontend/api/index.js` beserta direktori `frontend/api/` yang kosong. |
| 3 | Hook & komponen tidak terpakai (`useApi.js`, `Reviews.jsx`, `DarkModeToggle.jsx`) | Fixed | Menghapus file-file dead code yang tidak pernah diimpor di mana pun beserta direktori `frontend/src/hooks/` yang kosong. |
| 4 | Konflik konfigurasi PWA (`public/service-worker.js` & `public/manifest.json` vs `vite-plugin-pwa`) | Fixed | Menghapus manifest dan service worker manual lama, memperbarui `frontend/index.html`, dan menyempurnakan konfigurasi `VitePWA` di `frontend/vite.config.js`. |

---

## Detail Perbaikan

### 1. Penyatuan Struktur Git (Penghapusan Nested `.git`)

- **Akar Masalah**:
  - Root folder `TrueKicks/` sudah merupakan monorepo Git aktif (`TRUEKICKS.git`), namun di dalam subfolder masih tertinggal dua folder `.git` lama:
    - `backend/.git` (`TRUEKICKS-BACKEND.git` — hanya 1 commit lama `first commit`).
    - `frontend/.git` (`TrueKicks-1.git` — hanya 2 commit lama `first commit` & `update`).
  - Keberadaan nested `.git` tanpa konfigurasi git submodule menyebabkan status Git terpecah, kebingungan saat commit/push, serta potensi konflik tracking file.
- **Perbaikan**:
  - Menghapus direktori `backend/.git` dan `frontend/.git`.
  - Memverifikasi bahwa `git -C backend rev-parse --show-toplevel` dan `git -C frontend rev-parse --show-toplevel` kini sama-sama mengarah ke root `C:/Users/Lenovo/TrueKicks`.
- **Catatan Deployment Vercel**:
  - Dengan struktur monorepo tunggal (`TRUEKICKS.git`), pastikan kedua project Vercel terhubung ke repo `TRUEKICKS.git` dengan pengaturan **Root Directory** masing-masing ke `backend` dan `frontend`.

---

### 2. Penghapusan Dead / Legacy Code

Sebelum dihapus, dilakukan pencarian referensi (`Select-String`) di seluruh `frontend/` untuk memastikan tidak ada modul yang mengimpor file-file berikut:

1. **`frontend/api/index.js`** *(dihapus bersama folder `frontend/api/`)*.
   - File stub percobaan serverless Vercel lama yang belum selesai (berisi placeholder `"logic needs to be here"` dan mengimpor path relatif `../backend/config/supabase.js`). Backend sebenarnya berjalan terpisah di `backend/index.js`.
2. **`frontend/src/hooks/useApi.js`** *(dihapus bersama folder `frontend/src/hooks/`)*.
   - Tidak diimpor di komponen maupun halaman mana pun.
3. **`frontend/src/components/Reviews.jsx`** *(dihapus)*.
   - Tidak diimpor di mana pun karena halaman `frontend/src/pages/ProductDetail.jsx` sudah memiliki implementasi ulasan lengkap dengan **Supabase Realtime**.
4. **`frontend/src/components/DarkModeToggle.jsx`** *(dihapus)*.
   - Tidak diimpor di mana pun karena pengaturan Dark Mode sudah ditangani oleh `DarkModeSettingRow` pada `frontend/src/pages/Profile.jsx`.

---

### 3. Penyatuan Konfigurasi PWA (`vite-plugin-pwa`)

- **Akar Masalah**:
  - Terdapat dua mekanisme PWA yang tumpang tindih:
    - File statis manual `frontend/public/manifest.json` (`theme_color: #000000`) + `frontend/public/service-worker.js` (tidak pernah didaftarkan di `main.jsx`) dan tag `<link rel="manifest" href="/manifest.json" />` di `frontend/index.html`.
    - Plugin `vite-plugin-pwa` di `frontend/vite.config.js` yang secara otomatis menghasilkan `dist/manifest.webmanifest` (`theme_color: #FF5500`) dan `dist/registerSW.js` (Workbox).
  - Selain itu, `includeAssets` di `vite.config.js` mereferensikan file yang tidak ada di `public/` (`favicon.ico`, `apple-touch-icon.png`, `masked-icon.svg`).
- **Perbaikan**:
  - Menghapus `frontend/public/service-worker.js` dan `frontend/public/manifest.json`.
  - Menghapus `<link rel="manifest" href="/manifest.json" />` dari `frontend/index.html` (karena `vite-plugin-pwa` otomatis menyuntikkan `<link rel="manifest" href="/manifest.webmanifest">` saat build) dan menyelaraskan `<meta name="theme-color" content="#FF5500" />`.
  - Memperbarui konfigurasi `VitePWA` di `frontend/vite.config.js`:
    - `includeAssets: ['Logo.png']` sesuai aset aktual di `frontend/public/`.
    - Menambahkan `start_url: '/'` serta menyelaraskan metadata `name: 'TrueKicks Store'`, `short_name: 'TRUEKICKS'`, dan path ikon `/Logo.png`.

---

## Hasil Verifikasi

- **Git Monorepo Check**: `backend/.git` dan `frontend/.git` sudah terhapus; `git rev-parse --show-toplevel` dari `backend/` maupun `frontend/` menunjuk ke root `C:/Users/Lenovo/TrueKicks`.
- **Dead File & Reference Check**: Seluruh file legacy terhapus (`Test-Path` = `False`) dan tidak ada impor rusak di seluruh `frontend/src/`.
- **Build Check (`vite build`)**: Seluruh modul frontend berhasil di-transform dan di-bundle (`dist/manifest.webmanifest` & `dist/registerSW.js` dihasilkan dari satu sumber kebenaran `vite-plugin-pwa`). *(Catatan: langkah post-build `workbox-build` di sandbox Windows tetap terblokir akses `C:\Users\Lenovo\package.json`; jalankan `npm run build` di terminal lokal untuk verifikasi penuh generasi service worker).*

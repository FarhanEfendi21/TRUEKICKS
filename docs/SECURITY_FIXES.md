# Dokumentasi Perbaikan Keamanan (Security Fixes) — TrueKicks

Dokumen ini mencatat seluruh perbaikan kerentanan keamanan prioritas tinggi (Bagian A) yang diterapkan pada **Backend** dan **Frontend** project **TrueKicks**.

---

## Ringkasan Perbaikan

| # | Masalah Keamanan | Tingkat Risiko | Status | File Terkait |
| :-: | :--- | :---: | :---: | :--- |
| 1 | File `.env` ter-track di Git | **Kritis** | Fixed *(butuh rotasi key manual)* | `.gitignore`, `backend/.gitignore`, `frontend/.gitignore`, `backend/.env.example`, `frontend/.env.example` |
| 2 | IDOR pada Endpoint Protected & Password Leak di `PUT /api/users/:id` | **Tinggi** | Fixed | `backend/index.js`, `backend/middleware/validation.js` |
| 3 | Harga & Diskon Order dipercaya dari Client (`POST /api/orders`) | **Kritis** | Fixed | `backend/index.js`, `backend/middleware/validation.js`, `frontend/src/pages/ProductDetail.jsx`, `frontend/src/pages/Checkout.jsx` |
| 4 | Endpoint `POST /api/reviews` tanpa autentikasi & validasi | **Tinggi** | Fixed | `backend/index.js`, `backend/middleware/validation.js`, `frontend/src/pages/ProductDetail.jsx`, `frontend/src/components/Reviews.jsx` |
| 5 | CORS memantulkan semua origin & fallback `JWT_SECRET` hardcoded (+ ESM hoisting) | **Tinggi** | Fixed | `backend/index.js`, `backend/middleware/auth.js` |
| 6 | Duplikasi `apiLimiter` & debug dump seluruh tabel `coupons` | **Sedang** | Fixed | `backend/index.js` |

---

## Detail Perbaikan

### 1. File `.env` Ter-track di Git

- **Akar Masalah**:
  - `backend/.env` (berisi `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`) dan `frontend/.env` sudah terlanjur di-commit ke Git (baik di root repo maupun nested repo `backend/` dan `frontend/`).
  - Root folder tidak memiliki `.gitignore`.
- **Perbaikan**:
  - Menghapus `.env` dari indeks Git tanpa menghapus file lokal menggunakan `git rm --cached`:
    - Root repo: `git rm --cached backend/.env frontend/.env`
    - Nested repo: `git -C backend rm --cached .env` & `git -C frontend rm --cached .env`
  - Membuat root `.gitignore` serta memperbarui `backend/.gitignore` dan `frontend/.gitignore` agar mengabaikan `.env` dan `.env.*` dengan pengecualian `!.env.example`.
  - Membuat template aman `backend/.env.example` dan `frontend/.env.example` tanpa kredensial asli.
- **Tindakan Lanjutan Wajib (Manual)**:
  - Karena file `.env` lama masih tercatat di **riwayat commit Git**, Anda **wajib**:
    1. **Rotate** `SUPABASE_KEY` / `VITE_SUPABASE_ANON_KEY` (khususnya jika sebelumnya memakai Service Role Key) di dashboard Supabase.
    2. **Generate ulang `JWT_SECRET`** (acak minimal 32 karakter, contoh: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
    3. Perbarui environment variable tersebut di lokal (`.env`) dan dashboard **Vercel**.
    4. *(Opsional namun disarankan jika repo publik)* Bersihkan riwayat `.env` dari git history menggunakan `git filter-repo --invert-paths --path backend/.env --path frontend/.env` lalu force-push.

---

### 2. IDOR pada Endpoint Protected & Password Leak di `PUT /api/users/:id`

- **Akar Masalah**:
  - `PUT /api/users/:id`, `GET /api/orders/user/:userId`, dan `POST /api/orders` sudah memakai `authMiddleware` (yang mengisi `req.userId`), tetapi tidak pernah membandingkan `req.userId` dengan `id`/`userId`/`user_id` target. Akibatnya, user yang login bisa melihat order orang lain, membuat order atas nama orang lain, atau mengubah nama profil user lain.
  - `PUT /api/users/:id` mengembalikan `data[0]` secara mentah yang ikut menyertakan hash `password`.
- **Perbaikan**:
  - **`PUT /api/users/:id`**:
    - Menambahkan `updateProfileValidation` + `validate`.
    - Memverifikasi `Number(req.userId) === parsed_user_id`; jika tidak cocok, mengembalikan **`403 Forbidden`**.
    - Menghapus properti `password` (`delete userResponse.password`) sebelum mengembalikan response JSON.
  - **`GET /api/orders/user/:userId`**:
    - Memverifikasi `Number(req.userId) === parsed_user_id`; jika tidak cocok, mengembalikan **`403 Forbidden`**.
    - Memperbarui `frontend/src/pages/OrderHistory.jsx` agar memakai instance terpusat `api` (`src/lib/api.js`) sehingga cookie autentikasi dan fallback port `5000` konsisten.
  - **`POST /api/orders`**:
    - Menggunakan `Number(req.userId)` dari JWT sebagai pemilik order.
    - Jika `req.body.user_id` dikirim dan berbeda dengan `req.userId`, mengembalikan **`403 Forbidden`**.

---

### 3. Harga & Diskon Order Dipercaya dari Client (`POST /api/orders`)

- **Akar Masalah**:
  - Client mengirimkan `total_price` dan `items` (beserta `item.price`) dan backend langsung menyimpannya ke tabel `orders`. Penyerang dapat memanipulasi payload (misal `total_price: 1` atau `quantity: -5`) untuk checkout dengan harga palsu.
  - Kupon hanya dicek di halaman Cart (`POST /api/coupons/verify`), tidak pernah diverifikasi ulang saat checkout di backend.
- **Perbaikan**:
  - **Backend (`backend/index.js` & `backend/middleware/validation.js`)**:
    - Menambahkan `orderValidation` + `validate` (validasi alamat, nomor telepon, `items` minimal 1, `quantity` integer `1..100`, `size`, whitelist `productType`, dan opsional `coupon_code`).
    - Menambahkan helper `resolveProductFromDB(item)`: setiap item di-lookup ulang ke tabel Supabase yang sesuai (`products`, `sneakers`, `apparel`, `sale_products`) dan memakai harga otoritatif dari DB (`discount_price` untuk `sale_products` jika tersedia, selain itu `price`). Untuk kompatibilitas keranjang `localStorage` lama tanpa `productType`, lookup mencocokkan `(id, name)` secara eksak dan tetap memakai harga DB.
    - Menambahkan helper `verifyCouponFromDB(code, subtotal)`: jika `coupon_code` dikirim, server memverifikasi ulang kode kupon, masa berlaku (`expiry_date`), dan `min_purchase` terhadap subtotal hasil hitung server, lalu menghitung potongan diskon di server.
    - `total_price` dan `items` yang disimpan ke `orders` sepenuhnya berasal dari kalkulasi server (nilai `price` & `total_price` dari client diabaikan).
    - Response `201` tetap backward-compatible (`{ message, order, pricing: { subtotal, discount_amount, total_price } }`).
  - **Frontend**:
    - `frontend/src/pages/ProductDetail.jsx`: menyertakan `productType: type` saat `addToCart` serta menampilkan & menambahkan `effectivePrice` (`discount_price` untuk produk `sale_products`) agar harga di UI konsisten dengan kalkulasi server.
    - `frontend/src/pages/Checkout.jsx`: beralih ke instance `api` (`src/lib/api.js`), mengirimkan `coupon_code: discount?.code || undefined` dan `items` berisi `{ id, productType, name, size, quantity }` (tanpa mengandalkan `user_id` & `total_price` client), serta menolak user Guest.

---

### 4. Endpoint `POST /api/reviews` Tanpa Autentikasi & Validasi

- **Akar Masalah**:
  - `POST /api/reviews` dapat dipanggil tanpa login dengan `user_id`, `rating`, atau `product_type` sembarang, rawan spam dan pemalsuan identitas (*user spoofing*).
- **Perbaikan**:
  - **Backend (`backend/index.js` & `backend/middleware/validation.js`)**:
    - Melindungi `POST /api/reviews` dengan `authMiddleware`, `reviewValidation`, dan `validate`.
    - Validasi ketat: `product_id` integer positif, `product_type` masuk whitelist (`products`, `sneakers`, `apparel`, `sale_products`), `rating` integer `1..5`, `comment` 1–1000 karakter.
    - Menggunakan `req.userId` dari JWT untuk kolom `user_id`, dan menolak request dengan **`403 Forbidden`** jika body mencoba mengirim `user_id` milik user lain.
  - **Frontend**:
    - `frontend/src/pages/ProductDetail.jsx` dan `frontend/src/components/Reviews.jsx`: beralih ke `api.post("/api/reviews", ...)` (mengirim HttpOnly cookie secara otomatis, tidak mengirim `user_id` dari `localStorage`, serta menampilkan pesan error validasi yang jelas).

---

### 5. CORS Terlalu Permisif & Fallback `JWT_SECRET` Hardcoded (+ Bug ESM Hoisting)

- **Akar Masalah**:
  - Express CORS memantulkan origin apa pun (`callback(null, origin)`) bersama `credentials: true`, sehingga situs eksternal mana pun bisa melakukan credentialed request ke API.
  - `backend/middleware/auth.js` memakai fallback `'truekicks-secret-key-change-in-production'`.
  - **Bug tersembunyi (ESM Hoisting)**: Di `backend/index.js` sebelumnya, `import { ... } from "./middleware/auth.js"` dieksekusi *sebelum* `dotenv.config()`, sementara `auth.js` tidak memuat `dotenv`. Akibatnya, saat berjalan lokal, `process.env.JWT_SECRET` selalu terbaca `undefined` dan server diam-diam menandatangani semua token memakai fallback hardcoded!
- **Perbaikan**:
  - **JWT (`backend/middleware/auth.js` & `backend/index.js`)**:
    - Memasang `import "dotenv/config";` pada baris pertama `backend/index.js` dan `backend/middleware/auth.js`.
    - Menghapus fallback secret hardcoded dan menerapkan validasi **fail-fast** saat startup: server langsung melempar `FATAL` error jika `JWT_SECRET` kosong atau bernilai placeholder, serta memberi warning jika panjang `< 32` karakter.
  - **CORS (`backend/index.js`)**:
    - Menerapkan whitelist origin eksplisit:
      - `https://truekicks-production.vercel.app`
      - `http://localhost:5173`
      - `http://localhost:4173`
      - Tambahan opsional melalui env var `ALLOWED_ORIGINS` (dipisahkan koma).
    - Origin di luar whitelist ditolak oleh global error handler dengan **`403 Forbidden`** tanpa menyertakan header `Access-Control-Allow-Origin`.

---

### 6. Middleware Rate Limiter Duplikat & Debug Dump Tabel `coupons`

- **Akar Masalah**:
  - `app.use('/api', apiLimiter)` tertulis dua kali berturut-turut di `backend/index.js`, menyebabkan setiap request dihitung 2x (kuota efektif terpotong setengah).
  - `POST /api/coupons/verify` melakukan `SELECT * FROM coupons` ekstra dan mencetak seluruh isi tabel kupon beserta input mentah ke `console.log` pada setiap request.
- **Perbaikan**:
  - Menghapus duplikasi `app.use('/api', apiLimiter)` sehingga hanya terdaftar satu kali.
  - Menambahkan `app.set("trust proxy", 1)` agar pembacaan IP klien untuk rate limiting akurat di belakang proxy Vercel.
  - Menghapus query debug `SELECT * FROM coupons` dan seluruh `console.log` debug di `POST /api/coupons/verify`, serta menyatukan logikanya dengan helper `verifyCouponFromDB` (memilih kolom yang diperlukan saja dan memvalidasi `totalAmount` non-negatif).

---

## Ringkasan Perubahan Kontrak API

| Endpoint | Perubahan Kontrak | Dampak ke Consumer |
| :--- | :--- | :--- |
| `PUT /api/users/:id` | Menolak `403` jika `:id !== req.userId`; menghapus `password` dari response; validasi panjang `full_name` (2–100). | Aman untuk `Profile.jsx` (user hanya edit profil sendiri). |
| `GET /api/orders/user/:userId` | Menolak `403` jika `:userId !== req.userId`. | Aman untuk `Profile.jsx` & `OrderHistory.jsx`. |
| `POST /api/orders` | Mengabaikan `total_price` & `item.price` dari client; menerima opsional `coupon_code` dan `items[].productType`; `user_id` diambil dari JWT (tolak `403` jika mismatch); response menambah field `pricing`. | `ProductDetail.jsx` & `Checkout.jsx` sudah disesuaikan. |
| `POST /api/reviews` | Kini **wajib autentikasi** (`401` tanpa token, `403` jika spoof `user_id`, `400` jika invalid). | `ProductDetail.jsx` & `Reviews.jsx` sudah disesuaikan. |
| `POST /api/coupons/verify` | Menolak `totalAmount` negatif/bukan angka dengan `400`; tidak lagi mencetak daftar kupon ke log. | Kompatibel dengan `Cart.jsx`. |

---

## Hasil Verifikasi

Seluruh pengujian lokal berikut dijalankan setelah perbaikan diterapkan:

1. **Automated Security Verification (In-Memory Express via `serverless-http` + Mocked DB)**:
   - `JWT_SECRET` kosong / placeholder → **PASS** (process langsung gagal dengan error `FATAL: JWT_SECRET`).
   - CORS whitelist → **PASS** (`https://evil-attacker.example` ditolak `403` tanpa `Access-Control-Allow-Origin`; `https://truekicks-production.vercel.app` dan `http://localhost:5173` diizinkan `200` + `Access-Control-Allow-Credentials: true`).
   - Single `apiLimiter` → **PASS** (`ratelimit-remaining: 99` pada request `/api` pertama, bukan `98`).
   - Proteksi IDOR & Auth → **PASS** (`401` tanpa token, `403` untuk `PUT /api/users/999`, `GET /api/orders/user/999`, `POST /api/orders` dengan `user_id: 999`, dan `POST /api/reviews` dengan `user_id: 999`; `400` untuk `rating` di luar 1–5 dan `quantity` negatif).
   - Password stripping & server-side pricing/coupon math (mocked DB) → **PASS** (`password` tidak muncul di response `PUT /api/users/101`; order dengan spoof `price: 1` & `total_price: 1` + kupon `WELCOME10` dihitung ulang menjadi `2 × 1.500.000 - 10% = 2.700.000`; `POST /api/coupons/verify` hanya mengeksekusi 1 query terarah tanpa `SELECT *`).
2. **Frontend Lint & Build Check**:
   - ESLint pada file frontend yang diubah (`ProductDetail.jsx`, `Checkout.jsx`, `OrderHistory.jsx`, `Reviews.jsx`) bersih dari error.
   - Vite bundle compile berhasil untuk seluruh 274 modul.
3. **Git Untracking Check**:
   - `git ls-files backend/.env frontend/.env` (root) serta `git -C backend ls-files .env` dan `git -C frontend ls-files .env` mengembalikan kosong (sudah tidak ter-track), sementara file lokal tetap aman di disk.

> **Catatan Verifikasi Live**: Pengujian terhadap database **Supabase live** dan deployment **Vercel** belum dijalankan dari lingkungan sandbox (tanpa akses jaringan eksternal). Setelah deploy, pastikan untuk menguji alur Login → Update Profile → Add to Cart → Apply Coupon → Checkout → Post Review secara langsung.

---

## Checklist Pasca-Perbaikan (Sebelum/Saat Deploy)

- [ ] **Rotate** `SUPABASE_KEY` dan `JWT_SECRET`, lalu perbarui di `backend/.env`, `frontend/.env`, dan Vercel Environment Variables.
- [ ] Pastikan variabel `JWT_SECRET` sudah terpasang di project Vercel backend (server kini sengaja *fail-fast* jika kosong).
- [ ] Jika ada domain frontend tambahan (misal preview URL Vercel), tambahkan ke environment variable `ALLOWED_ORIGINS` di Vercel backend (dipisahkan koma).
- [ ] Commit perubahan (termasuk penghapusan tracking `.env`) dan deploy **backend** serta **frontend** bersamaan.
- [ ] *(Perhatian)* Karena bug ESM hoisting sebelumnya membuat backend lokal menandatangani JWT dengan fallback secret, token lama di browser akan otomatis menjadi tidak valid setelah update — cukup lakukan **Logout & Login ulang**.

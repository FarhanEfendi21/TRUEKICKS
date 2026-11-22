# Dokumentasi Perbaikan Bug Fungsional & Inkonsistensi (Bagian B) — TrueKicks

Dokumen ini mencatat seluruh perbaikan bug fungsional, inkonsistensi data/API, dan masalah interaksi UI (Bagian B) pada aplikasi frontend **TrueKicks**.

---

## Ringkasan Perbaikan

| # | Kategori Bug | Status | File yang Dimodifikasi |
| :-: | :--- | :---: | :--- |
| 1 | Harga diskon `sale_products` tidak konsisten di Detail, Cart, Wishlist, Rekomendasi & Search | Fixed | `frontend/src/pages/ProductDetail.jsx`, `frontend/src/pages/Search.jsx` |
| 2 | Route navigasi produk salah tabel (`Home` & `Wishlist`) | Fixed | `frontend/src/pages/Home.jsx`, `frontend/src/pages/Wishlist.jsx` |
| 3 | Bentrok ID antar tabel pada Cart, Wishlist, dan rating/sortir Review | Fixed | `frontend/src/Context/CartContext.jsx`, `frontend/src/Context/WishlistContext.jsx`, `frontend/src/components/Navbar.jsx`, `frontend/src/components/ProductCard.jsx`, `frontend/src/pages/Cart.jsx`, `frontend/src/pages/Wishlist.jsx`, `frontend/src/pages/ProductDetail.jsx`, `frontend/src/pages/Sneakers.jsx`, `frontend/src/pages/Apparel.jsx` |
| 4 | Notifikasi toast di Cart (dan halaman lain) tidak tampil | Fixed | `frontend/src/App.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/ProductDetail.jsx`, `frontend/src/pages/Checkout.jsx` |
| 5 | Validasi password register & pesan error backend tidak sinkron | Fixed | `frontend/src/pages/Login.jsx` |
| 6 | Fallback port (`5001` vs `5000`) & pemakaian `axios` langsung tidak konsisten | Fixed | `frontend/src/pages/Home.jsx`, `Catalog.jsx`, `Sneakers.jsx`, `Apparel.jsx`, `Sale.jsx`, `ProductDetail.jsx`, `Cart.jsx`, `Login.jsx`, `Search.jsx`, `frontend/src/components/SearchBar.jsx`, `frontend/src/hooks/useApi.js` |
| 7 | Bug UI & interaksi minor (refetch `Sneakers`, `typeFilter` mega-menu, dual range slider, tombol tanpa aksi) | Fixed | `frontend/src/pages/Sneakers.jsx`, `frontend/src/pages/Apparel.jsx`, `frontend/src/components/ProductCard.jsx`, `frontend/src/pages/Home.jsx`, `frontend/src/pages/Sale.jsx` |

---

## Detail Perbaikan

### 1. Diskon Sale Hilang di Detail, Cart, Wishlist, Rekomendasi & Search

- **Akar Masalah**:
  - `Sale.jsx` menampilkan `discount_price`, tetapi `ProductDetail.jsx` sebelumnya menampilkan `product.price` serta memasukkan `product.price` ke Wishlist/Cart dan rekomendasi "You Might Also Like".
  - `Search.jsx` juga menampilkan `item.price` untuk hasil `sale_products`.
- **Perbaikan**:
  - Di `frontend/src/pages/ProductDetail.jsx`:
    - Menghitung `effectivePrice` (`Number(product.discount_price)` jika `type === "sale_products"` dan `discount_price != null`, selain itu `Number(product.price)`).
    - Memakai `effectivePrice` pada tampilan harga (disertai harga coret jika lebih rendah dari harga normal), `addToCart`, dan `addToWishlist`.
    - Memperbarui tampilan harga pada section "You Might Also Like" agar memakai `discount_price` saat `type === "sale_products"`.
  - Di `frontend/src/pages/Search.jsx`: menampilkan `discount_price` untuk item bertipe `sale_products`.

---

### 2. Route Produk Salah Tabel (`Home.jsx` & `Wishlist.jsx`)

- **Akar Masalah**:
  - Pada `Home.jsx`, bagian `topPicks` (bersumber dari tabel `products`) menavigasi ke `/product/sneakers/${item.id}`, berbeda dengan `newArrivals` dan `blackCollection` yang mengarah ke `/product/products/${item.id}`.
  - Pada `Wishlist.jsx`, klik item di-hardcode ke `/product/sneakers/${item.id}` sehingga item dari `apparel`, `sale_products`, atau `products` membuka tabel yang salah.
- **Perbaikan**:
  - Mengubah navigasi `topPicks` di `frontend/src/pages/Home.jsx` ke `/product/products/${item.id}`.
  - Mengubah navigasi item di `frontend/src/pages/Wishlist.jsx` ke `/product/${item.productType || "sneakers"}/${item.id}`.

---

### 3. Bentrok ID Antar Tabel (`sneakers`, `apparel`, `sale_products`, `products`)

- **Akar Masalah**:
  - Tabel produk terpisah memiliki `id` auto-increment masing-masing (misal `sneakers` id `1` dan `apparel` id `1`).
  - `CartContext.jsx` dan `WishlistContext.jsx` hanya membandingkan `item.id` (dan `size` untuk Cart) tanpa `productType`.
  - `ProductCard.jsx`, `Sneakers.jsx`, dan `Apparel.jsx` memfilter `reviews` hanya dengan `r.product_id === item.id` tanpa memeriksa `r.product_type`, sehingga rating antar tabel tercampur.
- **Perbaikan**:
  - **`CartContext.jsx`**: Menambahkan identitas komposit `(id, size, productType)` pada `addToCart`, `removeFromCart`, dan `updateQuantity` dengan fallback `normalizeProductType` (`"sneakers"`) agar tetap kompatibel dengan data `localStorage` lama.
  - **`WishlistContext.jsx`**: Menambahkan identitas komposit `(id, productType)` pada `addToWishlist`, `removeFromWishlist`, dan `isInWishlist`.
  - Memperbarui pemanggilan dan React `key` komposit (`${item.productType || "sneakers"}-${item.id}...`) di `Cart.jsx`, `Wishlist.jsx`, `Navbar.jsx`, dan `ProductDetail.jsx`.
  - **`ProductCard.jsx`, `Sneakers.jsx`, `Apparel.jsx`**: Menambahkan syarat `r.product_type === productType` (atau `"sneakers"` / `"apparel"`) pada kalkulasi rating kartu dan sortir `"reviewed"`.

---

### 4. Toast Global di `App.jsx` (Perbaikan Notifikasi di `Cart.jsx`)

- **Akar Masalah**:
  - Komponen `<Toaster />` hanya dipasang secara lokal di `Login.jsx`, `ProductDetail.jsx`, dan `Checkout.jsx`. Halaman `Cart.jsx` memanggil `toast.success` / `toast.error` saat menerapkan kupon, tetapi tidak ada `<Toaster />` yang ter-render sehingga notifikasi tidak pernah muncul.
- **Perbaikan**:
  - Memasang satu `<Toaster position="top-center" />` secara global di `frontend/src/App.jsx`.
  - Menghapus `<Toaster />` duplikat dari `Login.jsx`, `ProductDetail.jsx`, dan `Checkout.jsx` agar notifikasi konsisten di seluruh halaman tanpa duplikasi.

---

### 5. Sinkronisasi Validasi Password Register (`Login.jsx` vs Backend)

- **Akar Masalah**:
  - `backend/middleware/validation.js` mewajibkan `full_name` 2–100 karakter dan `password` minimal 6 karakter + minimal 1 angka (`/\d/`), lalu mengembalikan array `errors` pada HTTP `400`.
  - `Login.jsx` sebelumnya hanya memeriksa panjang password ≥ 6 dan hanya menampilkan `error.response.data.message` (`"Validation failed"`), tidak menampilkan rincian `errors`.
- **Perbaikan**:
  - Menambahkan validasi panjang `fullName` (2–100 karakter) dan keberadaan minimal satu angka (`/\d/`) pada `handleSubmit` serta pesan inline `getPasswordError()` di `frontend/src/pages/Login.jsx`.
  - Memperbarui placeholder input password pada tab Sign Up agar persyaratan jelas bagi pengguna.
  - Menampilkan array `error.response.data.errors` dari backend di toast error saat validasi gagal.

---

### 6. Standardisasi Instance `api.js` & Penghapusan Fallback Port `5001`

- **Akar Masalah**:
  - Backend berjalan di port `5000`, namun sebagian besar halaman memanggil `axios` langsung dengan fallback `http://localhost:5001` dan tidak memanfaatkan instance terpusat `src/lib/api.js` (yang menangani `baseURL`, `withCredentials: true`, dan interceptor auto-logout `401`).
  - `frontend/src/hooks/useApi.js` juga menggunakan port `5001`, opsi React Query v4 (`cacheTime`), serta path endpoint yang tidak cocok dengan backend (`/api/sale_products`, `/api/${type}/${id}`, `?product_type=`).
- **Perbaikan**:
  - Mengganti seluruh pemanggilan `axios` langsung ke instance terpusat `api` (`frontend/src/lib/api.js`) di `Home.jsx`, `Catalog.jsx`, `Sneakers.jsx`, `Apparel.jsx`, `Sale.jsx`, `ProductDetail.jsx`, `Cart.jsx`, `Login.jsx`, `Search.jsx`, `SearchBar.jsx`, dan `hooks/useApi.js`.
  - Menyelaraskan path endpoint di `hooks/useApi.js` (`/api/sale`, `/api/detail/${type}/${id}`, `?type=${productType}`) serta mengganti `cacheTime` menjadi `gcTime` (TanStack Query v5).

---

### 7. Bug UI & Interaksi Minor

1. **Refetch Berulang & `typeFilter` di `Sneakers.jsx`**:
   - Memisahkan fetch awal `GET /api/sneakers` ke `useEffect(..., [])` agar hanya dipanggil sekali saat mount.
   - Menyatukan seluruh logika filter (Brand, Category/Shoe Type, Keyword, Price Range) dan sort (`price-asc`, `price-desc`, `reviewed`) ke satu `useEffect` client-side.
   - Menambahkan penanganan `location.state.typeFilter` (dari mega-menu "Categories" di `Navbar.jsx`) dan pencocokan brand case-insensitive (misal `"Asics"` → `"ASICS"`).
   - Memperbaiki kondisi dan aksi tombol `Reset All` agar mereset `sortOption` ke `"price-asc"` serta membersihkan `searchKeyword`.
2. **Dual Range Slider Harga di `Sneakers.jsx` & `Apparel.jsx`**:
   - Menambahkan `pointer-events-none` pada track kedua `<input type="range">` dan `pointer-events-auto` khusus pada thumb (`::-webkit-slider-thumb` & `::-moz-range-thumb`), disertai penyesuaian `z-index` dinamis pada slider minimum saat mendekati batas maksimum sehingga kedua thumb dapat digeser bebas.
3. **Tombol Tanpa Aksi (No-Op)**:
   - `ProductCard.jsx`: Tombol `+` kini menavigasi ke halaman detail produk (`/product/${productType}/${item.id}`).
   - `Home.jsx`: Tombol heart pada kartu *Top Picks* kini terhubung ke `WishlistContext` (`productType: "products"`) dengan proteksi Guest & toast; tombol `+` pada kartu *Fresh Kicks* kini menavigasi ke `/product/products/${item.id}`.
   - `Sale.jsx`: Tombol *"Shop Now"* pada banner kini melakukan smooth scroll menuju grid produk sale (`productsGridRef`).

---

## Hasil Verifikasi

- **Static Check (`Select-String`)**: Tidak ada lagi referensi fallback `localhost:5001`, pemanggilan `axios.` langsung di luar `src/lib/api.js` & global `withCredentials` di `App.jsx`, maupun `<Toaster />` duplikat di halaman.
- **ESLint**: `0` error baru dari seluruh perubahan (`App.jsx`, `Login.jsx`, `ProductDetail.jsx`, `Checkout.jsx`, `OrderHistory.jsx`, `Wishlist.jsx`, `Sneakers.jsx`, `Apparel.jsx`, `Sale.jsx`, `Home.jsx`, `Search.jsx`, `SearchBar.jsx`, `useApi.js` lulus 0 error; tersisa 8 error *pre-existing* di luar perubahan ini pada `CartContext.jsx`, `WishlistContext.jsx`, `Navbar.jsx`, `ProductCard.jsx`, `Cart.jsx`, `Catalog.jsx`).
- **Build Check (`vite build`)**: Seluruh modul frontend ter-transform dan ter-bundle oleh Vite/Rollup tanpa error sintaks maupun error impor. *(Catatan: langkah post-build `workbox-build` PWA di sandbox Windows terblokir izin akses `C:\Users\Lenovo\package.json`; jalankan `npm run build` di terminal lokal untuk verifikasi penuh generasi service worker).*
- **Belum Diverifikasi Live**: Pengujian interaksi UI di browser terhadap server backend + Supabase live belum dijalankan dari sandbox.

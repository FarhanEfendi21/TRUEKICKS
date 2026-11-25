# TrueKicks — Rekap Status Implementasi Fitur Roadmap

**Tanggal Pembaruan:** 23 November 2026  
**Status Workspace:** Seluruh implementasi Tier 1 (#1–#3), Tier 2 (#4 & #5), dan Tier 3 (#7–#9) sudah selesai dan terverifikasi (`44/44` uji kontrak Postman CLI live).

---

## 1. Ringkasan Eksekutif

| Kategori | Total Fitur | Sudah Diimplementasikan | Belum Diimplementasikan | Progres |
| :--- | :---: | :---: | :---: | :---: |
| **Tier 1 — Core Commerce** | 3 | 3 | 0 | **100%** |
| **Tier 2 — Fitur Pembeda Sneaker Store** | 3 | 2 | 1 | 67% |
| **Tier 3 — Retensi & Polish Teknis** | 3 | 3 | 0 | **100%** |
| **Total Roadmap Utama (1–9)** | **9** | **8** | **1** | **89%** |

Selain 8 fitur roadmap utama di atas, telah diselesaikan pula fitur tambahan lintas aplikasi: **Sistem Dwibahasa Global (Bahasa Indonesia & English)** hingga ke AI Chat Kixo dan Admin Dashboard, **UX/UI Polish Fase 1–3**, **Hardening RLS seluruh tabel Supabase**, serta **Koleksi Uji Kontrak API Postman CLI v3 (44 request / 83 assertion)**.

---

## 2. Matriks Status Roadmap (Tier 1–3)

| No | Tier | Nama Fitur | Status | Lokasi Implementasi Utama |
| :-: | :--- | :--- | :---: | :--- |
| 1 | Tier 1 | Payment Gateway (Midtrans Snap / Xendit) + Webhook | **Selesai**§ | `backend/migrations/tier1_payment_gateway.sql`, `backend/services/paymentService.js`, `PaymentModal.jsx`, `Checkout.jsx`, `OrderHistory.jsx` |
| 2 | Tier 1 | Stok Real-Time per Ukuran (`product_variants`) | **Selesai**† | `backend/migrations/tier1_product_variants.sql`, `backend/services/inventoryService.js`, `ProductDetail.jsx`, `Cart.jsx`, `Checkout.jsx` |
| 3 | Tier 1 | Admin Dashboard (`/admin`) + RBAC | **Selesai**¶ | `backend/migrations/tier1_admin_rbac.sql`, `backend/middleware/auth.js`, `backend/services/adminService.js`, `AdminDashboard.jsx`, `RevenueChart.jsx`, `AdminModals.jsx` |
| 4 | Tier 2 | AI Sneaker Concierge (**Kixo**) | **Selesai** | `backend/services/conciergeService.js`, `frontend/src/components/ConciergeDrawer.jsx` |
| 5 | Tier 2 | Drop Calendar & Flash Sale Countdown (`/drops`) | **Selesai**‡ | `backend/migrations/tier2_drop_calendar.sql`, `backend/services/dropsService.js`, `Drops.jsx`, `HypeQueueModal.jsx` |
| 6 | Tier 2 | Side-by-Side Sneaker Compare | Belum | — |
| 7 | Tier 3 | Cloud-Synced Cart, Wishlist & Saved Addresses | **Selesai** | `backend/migrations/tier3_retention_and_authenticity.sql`, `CartContext.jsx`, `WishlistContext.jsx`, `Checkout.jsx`, `Profile.jsx` |
| 8 | Tier 3 | Order Tracking Timeline, Invoice PDF & Email Notifikasi | **Selesai** | `OrderTrackingTimeline.jsx`, `frontend/src/lib/invoicePdf.js`, `backend/services/emailService.js`, `backend/services/authenticity.js` |
| 9 | Tier 3 | Interactive Zoom Loupe & Digital Authenticity Tag | **Selesai*** | `ZoomLoupe.jsx`, `VerifyAuthenticity.jsx`, `backend/services/authenticity.js` |

*\*Catatan #9: Interactive Zoom Loupe (desktop hover 2.6x + fullscreen Texture Inspector 1x/2x/3x drag-to-pan) dan Digital Authenticity Tag (HMAC-SHA256 + halaman verifikasi `/verify` & `/verify/:code`) sudah selesai penuh. Mode 360° viewer belum ditambahkan karena aset gambar katalog saat ini masih berupa foto produk statis.*  
*†Catatan #2: Migrasi SQL (`backend/migrations/tier1_product_variants.sql`), layanan stok atomik backend, UI frontend, dan uji kontrak Postman sudah selesai penuh. Jika RLS diaktifkan pada `product_variants`, `SUPABASE_SERVICE_ROLE_KEY` wajib diset di backend agar RPC `deduct_variant_stocks` (`SELECT ... FOR UPDATE`) dapat memotong stok.*  
*‡Catatan #5: Migrasi SQL (`backend/migrations/tier2_drop_calendar.sql`), layanan backend drops + hype queue, halaman `/drops`, dan 5 uji kontrak Postman sudah selesai dengan graceful fallback katalog. Jalankan file SQL tersebut di Supabase SQL Editor untuk menyimpan pengingat ke tabel `drop_reminders` live.*  
*§Catatan #1: Integrasi Midtrans Snap REST API, verifikasi webhook SHA-512 idempoten, pengembalian stok otomatis saat kedaluwarsa, tombol Bayar Sekarang, dan mode Sandbox Simulator lokal sudah selesai penuh. Kolom payment di tabel `orders` sudah aktif di Supabase; pasang `MIDTRANS_SERVER_KEY` + `MIDTRANS_CLIENT_KEY` saat beralih ke Midtrans Snap live.*  
*¶Catatan #3: RBAC (`adminMiddleware` terverifikasi langsung ke DB + dukungan `ADMIN_EMAILS`), 17 endpoint `/api/admin/*` + `/api/auth/me`, dashboard minimalist `/admin` (dwibahasa ID/EN), dan 8 uji kontrak Postman RBAC sudah selesai penuh. Jalankan `backend/migrations/tier1_admin_rbac.sql` di Supabase SQL Editor dan promosikan email admin Anda (`UPDATE users SET role = 'admin' WHERE LOWER(email) = '...'`) atau set `ADMIN_EMAILS` di env backend.*

---

## 3. Rincian Fitur yang Sudah Diimplementasikan

### A. Roadmap Utama (8 Fitur Selesai)

#### 1. Payment Gateway (Midtrans Snap) + Webhook (Tier 1) — Selesai
- **Database & Migrasi:**
  - `backend/migrations/tier1_payment_gateway.sql` & `backend/schema.sql`: menambah kolom `payment_status`, `payment_gateway`, `payment_gateway_order_id`, `payment_token`, `payment_redirect_url`, `payment_method`, `paid_at`, `payment_expires_at`, dan `stock_restored` pada tabel `orders` beserta indeks unik `payment_gateway_order_id` dan backfill aman pesanan historis.
- **Backend:**
  - `backend/services/paymentService.js`: pembuatan transaksi Midtrans Snap REST (QRIS, VA BCA/BNI/BRI/Mandiri/Permata, GoPay, ShopeePay, Kartu Kredit), verifikasi signature kriptografis **SHA-512** dengan `crypto.timingSafeEqual`, state machine idempoten (`Pending Payment` → `Paid` / `Expired` / `Cancelled`), pengembalian stok otomatis via `restoreStockAtomic` (maksimal sekali via `stock_restored`), polling status Midtrans API v2, dan mode Sandbox Simulator lokal saat kunci Midtrans belum diisi.
  - `backend/index.js`: `POST /api/orders` kini membuat pesanan berstatus `Pending Payment` dengan sesi Snap; tambah `GET /api/payments/config`, `POST /api/payments/webhook`, `POST /api/orders/:id/pay` (Bayar Ulang khusus pemilik), `GET /api/orders/:id/payment-status`, dan `POST /api/payments/sandbox/simulate`.
  - `backend/services/authenticity.js`: timeline pesanan diperbarui mendukung tahap `Awaiting Payment`, `Payment Confirmed`, dan `Payment Expired`.
- **Frontend (Dwibahasa ID/EN):**
  - `frontend/src/lib/midtransSnap.js`: loader dinamis Midtrans `snap.js` (sandbox/produksi) dengan fallback redirect.
  - `frontend/src/components/PaymentModal.jsx`: modal pembayaran sandbox minimalist (`createPortal`, `z-[9999]`, pilihan QRIS, BCA VA, Mandiri VA, GoPay) yang mengeksekusi alur webhook bertanda tangan SHA-512 secara langsung.
  - `Checkout.jsx`, `OrderHistory.jsx`, `Profile.jsx`, `OrderTrackingTimeline.jsx`, `pricing.js`, & `translations.js`: popup pembayaran otomatis usai checkout, tombol **Bayar Sekarang / Pay Now** untuk pesanan `Pending Payment`, rekonsiliasi status pasca-redirect (`?payment=finish`), dan badge status `Pending Payment`/`Paid`/`Expired`.
- **Verifikasi:** Syntax backend `0`, unit test signature & state machine `9/9`, ESLint `0` error/warning, Vite bundle sukses, Postman CLI lint `0` error (`36` request), dan uji live `36/36` request (`68/68` assertion) lolos penuh termasuk penolakan signature palsu `403`, settlement `200`, dan blokir bayar ulang pada order lunas `400`.

#### 2. Stok Real-Time per Ukuran (`product_variants`) (Tier 1) — Selesai
- **Database & Migrasi:**
  - `backend/migrations/tier1_product_variants.sql` (idempoten) & cerminan skema di `backend/schema.sql`: tabel `product_variants` (`product_id`, `product_type`, `size`, `stock`, `low_stock_threshold`, `sku`), seed deterministik untuk seluruh `sneakers`, `apparel`, serta orphan `products`/`sale_products`, dan publikasi `supabase_realtime`.
  - Fungsi RPC PostgreSQL `deduct_variant_stocks(JSONB)` (penguncian baris `FOR UPDATE` terurut untuk mencegah deadlock & overselling) dan `restore_variant_stocks(JSONB)` untuk rollback otomatis jika insert order gagal atau pesanan dibatalkan.
- **Backend:**
  - `backend/services/inventoryService.js`: resolusi target kanonik (`products` & `sale_products` dipetakan ke ID `sneakers`/`apparel` agar stok tidak terpecah), status `in_stock` / `low_stock` / `out_of_stock` / `untracked`, pemotongan stok atomik, serta graceful fallback sebelum migrasi dijalankan.
  - `backend/index.js`: endpoint `GET /api/variants/:table/:id`, penyematan `variants` di `GET /api/detail/:table/:id`, pengayaan `available_stock` & `stock_warnings` di `GET /api/cart` & `PUT /api/cart`, serta pemotongan stok atomik + `409 Conflict` (`INSUFFICIENT_STOCK`) + rollback otomatis di `POST /api/orders`.
- **Frontend:**
  - `ProductDetail.jsx`: pemilih ukuran real-time (badge `Stok Real-Time`, sub-label & pil `Stok Menipis · Sisa N` / `Low Stock · N left`, penonaktifan otomatis ukuran `Habis` / `Sold Out`), pembatasan jumlah sesuai sisa stok & isi keranjang, sinkronisasi `Supabase Realtime` + refresh saat fokus tab, dan dukungan sticky CTA mobile dwibahasa `ID`/`EN`.
  - `CartContext.jsx`, `Cart.jsx`, & `Checkout.jsx`: sinkronisasi metadata stok keranjang, badge `Stok Menipis` / `Stok Habis` / tombol `Sesuaikan`, penguncian tombol checkout saat ada konflik stok, serta penanganan error `409 INSUFFICIENT_STOCK` yang otomatis menyegarkan keranjang.
- **Verifikasi:** Syntax backend `0`, ESLint `0` error/warning, Vite bundle sukses, 13/13 unit test logika inventori lolos, Postman CLI lint `0` error, dan uji live `26/26` request (`50/50` assertion) lolos (mode graceful pre-migration sebelum SQL dijalankan di Supabase).

#### 3. Admin Dashboard (`/admin`) + RBAC (Tier 1) — Selesai
- **Database & Migrasi:**
  - `backend/migrations/tier1_admin_rbac.sql` (idempoten) & cerminan di `backend/schema.sql`: menambah kolom `role` (`'customer' | 'admin'`, default `'customer'`, `CHECK users_role_check`) dan indeks `idx_users_role` pada tabel `users`.
- **Backend RBAC & Layanan Admin:**
  - `backend/middleware/auth.js`: `resolveUserRole()` membaca `users.role` serta daftar opsional `ADMIN_EMAILS`; `adminMiddleware` selalu memverifikasi peran langsung ke DB pada setiap request (`401` bila belum login, `403 ADMIN_REQUIRED` bila bukan admin) sehingga pencabutan akses berlaku seketika.
  - `backend/services/adminService.js` & `backend/middleware/validation.js` & `backend/index.js`:
    - `GET /api/auth/me` untuk verifikasi sesi & peran aktif di frontend.
    - `GET /api/admin/analytics`: KPI omzet terkonfirmasi, total & rata-rata order, seri grafik omzet harian (14 hari) & bulanan (6 bulan), produk terlaris, dan daftar peringatan stok ukuran menipis/habis.
    - CRUD Produk (`GET/POST /api/admin/products`, `PUT/DELETE /api/admin/products/:type/:id`) + matriks stok per ukuran (`PUT /api/admin/products/:type/:id/variants`) dengan invalidasi cache Kixo AI & kanonik inventori otomatis.
    - CRUD Promo Diskon (`GET/POST/PUT/DELETE /api/admin/sales`) dan Kupon (`GET/POST/PUT/DELETE /api/admin/coupons`).
    - Manajemen Pesanan (`GET /api/admin/orders`, `PATCH /api/admin/orders/:id`) untuk ubah status, kurir, dan nomor resi (`shipped_at`/`delivered_at`/`paid_at` otomatis + pengembalian stok atomik otomatis saat dibatalkan/kedaluwarsa).
    - Direktori Pengguna & RBAC (`GET /api/admin/users`, `PATCH /api/admin/users/:id/role`) dengan proteksi anti self-demotion.
- **Frontend (Dwibahasa ID/EN, Desain Minimalist):**
  - `frontend/src/pages/AdminDashboard.jsx`, `frontend/src/components/admin/RevenueChart.jsx`, `frontend/src/components/admin/AdminModals.jsx`: shell admin khusus di `/admin` dengan guard sesi live (redirect `/login` atau halaman `403 RBAC`), 5 tab kerja (`Overview`, `Orders`, `Catalog & Stock`, `Promos & Coupons`, `Users & Roles`), grafik batang SVG interaktif Harian/Bulanan, modal matriks restock ukuran, dan pengisian cepat promo dari katalog.
  - Terhubung di `App.jsx`, `Navbar.jsx` (dropdown akun khusus admin), `Profile.jsx` (tombol cepat admin), dan `translations.js`.
- **Verifikasi:** Syntax backend `0`, unit test RBAC & analitik `11/11`, ESLint `0` error/warning, Vite bundle sukses (`AdminDashboard` lazy chunk `15.25 kB` gzip), Postman CLI lint `0` error (`44` request), dan uji live `44/44` request (`83/83` assertion) lolos termasuk penolakan unauthenticated `401`, penolakan customer `403 ADMIN_REQUIRED`, update status & resi pesanan `200`, serta siklus buat/hapus kupon admin.

#### 4. AI Sneaker Concierge — Maskot **Kixo** (Tier 2) — Selesai
- **Spesifikasi:** `docs/AI_SNEAKER_CONCIERGE.md`
- **Backend:**
  - `POST /api/concierge/chat` (`backend/index.js`) dengan rate limit `conciergeLimiter` 15 req/menit/IP (`backend/middleware/rateLimit.js`) dan validasi `conciergeValidation` (`backend/middleware/validation.js`).
  - `backend/services/conciergeService.js`:
    - Snapshot katalog Supabase terdeduplikasi (`sneakers`, `apparel`, `sale_products`) dengan sinkronisasi harga diskon aktual + cache 60 detik.
    - Integrasi live Gemini REST API (`gemini-flash-lite-latest`) lengkap dengan fallback model otomatis (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`) saat `404`/`429`/`503`, serta fallback deterministik lokal jika kuota habis atau kunci belum diisi.
    - Guardrail deterministik `applyHardConstraints` (pre-filter & post-verify) untuk memastikan batasan budget (misal `<= 2 juta`), filter promo diskon, dan tipe produk tidak pernah dilanggar LLM.
    - Sinkronisasi bahasa otomatis via `context.language` (`id` / `en`) sehingga balasan dan saran `followups` konsisten 100% sesuai bahasa pilihan pengguna.
- **Frontend:**
  - `frontend/src/components/ConciergeDrawer.jsx` (terpasang global di `Layout.jsx`): maskot **Kixo** dengan ikon SVG geometris sneaker-visor kustom, floating sheet drawer minimalis modern (`sm:rounded-[28px]`, `createPortal`, `z-[9998]`, `data-lenis-prevent`, tombol `Escape`), grid `Mulai Cepat`, kartu rekomendasi produk yang dapat diklik langsung ke halaman detail produk, dan toggle bahasa `ID | EN`.
- **Verifikasi:** Teruji live `mode: "llm"` pada `ID` dan `EN`, serta 3 kontrak uji di koleksi Postman CLI (`21`, `22`, `23`).

#### 5. Drop Calendar & Flash Sale Countdown (`/drops`) (Tier 2) — Selesai
- **Database & Migrasi:**
  - `backend/migrations/tier2_drop_calendar.sql` (idempoten) & `backend/schema.sql`: tabel `drops` (jadwal rilis, tipe `limited_drop` / `flash_sale` / `exclusive_collab`, kuota terbatas, harga rilis & harga asli, tautan langsung ke `sneakers.id`) dan `drop_reminders` (`drop_id`, `user_id`, `email`, unik per `(drop_id, email)`), plus seed otomatis mengambil gambar & harga produk asli dari tabel `sneakers`.
- **Backend:**
  - `backend/services/dropsService.js`: kalkulasi status efektif real-time (`upcoming` / `live` / `sold_out` / `ended`), penghitungan `reminder_count` & `user_notified`, tiket antrean kriptografis (`TK-Q-XXXXXX`), serta graceful fallback katalog sebelum migrasi SQL dijalankan.
  - `backend/index.js`: `GET /api/drops` (`optionalAuth`), `POST /api/drops/:id/notify`, `DELETE /api/drops/:id/notify`, dan `POST /api/drops/:id/queue/join`.
- **Frontend (Dwibahasa ID/EN):**
  - `frontend/src/pages/Drops.jsx`: hero spotlight Flash Sale dengan hitung mundur 4-unit (`Hari`/`Jam`/`Mnt`/`Dtk`), filter tab (`Semua`, `Sedang Live`, `Akan Datang`, `Pengingat Saya`, `Arsip`), grid jadwal rilis, tombol **Ingatkan Saya / Notify Me** 1-klik (atau modal email untuk tamu) tersimpan ke DB + fallback lokal.
  - `frontend/src/components/HypeQueueModal.jsx`: simulasi ruang antrean rilis terbatas (`createPortal`, `z-[9999]`, `Escape`, `data-lenis-prevent`) dengan tiket antrean, posisi antrean & checkpoint anti-bot, jendela reservasi `03:00`, pemilih ukuran terhubung ke `/api/variants/:type/:id`, dan klaim langsung ke keranjang.
  - Terhubung penuh di `App.jsx` (`/drops`), `Navbar.jsx`, `BottomNav.jsx`, `Footer.jsx`, dan `translations.js`.
- **Verifikasi:** Syntax backend `0`, unit test `6/6`, ESLint `0` error/warning, Vite bundle sukses (`Drops` lazy chunk `36.25 kB`), Postman CLI lint `0` error (`31` request), dan seluruh 5 kontrak uji Drops (`27`–`31`) lolos live.

#### 7. Cloud-Synced Cart, Wishlist & Saved Addresses (Tier 3) — Selesai
- **Database:** Migrasi `backend/migrations/tier3_retention_and_authenticity.sql` dan `backend/schema.sql` telah diterapkan langsung ke Supabase live (`cart_items`, `wishlist_items`, `user_addresses`).
- **Backend (`backend/index.js`):**
  - `GET /api/cart`, `PUT /api/cart`, `DELETE /api/cart`
  - `GET /api/wishlist`, `PUT /api/wishlist`
  - `GET /api/addresses`, `POST /api/addresses`, `PUT /api/addresses/:id`, `DELETE /api/addresses/:id`
- **Frontend:**
  - `CartContext.jsx` & `WishlistContext.jsx`: sinkronisasi cloud otomatis saat login dengan fallback `localStorage` untuk tamu/offline.
  - `Checkout.jsx` & `Profile.jsx`: buku alamat pengiriman tersimpan (pilih 1-klik, simpan alamat baru dengan label Rumah/Kantor/Lainnya, hapus alamat).
- **Verifikasi:** Seluruh endpoint read/write dan proteksi `401` teruji live melalui Postman CLI terhadap Supabase.

#### 8. Order Tracking Timeline, Invoice PDF & Email Notifikasi (Tier 3) — Selesai
- **Backend:**
  - `backend/services/authenticity.js`: generasi nomor resi (`TKX-YYYYMMDD-<SHORT_ID>`), timeline 4 tahap pesanan, dukungan `orders.id` berbasis UUID maupun integer.
  - `backend/services/emailService.js`: pengiriman email konfirmasi pesanan HTML otomatis melalui Resend REST API (`POST /api/orders` mengembalikan `email_sent: true`).
  - Konfigurasi Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`) sudah terpasang di lokal `backend/.env` dan Vercel Backend (`truekicks-t2dw`).
- **Frontend:**
  - `frontend/src/components/OrderTrackingTimeline.jsx`: stepper progres 4 langkah terlokalisasi (`ID`/`EN`), tombol salin nomor resi, tombol sertifikat keaslian, dan tombol unduh Invoice PDF (terpasang di `OrderHistory.jsx` dan `Profile.jsx`).
  - `frontend/src/lib/invoicePdf.js`: generasi dokumen PDF invoice di sisi klien memakai `jspdf` (dynamic import agar tidak membebani bundle awal).
- **Verifikasi:** Teruji live checkout `POST /api/orders` (`201 Created`, `email_sent: true`) via Postman CLI.

#### 9. Interactive Zoom Loupe & Digital Authenticity Tag (Tier 3) — Selesai
- **Zoom Loupe (`frontend/src/components/ZoomLoupe.jsx` di `ProductDetail.jsx`):**
  - Kaca pembesar melingkar 2.6x saat hover di desktop dengan toggle aktif/mati.
  - Modal Fullscreen Texture Inspector (1x / 2x / 3x + drag-to-pan) dirender melalui `createPortal(..., document.body)` pada `z-[9999]` sehingga bebas dari konflik stacking context.
- **Digital Authenticity Tag:**
  - `backend/services/authenticity.js`: pembuatan dan verifikasi tanda tangan kriptografis HMAC-SHA256 (`TK-AUTH-<SHORT_ID>-<SIG>`) dengan `crypto.timingSafeEqual` serta masking nama pembeli (tanpa kebocoran PII).
  - Endpoint publik `GET /api/authenticity/:code` (`backend/index.js`).
  - Halaman publik `frontend/src/pages/VerifyAuthenticity.jsx` (`/verify` dan `/verify/:code`, terhubung dari `Footer.jsx`, `OrderHistory.jsx`, `Profile.jsx`, dan email konfirmasi).
- **Verifikasi:** Teruji live untuk kode valid (`200 OK`, bebas PII) dan kode palsu (`404 Not Found`) via Postman CLI.

---

### B. Fitur & Peningkatan Tambahan di Luar 9 Poin Roadmap (Selesai)

1. **Sistem Dwibahasa Global (`Bahasa Indonesia` & `English`):**
   - `frontend/src/Context/LanguageContext.jsx` & `frontend/src/lib/translations.js` (default `id`, persist di `localStorage`, sinkron `html[lang]`).
   - Toggle `ID | EN` tersedia di `Navbar.jsx`, `ConciergeDrawer.jsx`, `Profile.jsx`, `Footer.jsx`, dan `Login.jsx`.
   - Mencakup seluruh 14 halaman utama, banner, komponen filter/sort, validasi form, toast, status pesanan, format tanggal, hingga Kixo AI backend & frontend.
2. **Audit & Polish UX/UI Fase 1–3:**
   - Desain ulang `Sale.jsx` + `SaleBanner.jsx` dengan filter multi-facet, facet count `(N)`, active filter chips, dan `SortDropdown.jsx` terpadu di `Sneakers.jsx`, `Apparel.jsx`, dan `Sale.jsx`.
   - Mobile Search + halaman `/search?q=` dengan deduplikasi produk.
   - Editorial polish `Home.jsx` (`Shop By Brand`, `Top Picks`, `Fresh Kicks`, `Back In Black`), sticky mobile CTA bar di `ProductDetail.jsx`, serta utilitas harga terpadu `frontend/src/lib/pricing.js`.
3. **Suite Uji Kontrak API Postman:**
   - Koleksi v3 Git-native di `postman/collections/truekicks-api/` (44 request, 83 assertion, `0` error lint) beserta environment `Local` dan `Production`.

---

## 4. Rincian Fitur yang Belum Diimplementasikan (1 Fitur)

### Tier 2 — Fitur Pembeda Sneaker Store

6. **Side-by-Side Sneaker Compare**
   - **Kondisi Saat Ini:** Belum ada context/tray pembanding produk atau halaman/drawer perbandingan.
   - **Yang Perlu Dibangun:**
     - `CompareContext` (maksimal 2–3 produk) + tombol `Bandingkan / Compare` di `ProductCard.jsx` dan `ProductDetail.jsx`.
     - Floating comparison dock + panel/modal perbandingan berdampingan yang menampilkan foto, harga efektif, persentase diskon, rating & jumlah ulasan, kategori, merek, serta spesifikasi inti dengan sorotan nilai terbaik.

---

## 5. Checklist Kesiapan Deployment Saat Ini

| Item | Lokal | Produksi (Vercel / Supabase) |
| :--- | :---: | :---: |
| Migrasi SQL Tier 3 (`cart_items`, `wishlist_items`, `user_addresses`, kolom `orders`) | Aktif | **Sudah diterapkan di Supabase live** |
| Migrasi SQL Tier 1 (`backend/migrations/tier1_product_variants.sql` + `security_enable_rls_all_tables.sql`) | Aktif (`SUPABASE_SERVICE_ROLE_KEY` terpasang) | **Sudah diterapkan & teruji live (`44/44`)** |
| Migrasi SQL Tier 1 Payment (`backend/migrations/tier1_payment_gateway.sql`) | Aktif | **Kolom aktif di Supabase live** |
| Migrasi SQL Tier 1 Admin RBAC (`backend/migrations/tier1_admin_rbac.sql`) | Fallback `ADMIN_EMAILS` aktif | **Jalankan SQL & promosikan email admin Anda** |
| Migrasi SQL Tier 2 Drops (`backend/migrations/tier2_drop_calendar.sql`) | Fallback katalog aktif | **Belum dijalankan di Supabase SQL Editor** |
| Midtrans Snap Keys (`MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`) | Mode Sandbox Simulator aktif | **Opsional: tambahkan untuk popup Midtrans Snap live** |
| Resend Email (`RESEND_API_KEY`, `EMAIL_FROM`) | Aktif | **Sudah diatur di Vercel Backend (`truekicks-t2dw`)** |
| Gemini AI Key (`GEMINI_API_KEY`, `GEMINI_MODEL=gemini-flash-lite-latest`) | Aktif & teruji live | **Belum ditambahkan di Vercel Backend (`truekicks-t2dw`)** |
| Kode Tier 1 (#1–#3), Tier 2 (#4–#5), Tier 3 (#7–#9), Dwibahasa ID/EN, UX/UI Fase 1–3 | Aktif & teruji | **Tier 1 #3 & perbaikan SearchBar siap di-push ke GitHub** |

---

## 6. Rekomendasi Urutan Eksekusi Berikutnya

1. **Jalankan SQL `backend/migrations/tier1_admin_rbac.sql`** di Supabase SQL Editor lalu promosikan akun owner Anda menjadi `admin` (`UPDATE users SET role = 'admin' WHERE LOWER(email) = '...';`), atau tambahkan `ADMIN_EMAILS=...` di `backend/.env` dan Vercel Backend.
2. **Side-by-Side Sneaker Compare** — melengkapi 100% seluruh 9 fitur roadmap utama.

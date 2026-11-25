import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../../lib/api";
import { formatRupiah } from "../../lib/pricing";
import {
  MAX_DETAIL_IMAGES,
  deleteUploadedImage,
  uploadProductImage,
} from "../../lib/imageUpload";
import {
  MIN_IMAGE_SCALE,
  MAX_IMAGE_SCALE,
  MAX_IMAGE_OFFSET,
  parseImageFrame,
  formatImageFrameUrl,
  getImageFrameTransform,
} from "../../lib/imageFrame";

const SHOE_SIZES = ["38", "39", "40", "40.5", "41", "42", "42.5", "43", "44", "45", "46"];
const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const ORDER_STATUS_OPTIONS = [
  "Pending Payment",
  "Paid",
  "Processing",
  "Packed",
  "Shipped",
  "Delivered",
  "Completed",
  "Cancelled",
  "Expired",
];

const COURIER_PRESETS = [
  "TrueKicks Express",
  "JNE YES",
  "JNE Regular",
  "J&T Express",
  "SiCepat BEST",
  "AnterAja",
];

function ModalShell({ isOpen, onClose, title, subtitle, maxWidth = "max-w-lg", children }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[9995] flex items-center justify-center p-4 font-poppins"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-[2px] animate-fade-in"
      />
      <div
        data-lenis-prevent
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full ${maxWidth} max-h-[90vh] flex flex-col bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-fade-in`}
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-900 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-950 dark:text-white tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-gray-950 dark:focus:border-white transition-colors";
const labelCls =
  "block text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 mb-1.5";

// ============================================================
// 1. PRODUCT CREATE / EDIT MODAL
// ============================================================
export function ProductFormModal({ isOpen, onClose, initialProduct, onSaved, pick }) {
  const isEditing = Boolean(initialProduct?.id);
  const [form, setForm] = useState({
    product_type: "sneakers",
    name: "",
    category: "",
    categories: "",
    price: "",
    image_url: "",
    description: "",
    initial_stock: "8",
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState("");
  const coverFileInputRef = useRef(null);

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingCover(true);
    setError("");
    try {
      const uploaded = await uploadProductImage(file, {
        productType: form.product_type,
        productId: initialProduct?.id || null,
      });
      setForm((f) => ({ ...f, image_url: uploaded.public_url }));
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          pick("Gagal mengunggah gambar utama.", "Failed to upload main image.")
      );
    } finally {
      setUploadingCover(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    if (initialProduct) {
      setForm({
        product_type: initialProduct.product_type || "sneakers",
        name: initialProduct.name || "",
        category: initialProduct.category || "",
        categories: initialProduct.categories || "",
        price: initialProduct.price != null ? String(initialProduct.price) : "",
        image_url: initialProduct.image_url || "",
        description: initialProduct.description || "",
        initial_stock: "8",
      });
    } else {
      setForm({
        product_type: "sneakers",
        name: "",
        category: "",
        categories: "",
        price: "",
        image_url: "",
        description: "",
        initial_stock: "8",
      });
    }
  }, [isOpen, initialProduct]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        product_type: form.product_type,
        name: form.name.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        image_url: form.image_url.trim(),
        description: form.description.trim(),
      };
      if (form.product_type === "sneakers") {
        payload.categories = form.categories.trim();
      }
      if (!isEditing) {
        payload.initial_stock = Number(form.initial_stock) || 0;
        await api.post("/api/admin/products", payload);
      } else {
        await api.put(
          `/api/admin/products/${initialProduct.product_type}/${initialProduct.id}`,
          payload
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      const msgs = err.response?.data?.errors;
      setError(
        (Array.isArray(msgs) && msgs.join(". ")) ||
          err.response?.data?.error ||
          pick("Gagal menyimpan produk.", "Failed to save product.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? pick("Edit Produk", "Edit Product")
          : pick("Tambah Produk Baru", "Add New Product")
      }
      subtitle={
        isEditing
          ? `${initialProduct.product_type} · #${initialProduct.id}`
          : pick("Tambahkan item baru ke katalog Sneakers atau Apparel", "Add a new listing to Sneakers or Apparel catalog")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{pick("Tipe Katalog", "Catalog Type")}</label>
            <select
              disabled={isEditing}
              value={form.product_type}
              onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))}
              className={`${inputCls} disabled:opacity-60`}
            >
              <option value="sneakers">Sneakers</option>
              <option value="apparel">Apparel</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>
              {form.product_type === "sneakers"
                ? pick("Merek / Brand", "Brand")
                : pick("Kategori Pakaian", "Apparel Category")}
            </label>
            <input
              type="text"
              required
              placeholder={form.product_type === "sneakers" ? "Nike, Adidas, New Balance" : "Hoodie, Jacket, Tee"}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>{pick("Nama Produk", "Product Name")}</label>
          <input
            type="text"
            required
            placeholder="Nike Air Jordan 1 Low..."
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{pick("Harga (IDR)", "Price (IDR)")}</label>
            <input
              type="number"
              required
              min="1000"
              step="1000"
              placeholder="1850000"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className={`${inputCls} tabular-nums`}
            />
          </div>

          {form.product_type === "sneakers" ? (
            <div>
              <label className={labelCls}>{pick("Sub-Kategori", "Sub-Category")}</label>
              <input
                type="text"
                placeholder="Lifestyle, Running, Basketball"
                value={form.categories}
                onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))}
                className={inputCls}
              />
            </div>
          ) : !isEditing ? (
            <div>
              <label className={labelCls}>{pick("Stok Awal / Ukuran", "Initial Stock / Size")}</label>
              <input
                type="number"
                min="0"
                max="9999"
                value={form.initial_stock}
                onChange={(e) => setForm((f) => ({ ...f, initial_stock: e.target.value }))}
                className={`${inputCls} tabular-nums`}
              />
            </div>
          ) : null}
        </div>

        {!isEditing && form.product_type === "sneakers" && (
          <div>
            <label className={labelCls}>
              {pick("Stok Awal per Ukuran (38–46)", "Initial Stock per Size (38–46)")}
            </label>
            <input
              type="number"
              min="0"
              max="9999"
              value={form.initial_stock}
              onChange={(e) => setForm((f) => ({ ...f, initial_stock: e.target.value }))}
              className={`${inputCls} tabular-nums`}
            />
          </div>
        )}

        <div>
          <label className={labelCls}>{pick("Foto Utama (URL atau Upload)", "Main Image (URL or Upload)")}</label>
          <div className="flex items-center gap-2.5">
            <input
              type="url"
              required
              placeholder="https://..."
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              className={inputCls}
            />
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleCoverUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingCover}
              onClick={() => coverFileInputRef.current?.click()}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {uploadingCover ? pick("Mengunggah...", "Uploading...") : pick("Upload", "Upload")}
            </button>
            {form.image_url && (
              <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-200 border border-gray-200 dark:border-gray-700 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls}>{pick("Deskripsi", "Description")}</label>
          <textarea
            rows={3}
            placeholder={pick("Detail material, fit, dan keaslian...", "Material details, fit, and specs...")}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-900 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            {pick("Batal", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting
              ? pick("Menyimpan...", "Saving...")
              : isEditing
                ? pick("Simpan Perubahan", "Save Changes")
                : pick("Buat Produk", "Create Product")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ============================================================
// 2. VARIANT PER-SIZE STOCK MATRIX MODAL
// ============================================================
export function VariantStockModal({ isOpen, onClose, product, onSaved, pick }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchVal, setBatchVal] = useState("10");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !product) return;
    setError("");
    setLoading(true);
    const defaultSizes =
      product.product_type === "apparel" ? APPAREL_SIZES : SHOE_SIZES;

    api
      .get(`/api/variants/${product.product_type}/${product.id}`)
      .then((res) => {
        const fetched = Array.isArray(res.data?.variants) ? res.data.variants : [];
        const bySize = new Map(fetched.map((v) => [String(v.size), v]));
        const merged = defaultSizes.map((sz) => {
          const existing = bySize.get(sz);
          return {
            size: sz,
            stock: existing?.stock != null ? Number(existing.stock) : 0,
            low_stock_threshold: existing?.low_stock_threshold || 3,
          };
        });
        for (const v of fetched) {
          if (!defaultSizes.includes(String(v.size))) {
            merged.push({
              size: String(v.size),
              stock: Number(v.stock) || 0,
              low_stock_threshold: v.low_stock_threshold || 3,
            });
          }
        }
        setRows(merged);
      })
      .catch(() => {
        setRows(
          defaultSizes.map((sz) => ({ size: sz, stock: 0, low_stock_threshold: 3 }))
        );
      })
      .finally(() => setLoading(false));
  }, [isOpen, product]);

  const handleApplyBatch = () => {
    const val = Math.max(0, Math.min(9999, Math.round(Number(batchVal) || 0)));
    setRows((prev) => prev.map((r) => ({ ...r, stock: val })));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.put(
        `/api/admin/products/${product.product_type}/${product.id}/variants`,
        { variants: rows }
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          pick("Gagal memperbarui stok varian.", "Failed to update variant stock.")
      );
    } finally {
      setSaving(false);
    }
  };

  const totalUnits = rows.reduce((sum, r) => sum + (Number(r.stock) || 0), 0);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={pick("Kelola Stok per Ukuran", "Manage Size Inventory")}
      subtitle={product ? `${product.name} · ${totalUnits} ${pick("unit total", "total units")}` : ""}
      maxWidth="max-w-xl"
    >
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">
          {pick("Memuat matriks ukuran...", "Loading size matrix...")}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Quick Batch Setter */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {pick("Atur semua ukuran sekaligus", "Batch set all sizes")}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="9999"
                value={batchVal}
                onChange={(e) => setBatchVal(e.target.value)}
                className="w-20 px-2.5 py-1.5 text-xs font-semibold tabular-nums rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-950 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyBatch}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {pick("Terapkan", "Apply")}
              </button>
            </div>
          </div>

          {/* Size Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {rows.map((row, idx) => (
              <div
                key={row.size}
                className={`p-3 rounded-xl border transition-colors ${
                  row.stock === 0
                    ? "border-red-200/80 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20"
                    : row.stock <= row.low_stock_threshold
                      ? "border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20"
                      : "border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-950 dark:text-white">
                    {row.size}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      row.stock === 0
                        ? "bg-red-500"
                        : row.stock <= row.low_stock_threshold
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  max="9999"
                  value={row.stock}
                  onChange={(e) => {
                    const nextStock = Math.max(0, Math.min(9999, Number(e.target.value) || 0));
                    setRows((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, stock: nextStock } : item
                      )
                    );
                  }}
                  className="w-full px-2.5 py-1.5 text-sm font-semibold tabular-nums rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-950 dark:text-white focus:outline-none focus:border-gray-950 dark:focus:border-white"
                />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-gray-900 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            >
              {pick("Batal", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? pick("Menyimpan...", "Saving...") : pick("Simpan Stok", "Save Inventory")}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// ============================================================
// 3. SALE LISTING CREATE / EDIT MODAL
// ============================================================
export function SaleFormModal({ isOpen, onClose, initialSale, catalogProducts = [], onSaved, pick }) {
  const isEditing = Boolean(initialSale?.id);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "Sneakers",
    price: "",
    discount_price: "",
    image_url: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    if (initialSale) {
      setForm({
        name: initialSale.name || "",
        brand: initialSale.brand || "",
        category: initialSale.category || "Sneakers",
        price: initialSale.price != null ? String(initialSale.price) : "",
        discount_price:
          initialSale.discount_price != null ? String(initialSale.discount_price) : "",
        image_url: initialSale.image_url || "",
        description: initialSale.description || "",
      });
    } else {
      setForm({
        name: "",
        brand: "",
        category: "Sneakers",
        price: "",
        discount_price: "",
        image_url: "",
        description: "",
      });
    }
  }, [isOpen, initialSale]);

  const handleCatalogPick = (e) => {
    const selectedKey = e.target.value;
    if (!selectedKey) return;
    const found = catalogProducts.find((p) => `${p.product_type}:${p.id}` === selectedKey);
    if (!found) return;
    const suggestedDiscount = Math.round((Number(found.price) * 0.8) / 1000) * 1000;
    setForm({
      name: found.name || "",
      brand: found.category || "",
      category: found.product_type === "apparel" ? "Apparel" : found.categories || "Sneakers",
      price: String(found.price || ""),
      discount_price: String(suggestedDiscount || ""),
      image_url: found.image_url || "",
      description: found.description || "",
    });
  };

  const priceNum = Number(form.price) || 0;
  const discNum = Number(form.discount_price) || 0;
  const pctOff =
    priceNum > 0 && discNum > 0 && discNum < priceNum
      ? Math.round(((priceNum - discNum) / priceNum) * 100)
      : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        discount_price: Number(form.discount_price),
        image_url: form.image_url.trim(),
        description: form.description.trim(),
      };
      if (isEditing) {
        await api.put(`/api/admin/sales/${initialSale.id}`, payload);
      } else {
        await api.post("/api/admin/sales", payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msgs = err.response?.data?.errors;
      setError(
        (Array.isArray(msgs) && msgs.join(". ")) ||
          err.response?.data?.error ||
          pick("Gagal menyimpan promo.", "Failed to save sale listing.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? pick("Edit Promo Diskon", "Edit Sale Listing") : pick("Tambah Produk Promo", "Add Sale Listing")}
      subtitle={pick("Harga diskon tersinkron otomatis ke katalog Sneakers, Apparel & Checkout", "Discounted prices sync live across catalog and checkout")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!isEditing && catalogProducts.length > 0 && (
          <div>
            <label className={labelCls}>
              {pick("Isi Cepat dari Katalog (Opsional)", "Quick-Fill from Catalog (Optional)")}
            </label>
            <select defaultValue="" onChange={handleCatalogPick} className={inputCls}>
              <option value="">
                {pick("— Pilih produk katalog yang ada —", "— Pick an existing catalog product —")}
              </option>
              {catalogProducts.map((p) => (
                <option key={`${p.product_type}:${p.id}`} value={`${p.product_type}:${p.id}`}>
                  {p.name} ({formatRupiah(p.price)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>{pick("Nama Produk (cocokkan tepat untuk sync)", "Product Name (exact match syncs catalog)")}</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{pick("Merek", "Brand")}</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{pick("Kategori", "Category")}</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{pick("Harga Normal (IDR)", "Regular Price (IDR)")}</label>
            <input
              type="number"
              required
              min="1000"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className={`${inputCls} tabular-nums`}
            />
          </div>
          <div>
            <label className={labelCls}>
              {pick("Harga Diskon (IDR)", "Discount Price (IDR)")}
              {pctOff > 0 && (
                <span className="ml-2 text-[#FF5500] font-bold">-{pctOff}%</span>
              )}
            </label>
            <input
              type="number"
              required
              min="1"
              value={form.discount_price}
              onChange={(e) => setForm((f) => ({ ...f, discount_price: e.target.value }))}
              className={`${inputCls} tabular-nums`}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>{pick("URL Gambar", "Image URL")}</label>
          <input
            type="url"
            required
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-900 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            {pick("Batal", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? pick("Menyimpan...", "Saving...") : pick("Simpan Promo", "Save Sale")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ============================================================
// 4. COUPON CREATE / EDIT MODAL
// ============================================================
export function CouponFormModal({ isOpen, onClose, initialCoupon, onSaved, pick }) {
  const isEditing = Boolean(initialCoupon?.id);
  const [form, setForm] = useState({
    code: "",
    discount_type: "percent",
    discount_value: "10",
    min_purchase: "0",
    expiry_date: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    if (initialCoupon) {
      setForm({
        code: initialCoupon.code || "",
        discount_type: initialCoupon.discount_type || "percent",
        discount_value: String(initialCoupon.discount_value ?? ""),
        min_purchase: String(initialCoupon.min_purchase ?? 0),
        expiry_date: initialCoupon.expiry_date
          ? new Date(initialCoupon.expiry_date).toISOString().slice(0, 10)
          : "",
      });
    } else {
      setForm({
        code: "",
        discount_type: "percent",
        discount_value: "10",
        min_purchase: "0",
        expiry_date: "",
      });
    }
  }, [isOpen, initialCoupon]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_purchase: Number(form.min_purchase) || 0,
        expiry_date: form.expiry_date ? `${form.expiry_date}T23:59:59.000Z` : "",
      };
      if (isEditing) {
        await api.put(`/api/admin/coupons/${initialCoupon.id}`, payload);
      } else {
        await api.post("/api/admin/coupons", payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msgs = err.response?.data?.errors;
      setError(
        (Array.isArray(msgs) && msgs.join(". ")) ||
          err.response?.data?.error ||
          pick("Gagal menyimpan kupon.", "Failed to save coupon.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? pick("Edit Kupon", "Edit Coupon") : pick("Buat Kupon Promo", "Create Promo Coupon")}
      subtitle={pick("Kode kupon diverifikasi langsung di server saat checkout", "Coupon codes are validated server-side at checkout")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className={labelCls}>{pick("Kode Kupon", "Coupon Code")}</label>
          <input
            type="text"
            required
            placeholder="TRUEKICKS15"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            className={`${inputCls} font-mono uppercase tracking-wider`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{pick("Tipe Diskon", "Discount Type")}</label>
            <select
              value={form.discount_type}
              onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
              className={inputCls}
            >
              <option value="percent">{pick("Persentase (%)", "Percentage (%)")}</option>
              <option value="fixed">{pick("Nominal Tetap (Rp)", "Fixed Amount (Rp)")}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              {form.discount_type === "percent"
                ? pick("Nilai Diskon (%)", "Discount (%)")
                : pick("Nominal Diskon (Rp)", "Discount Amount (Rp)")}
            </label>
            <input
              type="number"
              required
              min="1"
              max={form.discount_type === "percent" ? "100" : "500000000"}
              value={form.discount_value}
              onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
              className={`${inputCls} tabular-nums`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{pick("Min. Belanja (Rp)", "Min. Purchase (Rp)")}</label>
            <input
              type="number"
              min="0"
              step="10000"
              value={form.min_purchase}
              onChange={(e) => setForm((f) => ({ ...f, min_purchase: e.target.value }))}
              className={`${inputCls} tabular-nums`}
            />
          </div>
          <div>
            <label className={labelCls}>{pick("Tanggal Kedaluwarsa", "Expiry Date")}</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-900 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            {pick("Batal", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? pick("Menyimpan...", "Saving...") : pick("Simpan Kupon", "Save Coupon")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ============================================================
// 5. ORDER FULFILLMENT & TRACKING UPDATE MODAL
// ============================================================
export function OrderFulfillmentModal({ isOpen, onClose, order, onSaved, pick }) {
  const [status, setStatus] = useState("Processing");
  const [courier, setCourier] = useState("TrueKicks Express");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !order) return;
    setError("");
    setStatus(order.status || "Processing");
    setCourier(order.courier || "TrueKicks Express");
    setTrackingNumber(order.tracking_number || "");
  }, [isOpen, order]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.patch(`/api/admin/orders/${order.id}`, {
        status,
        courier: courier.trim(),
        tracking_number: trackingNumber.trim(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          pick("Gagal memperbarui pesanan.", "Failed to update order.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) return null;

  const shortId = String(order.id).slice(0, 8).toUpperCase();

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`${pick("Kelola Pesanan", "Manage Order")} #${shortId}`}
      subtitle={`${order.full_name} · ${formatRupiah(order.total_price)}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Shipping & Items Summary */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4 text-xs">
            <div>
              <p className="font-semibold text-gray-950 dark:text-white">{order.full_name}</p>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                {order.address}, {order.city} {order.postal_code}
              </p>
              <p className="text-gray-500 dark:text-gray-400 tabular-nums">{order.phone}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">
                {pick("Total", "Total")}
              </p>
              <p className="text-sm font-bold text-gray-950 dark:text-white tabular-nums">
                {formatRupiah(order.total_price)}
              </p>
            </div>
          </div>

          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="pt-3 border-t border-gray-200/70 dark:border-gray-800 space-y-2">
              {order.items.map((item, idx) => (
                <div key={`${item.id}-${item.size}-${idx}`} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.image && (
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 dark:border-gray-700 p-1 flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {pick("Ukuran", "Size")} {item.size} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums flex-shrink-0">
                    {formatRupiah((Number(item.price) || 0) * (Number(item.quantity) || 1))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status, Courier & Tracking Controls */}
        <div className="space-y-4">
          <div>
            <label className={labelCls}>{pick("Status Pesanan", "Order Status")}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputCls}
            >
              {ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {(status === "Cancelled" || status === "Expired") && !order.stock_restored && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                {pick(
                  "Stok ukuran pesanan ini akan dikembalikan otomatis ke gudang saat disimpan.",
                  "Deducted size inventory will be automatically restored on save."
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{pick("Kurir Pengiriman", "Courier")}</label>
              <input
                type="text"
                list="truekicks-couriers"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="JNE YES / SiCepat"
                className={inputCls}
              />
              <datalist id="truekicks-couriers">
                {COURIER_PRESETS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelCls}>{pick("Nomor Resi (AWB)", "Tracking Number (AWB)")}</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="TKX-20261123-..."
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-900 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            {pick("Batal", "Cancel")}
          </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? pick("Menyimpan...", "Saving...") : pick("Perbarui Pesanan", "Update Order")}
            </button>
          </div>
      </form>
    </ModalShell>
  );
}

// ============================================================
// 6. SNEAKER DETAIL PHOTO GALLERY MODAL (UPLOAD / REORDER / DELETE)
// ============================================================
export function DetailGalleryModal({ isOpen, onClose, product, onSaved, pick }) {
  const [images, setImages] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);
  const previewBoxRef = useRef(null);
  const dragOriginRef = useRef(null);
  const sessionUploadsRef = useRef([]);
  const removedSavedRef = useRef([]);

  useEffect(() => {
    if (!isOpen || !product) return;
    setError("");
    setUrlDraft("");
    setEditingIndex(null);
    setUploadingStatus("");
    const existing = Array.isArray(product.detail_images)
      ? product.detail_images.filter((u) => typeof u === "string" && u.trim() !== "")
      : [];
    setImages(existing);
    sessionUploadsRef.current = [];
    removedSavedRef.current = [];
  }, [isOpen, product]);

  const updateImageFrameAt = (index, nextFrame) => {
    setImages((prev) =>
      prev.map((url, idx) =>
        idx === index ? formatImageFrameUrl(url, nextFrame) : url
      )
    );
  };

  const editingUrl =
    editingIndex != null && images[editingIndex] ? images[editingIndex] : null;
  const editingFrame = editingUrl ? parseImageFrame(editingUrl) : null;

  const handleStagePointerDown = (e) => {
    if (!editingFrame || !previewBoxRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = previewBoxRef.current.getBoundingClientRect();
    dragOriginRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: editingFrame.x,
      startY: editingFrame.y,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  };

  const handleStagePointerMove = (e) => {
    if (!dragOriginRef.current || editingIndex == null || !editingFrame) return;
    const { startClientX, startClientY, startX, startY, width, height } =
      dragOriginRef.current;
    const dxPct = ((e.clientX - startClientX) / width) * 100;
    const dyPct = ((e.clientY - startClientY) / height) * 100;
    updateImageFrameAt(editingIndex, {
      scale: editingFrame.scale,
      x: Math.round(startX + dxPct),
      y: Math.round(startY + dyPct),
    });
  };

  const handleStagePointerUp = () => {
    dragOriginRef.current = null;
  };

  const handleCancelClose = () => {
    // Clean up any unsaved files uploaded during this modal session
    const unsaved = [...sessionUploadsRef.current];
    sessionUploadsRef.current = [];
    removedSavedRef.current = [];
    unsaved.forEach((url) => {
      deleteUploadedImage(url);
    });
    onClose();
  };

  const handleFilesUpload = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0 || !product) return;

    const remainingSlots = MAX_DETAIL_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setError(
        pick(
          `Maksimal ${MAX_DETAIL_IMAGES} foto detail per sepatu.`,
          `Maximum ${MAX_DETAIL_IMAGES} detail photos per sneaker.`
        )
      );
      return;
    }

    const batch = files.slice(0, remainingSlots);
    setError("");
    const newlyUploaded = [];

    for (let i = 0; i < batch.length; i += 1) {
      const file = batch[i];
      setUploadingStatus(
        pick(
          `Mengunggah ${i + 1}/${batch.length}...`,
          `Uploading ${i + 1}/${batch.length}...`
        )
      );
      try {
        const res = await uploadProductImage(file, {
          productType: "sneakers",
          productId: product.id,
        });
        newlyUploaded.push(res.public_url);
        sessionUploadsRef.current.push(res.public_url);
        setImages((prev) =>
          prev.some((u) => parseImageFrame(u).src === res.public_url) ||
          prev.length >= MAX_DETAIL_IMAGES
            ? prev
            : [...prev, res.public_url]
        );
      } catch (err) {
        setError(
          err.response?.data?.error ||
            err.message ||
            pick(
              `Gagal mengunggah "${file.name}".`,
              `Failed to upload "${file.name}".`
            )
        );
        break;
      }
    }

    setUploadingStatus("");
    if (files.length > remainingSlots && newlyUploaded.length > 0) {
      setError(
        pick(
          `Hanya ${remainingSlots} foto ditambahkan (batas maks. ${MAX_DETAIL_IMAGES} foto detail).`,
          `Only ${remainingSlots} photo(s) added (max ${MAX_DETAIL_IMAGES} detail photos).`
        )
      );
    }
  };

  const handleAddExternalUrl = () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    if (images.length >= MAX_DETAIL_IMAGES) {
      setError(
        pick(
          `Maksimal ${MAX_DETAIL_IMAGES} foto detail per sepatu.`,
          `Maximum ${MAX_DETAIL_IMAGES} detail photos per sneaker.`
        )
      );
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("Invalid protocol");
      }
    } catch {
      setError(pick("Masukkan URL gambar http(s) yang valid.", "Enter a valid http(s) image URL."));
      return;
    }
    const incomingBase = parseImageFrame(trimmed).src;
    if (images.some((u) => parseImageFrame(u).src === incomingBase)) {
      setError(pick("Foto tersebut sudah ada di galeri.", "That photo URL is already in the gallery."));
      return;
    }
    setError("");
    setImages((prev) => [...prev, trimmed]);
    setUrlDraft("");
  };

  const handleMove = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setEditingIndex((prevIdx) => {
      if (prevIdx === index) return target;
      if (prevIdx === target) return index;
      return prevIdx;
    });
  };

  const handleRemove = (url, index) => {
    const baseUrl = parseImageFrame(url).src;
    setImages((prev) => prev.filter((_, idx) => idx !== index));
    setEditingIndex((prevIdx) => {
      if (prevIdx == null) return null;
      if (prevIdx === index) return null;
      return prevIdx > index ? prevIdx - 1 : prevIdx;
    });
    if (sessionUploadsRef.current.includes(baseUrl)) {
      sessionUploadsRef.current = sessionUploadsRef.current.filter((u) => u !== baseUrl);
      deleteUploadedImage(baseUrl);
    } else {
      removedSavedRef.current.push(baseUrl);
    }
  };

  const handleSave = async () => {
    if (!product) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/admin/products/sneakers/${product.id}/detail-images`, {
        detail_images: images,
      });

      // Only delete previously saved storage objects after DB update succeeds
      const activeBaseSet = new Set(images.map((u) => parseImageFrame(u).src));
      const toPurge = removedSavedRef.current.filter((u) => !activeBaseSet.has(u));
      removedSavedRef.current = [];
      sessionUploadsRef.current = [];
      toPurge.forEach((url) => {
        deleteUploadedImage(url);
      });

      onSaved();
      onClose();
    } catch (err) {
      const msgs = err.response?.data?.errors;
      setError(
        (Array.isArray(msgs) && msgs.join(". ")) ||
          err.response?.data?.error ||
          pick("Gagal menyimpan galeri foto detail.", "Failed to save detail photo gallery.")
      );
    } finally {
      setSaving(false);
    }
  };

  if (!product) return null;

  const isBusy = Boolean(uploadingStatus) || saving;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleCancelClose}
      title={pick("Galeri Foto Detail Sepatu", "Sneaker Detail Photo Gallery")}
      subtitle={`${product.name} · ${images.length}/${MAX_DETAIL_IMAGES} ${pick("foto detail", "detail photos")}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Cover Image Reference */}
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800">
          <div className="w-14 h-14 rounded-xl bg-white dark:bg-gray-100 border border-gray-200 dark:border-gray-700 p-1.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-950 dark:bg-white text-white dark:text-gray-950">
                {pick("Utama", "Cover")}
              </span>
              <span className="text-xs font-semibold text-gray-950 dark:text-white truncate">
                {product.name}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {pick(
                "Foto detail di bawah ini tampil sebagai galeri tambahan di halaman detail & Zoom Loupe.",
                "Detail photos below appear as extra gallery angles on the product page & Zoom Loupe."
              )}
            </p>
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBusy && images.length < MAX_DETAIL_IMAGES) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (!isBusy) handleFilesUpload(e.dataTransfer?.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${
            isDragging
              ? "border-gray-950 dark:border-white bg-gray-100/70 dark:bg-gray-900"
              : "border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              handleFilesUpload(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />

          <p className="text-xs font-semibold text-gray-900 dark:text-white">
            {uploadingStatus
              ? uploadingStatus
              : pick(
                  "Tarik foto ke sini atau pilih dari perangkat",
                  "Drag photos here or browse from device"
                )}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {pick(
              `PNG, JPG, WebP (maks. 10 MB, otomatis dikompres ke WebP · maks. ${MAX_DETAIL_IMAGES} foto)`,
              `PNG, JPG, WebP (max 10 MB, auto-compressed to WebP · up to ${MAX_DETAIL_IMAGES} photos)`
            )}
          </p>

          <button
            type="button"
            disabled={isBusy || images.length >= MAX_DETAIL_IMAGES}
            onClick={() => fileInputRef.current?.click()}
            className="mt-3.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {uploadingStatus
              ? uploadingStatus
              : pick("Pilih Foto Detail", "Choose Detail Photos")}
          </button>
        </div>

        {/* Optional External URL Input */}
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={urlDraft}
            disabled={isBusy || images.length >= MAX_DETAIL_IMAGES}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddExternalUrl();
              }
            }}
            placeholder={pick(
              "Atau tempel URL foto eksternal (https://...)",
              "Or paste an external photo URL (https://...)"
            )}
            className={inputCls}
          />
          <button
            type="button"
            disabled={isBusy || !urlDraft.trim() || images.length >= MAX_DETAIL_IMAGES}
            onClick={handleAddExternalUrl}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap disabled:opacity-40 transition-colors"
          >
            + URL
          </button>
        </div>

        {/* Live WYSIWYG Frame Adjuster (Zoom & Position) */}
        {editingFrame && editingIndex != null && (
          <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-950 dark:text-white">
                  {pick(`Atur Ukuran & Posisi · Foto #${editingIndex + 1}`, `Adjust Scale & Position · Photo #${editingIndex + 1}`)}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {pick(
                    "Geser slider atau seret langsung sepatu pada pratinjau agar proporsional.",
                    "Use the slider or drag the shoe directly inside the preview frame."
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-[11px] font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
              >
                {pick("Selesai", "Done")}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* 1:1 Storefront Stage Preview */}
              <div className="sm:col-span-5">
                <div
                  ref={previewBoxRef}
                  onPointerDown={handleStagePointerDown}
                  onPointerMove={handleStagePointerMove}
                  onPointerUp={handleStagePointerUp}
                  onPointerCancel={handleStagePointerUp}
                  className="relative aspect-square w-full max-w-[220px] mx-auto rounded-2xl bg-[#F8F8F8] dark:bg-gray-100 border border-gray-200 dark:border-gray-700 p-6 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
                >
                  <img
                    src={editingFrame.src}
                    alt={`Adjust preview ${editingIndex + 1}`}
                    draggable={false}
                    style={{
                      transform: getImageFrameTransform(editingFrame),
                    }}
                    className="w-[85%] max-h-full h-auto object-contain mix-blend-multiply pointer-events-none"
                  />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-gray-950/80 text-white text-[10px] font-bold tabular-nums">
                    {Math.round(editingFrame.scale * 100)}%
                  </span>
                </div>
              </div>

              {/* Scale & Position Controls */}
              <div className="sm:col-span-7 space-y-3.5">
                {/* Scale Slider + Stepper */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {pick("Ukuran Foto (Zoom)", "Photo Scale (Zoom)")}
                    </span>
                    <span className="text-xs font-bold text-gray-950 dark:text-white tabular-nums">
                      {Math.round(editingFrame.scale * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateImageFrameAt(editingIndex, {
                          ...editingFrame,
                          scale: editingFrame.scale - 0.1,
                        })
                      }
                      aria-label={pick("Perkecil foto", "Zoom out")}
                      className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center flex-shrink-0"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={MIN_IMAGE_SCALE}
                      max={MAX_IMAGE_SCALE}
                      step={0.05}
                      value={editingFrame.scale}
                      onChange={(e) =>
                        updateImageFrameAt(editingIndex, {
                          ...editingFrame,
                          scale: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-gray-950 dark:accent-white cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateImageFrameAt(editingIndex, {
                          ...editingFrame,
                          scale: editingFrame.scale + 0.1,
                        })
                      }
                      aria-label={pick("Perbesar foto", "Zoom in")}
                      className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center flex-shrink-0"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Scale Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {[0.75, 1, 1.25, 1.5, 1.75].map((preset) => {
                      const active = Math.abs(editingFrame.scale - preset) < 0.01;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            updateImageFrameAt(editingIndex, {
                              ...editingFrame,
                              scale: preset,
                            })
                          }
                          className={`px-2 py-1 rounded-md text-[10px] font-semibold tabular-nums border transition-colors ${
                            active
                              ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950 border-gray-950 dark:border-white"
                              : "bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-gray-400"
                          }`}
                        >
                          {Math.round(preset * 100)}%
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fine Position X / Y */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {pick("Geser X", "Offset X")}
                      </span>
                      <span className="text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                        {editingFrame.x}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-MAX_IMAGE_OFFSET}
                      max={MAX_IMAGE_OFFSET}
                      step={1}
                      value={editingFrame.x}
                      onChange={(e) =>
                        updateImageFrameAt(editingIndex, {
                          ...editingFrame,
                          x: Number(e.target.value),
                        })
                      }
                      className="w-full accent-gray-950 dark:accent-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {pick("Geser Y", "Offset Y")}
                      </span>
                      <span className="text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                        {editingFrame.y}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-MAX_IMAGE_OFFSET}
                      max={MAX_IMAGE_OFFSET}
                      step={1}
                      value={editingFrame.y}
                      onChange={(e) =>
                        updateImageFrameAt(editingIndex, {
                          ...editingFrame,
                          y: Number(e.target.value),
                        })
                      }
                      className="w-full accent-gray-950 dark:accent-white cursor-pointer"
                    />
                  </div>
                </div>

                {/* Reset Button */}
                {editingFrame.hasCustomFrame && (
                  <button
                    type="button"
                    onClick={() =>
                      updateImageFrameAt(editingIndex, { scale: 1, x: 0, y: 0 })
                    }
                    className="text-[11px] font-semibold text-gray-500 hover:text-gray-950 dark:hover:text-white underline underline-offset-4 transition-colors"
                  >
                    {pick("Kembalikan ke standar (100%)", "Reset to default (100%)")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Detail Images Grid */}
        {images.length === 0 ? (
          <div className="py-8 text-center rounded-xl border border-gray-100 dark:border-gray-900 text-xs text-gray-400">
            {pick(
              "Belum ada foto detail untuk sepatu ini. Unggah angle samping, belakang, atas, atau sol.",
              "No detail photos yet. Upload side, heel, top, or outsole angles."
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((url, idx) => {
              const cardFrame = parseImageFrame(url);
              const cardTransform = getImageFrameTransform(cardFrame);
              const isSelectedForEdit = editingIndex === idx;

              return (
                <div
                  key={`${cardFrame.src}-${idx}`}
                  className={`group rounded-xl border bg-white dark:bg-gray-900 overflow-hidden flex flex-col transition-colors ${
                    isSelectedForEdit
                      ? "border-gray-950 dark:border-white ring-1 ring-gray-950 dark:ring-white"
                      : "border-gray-200/80 dark:border-gray-800"
                  }`}
                >
                  <div
                    onClick={() => !isBusy && setEditingIndex(isSelectedForEdit ? null : idx)}
                    className="relative aspect-square bg-[#F6F6F6] dark:bg-gray-100 p-3 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    <img
                      src={cardFrame.src}
                      alt={`Detail ${idx + 1}`}
                      style={cardTransform ? { transform: cardTransform } : undefined}
                      className="w-[85%] max-h-full h-auto object-contain mix-blend-multiply transition-transform duration-200"
                    />
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-gray-950/80 text-white text-[10px] font-bold tabular-nums">
                      #{idx + 1}
                    </span>
                    {cardFrame.hasCustomFrame && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-white/95 text-gray-900 border border-gray-200 text-[10px] font-bold tabular-nums">
                        {Math.round(cardFrame.scale * 100)}%
                      </span>
                    )}
                  </div>

                  <div className="px-2 py-1.5 sm:py-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-1 min-w-0">
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0 || isBusy}
                        onClick={() => handleMove(idx, -1)}
                        aria-label={pick("Geser kiri", "Move left")}
                        className="w-6 h-6 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors flex-shrink-0"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={idx === images.length - 1 || isBusy}
                        onClick={() => handleMove(idx, 1)}
                        aria-label={pick("Geser kanan", "Move right")}
                        className="w-6 h-6 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors flex-shrink-0"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setEditingIndex(isSelectedForEdit ? null : idx)}
                        className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold whitespace-nowrap transition-colors ${
                          isSelectedForEdit
                            ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        {pick("Atur", "Adjust")}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRemove(url, idx)}
                        aria-label={pick("Hapus foto", "Remove photo")}
                        title={pick("Hapus foto", "Remove photo")}
                        className="w-6 h-6 rounded-md border border-transparent flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200/80 dark:hover:border-red-900/60 disabled:opacity-40 transition-colors flex-shrink-0"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="w-3.5 h-3.5">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-900 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={handleCancelClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            {pick("Batal", "Cancel")}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving
              ? pick("Menyimpan...", "Saving...")
              : pick("Simpan Galeri", "Save Gallery")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

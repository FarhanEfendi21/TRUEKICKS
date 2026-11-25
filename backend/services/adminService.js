import crypto from "node:crypto";
import supabase from "../config/supabase.js";
import { enrichOrder } from "./authenticity.js";
import {
  SHOE_SIZES,
  APPAREL_SIZES,
  DEFAULT_LOW_STOCK_THRESHOLD,
  clearInventoryCanonicalCache,
  isMissingInventorySchemaError,
  resolveCanonicalVariantTarget,
  restoreStockAtomic,
} from "./inventoryService.js";
import { clearCatalogCache } from "./conciergeService.js";
import { resolveUserRole } from "../middleware/auth.js";

export const ADMIN_PRODUCT_TABLES = ["sneakers", "apparel"];
export const STORAGE_BUCKET = "images";
export const MAX_DETAIL_IMAGES = 6;

const ALLOWED_IMAGE_MIME_TO_EXT = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

const LOCAL_IMAGE_PATH_RE =
  /^\/images\/(?!.*\.\.)[A-Za-z0-9/_.%-]+(?:#[A-Za-z0-9=&._%-]+)?$/;

const isValidDetailImageUrl = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1200) return false;
  if (LOCAL_IMAGE_PATH_RE.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

export const sanitizeDetailImagesList = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  const unique = [];
  const seen = new Set();
  for (const item of rawList) {
    const trimmed = typeof item === "string" ? item.trim() : "";
    if (!trimmed || !isValidDetailImageUrl(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
    if (unique.length >= MAX_DETAIL_IMAGES) break;
  }
  return unique;
};

export const extractManagedStoragePath = ({ public_url, path }) => {
  const tryNormalize = (raw) => {
    const cleaned = String(raw || "")
      .trim()
      .replace(/^\/+/, "");
    if (!cleaned || cleaned.includes("..")) return null;
    if (!/^(sneakers|apparel)\/[A-Za-z0-9/_.-]+$/.test(cleaned)) {
      return null;
    }
    return cleaned;
  };

  if (path) {
    return tryNormalize(path);
  }
  if (public_url && typeof public_url === "string") {
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = public_url.indexOf(marker);
    if (idx !== -1) {
      const encoded = public_url.slice(idx + marker.length).split(/[?#]/)[0];
      try {
        return tryNormalize(decodeURIComponent(encoded));
      } catch {
        return tryNormalize(encoded);
      }
    }
  }
  return null;
};

export const ADMIN_ORDER_STATUSES = [
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

const PAID_STATUS_SET = new Set([
  "paid",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "completed",
]);

const CANCELLED_STATUS_SET = new Set(["cancelled", "expired", "failed"]);

const normalizeName = (name) =>
  typeof name === "string"
    ? name.trim().toLowerCase().replace(/\s+/g, " ")
    : "";

const isMissingSchemaError = (error) => {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "42P01" ||
    code === "42703" ||
    msg.includes("could not find the") ||
    msg.includes("does not exist")
  );
};

const invalidateCatalogCaches = () => {
  clearCatalogCache();
  clearInventoryCanonicalCache();
};

const toDateKeyUTC = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toMonthKeyUTC = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export const isRevenueOrder = (order) => {
  if (!order) return false;
  const payStatus = String(order.payment_status || "").toLowerCase();
  const status = String(order.status || "").toLowerCase();
  if (CANCELLED_STATUS_SET.has(status) || CANCELLED_STATUS_SET.has(payStatus)) {
    return false;
  }
  if (payStatus === "paid") return true;
  if (PAID_STATUS_SET.has(status)) return true;
  return false;
};

/**
 * Pure analytics aggregator (exported for unit tests).
 */
export const computeAdminAnalytics = ({
  orders = [],
  sneakers = [],
  apparel = [],
  saleProducts = [],
  coupons = [],
  users = [],
  variants = [],
  days = 14,
  months = 6,
  now = new Date(),
} = {}) => {
  const safeDays = Math.min(90, Math.max(7, Number(days) || 14));
  const safeMonths = Math.min(24, Math.max(3, Number(months) || 6));

  // Pre-seed daily buckets
  const dailyMap = new Map();
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const dt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)
    );
    const key = toDateKeyUTC(dt);
    const label = dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    dailyMap.set(key, { date: key, label, revenue: 0, orders: 0 });
  }

  // Pre-seed monthly buckets
  const monthlyMap = new Map();
  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const dt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    const key = toMonthKeyUTC(dt);
    const label = dt.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
    monthlyMap.set(key, { month: key, label, revenue: 0, orders: 0 });
  }

  let totalRevenue = 0;
  let paidOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  const statusMap = new Map();
  const productSalesMap = new Map();

  for (const rawOrder of orders) {
    const order = enrichOrder(rawOrder);
    const amount = Math.max(0, Number(order.total_price) || 0);
    const statusLabel = order.status || "Processing";
    const statusLower = statusLabel.toLowerCase();
    const revenueEligible = isRevenueOrder(order);

    const statusEntry = statusMap.get(statusLabel) || {
      status: statusLabel,
      count: 0,
      revenue: 0,
    };
    statusEntry.count += 1;
    statusEntry.revenue += amount;
    statusMap.set(statusLabel, statusEntry);

    if (revenueEligible) {
      totalRevenue += amount;
      paidOrders += 1;

      const dKey = toDateKeyUTC(order.paid_at || order.created_at);
      if (dKey && dailyMap.has(dKey)) {
        const b = dailyMap.get(dKey);
        b.revenue += amount;
        b.orders += 1;
      }

      const mKey = toMonthKeyUTC(order.paid_at || order.created_at);
      if (mKey && monthlyMap.has(mKey)) {
        const b = monthlyMap.get(mKey);
        b.revenue += amount;
        b.orders += 1;
      }

      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          const name = String(item?.name || "Unnamed Product").trim();
          const qty = Math.max(1, Number(item?.quantity) || 1);
          const itemRevenue = Math.max(0, Number(item?.price) || 0) * qty;
          const prev = productSalesMap.get(name) || {
            name,
            productType: item?.productType || "sneakers",
            image: item?.image || "",
            units: 0,
            revenue: 0,
          };
          prev.units += qty;
          prev.revenue += itemRevenue;
          if (!prev.image && item?.image) prev.image = item.image;
          productSalesMap.set(name, prev);
        }
      }
    } else if (CANCELLED_STATUS_SET.has(statusLower)) {
      cancelledOrders += 1;
    } else {
      pendingOrders += 1;
    }
  }

  // Product lookup for low-stock alerts
  const productNameLookup = new Map();
  for (const s of sneakers) {
    productNameLookup.set(`sneakers:${s.id}`, {
      name: s.name,
      category: s.category,
      image_url: s.image_url,
    });
  }
  for (const a of apparel) {
    productNameLookup.set(`apparel:${a.id}`, {
      name: a.name,
      category: a.category,
      image_url: a.image_url,
    });
  }

  let lowStockVariants = 0;
  let outOfStockVariants = 0;
  const lowStockAlerts = [];

  for (const v of variants) {
    const stock = Math.max(0, Number(v.stock) || 0);
    const threshold =
      Number(v.low_stock_threshold) || DEFAULT_LOW_STOCK_THRESHOLD;
    if (stock === 0) {
      outOfStockVariants += 1;
    } else if (stock <= threshold) {
      lowStockVariants += 1;
    }
    if (stock <= threshold) {
      const meta = productNameLookup.get(`${v.product_type}:${v.product_id}`);
      if (meta) {
        lowStockAlerts.push({
          id: v.id,
          product_type: v.product_type,
          product_id: Number(v.product_id),
          product_name: meta.name,
          category: meta.category || "",
          image_url: meta.image_url || "",
          size: String(v.size),
          stock,
          low_stock_threshold: threshold,
          status: stock === 0 ? "out_of_stock" : "low_stock",
        });
      }
    }
  }

  lowStockAlerts.sort((a, b) => a.stock - b.stock || a.product_name.localeCompare(b.product_name));

  const activeCoupons = coupons.filter(
    (c) => !c.expiry_date || new Date(c.expiry_date) >= now
  ).length;

  const avgOrderValue =
    paidOrders > 0 ? Math.round(totalRevenue / paidOrders) : 0;

  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, 6);

  const recentOrders = [...orders]
    .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))
    .slice(0, 6)
    .map(enrichOrder);

  return {
    summary: {
      total_revenue: Math.round(totalRevenue),
      paid_orders: paidOrders,
      pending_orders: pendingOrders,
      cancelled_orders: cancelledOrders,
      total_orders: orders.length,
      avg_order_value: avgOrderValue,
      total_sneakers: sneakers.length,
      total_apparel: apparel.length,
      total_products: sneakers.length + apparel.length,
      total_sale_products: saleProducts.length,
      active_coupons: activeCoupons,
      total_coupons: coupons.length,
      total_customers: users.length,
      low_stock_variants: lowStockVariants,
      out_of_stock_variants: outOfStockVariants,
    },
    daily_revenue: Array.from(dailyMap.values()),
    monthly_revenue: Array.from(monthlyMap.values()),
    status_breakdown: Array.from(statusMap.values()).sort(
      (a, b) => b.count - a.count
    ),
    top_products: topProducts,
    low_stock_alerts: lowStockAlerts.slice(0, 12),
    recent_orders: recentOrders,
  };
};

export const getAdminAnalytics = async ({ days = 14, months = 6 } = {}) => {
  const [
    ordersRes,
    sneakersRes,
    apparelRes,
    saleRes,
    couponsRes,
    usersRes,
    variantsRes,
  ] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("sneakers").select("id, name, category, price, image_url"),
    supabase.from("apparel").select("id, name, category, price, image_url"),
    supabase.from("sale_products").select("id, name, price, discount_price"),
    supabase.from("coupons").select("id, code, discount_type, discount_value, expiry_date"),
    supabase.from("users").select("id"),
    supabase
      .from("product_variants")
      .select("id, product_id, product_type, size, stock, low_stock_threshold"),
  ]);

  if (ordersRes.error) throw ordersRes.error;

  return computeAdminAnalytics({
    orders: ordersRes.data || [],
    sneakers: sneakersRes.data || [],
    apparel: apparelRes.data || [],
    saleProducts: saleRes.data || [],
    coupons: couponsRes.data || [],
    users: usersRes.data || [],
    variants: variantsRes.error ? [] : variantsRes.data || [],
    days,
    months,
  });
};

// ============================================================
// PRODUCTS + VARIANT INVENTORY CRUD
// ============================================================
export const listAdminProducts = async ({ type = "all", q = "" } = {}) => {
  const includeSneakers = type === "all" || type === "sneakers";
  const includeApparel = type === "all" || type === "apparel";

  const [sneakersRes, apparelRes, saleRes, variantsRes] = await Promise.all([
    includeSneakers
      ? supabase.from("sneakers").select("*").order("id", { ascending: false })
      : Promise.resolve({ data: [] }),
    includeApparel
      ? supabase.from("apparel").select("*").order("id", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("sale_products").select("id, name, price, discount_price"),
    supabase
      .from("product_variants")
      .select("product_type, product_id, size, stock, low_stock_threshold"),
  ]);

  if (sneakersRes.error) throw sneakersRes.error;
  if (apparelRes.error) throw apparelRes.error;

  const saleByName = new Map();
  for (const row of saleRes.data || []) {
    const key = normalizeName(row.name);
    if (key) saleByName.set(key, row);
  }

  const variantAgg = new Map();
  if (!variantsRes.error && Array.isArray(variantsRes.data)) {
    for (const v of variantsRes.data) {
      const key = `${v.product_type}:${v.product_id}`;
      const entry = variantAgg.get(key) || {
        total_stock: 0,
        variant_count: 0,
        low_stock_sizes: 0,
        sold_out_sizes: 0,
      };
      const stock = Math.max(0, Number(v.stock) || 0);
      const threshold =
        Number(v.low_stock_threshold) || DEFAULT_LOW_STOCK_THRESHOLD;
      entry.total_stock += stock;
      entry.variant_count += 1;
      if (stock === 0) entry.sold_out_sizes += 1;
      else if (stock <= threshold) entry.low_stock_sizes += 1;
      variantAgg.set(key, entry);
    }
  }

  const mapRow = (row, productType) => {
    const saleMatch = saleByName.get(normalizeName(row.name));
    const stockStats = variantAgg.get(`${productType}:${row.id}`) || null;
    const price = Number(row.price) || 0;
    const discountPrice =
      saleMatch && Number(saleMatch.discount_price) < Number(saleMatch.price)
        ? Number(saleMatch.discount_price)
        : null;

    const detailImages = Array.isArray(row.detail_images)
      ? row.detail_images.filter((u) => typeof u === "string" && u.trim() !== "")
      : [];

    return {
      ...row,
      price,
      product_type: productType,
      detail_images: productType === "sneakers" ? detailImages : [],
      detail_image_count: detailImages.length,
      is_on_sale: Boolean(discountPrice),
      sale_id: saleMatch?.id || null,
      discount_price: discountPrice,
      stock_tracked: Boolean(stockStats),
      total_stock: stockStats ? stockStats.total_stock : null,
      variant_count: stockStats ? stockStats.variant_count : 0,
      low_stock_sizes: stockStats ? stockStats.low_stock_sizes : 0,
      sold_out_sizes: stockStats ? stockStats.sold_out_sizes : 0,
    };
  };

  let combined = [
    ...(sneakersRes.data || []).map((r) => mapRow(r, "sneakers")),
    ...(apparelRes.data || []).map((r) => mapRow(r, "apparel")),
  ];

  const query = String(q || "").trim().toLowerCase();
  if (query) {
    combined = combined.filter(
      (item) =>
        String(item.name || "").toLowerCase().includes(query) ||
        String(item.category || "").toLowerCase().includes(query) ||
        String(item.categories || "").toLowerCase().includes(query) ||
        String(item.id).includes(query)
    );
  }

  return combined;
};

export const createAdminProduct = async (payload) => {
  const productType = payload.product_type;
  if (!ADMIN_PRODUCT_TABLES.includes(productType)) {
    return { ok: false, status: 400, error: "product_type must be sneakers or apparel." };
  }

  const record = {
    name: String(payload.name).trim(),
    category: String(payload.category).trim(),
    price: Math.round(Number(payload.price)),
    image_url: String(payload.image_url).trim(),
    description: String(payload.description || "").trim(),
  };

  if (productType === "sneakers") {
    if (payload.categories !== undefined) {
      record.categories = String(payload.categories || "").trim() || null;
    }
    if (Array.isArray(payload.detail_images)) {
      record.detail_images = sanitizeDetailImagesList(payload.detail_images);
    }
  }

  const { data, error } = await supabase
    .from(productType)
    .insert([record])
    .select()
    .single();

  if (error) throw error;

  // Optionally seed default per-size stock variants immediately
  const initialStock =
    payload.initial_stock != null && Number.isFinite(Number(payload.initial_stock))
      ? Math.max(0, Math.round(Number(payload.initial_stock)))
      : 8;

  const sizes = productType === "apparel" ? APPAREL_SIZES : SHOE_SIZES;
  const skuPrefix = productType === "apparel" ? "APP" : "SNK";
  const variantRows = sizes.map((size) => ({
    product_type: productType,
    product_id: data.id,
    size,
    stock: initialStock,
    low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
    sku: `TK-${skuPrefix}-${data.id}-${String(size).replace(/\./g, "")}`,
    updated_at: new Date().toISOString(),
  }));

  let variantsSeeded = false;
  const seedRes = await supabase
    .from("product_variants")
    .upsert(variantRows, { onConflict: "product_type,product_id,size" });

  if (!seedRes.error) {
    variantsSeeded = true;
  } else if (!isMissingInventorySchemaError(seedRes.error)) {
    console.warn("Admin product variant seed warning:", seedRes.error.message);
  }

  invalidateCatalogCaches();

  return {
    ok: true,
    product: {
      ...data,
      product_type: productType,
      variants_seeded: variantsSeeded,
      total_stock: variantsSeeded ? initialStock * sizes.length : null,
    },
  };
};

export const updateAdminProduct = async (productType, id, payload) => {
  if (!ADMIN_PRODUCT_TABLES.includes(productType)) {
    return { ok: false, status: 400, error: "Invalid product type." };
  }
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return { ok: false, status: 400, error: "Invalid product ID." };
  }

  const updates = {};
  if (payload.name !== undefined) updates.name = String(payload.name).trim();
  if (payload.category !== undefined) updates.category = String(payload.category).trim();
  if (payload.price !== undefined) updates.price = Math.round(Number(payload.price));
  if (payload.image_url !== undefined) updates.image_url = String(payload.image_url).trim();
  if (payload.description !== undefined) updates.description = String(payload.description || "").trim();

  if (productType === "sneakers") {
    if (payload.categories !== undefined) {
      updates.categories = String(payload.categories || "").trim() || null;
    }
    if (Array.isArray(payload.detail_images)) {
      updates.detail_images = sanitizeDetailImagesList(payload.detail_images);
    }
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, status: 400, error: "No valid fields provided for update." };
  }

  const { data, error } = await supabase
    .from(productType)
    .update(updates)
    .eq("id", productId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { ok: false, status: 404, error: "Product not found." };
  }

  invalidateCatalogCaches();
  return { ok: true, product: { ...data, product_type: productType } };
};

export const deleteAdminProduct = async (productType, id) => {
  if (!ADMIN_PRODUCT_TABLES.includes(productType)) {
    return { ok: false, status: 400, error: "Invalid product type." };
  }
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return { ok: false, status: 400, error: "Invalid product ID." };
  }

  const { data, error } = await supabase
    .from(productType)
    .delete()
    .eq("id", productId)
    .select("id, name")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { ok: false, status: 404, error: "Product not found." };
  }

  // Clean up orphaned variant rows best-effort
  await supabase
    .from("product_variants")
    .delete()
    .eq("product_type", productType)
    .eq("product_id", productId);

  invalidateCatalogCaches();
  return { ok: true, deleted: data };
};

export const upsertAdminProductVariants = async (productType, id, variants) => {
  if (!ADMIN_PRODUCT_TABLES.includes(productType)) {
    return { ok: false, status: 400, error: "Invalid product type." };
  }
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return { ok: false, status: 400, error: "Invalid product ID." };
  }

  const { data: exists } = await supabase
    .from(productType)
    .select("id")
    .eq("id", productId)
    .maybeSingle();

  if (!exists) {
    return { ok: false, status: 404, error: "Product not found." };
  }

  const skuPrefix = productType === "apparel" ? "APP" : "SNK";
  const rows = variants.map((v) => {
    const cleanSize = String(v.size).trim();
    const stock = Math.max(0, Math.min(9999, Math.round(Number(v.stock) || 0)));
    const threshold = Math.max(
      1,
      Math.min(100, Math.round(Number(v.low_stock_threshold) || DEFAULT_LOW_STOCK_THRESHOLD))
    );
    return {
      product_type: productType,
      product_id: productId,
      size: cleanSize,
      stock,
      low_stock_threshold: threshold,
      sku:
        v.sku && String(v.sku).trim()
          ? String(v.sku).trim()
          : `TK-${skuPrefix}-${productId}-${cleanSize.replace(/\./g, "")}`,
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase
    .from("product_variants")
    .upsert(rows, { onConflict: "product_type,product_id,size" })
    .select("id, size, stock, low_stock_threshold, sku, updated_at");

  if (error) {
    if (isMissingInventorySchemaError(error)) {
      return {
        ok: false,
        status: 409,
        error: "product_variants migration has not been applied yet.",
      };
    }
    throw error;
  }

  invalidateCatalogCaches();
  const totalStock = (data || []).reduce((sum, r) => sum + (Number(r.stock) || 0), 0);
  return { ok: true, variants: data || [], total_stock: totalStock };
};

// ============================================================
// PRODUCT DETAIL GALLERY & SIGNED SUPABASE STORAGE UPLOADS
// ============================================================
export const createAdminSignedUpload = async ({
  product_type = "sneakers",
  product_id = null,
  content_type = "image/webp",
  filename = "",
} = {}) => {
  const folder = ADMIN_PRODUCT_TABLES.includes(product_type)
    ? product_type
    : "sneakers";
  const mime = String(content_type || "").trim().toLowerCase();
  const ext = ALLOWED_IMAGE_MIME_TO_EXT[mime];

  if (!ext) {
    return {
      ok: false,
      status: 400,
      error: "Unsupported image format. Use WebP, PNG, or JPEG.",
    };
  }

  const parsedId = Number(product_id);
  const subFolder =
    Number.isInteger(parsedId) && parsedId > 0 ? String(parsedId) : "uploads";

  const rawStem = String(filename || "detail")
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const stem = rawStem || "detail";
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const objectPath = `${folder}/${subFolder}/${stem}-${uniqueSuffix}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(objectPath);

  if (error || !data?.signedUrl) {
    throw error || new Error("Failed to generate signed upload URL.");
  }

  const { data: pubData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(objectPath);

  return {
    ok: true,
    bucket: STORAGE_BUCKET,
    path: data.path || objectPath,
    token: data.token,
    signed_url: data.signedUrl,
    public_url: pubData?.publicUrl || "",
    content_type: mime,
  };
};

export const deleteAdminStorageObject = async ({ public_url, path } = {}) => {
  const managedPath = extractManagedStoragePath({ public_url, path });
  if (!managedPath) {
    return { ok: true, removed: false, reason: "Not a managed upload path." };
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([managedPath]);

  if (error) {
    console.warn("Storage cleanup warning:", error.message);
    return { ok: true, removed: false, path: managedPath };
  }

  return { ok: true, removed: true, path: managedPath };
};

export const updateAdminProductDetailImages = async (
  productType,
  id,
  rawDetailImages
) => {
  if (productType !== "sneakers") {
    return {
      ok: false,
      status: 400,
      error: "Detail image gallery is currently supported for sneakers only.",
    };
  }

  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return { ok: false, status: 400, error: "Invalid product ID." };
  }

  if (!Array.isArray(rawDetailImages)) {
    return { ok: false, status: 400, error: "detail_images must be an array." };
  }

  if (rawDetailImages.length > MAX_DETAIL_IMAGES) {
    return {
      ok: false,
      status: 400,
      error: `Maximum ${MAX_DETAIL_IMAGES} detail photos allowed per sneaker.`,
    };
  }

  const sanitized = sanitizeDetailImagesList(rawDetailImages);
  if (sanitized.length !== rawDetailImages.filter((u) => String(u || "").trim() !== "").length) {
    return {
      ok: false,
      status: 400,
      error: "All detail image entries must be valid unique http(s) URLs.",
    };
  }

  const { data, error } = await supabase
    .from("sneakers")
    .update({ detail_images: sanitized })
    .eq("id", productId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { ok: false, status: 404, error: "Sneaker not found." };
  }

  invalidateCatalogCaches();
  return {
    ok: true,
    product: {
      ...data,
      product_type: "sneakers",
      detail_images: sanitized,
      detail_image_count: sanitized.length,
    },
    detail_images: sanitized,
  };
};

// ============================================================
// SALE PRODUCTS CRUD
// ============================================================
export const listAdminSales = async () => {
  const { data, error } = await supabase
    .from("sale_products")
    .select("*")
    .order("id", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => {
    const price = Number(row.price) || 0;
    const discountPrice = Number(row.discount_price) || 0;
    const discountPercentage =
      price > 0 && discountPrice > 0 && discountPrice < price
        ? Math.round(((price - discountPrice) / price) * 100)
        : 0;
    return {
      ...row,
      price,
      discount_price: discountPrice,
      discount_percentage: discountPercentage,
    };
  });
};

export const createAdminSale = async (payload) => {
  const price = Math.round(Number(payload.price));
  const discountPrice = Math.round(Number(payload.discount_price));
  if (discountPrice <= 0 || discountPrice >= price) {
    return {
      ok: false,
      status: 400,
      error: "discount_price must be greater than 0 and strictly less than price.",
    };
  }

  const record = {
    name: String(payload.name).trim(),
    brand: String(payload.brand || payload.category || "").trim(),
    category: String(payload.category || "Sneakers").trim(),
    description: String(payload.description || "").trim(),
    image_url: String(payload.image_url).trim(),
    price,
    discount_price: discountPrice,
  };

  const { data, error } = await supabase
    .from("sale_products")
    .insert([record])
    .select()
    .single();

  if (error) throw error;
  invalidateCatalogCaches();

  return {
    ok: true,
    sale: {
      ...data,
      discount_percentage: Math.round(((price - discountPrice) / price) * 100),
    },
  };
};

export const updateAdminSale = async (id, payload) => {
  const saleId = Number(id);
  if (!Number.isInteger(saleId) || saleId <= 0) {
    return { ok: false, status: 400, error: "Invalid sale ID." };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("sale_products")
    .select("*")
    .eq("id", saleId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) {
    return { ok: false, status: 404, error: "Sale listing not found." };
  }

  const nextPrice =
    payload.price !== undefined ? Math.round(Number(payload.price)) : Number(existing.price);
  const nextDiscount =
    payload.discount_price !== undefined
      ? Math.round(Number(payload.discount_price))
      : Number(existing.discount_price);

  if (nextDiscount <= 0 || nextDiscount >= nextPrice) {
    return {
      ok: false,
      status: 400,
      error: "discount_price must be greater than 0 and strictly less than price.",
    };
  }

  const updates = {
    price: nextPrice,
    discount_price: nextDiscount,
  };
  if (payload.name !== undefined) updates.name = String(payload.name).trim();
  if (payload.brand !== undefined) updates.brand = String(payload.brand).trim();
  if (payload.category !== undefined) updates.category = String(payload.category).trim();
  if (payload.description !== undefined) updates.description = String(payload.description || "").trim();
  if (payload.image_url !== undefined) updates.image_url = String(payload.image_url).trim();

  const { data, error } = await supabase
    .from("sale_products")
    .update(updates)
    .eq("id", saleId)
    .select()
    .single();

  if (error) throw error;
  invalidateCatalogCaches();

  return {
    ok: true,
    sale: {
      ...data,
      discount_percentage: Math.round(((nextPrice - nextDiscount) / nextPrice) * 100),
    },
  };
};

export const deleteAdminSale = async (id) => {
  const saleId = Number(id);
  if (!Number.isInteger(saleId) || saleId <= 0) {
    return { ok: false, status: 400, error: "Invalid sale ID." };
  }

  const { data, error } = await supabase
    .from("sale_products")
    .delete()
    .eq("id", saleId)
    .select("id, name")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { ok: false, status: 404, error: "Sale listing not found." };
  }

  invalidateCatalogCaches();
  return { ok: true, deleted: data };
};

// ============================================================
// COUPONS CRUD
// ============================================================
export const listAdminCoupons = async () => {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const now = new Date();
  return (data || []).map((c) => ({
    ...c,
    is_expired: Boolean(c.expiry_date && new Date(c.expiry_date) < now),
  }));
};

export const createAdminCoupon = async (payload) => {
  const code = String(payload.code || "").trim().toUpperCase();
  const discountType = String(payload.discount_type || "").trim().toLowerCase();
  const discountValue = Math.round(Number(payload.discount_value));
  const minPurchase = Math.max(0, Math.round(Number(payload.min_purchase) || 0));

  if (discountType === "percent" && (discountValue < 1 || discountValue > 100)) {
    return { ok: false, status: 400, error: "Percent discount must be between 1 and 100." };
  }
  if (discountType === "fixed" && discountValue < 1000) {
    return { ok: false, status: 400, error: "Fixed discount must be at least Rp 1.000." };
  }

  const { data: dup } = await supabase
    .from("coupons")
    .select("id")
    .ilike("code", code)
    .maybeSingle();

  if (dup) {
    return { ok: false, status: 409, error: `Coupon code "${code}" already exists.` };
  }

  const expiryDate =
    payload.expiry_date && String(payload.expiry_date).trim()
      ? new Date(payload.expiry_date).toISOString()
      : null;

  const { data, error } = await supabase
    .from("coupons")
    .insert([
      {
        code,
        discount_type: discountType,
        discount_value: discountValue,
        min_purchase: minPurchase,
        expiry_date: expiryDate,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return {
    ok: true,
    coupon: {
      ...data,
      is_expired: Boolean(data.expiry_date && new Date(data.expiry_date) < new Date()),
    },
  };
};

export const updateAdminCoupon = async (id, payload) => {
  const couponId = Number(id);
  if (!Number.isInteger(couponId) || couponId <= 0) {
    return { ok: false, status: 400, error: "Invalid coupon ID." };
  }

  const updates = {};
  if (payload.code !== undefined) updates.code = String(payload.code).trim().toUpperCase();
  if (payload.discount_type !== undefined) {
    updates.discount_type = String(payload.discount_type).trim().toLowerCase();
  }
  if (payload.discount_value !== undefined) {
    updates.discount_value = Math.round(Number(payload.discount_value));
  }
  if (payload.min_purchase !== undefined) {
    updates.min_purchase = Math.max(0, Math.round(Number(payload.min_purchase) || 0));
  }
  if (payload.expiry_date !== undefined) {
    updates.expiry_date =
      payload.expiry_date && String(payload.expiry_date).trim()
        ? new Date(payload.expiry_date).toISOString()
        : null;
  }

  if (
    updates.discount_type === "percent" &&
    updates.discount_value !== undefined &&
    (updates.discount_value < 1 || updates.discount_value > 100)
  ) {
    return { ok: false, status: 400, error: "Percent discount must be between 1 and 100." };
  }

  const { data, error } = await supabase
    .from("coupons")
    .update(updates)
    .eq("id", couponId)
    .select()
    .maybeSingle();

  if (error) {
    if (String(error.code) === "23505") {
      return { ok: false, status: 409, error: "Coupon code already exists." };
    }
    throw error;
  }
  if (!data) {
    return { ok: false, status: 404, error: "Coupon not found." };
  }

  return {
    ok: true,
    coupon: {
      ...data,
      is_expired: Boolean(data.expiry_date && new Date(data.expiry_date) < new Date()),
    },
  };
};

export const deleteAdminCoupon = async (id) => {
  const couponId = Number(id);
  if (!Number.isInteger(couponId) || couponId <= 0) {
    return { ok: false, status: 400, error: "Invalid coupon ID." };
  }

  const { data, error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", couponId)
    .select("id, code")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { ok: false, status: 404, error: "Coupon not found." };
  }
  return { ok: true, deleted: data };
};

// ============================================================
// ORDERS FULFILLMENT MANAGEMENT
// ============================================================
export const listAdminOrders = async ({ status = "", q = "", limit = 100 } = {}) => {
  const safeLimit = Math.min(250, Math.max(1, Number(limit) || 100));
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;

  let enriched = (data || []).map(enrichOrder);

  const statusFilter = String(status || "").trim().toLowerCase();
  if (statusFilter && statusFilter !== "all") {
    enriched = enriched.filter(
      (o) => String(o.status || "").trim().toLowerCase() === statusFilter
    );
  }

  const query = String(q || "").trim().toLowerCase();
  if (query) {
    enriched = enriched.filter(
      (o) =>
        String(o.id || "").toLowerCase().includes(query) ||
        String(o.full_name || "").toLowerCase().includes(query) ||
        String(o.tracking_number || "").toLowerCase().includes(query) ||
        String(o.courier || "").toLowerCase().includes(query) ||
        String(o.phone || "").toLowerCase().includes(query)
    );
  }

  return enriched;
};

export const updateAdminOrder = async (orderId, payload) => {
  const cleanId = String(orderId || "").trim();
  if (!cleanId) {
    return { ok: false, status: 400, error: "Invalid order ID." };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", cleanId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) {
    return { ok: false, status: 404, error: "Order not found." };
  }

  const updates = {};
  const nowIso = new Date().toISOString();
  let shouldRestoreStock = false;

  if (payload.status !== undefined) {
    const matched = ADMIN_ORDER_STATUSES.find(
      (s) => s.toLowerCase() === String(payload.status).trim().toLowerCase()
    );
    if (!matched) {
      return {
        ok: false,
        status: 400,
        error: `Invalid order status. Allowed: ${ADMIN_ORDER_STATUSES.join(", ")}`,
      };
    }

    updates.status = matched;
    const lower = matched.toLowerCase();

    if (lower === "pending payment") {
      updates.payment_status = "pending";
    } else if (PAID_STATUS_SET.has(lower)) {
      updates.payment_status = "paid";
      if (!existing.paid_at) updates.paid_at = nowIso;
    } else if (lower === "cancelled") {
      updates.payment_status = "cancelled";
      if (!existing.stock_restored) shouldRestoreStock = true;
    } else if (lower === "expired") {
      updates.payment_status = "expired";
      if (!existing.stock_restored) shouldRestoreStock = true;
    }

    if (lower === "shipped" && !existing.shipped_at) {
      updates.shipped_at = nowIso;
    }
    if ((lower === "delivered" || lower === "completed") && !existing.delivered_at) {
      if (!existing.shipped_at) updates.shipped_at = nowIso;
      updates.delivered_at = nowIso;
    }
  }

  if (payload.courier !== undefined) {
    updates.courier = String(payload.courier || "").trim() || "TrueKicks Express";
  }

  if (payload.tracking_number !== undefined) {
    const cleanTracking = String(payload.tracking_number || "").trim();
    updates.tracking_number = cleanTracking || null;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, status: 400, error: "No valid order fields provided." };
  }

  // Restore stock once when transitioning to Cancelled / Expired
  let stockRestoredNow = false;
  if (shouldRestoreStock && Array.isArray(existing.items) && existing.items.length > 0) {
    const rawRestorable = existing.items.filter((item) => item?.id && item?.size);
    const canonicalItems = await Promise.all(
      rawRestorable.map(async (item) => {
        const target = await resolveCanonicalVariantTarget(
          item.productType || "sneakers",
          item.id,
          { name: item.name }
        );
        return {
          product_type: target.productType,
          product_id: target.productId,
          size: String(item.size).trim(),
          quantity: Math.max(1, Number(item.quantity) || 1),
        };
      })
    );

    if (canonicalItems.length > 0) {
      const restoreRes = await restoreStockAtomic(canonicalItems);
      if (restoreRes?.restored) {
        stockRestoredNow = true;
        updates.stock_restored = true;
      }
    }
  }

  let updateRes = await supabase
    .from("orders")
    .update(updates)
    .eq("id", existing.id)
    .select()
    .single();

  if (updateRes.error && isMissingSchemaError(updateRes.error)) {
    const safeUpdates = {};
    if (updates.status !== undefined) safeUpdates.status = updates.status;
    if (updates.courier !== undefined) safeUpdates.courier = updates.courier;
    if (updates.tracking_number !== undefined) safeUpdates.tracking_number = updates.tracking_number;
    updateRes = await supabase
      .from("orders")
      .update(safeUpdates)
      .eq("id", existing.id)
      .select()
      .single();
  }

  if (updateRes.error) throw updateRes.error;

  return {
    ok: true,
    order: enrichOrder(updateRes.data),
    stock_restored: stockRestoredNow,
  };
};

// ============================================================
// USERS & RBAC ROLE MANAGEMENT
// ============================================================
export const listAdminUsers = async () => {
  let users = [];
  let roleColumnAvailable = true;

  const primaryRes = await supabase
    .from("users")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false });

  if (primaryRes.error) {
    if (isMissingSchemaError(primaryRes.error)) {
      roleColumnAvailable = false;
      const fallbackRes = await supabase
        .from("users")
        .select("id, full_name, email, created_at")
        .order("created_at", { ascending: false });
      if (fallbackRes.error) throw fallbackRes.error;
      users = fallbackRes.data || [];
    } else {
      throw primaryRes.error;
    }
  } else {
    users = primaryRes.data || [];
  }

  const { data: orderRows } = await supabase
    .from("orders")
    .select("user_id, total_price, status, payment_status");

  const statsByUser = new Map();
  for (const row of orderRows || []) {
    const uid = Number(row.user_id);
    if (!Number.isInteger(uid)) continue;
    const entry = statsByUser.get(uid) || { order_count: 0, total_spent: 0 };
    entry.order_count += 1;
    if (isRevenueOrder(row)) {
      entry.total_spent += Math.max(0, Number(row.total_price) || 0);
    }
    statsByUser.set(uid, entry);
  }

  return {
    role_column_available: roleColumnAvailable,
    users: users.map((u) => {
      const stats = statsByUser.get(Number(u.id)) || {
        order_count: 0,
        total_spent: 0,
      };
      return {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: resolveUserRole(u),
        created_at: u.created_at,
        order_count: stats.order_count,
        total_spent: Math.round(stats.total_spent),
      };
    }),
  };
};

export const updateAdminUserRole = async ({ targetUserId, nextRole, actorUserId }) => {
  const parsedTarget = Number(targetUserId);
  const parsedActor = Number(actorUserId);
  const cleanRole = String(nextRole || "").trim().toLowerCase();

  if (!Number.isInteger(parsedTarget) || parsedTarget <= 0) {
    return { ok: false, status: 400, error: "Invalid user ID." };
  }
  if (!["customer", "admin"].includes(cleanRole)) {
    return { ok: false, status: 400, error: "Role must be 'customer' or 'admin'." };
  }
  if (parsedTarget === parsedActor && cleanRole !== "admin") {
    return {
      ok: false,
      status: 400,
      error: "You cannot demote your own admin account.",
    };
  }

  const { data, error } = await supabase
    .from("users")
    .update({ role: cleanRole })
    .eq("id", parsedTarget)
    .select("id, full_name, email, role, created_at")
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return {
        ok: false,
        status: 409,
        error: "Run backend/migrations/tier1_admin_rbac.sql in Supabase SQL Editor first to persist role updates.",
      };
    }
    throw error;
  }

  if (!data) {
    return { ok: false, status: 404, error: "User not found." };
  }

  return {
    ok: true,
    user: {
      ...data,
      role: resolveUserRole(data),
    },
  };
};

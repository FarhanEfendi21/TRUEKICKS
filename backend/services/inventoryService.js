import supabase from "../config/supabase.js";

export const ALLOWED_PRODUCT_TABLES = [
  "products",
  "sneakers",
  "apparel",
  "sale_products",
];

export const SHOE_SIZES = [
  "38",
  "39",
  "40",
  "40.5",
  "41",
  "42",
  "42.5",
  "43",
  "44",
  "45",
  "46",
];

export const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;

const CANONICAL_CACHE_TTL_MS = 60 * 1000;

let canonicalIndexCache = {
  sneakersByName: null,
  apparelByName: null,
  fetchedAt: 0,
};

export const clearInventoryCanonicalCache = () => {
  canonicalIndexCache = {
    sneakersByName: null,
    apparelByName: null,
    fetchedAt: 0,
  };
};

const normalizeName = (name) =>
  typeof name === "string"
    ? name.trim().toLowerCase().replace(/\s+/g, " ")
    : "";

export const isApparelProduct = (table, product) =>
  table === "apparel" ||
  (typeof product?.category === "string" &&
    /apparel|hoodie|shirt|jacket|pants|jersey/i.test(product.category));

export const isMissingInventorySchemaError = (error) => {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "PGRST202" ||
    code === "42P01" ||
    code === "42883" ||
    code === "42703" ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the function") ||
    msg.includes("does not exist") ||
    details.includes("does not exist")
  );
};

export const computeStockStatus = (
  stock,
  threshold = DEFAULT_LOW_STOCK_THRESHOLD
) => {
  if (stock == null || !Number.isFinite(Number(stock))) return "untracked";
  const count = Number(stock);
  if (count <= 0) return "out_of_stock";
  if (count <= threshold) return "low_stock";
  return "in_stock";
};

const sortVariantsBySize = (variants, apparel = false) => {
  const order = apparel ? APPAREL_SIZES : SHOE_SIZES;
  return [...variants].sort((a, b) => {
    const idxA = order.indexOf(String(a.size));
    const idxB = order.indexOf(String(b.size));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    const numA = Number(a.size);
    const numB = Number(b.size);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
    return String(a.size).localeCompare(String(b.size));
  });
};

const buildUntrackedVariants = (apparel) => {
  const sizes = apparel ? APPAREL_SIZES : SHOE_SIZES;
  return sizes.map((size) => ({
    size,
    stock: null,
    low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
    sku: null,
    status: "untracked",
  }));
};

const getCanonicalNameIndex = async () => {
  const now = Date.now();
  if (
    canonicalIndexCache.sneakersByName &&
    canonicalIndexCache.apparelByName &&
    now - canonicalIndexCache.fetchedAt < CANONICAL_CACHE_TTL_MS
  ) {
    return canonicalIndexCache;
  }

  const [sneakersRes, apparelRes] = await Promise.all([
    supabase.from("sneakers").select("id, name"),
    supabase.from("apparel").select("id, name"),
  ]);

  const sneakersByName = new Map();
  for (const row of sneakersRes.data || []) {
    const key = normalizeName(row.name);
    if (key && !sneakersByName.has(key)) {
      sneakersByName.set(key, Number(row.id));
    }
  }

  const apparelByName = new Map();
  for (const row of apparelRes.data || []) {
    const key = normalizeName(row.name);
    if (key && !apparelByName.has(key)) {
      apparelByName.set(key, Number(row.id));
    }
  }

  canonicalIndexCache = {
    sneakersByName,
    apparelByName,
    fetchedAt: now,
  };

  return canonicalIndexCache;
};

/**
 * Resolves any catalog product reference (including shared items viewed from
 * `products` or `sale_products`) to its canonical `product_variants` owner.
 */
export const resolveCanonicalVariantTarget = async (
  table,
  id,
  productRow = null
) => {
  const numericId = Number(id);
  if (table === "sneakers" || table === "apparel") {
    return { productType: table, productId: numericId };
  }

  let productName = productRow?.name || "";
  if (!productName && ALLOWED_PRODUCT_TABLES.includes(table) && Number.isInteger(numericId) && numericId > 0) {
    const { data } = await supabase
      .from(table)
      .select("name")
      .eq("id", numericId)
      .maybeSingle();
    productName = data?.name || "";
  }

  const key = normalizeName(productName);
  if (key) {
    const index = await getCanonicalNameIndex();
    if (index.sneakersByName.has(key)) {
      return {
        productType: "sneakers",
        productId: index.sneakersByName.get(key),
      };
    }
    if (index.apparelByName.has(key)) {
      return {
        productType: "apparel",
        productId: index.apparelByName.get(key),
      };
    }
  }

  return { productType: table, productId: numericId };
};

export const getProductVariants = async (table, id, productRow = null) => {
  const numericId = Number(id);
  let resolvedProduct = productRow;

  if (!resolvedProduct) {
    const { data, error } = await supabase
      .from(table)
      .select("id, name, category")
      .eq("id", numericId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { notFound: true };
    }
    resolvedProduct = data;
  }

  const apparel = isApparelProduct(table, resolvedProduct);
  const canonical = await resolveCanonicalVariantTarget(
    table,
    numericId,
    resolvedProduct
  );

  let { data: rows, error } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, product_type, size, stock, low_stock_threshold, sku, updated_at"
    )
    .eq("product_type", canonical.productType)
    .eq("product_id", canonical.productId);

  if (error) {
    if (isMissingInventorySchemaError(error)) {
      return {
        tracked: false,
        migrationRequired: true,
        product_type: table,
        product_id: numericId,
        canonical_type: canonical.productType,
        canonical_id: canonical.productId,
        total_stock: null,
        low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
        variants: buildUntrackedVariants(apparel),
      };
    }
    throw error;
  }

  // Fallback check under original (table, id) if canonical target had no rows
  if (
    (!rows || rows.length === 0) &&
    (canonical.productType !== table || canonical.productId !== numericId)
  ) {
    const fallbackRes = await supabase
      .from("product_variants")
      .select(
        "id, product_id, product_type, size, stock, low_stock_threshold, sku, updated_at"
      )
      .eq("product_type", table)
      .eq("product_id", numericId);

    if (!fallbackRes.error && fallbackRes.data?.length > 0) {
      rows = fallbackRes.data;
    }
  }

  if (!rows || rows.length === 0) {
    return {
      tracked: false,
      migrationRequired: false,
      product_type: table,
      product_id: numericId,
      canonical_type: canonical.productType,
      canonical_id: canonical.productId,
      total_stock: null,
      low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
      variants: buildUntrackedVariants(apparel),
    };
  }

  const mapped = sortVariantsBySize(
    rows.map((row) => {
      const stock = Math.max(0, Number(row.stock) || 0);
      const threshold =
        Number(row.low_stock_threshold) || DEFAULT_LOW_STOCK_THRESHOLD;
      return {
        id: row.id,
        size: String(row.size),
        stock,
        low_stock_threshold: threshold,
        sku: row.sku || null,
        status: computeStockStatus(stock, threshold),
        updated_at: row.updated_at || null,
      };
    }),
    apparel
  );

  const totalStock = mapped.reduce((sum, v) => sum + v.stock, 0);

  return {
    tracked: true,
    migrationRequired: false,
    product_type: table,
    product_id: numericId,
    canonical_type: rows[0].product_type,
    canonical_id: Number(rows[0].product_id),
    total_stock: totalStock,
    low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
    available_sizes: mapped.filter((v) => v.stock > 0).length,
    low_stock_sizes: mapped.filter((v) => v.status === "low_stock").length,
    sold_out_sizes: mapped.filter((v) => v.status === "out_of_stock").length,
    variants: mapped,
  };
};

export const enrichCartItemsWithStock = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      stock_tracked: false,
      migrationRequired: false,
      items: [],
      stock_warnings: [],
    };
  }

  const resolvedTargets = await Promise.all(
    items.map((item) =>
      resolveCanonicalVariantTarget(
        item.productType || "sneakers",
        item.id,
        { name: item.name }
      )
    )
  );

  const idsByType = new Map();
  for (const target of resolvedTargets) {
    if (!Number.isInteger(target.productId) || target.productId <= 0) continue;
    if (!idsByType.has(target.productType)) {
      idsByType.set(target.productType, new Set());
    }
    idsByType.get(target.productType).add(target.productId);
  }

  const variantMap = new Map();
  const trackedProducts = new Set();

  for (const [productType, idSet] of idsByType.entries()) {
    const ids = Array.from(idSet);
    const { data, error } = await supabase
      .from("product_variants")
      .select("product_type, product_id, size, stock, low_stock_threshold, sku")
      .eq("product_type", productType)
      .in("product_id", ids);

    if (error) {
      if (isMissingInventorySchemaError(error)) {
        return {
          stock_tracked: false,
          migrationRequired: true,
          items,
          stock_warnings: [],
        };
      }
      throw error;
    }

    for (const row of data || []) {
      const prodKey = `${row.product_type}:${row.product_id}`;
      trackedProducts.add(prodKey);
      variantMap.set(`${prodKey}:${String(row.size)}`, row);
    }
  }

  const stockWarnings = [];
  const enrichedItems = items.map((item, idx) => {
    const target = resolvedTargets[idx];
    const prodKey = `${target.productType}:${target.productId}`;
    const sizeKey = `${prodKey}:${String(item.size).trim()}`;
    const variant = variantMap.get(sizeKey);

    if (variant) {
      const available = Math.max(0, Number(variant.stock) || 0);
      const threshold =
        Number(variant.low_stock_threshold) || DEFAULT_LOW_STOCK_THRESHOLD;
      const status = computeStockStatus(available, threshold);
      const exceeded = Number(item.quantity) > available;

      if (exceeded || available === 0) {
        stockWarnings.push({
          id: item.id,
          productType: item.productType || "sneakers",
          name: item.name,
          size: String(item.size),
          requested: Number(item.quantity),
          available,
          status,
        });
      }

      return {
        ...item,
        available_stock: available,
        low_stock_threshold: threshold,
        stock_status: status,
        stock_exceeded: exceeded,
        sku: variant.sku || null,
      };
    }

    if (trackedProducts.has(prodKey)) {
      stockWarnings.push({
        id: item.id,
        productType: item.productType || "sneakers",
        name: item.name,
        size: String(item.size),
        requested: Number(item.quantity),
        available: 0,
        status: "out_of_stock",
      });
      return {
        ...item,
        available_stock: 0,
        low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
        stock_status: "out_of_stock",
        stock_exceeded: true,
        sku: null,
      };
    }

    return {
      ...item,
      available_stock: null,
      low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
      stock_status: "untracked",
      stock_exceeded: false,
      sku: null,
    };
  });

  return {
    stock_tracked: trackedProducts.size > 0,
    migrationRequired: false,
    items: enrichedItems,
    stock_warnings: stockWarnings,
  };
};

const parseInsufficientStockError = (message) => {
  const raw = String(message || "");
  const markerIndex = raw.indexOf("INSUFFICIENT_STOCK|");
  if (markerIndex === -1) return null;

  const payload = raw.slice(markerIndex);
  const parts = payload.split("|");
  const name = parts[1] || "Product";
  const size = parts[2] || "";
  const requested = Number(parts[3]) || 1;
  const available = Number(parts[4]) || 0;

  return {
    ok: false,
    status: 409,
    code: "INSUFFICIENT_STOCK",
    error:
      available <= 0
        ? `${name} (size ${size}) is sold out.`
        : `Insufficient stock for ${name} (size ${size}): only ${available} left (requested ${requested}).`,
    conflict: {
      name,
      size,
      requested,
      available,
    },
  };
};

const aggregateCanonicalItems = (canonicalItems) => {
  const map = new Map();
  for (const item of canonicalItems) {
    const key = `${item.product_type}:${item.product_id}:${item.size}`;
    if (map.has(key)) {
      map.get(key).quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    `${a.product_type}:${a.product_id}:${a.size}`.localeCompare(
      `${b.product_type}:${b.product_id}:${b.size}`
    )
  );
};

/**
 * Fallback optimistic deduction if `product_variants` table exists but RPC
 * functions have not been installed yet. Always rolls back partial deductions.
 */
const deductStockTableFallback = async (canonicalItems) => {
  const aggregated = aggregateCanonicalItems(canonicalItems);
  const applied = [];

  for (const item of aggregated) {
    const { data: row, error } = await supabase
      .from("product_variants")
      .select("id, stock")
      .eq("product_type", item.product_type)
      .eq("product_id", item.product_id)
      .eq("size", item.size)
      .maybeSingle();

    if (error) {
      if (isMissingInventorySchemaError(error)) {
        return {
          ok: true,
          tracked: false,
          deducted: false,
          migrationRequired: true,
          canonicalItems: [],
        };
      }
      throw error;
    }

    if (!row) {
      const { count } = await supabase
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("product_type", item.product_type)
        .eq("product_id", item.product_id);

      if ((count || 0) > 0) {
        if (applied.length > 0) await restoreStockAtomic(applied);
        return {
          ok: false,
          status: 409,
          code: "INSUFFICIENT_STOCK",
          error: `${item.name} (size ${item.size}) is sold out.`,
          conflict: {
            name: item.name,
            size: item.size,
            requested: item.quantity,
            available: 0,
          },
        };
      }
      continue;
    }

    const currentStock = Number(row.stock) || 0;
    if (currentStock < item.quantity) {
      if (applied.length > 0) await restoreStockAtomic(applied);
      return {
        ok: false,
        status: 409,
        code: "INSUFFICIENT_STOCK",
        error:
          currentStock <= 0
            ? `${item.name} (size ${item.size}) is sold out.`
            : `Insufficient stock for ${item.name} (size ${item.size}): only ${currentStock} left (requested ${item.quantity}).`,
        conflict: {
          name: item.name,
          size: item.size,
          requested: item.quantity,
          available: currentStock,
        },
      };
    }

    // Optimistic compare-and-swap on exact previous stock value
    const { data: updated, error: updateErr } = await supabase
      .from("product_variants")
      .update({
        stock: currentStock - item.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("stock", currentStock)
      .select("id, stock");

    if (updateErr || !updated || updated.length === 0) {
      if (applied.length > 0) await restoreStockAtomic(applied);
      return {
        ok: false,
        status: 409,
        code: "INSUFFICIENT_STOCK",
        error: `Stock for ${item.name} (size ${item.size}) just changed. Please try again.`,
        conflict: {
          name: item.name,
          size: item.size,
          requested: item.quantity,
          available: Math.max(0, currentStock - 1),
        },
      };
    }

    applied.push(item);
  }

  return {
    ok: true,
    tracked: applied.length > 0,
    deducted: applied.length > 0,
    migrationRequired: false,
    canonicalItems: applied,
  };
};

export const deductStockAtomic = async (verifiedItems) => {
  if (!Array.isArray(verifiedItems) || verifiedItems.length === 0) {
    return {
      ok: true,
      tracked: false,
      deducted: false,
      canonicalItems: [],
    };
  }

  const canonicalItems = await Promise.all(
    verifiedItems.map(async (item) => {
      const target = await resolveCanonicalVariantTarget(
        item.productType || "sneakers",
        item.id,
        { name: item.name }
      );
      return {
        product_type: target.productType,
        product_id: target.productId,
        size: String(item.size).trim(),
        quantity: Number(item.quantity),
        name: item.name,
      };
    })
  );

  const { data, error } = await supabase.rpc("deduct_variant_stocks", {
    p_items: canonicalItems,
  });

  if (error) {
    const conflict = parseInsufficientStockError(error.message);
    if (conflict) return conflict;

    if (isMissingInventorySchemaError(error)) {
      return deductStockTableFallback(canonicalItems);
    }

    throw error;
  }

  const deducted = Boolean(data?.deducted);
  return {
    ok: true,
    tracked: true,
    deducted,
    migrationRequired: false,
    canonicalItems: deducted ? canonicalItems : [],
    items: data?.items || [],
  };
};

export const restoreStockAtomic = async (canonicalItems) => {
  if (!Array.isArray(canonicalItems) || canonicalItems.length === 0) {
    return { restored: false };
  }

  try {
    const { data, error } = await supabase.rpc("restore_variant_stocks", {
      p_items: canonicalItems,
    });

    if (!error) {
      return { restored: Boolean(data?.restored), items: data?.items || [] };
    }

    if (!isMissingInventorySchemaError(error)) {
      console.error("Failed to restore variant stocks via RPC:", error.message);
      return { restored: false };
    }

    // Fallback row-by-row restore when RPC is absent
    const aggregated = aggregateCanonicalItems(canonicalItems);
    for (const item of aggregated) {
      const { data: row } = await supabase
        .from("product_variants")
        .select("id, stock")
        .eq("product_type", item.product_type)
        .eq("product_id", item.product_id)
        .eq("size", item.size)
        .maybeSingle();

      if (row) {
        await supabase
          .from("product_variants")
          .update({
            stock: (Number(row.stock) || 0) + item.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    }
    return { restored: true };
  } catch (err) {
    console.error("Unexpected error restoring variant stocks:", err.message);
    return { restored: false };
  }
};

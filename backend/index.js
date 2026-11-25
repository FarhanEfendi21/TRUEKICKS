import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import supabase from "./config/supabase.js";
import bcrypt from "bcryptjs";

// Security Middleware
import {
  generateToken,
  authMiddleware,
  adminMiddleware,
  optionalAuth,
  resolveUserRole,
  setNoStoreAuthHeaders,
} from "./middleware/auth.js";
import {
  registerValidation,
  loginValidation,
  orderValidation,
  updateProfileValidation,
  reviewValidation,
  cartSyncValidation,
  wishlistSyncValidation,
  addressValidation,
  conciergeValidation,
  dropNotifyValidation,
  adminProductCreateValidation,
  adminProductUpdateValidation,
  adminSignedUploadValidation,
  adminDetailImagesValidation,
  adminDeleteUploadValidation,
  adminVariantsUpsertValidation,
  adminSaleValidation,
  adminCouponValidation,
  adminOrderUpdateValidation,
  adminUserRoleValidation,
  validate,
} from "./middleware/validation.js";
import { authLimiter, apiLimiter, conciergeLimiter } from "./middleware/rateLimit.js";
import { askConcierge } from "./services/conciergeService.js";
import {
  enrichOrder,
  generateAuthenticityCode,
  generateTrackingNumber,
  parseAuthenticityCode,
  verifyAuthenticityForOrder,
  maskBuyerName,
} from "./services/authenticity.js";
import { sendOrderConfirmationEmail } from "./services/emailService.js";
import {
  getProductVariants,
  enrichCartItemsWithStock,
  deductStockAtomic,
  restoreStockAtomic,
} from "./services/inventoryService.js";
import {
  listDrops,
  subscribeDropReminder,
  unsubscribeDropReminder,
  joinHypeQueue,
} from "./services/dropsService.js";
import {
  getPublicPaymentConfig,
  createSnapTransaction,
  fetchMidtransTransactionStatus,
  processPaymentNotification,
  computeMidtransSignature,
  getWebhookSigningSecret,
  isMidtransLiveConfigured,
  isMidtransProduction,
} from "./services/paymentService.js";
import {
  getAdminAnalytics,
  listAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  upsertAdminProductVariants,
  createAdminSignedUpload,
  deleteAdminStorageObject,
  updateAdminProductDetailImages,
  listAdminSales,
  createAdminSale,
  updateAdminSale,
  deleteAdminSale,
  listAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  listAdminOrders,
  updateAdminOrder,
  listAdminUsers,
  updateAdminUserRole,
} from "./services/adminService.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Trust first proxy (required on Vercel / reverse proxies for accurate IP rate limiting)
app.set("trust proxy", 1);

// === ALLOWED TABLES & CORS WHITELIST ===
const ALLOWED_PRODUCT_TABLES = ["products", "sneakers", "apparel", "sale_products"];

const DEFAULT_ALLOWED_ORIGINS = [
  "https://truekicks-production.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
];

const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...envAllowedOrigins])];

// === SECURITY MIDDLEWARE ===
app.use(helmet()); // Security headers

// Strict CORS whitelist with credentials allowed only for trusted origins
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow non-browser / same-origin / server-to-server requests with no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "X-CSRF-Token",
    ],
  })
);

app.use(express.json({ limit: "10mb" })); // Body parser with size limit
app.use(cookieParser()); // Parse Cookie header
app.use("/api", apiLimiter); // General rate limiting for all API routes (single registration)

// === SERVER-SIDE HELPERS (PRICE, SALE SYNC & COUPON VERIFICATION) ===
const isMissingSchemaError = (error) => {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "42P01" ||
    code === "42703" ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the") ||
    msg.includes("does not exist")
  );
};

const normalizeProductName = (name) =>
  typeof name === "string" ? name.trim().toLowerCase().replace(/\s+/g, " ") : "";

const fetchActiveSaleMap = async () => {
  const { data, error } = await supabase
    .from("sale_products")
    .select("id, name, price, discount_price");

  if (error || !Array.isArray(data)) {
    return new Map();
  }

  const saleMap = new Map();
  for (const row of data) {
    const key = normalizeProductName(row.name);
    const originalPrice = Number(row.price);
    const discountPrice = Number(row.discount_price);

    if (
      key &&
      Number.isFinite(originalPrice) &&
      Number.isFinite(discountPrice) &&
      discountPrice > 0 &&
      discountPrice < originalPrice
    ) {
      saleMap.set(key, {
        sale_id: row.id,
        price: originalPrice,
        discount_price: discountPrice,
        discount_percentage: Math.round(
          ((originalPrice - discountPrice) / originalPrice) * 100
        ),
      });
    }
  }
  return saleMap;
};

const applySaleOverride = (product, saleMap) => {
  if (!product || !saleMap) return product;
  const saleMatch = saleMap.get(normalizeProductName(product.name));
  if (!saleMatch) return product;

  return {
    ...product,
    price: saleMatch.price,
    discount_price: saleMatch.discount_price,
    is_on_sale: true,
    sale_id: saleMatch.sale_id,
    discount_percentage: saleMatch.discount_percentage,
  };
};

const applySaleToList = async (items) => {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const saleMap = await fetchActiveSaleMap();
  if (saleMap.size === 0) return items;
  return items.map((item) => applySaleOverride(item, saleMap));
};

const getAuthoritativePrice = (table, product) => {
  if (
    product.discount_price != null &&
    Number(product.discount_price) > 0 &&
    Number(product.discount_price) < Number(product.price)
  ) {
    return Number(product.discount_price);
  }
  return Number(product.price);
};

const resolveProductFromDB = async (item, saleMap = null) => {
  const productId = Number(item.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return { error: `Invalid product ID: ${item.id}` };
  }

  const activeSaleMap = saleMap || (await fetchActiveSaleMap());
  const requestedType = item.productType || item.product_type;

  if (requestedType) {
    if (!ALLOWED_PRODUCT_TABLES.includes(requestedType)) {
      return { error: `Invalid product type: ${requestedType}` };
    }

    const { data, error } = await supabase
      .from(requestedType)
      .select("id, name, price, image_url" + (requestedType === "sale_products" ? ", discount_price" : ""))
      .eq("id", productId)
      .single();

    if (error || !data) {
      return { error: `Product not found (${requestedType} #${productId}).` };
    }

    const syncedData =
      requestedType === "sale_products"
        ? data
        : applySaleOverride(data, activeSaleMap);
    const unitPrice = getAuthoritativePrice(requestedType, syncedData);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: `Invalid product pricing for product #${productId}.` };
    }

    return {
      product: {
        id: syncedData.id,
        productType: requestedType,
        name: syncedData.name,
        price: unitPrice,
        image: syncedData.image_url,
      },
    };
  }

  // Legacy cart compatibility: if productType is omitted, require exact (id + name) match from DB
  if (!item.name || typeof item.name !== "string") {
    return { error: `Product type is required for product #${productId}.` };
  }

  const lookupOrder = ["sneakers", "products", "apparel", "sale_products"];
  for (const table of lookupOrder) {
    const { data } = await supabase
      .from(table)
      .select("id, name, price, image_url" + (table === "sale_products" ? ", discount_price" : ""))
      .eq("id", productId)
      .eq("name", item.name)
      .maybeSingle();

    if (data) {
      const syncedData =
        table === "sale_products" ? data : applySaleOverride(data, activeSaleMap);
      const unitPrice = getAuthoritativePrice(table, syncedData);
      return {
        product: {
          id: syncedData.id,
          productType: table,
          name: syncedData.name,
          price: unitPrice,
          image: syncedData.image_url,
        },
      };
    }
  }

  return { error: `Product not found or mismatched metadata for product #${productId}.` };
};

const verifyCouponFromDB = async (rawCode, totalAmount) => {
  const cleanCode = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (!cleanCode) {
    return { valid: false, status: 400, message: "Coupon code is required" };
  }

  const { data: coupon, error } = await supabase
    .from("coupons")
    .select("code, discount_type, discount_value, min_purchase, expiry_date")
    .ilike("code", cleanCode)
    .single();

  if (error || !coupon) {
    return { valid: false, status: 404, message: "Invalid coupon code" };
  }

  if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
    return { valid: false, status: 400, message: "Coupon has expired" };
  }

  const minPurchase = Number(coupon.min_purchase) || 0;
  if (totalAmount < minPurchase) {
    return {
      valid: false,
      status: 400,
      message: `Minimum purchase for this coupon is Rp ${(minPurchase / 1000).toLocaleString()}K`,
    };
  }

  const discountValue = Number(coupon.discount_value) || 0;
  let discountAmount = 0;

  if (coupon.discount_type === "percent") {
    const boundedPercent = Math.min(100, Math.max(0, discountValue));
    discountAmount = Math.round((totalAmount * boundedPercent) / 100);
  } else if (coupon.discount_type === "fixed") {
    discountAmount = Math.max(0, discountValue);
  }

  discountAmount = Math.min(totalAmount, discountAmount);

  return {
    valid: true,
    coupon,
    discountAmount,
  };
};

// === ROUTE TEST (Untuk Cek Server Jalan) ===
app.get("/", (req, res) => {
  res.send("Server TrueKicks dengan Supabase Berjalan di Vercel! 🚀");
});

// === 1. ROUTE PRODUCTS (Semua Sepatu dari tabel 'products') ===
app.get("/api/products", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    const syncedData = await applySaleToList(data);
    res.json(syncedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === 2. ROUTE SNEAKERS (Khusus tabel 'sneakers') ===
app.get("/api/sneakers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("sneakers")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    const syncedData = await applySaleToList(data);
    res.json(syncedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === 3. ROUTE APPAREL (Khusus tabel 'apparel') ===
app.get("/api/apparel", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("apparel")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    const syncedData = await applySaleToList(data);
    res.json(syncedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === 4. ROUTE CATEGORIES (Untuk Navbar & Filter) ===
app.get("/api/categories", async (req, res) => {
  try {
    const { data, error } = await supabase.from("categories").select("*");

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === 5. ROUTE REGISTER (Daftar User Baru) ===
app.post("/api/register", authLimiter, registerValidation, validate, async (req, res) => {
  const { full_name, email, password } = req.body;

  // Normalize email (already validated by middleware)
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", normalizedEmail)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // Increased salt rounds

    const { data, error } = await supabase
      .from("users")
      .insert([{ full_name: full_name.trim(), email: normalizedEmail, password: hashedPassword }])
      .select();

    if (error) throw error;

    // Remove password from response and attach resolved RBAC role
    const userResponse = { ...data[0] };
    delete userResponse.password;
    userResponse.role = resolveUserRole(userResponse);

    res.status(201).json({ message: "Registration successful!", user: userResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const getAuthCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax", // 'none' is REQUIRED for cross-origin Vercel deployments
    path: "/",
  };
};

// === 6. ROUTE LOGIN (Masuk) ===
app.post("/api/login", authLimiter, loginValidation, validate, async (req, res) => {
  setNoStoreAuthHeaders(res);
  const { email, password } = req.body;

  // Normalize email (already validated by middleware)
  const normalizedEmail = email.trim().toLowerCase();

  try {
    let { data: user, error } = await supabase
      .from("users")
      .select("*")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    // Backward compatibility for accounts stored with Gmail dots stripped by older normalizeEmail()
    if (!user && !error && normalizedEmail.endsWith("@gmail.com")) {
      const [localPart, domainPart] = normalizedEmail.split("@");
      const dotlessEmail = `${localPart.replace(/\./g, "")}@${domainPart}`;
      if (dotlessEmail !== normalizedEmail) {
        const fallbackRes = await supabase
          .from("users")
          .select("*")
          .ilike("email", dotlessEmail)
          .maybeSingle();
        user = fallbackRes.data;
        error = fallbackRes.error;
      }
    }

    if (error || !user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Remove password from response and include resolved RBAC role
    const userResponse = { ...user };
    delete userResponse.password;
    userResponse.role = resolveUserRole(user);

    // Set token as an HttpOnly cookie with explicit root path
    res.cookie("token", token, {
      ...getAuthCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: "Login successful!",
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === 6a. ROUTE LOGOUT (Keluar) ===
app.post("/api/logout", (req, res) => {
  setNoStoreAuthHeaders(res);
  res.clearCookie("token", getAuthCookieOptions());
  res.json({ message: "Logout successful!" });
});

// === 6a2. ROUTE CURRENT SESSION PROFILE + LIVE RBAC ROLE ===
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.userId);
    let userRow = null;
    const primaryRes = await supabase
      .from("users")
      .select("id, full_name, email, role, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (primaryRes.error) {
      if (isMissingSchemaError(primaryRes.error)) {
        const fallbackRes = await supabase
          .from("users")
          .select("id, full_name, email, created_at")
          .eq("id", userId)
          .maybeSingle();
        if (fallbackRes.error) throw fallbackRes.error;
        userRow = fallbackRes.data;
      } else {
        throw primaryRes.error;
      }
    } else {
      userRow = primaryRes.data;
    }

    if (!userRow) {
      return res.status(401).json({ message: "Session user not found." });
    }

    res.json({
      user: {
        id: userRow.id,
        full_name: userRow.full_name,
        email: userRow.email,
        role: resolveUserRole(userRow),
        created_at: userRow.created_at,
      },
    });
  } catch (error) {
    console.error("Error fetching current session user:", error.message);
    res.status(500).json({ message: "Failed to verify session." });
  }
});

// === 6b. ROUTE UPDATE USER PROFILE (Protected + Owner Only) ===
app.put("/api/users/:id", authMiddleware, updateProfileValidation, validate, async (req, res) => {
  const { id } = req.params;
  const { full_name } = req.body;

  try {
    const parsed_user_id = parseInt(id, 10);

    if (isNaN(parsed_user_id)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    // IDOR Protection: authenticated user may only update their own profile
    if (Number(req.userId) !== parsed_user_id) {
      return res.status(403).json({ error: "Forbidden. You can only update your own profile." });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ full_name: full_name.trim() })
      .eq("id", parsed_user_id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    // Remove password hash from response and preserve resolved role
    const userResponse = { ...data[0] };
    delete userResponse.password;
    userResponse.role = resolveUserRole(userResponse);

    res.json({ message: "Profile updated successfully!", user: userResponse });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// === 7. ROUTE DETAIL PRODUK (DINAMIS + REAL-TIME SIZE STOCK) ===
app.get("/api/detail/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_PRODUCT_TABLES.includes(table)) {
    return res.status(400).json({ message: "Akses tabel ditolak." });
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data)
      return res.status(404).json({ message: "Produk tidak ditemukan" });

    let productPayload = data;
    if (table !== "sale_products") {
      const saleMap = await fetchActiveSaleMap();
      productPayload = applySaleOverride(data, saleMap);
    }

    try {
      const variantSummary = await getProductVariants(
        table,
        Number(id),
        productPayload
      );
      if (variantSummary && !variantSummary.notFound) {
        productPayload = {
          ...productPayload,
          stock_tracked: Boolean(variantSummary.tracked),
          canonical_product_type: variantSummary.canonical_type,
          canonical_product_id: variantSummary.canonical_id,
          total_stock: variantSummary.total_stock,
          variants: variantSummary.variants,
        };

        // Inherit canonical sneaker detail_images when product is viewed via `products` or `sale_products`
        if (
          table !== "sneakers" &&
          (!Array.isArray(productPayload.detail_images) ||
            productPayload.detail_images.length === 0) &&
          variantSummary.canonical_type === "sneakers" &&
          variantSummary.canonical_id
        ) {
          const { data: canonicalSneaker } = await supabase
            .from("sneakers")
            .select("detail_images")
            .eq("id", variantSummary.canonical_id)
            .maybeSingle();
          if (
            Array.isArray(canonicalSneaker?.detail_images) &&
            canonicalSneaker.detail_images.length > 0
          ) {
            productPayload = {
              ...productPayload,
              detail_images: canonicalSneaker.detail_images,
            };
          }
        }
      }
    } catch (variantErr) {
      console.error("Failed attaching variant stock:", variantErr.message);
    }

    res.json(productPayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === 7b. ROUTE REAL-TIME VARIANT STOCK PER SIZE ===
app.get("/api/variants/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  if (!ALLOWED_PRODUCT_TABLES.includes(table)) {
    return res.status(400).json({ message: "Invalid product table." });
  }

  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product ID." });
  }

  try {
    const result = await getProductVariants(table, productId);
    if (result.notFound) {
      return res.status(404).json({ message: "Product not found." });
    }
    res.json(result);
  } catch (error) {
    console.error("Error fetching product variants:", error.message);
    res.status(500).json({ error: "Failed to fetch variant stock." });
  }
});

// === 8. ROUTE ORDER / CHECKOUT (Protected + Server-Side Pricing & Coupon Verification) ===
app.post("/api/orders", authMiddleware, orderValidation, validate, async (req, res) => {
  const { user_id, full_name, address, city, postal_code, phone, items, coupon_code } = req.body;

  try {
    const authenticatedUserId = Number(req.userId);
    if (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0) {
      return res.status(401).json({ error: "Invalid authenticated user." });
    }

    // IDOR Protection: reject attempts to submit an order on behalf of another user
    if (user_id !== undefined && Number(user_id) !== authenticatedUserId) {
      return res.status(403).json({ error: "Forbidden. Cannot create an order for another user." });
    }

    // Recalculate all item prices strictly from Supabase DB (never trust client price/total_price)
    const saleMap = await fetchActiveSaleMap();
    const verifiedItems = [];
    let subtotal = 0;

    for (const rawItem of items) {
      const quantity = Number(rawItem.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ error: "Invalid item quantity." });
      }

      const resolved = await resolveProductFromDB(rawItem, saleMap);
      if (resolved.error) {
        return res.status(400).json({ error: resolved.error });
      }

      subtotal += resolved.product.price * quantity;
      verifiedItems.push({
        id: resolved.product.id,
        productType: resolved.product.productType,
        name: resolved.product.name,
        price: resolved.product.price,
        image: resolved.product.image,
        size: String(rawItem.size),
        quantity,
      });
    }

    // Re-verify coupon server-side if provided
    let discountAmount = 0;
    if (coupon_code && typeof coupon_code === "string" && coupon_code.trim() !== "") {
      const couponCheck = await verifyCouponFromDB(coupon_code, subtotal);
      if (!couponCheck.valid) {
        return res.status(couponCheck.status).json({ error: couponCheck.message });
      }
      discountAmount = couponCheck.discountAmount;
    }

    const verifiedTotalPrice = Math.max(0, subtotal - discountAmount);

    // Atomic per-size stock deduction (prevents overselling under concurrent checkout)
    const stockResult = await deductStockAtomic(verifiedItems);
    if (!stockResult.ok) {
      return res.status(stockResult.status || 409).json({
        error: stockResult.error,
        code: stockResult.code || "INSUFFICIENT_STOCK",
        conflict: stockResult.conflict || null,
      });
    }

    const baseOrderPayload = {
      user_id: authenticatedUserId,
      full_name: full_name.trim(),
      address: address.trim(),
      city: (city || "").trim(),
      postal_code: (postal_code || "").trim(),
      phone: phone.trim(),
      total_price: verifiedTotalPrice,
      items: verifiedItems,
      status: "Pending Payment",
    };

    const extendedOrderPayload = {
      ...baseOrderPayload,
      courier: "TrueKicks Express",
      coupon_code:
        coupon_code && typeof coupon_code === "string" && coupon_code.trim()
          ? coupon_code.trim().toUpperCase()
          : null,
      discount_amount: discountAmount,
    };

    let insertRes;
    let hasExtendedOrderCols = true;

    try {
      insertRes = await supabase
        .from("orders")
        .insert(extendedOrderPayload)
        .select();

      if (insertRes.error && isMissingSchemaError(insertRes.error)) {
        hasExtendedOrderCols = false;
        insertRes = await supabase
          .from("orders")
          .insert(baseOrderPayload)
          .select();
      }

      if (insertRes.error) throw insertRes.error;
    } catch (insertErr) {
      if (stockResult.deducted && stockResult.canonicalItems?.length > 0) {
        await restoreStockAtomic(stockResult.canonicalItems);
      }
      throw insertErr;
    }

    const insertedOrder = insertRes.data?.[0];

    // Initiate Midtrans Snap transaction (or local sandbox simulator when Midtrans key unset)
    let paymentSession = null;
    try {
      paymentSession = await createSnapTransaction({
        order: insertedOrder,
        items: verifiedItems,
        discountAmount,
        customerEmail: req.userEmail,
        frontendUrl: req.headers.origin,
      });
    } catch (snapErr) {
      console.error("Snap transaction creation error:", snapErr.message);
      // Keep order as Pending Payment so user can retry via "Pay Now" in Order History
      paymentSession = {
        mode: isMidtransLiveConfigured() ? "sandbox" : "sandbox_simulator",
        gateway: "midtrans",
        gateway_order_id: null,
        token: null,
        redirect_url: null,
        status: "pending",
        error: snapErr.message,
      };
    }

    const trackingNumber = generateTrackingNumber(insertedOrder);
    const authenticityCode = generateAuthenticityCode(insertedOrder);

    // Persist tracking, authenticity, and payment session metadata cleanly
    if (insertedOrder?.id) {
      const paymentCols = {
        ...(hasExtendedOrderCols
          ? {
              tracking_number: trackingNumber,
              authenticity_code: authenticityCode,
            }
          : {}),
        payment_status: "pending",
        payment_gateway: paymentSession?.gateway || "midtrans",
        payment_gateway_order_id: paymentSession?.gateway_order_id || null,
        payment_token: paymentSession?.token || null,
        payment_redirect_url: paymentSession?.redirect_url || null,
        payment_expires_at: paymentSession?.expires_at || null,
      };

      const metaUpdate = await supabase
        .from("orders")
        .update(paymentCols)
        .eq("id", insertedOrder.id);

      if (metaUpdate.error && isMissingSchemaError(metaUpdate.error) && hasExtendedOrderCols) {
        await supabase
          .from("orders")
          .update({
            tracking_number: trackingNumber,
            authenticity_code: authenticityCode,
          })
          .eq("id", insertedOrder.id);
      }
    }

    const enriched = enrichOrder({
      ...insertedOrder,
      tracking_number: trackingNumber,
      authenticity_code: authenticityCode,
      payment_status: "pending",
      payment_gateway: paymentSession?.gateway || "midtrans",
      payment_gateway_order_id: paymentSession?.gateway_order_id || null,
      payment_token: paymentSession?.token || null,
      payment_redirect_url: paymentSession?.redirect_url || null,
      payment_expires_at: paymentSession?.expires_at || null,
    });

    // Best-effort clear user's cloud cart after successful order creation
    try {
      await supabase.from("cart_items").delete().eq("user_id", authenticatedUserId);
    } catch {
      // Ignore if cart_items migration has not run yet
    }

    // Best-effort order confirmation email via Resend (never blocks order creation)
    const emailResult = await sendOrderConfirmationEmail({
      to: req.userEmail,
      order: enriched,
      pricing: {
        subtotal,
        discount_amount: discountAmount,
        total_price: verifiedTotalPrice,
      },
      frontendUrl: req.headers.origin,
    });

    res.status(201).json({
      message: "Order created. Please complete payment.",
      order: [enriched],
      pricing: {
        subtotal,
        discount_amount: discountAmount,
        total_price: verifiedTotalPrice,
      },
      payment: paymentSession,
      tracking_number: enriched.tracking_number,
      authenticity_code: enriched.authenticity_code,
      email_sent: Boolean(emailResult?.sent),
      stock_tracked: Boolean(stockResult.tracked),
    });
  } catch (error) {
    console.error("Error creating order:", error.message);
    res.status(500).json({ error: "DB Insert Failed: " + error.message });
  }
});

// === 8b. ROUTE GET USER ORDERS (Protected + Owner Only) ===
app.get("/api/orders/user/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    const parsed_user_id = parseInt(userId, 10);

    if (isNaN(parsed_user_id)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    // IDOR Protection: authenticated user may only read their own order history
    if (Number(req.userId) !== parsed_user_id) {
      return res.status(403).json({ error: "Forbidden. You can only view your own orders." });
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", parsed_user_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json((data || []).map(enrichOrder));
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// === 9. ROUTE SALE (KHUSUS DARI TABEL 'sale_products') ===
app.get("/api/sale", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("sale_products")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === 10. ROUTE REVIEWS ===

// GET ALL REVIEWS (for product cards rating display)
app.get("/api/all-reviews", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, product_id, product_type, rating")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET REVIEWS BY PRODUCT ID
app.get("/api/reviews/:productId", async (req, res) => {
  const { productId } = req.params;
  const { type } = req.query; // Ambil type dari query param

  try {
    let query = supabase
      .from("reviews")
      .select("*, users(full_name)")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    // Jika ada parameter type, filter juga berdasarkan type
    if (type) {
      query = query.eq("product_type", type);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reviews", authMiddleware, reviewValidation, validate, async (req, res) => {
  const { user_id, product_id, product_type, rating, comment } = req.body;

  try {
    const authenticatedUserId = Number(req.userId);
    if (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0) {
      return res.status(401).json({ message: "Invalid authenticated user." });
    }

    // Prevent user_id spoofing
    if (user_id !== undefined && Number(user_id) !== authenticatedUserId) {
      return res.status(403).json({ message: "Forbidden. Cannot post review as another user." });
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert([
        {
          user_id: authenticatedUserId,
          product_id: Number(product_id),
          product_type,
          rating: Number(rating),
          comment: comment.trim(),
        },
      ])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === 11. ROUTE COUPONS ===
app.post("/api/coupons/verify", async (req, res) => {
  const { code, totalAmount } = req.body;
  const parsedAmount = Number(totalAmount);

  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ message: "Invalid total amount" });
  }

  try {
    const result = await verifyCouponFromDB(code, parsedAmount);
    if (!result.valid) {
      return res.status(result.status).json({ message: result.message });
    }

    res.json({
      message: "Coupon applied!",
      discount_type: result.coupon.discount_type,
      discount_value: result.coupon.discount_value,
      code: result.coupon.code,
    });
  } catch (error) {
    console.error("Coupon verification error:", error.message);
    res.status(500).json({ error: "Failed to verify coupon" });
  }
});

// === 12. CLOUD-SYNCED CART ROUTES (Protected, Owner-Scoped) ===
app.get("/api/cart", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const { data, error } = await supabase
      .from("cart_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      if (isMissingSchemaError(error)) {
        return res.json({ synced: false, migrationRequired: true, items: [] });
      }
      throw error;
    }

    const saleMap = await fetchActiveSaleMap();
    const items = (data || []).map((row) => {
      const synced = applySaleOverride(
        { name: row.name, price: Number(row.price) },
        saleMap
      );
      return {
        id: row.product_id,
        productType: row.product_type || "sneakers",
        name: row.name,
        price: getAuthoritativePrice(row.product_type, synced),
        image: row.image,
        size: row.size,
        quantity: Number(row.quantity) || 1,
      };
    });

    const stockMeta = await enrichCartItemsWithStock(items);
    res.json({
      synced: true,
      stock_tracked: stockMeta.stock_tracked,
      stock_warnings: stockMeta.stock_warnings,
      items: stockMeta.items,
    });
  } catch (error) {
    console.error("Error fetching cloud cart:", error.message);
    res.status(500).json({ error: "Failed to fetch cart." });
  }
});

app.put("/api/cart", authMiddleware, cartSyncValidation, validate, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const rawItems = req.body.items || [];

    // Deduplicate incoming items by (product_id, product_type, size)
    const dedupMap = new Map();
    for (const item of rawItems) {
      const productId = Number(item.id);
      if (!Number.isInteger(productId) || productId <= 0) continue;
      const productType = item.productType || "sneakers";
      const size = String(item.size).trim();
      const key = `${productType}:${productId}:${size}`;
      const qty = Math.min(100, Math.max(1, Number(item.quantity) || 1));

      if (dedupMap.has(key)) {
        dedupMap.get(key).quantity = Math.min(100, dedupMap.get(key).quantity + qty);
      } else {
        dedupMap.set(key, {
          user_id: userId,
          product_id: productId,
          product_type: productType,
          name: String(item.name).trim(),
          price: Number(item.price) || 0,
          image: item.image || "",
          size,
          quantity: qty,
          updated_at: new Date().toISOString(),
        });
      }
    }

    const delRes = await supabase.from("cart_items").delete().eq("user_id", userId);
    if (delRes.error) {
      if (isMissingSchemaError(delRes.error)) {
        return res.json({ synced: false, migrationRequired: true, items: rawItems });
      }
      throw delRes.error;
    }

    const rowsToInsert = Array.from(dedupMap.values());
    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase.from("cart_items").insert(rowsToInsert);
      if (insertErr) throw insertErr;
    }

    const mappedItems = rowsToInsert.map((r) => ({
      id: r.product_id,
      productType: r.product_type,
      name: r.name,
      price: r.price,
      image: r.image,
      size: r.size,
      quantity: r.quantity,
    }));

    const stockMeta = await enrichCartItemsWithStock(mappedItems);

    res.json({
      synced: true,
      stock_tracked: stockMeta.stock_tracked,
      stock_warnings: stockMeta.stock_warnings,
      items: stockMeta.items,
    });
  } catch (error) {
    console.error("Error syncing cloud cart:", error.message);
    res.status(500).json({ error: "Failed to sync cart." });
  }
});

app.delete("/api/cart", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
    if (error && !isMissingSchemaError(error)) throw error;
    res.json({ synced: !error, items: [] });
  } catch (error) {
    console.error("Error clearing cloud cart:", error.message);
    res.status(500).json({ error: "Failed to clear cart." });
  }
});

// === 13. CLOUD-SYNCED WISHLIST ROUTES (Protected, Owner-Scoped) ===
app.get("/api/wishlist", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingSchemaError(error)) {
        return res.json({ synced: false, migrationRequired: true, items: [] });
      }
      throw error;
    }

    const saleMap = await fetchActiveSaleMap();
    const items = (data || []).map((row) => {
      const base = {
        id: row.product_id,
        productType: row.product_type || "sneakers",
        name: row.name,
        price: Number(row.price) || 0,
        discount_price: row.discount_price != null ? Number(row.discount_price) : null,
        discount_percentage: Number(row.discount_percentage) || 0,
        category: row.category || "",
        image: row.image || "",
      };
      return applySaleOverride(base, saleMap);
    });

    res.json({ synced: true, items });
  } catch (error) {
    console.error("Error fetching cloud wishlist:", error.message);
    res.status(500).json({ error: "Failed to fetch wishlist." });
  }
});

app.put("/api/wishlist", authMiddleware, wishlistSyncValidation, validate, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const rawItems = req.body.items || [];

    const dedupMap = new Map();
    for (const item of rawItems) {
      const productId = Number(item.id);
      if (!Number.isInteger(productId) || productId <= 0) continue;
      const productType = item.productType || "sneakers";
      const key = `${productType}:${productId}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, {
          user_id: userId,
          product_id: productId,
          product_type: productType,
          name: String(item.name).trim(),
          price: Number(item.price) || 0,
          discount_price: item.discount_price != null ? Number(item.discount_price) : null,
          discount_percentage: Number(item.discount_percentage) || 0,
          category: item.category ? String(item.category).trim() : "",
          image: item.image || "",
        });
      }
    }

    const delRes = await supabase.from("wishlist_items").delete().eq("user_id", userId);
    if (delRes.error) {
      if (isMissingSchemaError(delRes.error)) {
        return res.json({ synced: false, migrationRequired: true, items: rawItems });
      }
      throw delRes.error;
    }

    const rowsToInsert = Array.from(dedupMap.values());
    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase.from("wishlist_items").insert(rowsToInsert);
      if (insertErr) throw insertErr;
    }

    res.json({
      synced: true,
      items: rowsToInsert.map((r) => ({
        id: r.product_id,
        productType: r.product_type,
        name: r.name,
        price: r.price,
        discount_price: r.discount_price,
        discount_percentage: r.discount_percentage,
        category: r.category,
        image: r.image,
      })),
    });
  } catch (error) {
    console.error("Error syncing cloud wishlist:", error.message);
    res.status(500).json({ error: "Failed to sync wishlist." });
  }
});

// === 14. SAVED SHIPPING ADDRESS BOOK ROUTES (Protected, Owner-Scoped) ===
app.get("/api/addresses", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const { data, error } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingSchemaError(error)) {
        return res.json({ synced: false, migrationRequired: true, addresses: [] });
      }
      throw error;
    }

    res.json({ synced: true, addresses: data || [] });
  } catch (error) {
    console.error("Error fetching saved addresses:", error.message);
    res.status(500).json({ error: "Failed to fetch addresses." });
  }
});

app.post("/api/addresses", authMiddleware, addressValidation, validate, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const { label, full_name, phone, address, city, postal_code, is_default } = req.body;

    if (is_default) {
      const unsetRes = await supabase
        .from("user_addresses")
        .update({ is_default: false })
        .eq("user_id", userId);
      if (unsetRes.error && isMissingSchemaError(unsetRes.error)) {
        return res.status(200).json({ synced: false, migrationRequired: true, address: null });
      }
    }

    const { data, error } = await supabase
      .from("user_addresses")
      .insert([
        {
          user_id: userId,
          label: (label || "Home").trim(),
          full_name: full_name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          postal_code: postal_code.trim(),
          is_default: Boolean(is_default),
        },
      ])
      .select();

    if (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ synced: false, migrationRequired: true, address: null });
      }
      throw error;
    }

    res.status(201).json({ synced: true, address: data[0] });
  } catch (error) {
    console.error("Error saving address:", error.message);
    res.status(500).json({ error: "Failed to save address." });
  }
});

app.put("/api/addresses/:id", authMiddleware, addressValidation, validate, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const addressId = parseInt(req.params.id, 10);
    if (isNaN(addressId)) {
      return res.status(400).json({ error: "Invalid address ID." });
    }

    const { label, full_name, phone, address, city, postal_code, is_default } = req.body;

    if (is_default) {
      await supabase
        .from("user_addresses")
        .update({ is_default: false })
        .eq("user_id", userId);
    }

    const { data, error } = await supabase
      .from("user_addresses")
      .update({
        label: (label || "Home").trim(),
        full_name: full_name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        postal_code: postal_code.trim(),
        is_default: Boolean(is_default),
        updated_at: new Date().toISOString(),
      })
      .eq("id", addressId)
      .eq("user_id", userId)
      .select();

    if (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ synced: false, migrationRequired: true, address: null });
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Address not found." });
    }

    res.json({ synced: true, address: data[0] });
  } catch (error) {
    console.error("Error updating address:", error.message);
    res.status(500).json({ error: "Failed to update address." });
  }
});

app.delete("/api/addresses/:id", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.userId);
    const addressId = parseInt(req.params.id, 10);
    if (isNaN(addressId)) {
      return res.status(400).json({ error: "Invalid address ID." });
    }

    const { error } = await supabase
      .from("user_addresses")
      .delete()
      .eq("id", addressId)
      .eq("user_id", userId);

    if (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ synced: false, migrationRequired: true });
      }
      throw error;
    }

    res.json({ synced: true, deletedId: addressId });
  } catch (error) {
    console.error("Error deleting address:", error.message);
    res.status(500).json({ error: "Failed to delete address." });
  }
});

// === 15. PUBLIC DIGITAL AUTHENTICITY VERIFICATION ROUTE ===
app.get("/api/authenticity/:code", async (req, res) => {
  try {
    const rawCode = String(req.params.code || "").trim().toUpperCase();
    if (!rawCode || rawCode.length < 8 || rawCode.length > 64) {
      return res.status(400).json({ valid: false, message: "Invalid authenticity code format." });
    }

    let matchedOrder = null;

    // 1. Try direct DB column lookup when migrated
    const byColumn = await supabase
      .from("orders")
      .select("*")
      .eq("authenticity_code", rawCode)
      .maybeSingle();

    if (!byColumn.error && byColumn.data) {
      matchedOrder = byColumn.data;
    } else {
      // 2. Fallback: lookup by UUID prefix range (indexed PK scan) or numeric ID, then verify HMAC signature
      const parsed = parseAuthenticityCode(rawCode);
      if (parsed) {
        let candidates = [];

        if (parsed.isUuidPrefix) {
          const lower = parsed.idPrefix.toLowerCase();
          const uuidRange = await supabase
            .from("orders")
            .select("*")
            .gte("id", `${lower}-0000-0000-0000-000000000000`)
            .lte("id", `${lower}-ffff-ffff-ffff-ffffffffffff`)
            .limit(10);

          if (!uuidRange.error && Array.isArray(uuidRange.data)) {
            candidates = uuidRange.data;
          }
        }

        if (candidates.length === 0 && parsed.numericOrderId) {
          const byId = await supabase
            .from("orders")
            .select("*")
            .eq("id", parsed.numericOrderId)
            .maybeSingle();

          if (!byId.error && byId.data) {
            candidates = [byId.data];
          }
        }

        matchedOrder =
          candidates.find((row) => verifyAuthenticityForOrder(rawCode, row)) ||
          null;
      }
    }

    if (!matchedOrder) {
      return res.status(404).json({
        valid: false,
        message: "Authenticity certificate not found or invalid.",
      });
    }

    const enriched = enrichOrder(matchedOrder);
    // Return public-safe certificate only (mask buyer name, never expose address/phone/email)
    res.json({
      valid: true,
      certificate: {
        code: enriched.authenticity_code,
        order_id: enriched.id,
        issued_at: enriched.created_at,
        verified_at: new Date().toISOString(),
        status: enriched.status || "Processing",
        buyer_masked: maskBuyerName(enriched.full_name),
        courier: enriched.courier,
        tracking_number: enriched.tracking_number,
        items: (enriched.items || []).map((item) => ({
          id: item.id,
          productType: item.productType || "sneakers",
          name: item.name,
          size: item.size,
          quantity: item.quantity,
          image: item.image || item.image_url || "",
        })),
      },
    });
  } catch (error) {
    console.error("Authenticity verification error:", error.message);
    res.status(500).json({ valid: false, message: "Verification service error." });
  }
});

// === 16. AI SNEAKER CONCIERGE ROUTE (Catalog-Grounded LLM + Fallback) ===
app.post("/api/concierge/chat", conciergeLimiter, conciergeValidation, validate, async (req, res) => {
  const { message, history, context } = req.body;
  try {
    const result = await askConcierge({ message, history, context });
    res.json(result);
  } catch (error) {
    console.error("Concierge chat error:", error.message);
    const isEn = context?.language === "en";
    res.status(500).json({
      message: isEn
        ? "Kixo is temporarily unavailable. Please try again in a moment."
        : "Kixo sedang tidak tersedia sementara. Silakan coba lagi beberapa saat.",
    });
  }
});

// === 17. DROP CALENDAR, NOTIFY ME & HYPE QUEUE ROUTES ===
app.get("/api/drops", optionalAuth, async (req, res) => {
  try {
    const queryEmail =
      typeof req.query.email === "string" ? req.query.email.trim() : "";
    const result = await listDrops({
      userId: req.userId ?? null,
      email: req.userEmail || queryEmail || null,
    });
    res.json(result);
  } catch (error) {
    console.error("Error fetching drops:", error.message);
    res.status(500).json({ error: "Failed to load drop calendar." });
  }
});

app.post(
  "/api/drops/:id/notify",
  optionalAuth,
  dropNotifyValidation,
  validate,
  async (req, res) => {
    const dropId = Number(req.params.id);
    if (!Number.isInteger(dropId) || dropId <= 0) {
      return res.status(400).json({ message: "Invalid drop ID." });
    }

    const targetEmail = (req.body.email || req.userEmail || "").trim().toLowerCase();
    if (!targetEmail) {
      return res
        .status(400)
        .json({ message: "Email is required to enable drop reminders." });
    }

    try {
      const result = await subscribeDropReminder({
        dropId,
        userId: req.userId ?? null,
        email: targetEmail,
      });

      if (result.notFound) {
        return res.status(404).json({ message: "Drop not found." });
      }
      if (result.invalidStatus) {
        return res.status(400).json({ message: result.message });
      }

      const statusCode = result.already_subscribed ? 200 : 201;
      res.status(statusCode).json({
        message: result.already_subscribed
          ? "Reminder is already active for this drop."
          : "Drop reminder saved!",
        ...result,
      });
    } catch (error) {
      console.error("Error saving drop reminder:", error.message);
      res.status(500).json({ error: "Failed to save drop reminder." });
    }
  }
);

app.delete("/api/drops/:id/notify", optionalAuth, async (req, res) => {
  const dropId = Number(req.params.id);
  if (!Number.isInteger(dropId) || dropId <= 0) {
    return res.status(400).json({ message: "Invalid drop ID." });
  }

  const targetEmail =
    (typeof req.query.email === "string" && req.query.email.trim()) ||
    (typeof req.body?.email === "string" && req.body.email.trim()) ||
    req.userEmail ||
    "";

  if (!targetEmail && !req.userId) {
    return res
      .status(400)
      .json({ message: "Email or authenticated session is required." });
  }

  try {
    const result = await unsubscribeDropReminder({
      dropId,
      userId: req.userId ?? null,
      email: targetEmail || null,
    });

    res.json({
      message: "Drop reminder removed.",
      ...result,
    });
  } catch (error) {
    console.error("Error removing drop reminder:", error.message);
    res.status(500).json({ error: "Failed to remove drop reminder." });
  }
});

app.post("/api/drops/:id/queue/join", optionalAuth, async (req, res) => {
  const dropId = Number(req.params.id);
  if (!Number.isInteger(dropId) || dropId <= 0) {
    return res.status(400).json({ message: "Invalid drop ID." });
  }

  try {
    const result = await joinHypeQueue({
      dropId,
      userId: req.userId ?? null,
    });

    if (result.notFound) {
      return res.status(404).json({ message: "Drop not found." });
    }
    if (!result.ok) {
      return res
        .status(result.status || 400)
        .json({ error: result.error, code: result.code });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Error joining hype queue:", error.message);
    res.status(500).json({ error: "Failed to join release queue." });
  }
});

// === 18. PAYMENT GATEWAY (MIDTRANS SNAP) & WEBHOOK ROUTES ===
app.get("/api/payments/config", (req, res) => {
  res.json(getPublicPaymentConfig());
});

// Midtrans Server-to-Server Webhook (SHA-512 Signature Verified + Idempotent)
app.post("/api/payments/webhook", async (req, res) => {
  try {
    const result = await processPaymentNotification({
      payload: req.body,
      requireSignature: true,
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    res.json({
      received: true,
      idempotent: Boolean(result.idempotent),
      status: result.status,
      payment_status: result.payment_status,
      payment_method: result.payment_method || null,
      stock_restored: Boolean(result.stock_restored),
    });
  } catch (error) {
    console.error("Payment webhook error:", error.message);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

// Re-initiate or Resume Snap Payment for Pending Payment Order (Owner-Only)
app.post("/api/orders/:id/pay", authMiddleware, async (req, res) => {
  const orderId = String(req.params.id || "").trim();
  if (!orderId) {
    return res.status(400).json({ error: "Invalid order ID." });
  }

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    if (Number(order.user_id) !== Number(req.userId)) {
      return res.status(403).json({ error: "Forbidden. You can only pay for your own orders." });
    }

    const enriched = enrichOrder(order);
    const statusLower = String(enriched.status || "").toLowerCase();
    const payStatusLower = String(enriched.payment_status || "").toLowerCase();

    if (
      payStatusLower === "paid" ||
      ["paid", "processing", "packed", "shipped", "delivered", "completed"].includes(statusLower)
    ) {
      return res.status(400).json({ error: "This order has already been paid." });
    }

    if (
      ["expired", "cancelled", "failed", "refunded"].includes(payStatusLower) ||
      ["expired", "cancelled"].includes(statusLower)
    ) {
      return res.status(400).json({ error: "This order is expired or cancelled and cannot be paid." });
    }

    const paymentSession = await createSnapTransaction({
      order,
      items: order.items || [],
      discountAmount: Number(order.discount_amount) || 0,
      customerEmail: req.userEmail,
      frontendUrl: req.headers.origin,
    });

    await supabase
      .from("orders")
      .update({
        payment_status: "pending",
        payment_gateway: paymentSession.gateway,
        payment_gateway_order_id: paymentSession.gateway_order_id,
        payment_token: paymentSession.token,
        payment_redirect_url: paymentSession.redirect_url,
        payment_expires_at: paymentSession.expires_at,
      })
      .eq("id", order.id);

    res.json({
      order: enrichOrder({
        ...order,
        payment_status: "pending",
        payment_gateway: paymentSession.gateway,
        payment_gateway_order_id: paymentSession.gateway_order_id,
        payment_token: paymentSession.token,
        payment_redirect_url: paymentSession.redirect_url,
        payment_expires_at: paymentSession.expires_at,
      }),
      payment: paymentSession,
    });
  } catch (error) {
    console.error("Re-initiate payment error:", error.message);
    res.status(500).json({ error: "Failed to initialize payment session." });
  }
});

// Poll & Reconcile Live Payment Status (Owner-Only)
app.get("/api/orders/:id/payment-status", authMiddleware, async (req, res) => {
  const orderId = String(req.params.id || "").trim();
  if (!orderId) {
    return res.status(400).json({ error: "Invalid order ID." });
  }

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (Number(order.user_id) !== Number(req.userId)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    let latestOrder = enrichOrder(order);

    // If Midtrans live sandbox/prod is configured and order is still pending, reconcile directly with Midtrans Status API
    if (
      isMidtransLiveConfigured() &&
      latestOrder.payment_status === "pending" &&
      latestOrder.payment_gateway_order_id
    ) {
      const midtransStatus = await fetchMidtransTransactionStatus(
        latestOrder.payment_gateway_order_id
      );
      if (midtransStatus) {
        const reconciled = await processPaymentNotification({
          payload: midtransStatus,
          requireSignature: false,
          explicitOrderId: order.id,
        });
        if (reconciled.ok && reconciled.order) {
          latestOrder = reconciled.order;
        }
      }
    }

    res.json({
      order: latestOrder,
      status: latestOrder.status,
      payment_status: latestOrder.payment_status,
      payment_method: latestOrder.payment_method || null,
      paid_at: latestOrder.paid_at || null,
    });
  } catch (error) {
    console.error("Payment status check error:", error.message);
    res.status(500).json({ error: "Failed to check payment status." });
  }
});

// Local Sandbox Payment Simulator (Disabled automatically when real Midtrans key or production mode is active)
app.post("/api/payments/sandbox/simulate", authMiddleware, async (req, res) => {
  if (isMidtransLiveConfigured() || isMidtransProduction()) {
    return res.status(403).json({
      error: "Sandbox simulator is disabled when live Midtrans credentials are active.",
    });
  }

  const { order_id, action = "settlement", payment_type = "qris" } = req.body || {};
  const allowedActions = ["settlement", "expire", "cancel"];
  if (!order_id || !allowedActions.includes(String(action))) {
    return res.status(400).json({ error: "Valid order_id and action (settlement|expire|cancel) are required." });
  }

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (Number(order.user_id) !== Number(req.userId)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const gatewayOrderId =
      order.payment_gateway_order_id || `TK-${String(order.id).slice(0, 8).toUpperCase()}-SIM`;
    const grossAmount = `${Math.round(Number(order.total_price) || 0)}.00`;
    const statusCode = action === "settlement" ? "200" : "202";
    const signingSecret = getWebhookSigningSecret();

    const syntheticWebhookPayload = {
      order_id: gatewayOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      transaction_status: action,
      fraud_status: "accept",
      payment_type: String(payment_type || "qris"),
      signature_key: computeMidtransSignature(
        {
          order_id: gatewayOrderId,
          status_code: statusCode,
          gross_amount: grossAmount,
        },
        signingSecret
      ),
    };

    const result = await processPaymentNotification({
      payload: syntheticWebhookPayload,
      requireSignature: true,
      explicitOrderId: order.id,
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    res.json({
      simulated: true,
      ...result,
    });
  } catch (error) {
    console.error("Sandbox payment simulation error:", error.message);
    res.status(500).json({ error: "Failed to simulate payment." });
  }
});

// === 19. ADMIN DASHBOARD & RBAC ROUTES (Protected: authMiddleware + adminMiddleware) ===

app.get("/api/admin/analytics", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const analytics = await getAdminAnalytics({
      days: req.query.days,
      months: req.query.months,
    });
    res.json(analytics);
  } catch (error) {
    console.error("Admin analytics error:", error.message);
    res.status(500).json({ error: "Failed to load admin analytics." });
  }
});

// Admin Products CRUD & Variant Stock Matrix
app.get("/api/admin/products", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const products = await listAdminProducts({
      type: typeof req.query.type === "string" ? req.query.type : "all",
      q: typeof req.query.q === "string" ? req.query.q : "",
    });
    res.json({ products });
  } catch (error) {
    console.error("Admin list products error:", error.message);
    res.status(500).json({ error: "Failed to load products." });
  }
});

app.post(
  "/api/admin/products",
  authMiddleware,
  adminMiddleware,
  adminProductCreateValidation,
  validate,
  async (req, res) => {
    try {
      const result = await createAdminProduct(req.body);
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.status(201).json({ message: "Product created.", product: result.product });
    } catch (error) {
      console.error("Admin create product error:", error.message);
      res.status(500).json({ error: "Failed to create product." });
    }
  }
);

app.put(
  "/api/admin/products/:type/:id",
  authMiddleware,
  adminMiddleware,
  adminProductUpdateValidation,
  validate,
  async (req, res) => {
    try {
      const result = await updateAdminProduct(req.params.type, req.params.id, req.body);
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.json({ message: "Product updated.", product: result.product });
    } catch (error) {
      console.error("Admin update product error:", error.message);
      res.status(500).json({ error: "Failed to update product." });
    }
  }
);

app.delete("/api/admin/products/:type/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await deleteAdminProduct(req.params.type, req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    res.json({ message: "Product deleted.", deleted: result.deleted });
  } catch (error) {
    console.error("Admin delete product error:", error.message);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

app.put(
  "/api/admin/products/:type/:id/variants",
  authMiddleware,
  adminMiddleware,
  adminVariantsUpsertValidation,
  validate,
  async (req, res) => {
    try {
      const result = await upsertAdminProductVariants(
        req.params.type,
        req.params.id,
        req.body.variants
      );
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.json({
        message: "Variant stock updated.",
        variants: result.variants,
        total_stock: result.total_stock,
      });
    } catch (error) {
      console.error("Admin update variants error:", error.message);
      res.status(500).json({ error: "Failed to update variant stock." });
    }
  }
);

// Admin Direct Storage Signed Upload & Sneaker Detail Photo Gallery
app.post(
  "/api/admin/uploads/sign",
  authMiddleware,
  adminMiddleware,
  adminSignedUploadValidation,
  validate,
  async (req, res) => {
    try {
      const result = await createAdminSignedUpload(req.body);
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.json(result);
    } catch (error) {
      console.error("Admin signed upload URL error:", error.message);
      res.status(500).json({ error: "Failed to create upload URL." });
    }
  }
);

app.post(
  "/api/admin/uploads/delete",
  authMiddleware,
  adminMiddleware,
  adminDeleteUploadValidation,
  validate,
  async (req, res) => {
    try {
      const result = await deleteAdminStorageObject(req.body);
      res.json(result);
    } catch (error) {
      console.error("Admin storage delete error:", error.message);
      res.status(500).json({ error: "Failed to delete storage object." });
    }
  }
);

app.put(
  "/api/admin/products/:type/:id/detail-images",
  authMiddleware,
  adminMiddleware,
  adminDetailImagesValidation,
  validate,
  async (req, res) => {
    try {
      const result = await updateAdminProductDetailImages(
        req.params.type,
        req.params.id,
        req.body.detail_images
      );
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.json({
        message: "Detail photo gallery updated.",
        product: result.product,
        detail_images: result.detail_images,
      });
    } catch (error) {
      console.error("Admin detail images update error:", error.message);
      res.status(500).json({ error: "Failed to update detail photo gallery." });
    }
  }
);

// Admin Sale Listings CRUD
app.get("/api/admin/sales", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const sales = await listAdminSales();
    res.json({ sales });
  } catch (error) {
    console.error("Admin list sales error:", error.message);
    res.status(500).json({ error: "Failed to load sale listings." });
  }
});

app.post(
  "/api/admin/sales",
  authMiddleware,
  adminMiddleware,
  adminSaleValidation,
  validate,
  async (req, res) => {
    try {
      const result = await createAdminSale(req.body);
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.status(201).json({ message: "Sale listing created.", sale: result.sale });
    } catch (error) {
      console.error("Admin create sale error:", error.message);
      res.status(500).json({ error: "Failed to create sale listing." });
    }
  }
);

app.put(
  "/api/admin/sales/:id",
  authMiddleware,
  adminMiddleware,
  adminSaleValidation,
  validate,
  async (req, res) => {
    try {
      const result = await updateAdminSale(req.params.id, req.body);
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.json({ message: "Sale listing updated.", sale: result.sale });
    } catch (error) {
      console.error("Admin update sale error:", error.message);
      res.status(500).json({ error: "Failed to update sale listing." });
    }
  }
);

app.delete("/api/admin/sales/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await deleteAdminSale(req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    res.json({ message: "Sale listing deleted.", deleted: result.deleted });
  } catch (error) {
    console.error("Admin delete sale error:", error.message);
    res.status(500).json({ error: "Failed to delete sale listing." });
  }
});

// Admin Promo Coupons CRUD
app.get("/api/admin/coupons", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const coupons = await listAdminCoupons();
    res.json({ coupons });
  } catch (error) {
    console.error("Admin list coupons error:", error.message);
    res.status(500).json({ error: "Failed to load coupons." });
  }
});

app.post(
  "/api/admin/coupons",
  authMiddleware,
  adminMiddleware,
  adminCouponValidation,
  validate,
  async (req, res) => {
    try {
      const result = await createAdminCoupon(req.body);
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.status(201).json({ message: "Coupon created.", coupon: result.coupon });
    } catch (error) {
      console.error("Admin create coupon error:", error.message);
      res.status(500).json({ error: "Failed to create coupon." });
    }
  }
);

app.put(
  "/api/admin/coupons/:id",
  authMiddleware,
  adminMiddleware,
  adminCouponValidation,
  validate,
  async (req, res) => {
    try {
      const result = await updateAdminCoupon(req.params.id, req.body);
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.json({ message: "Coupon updated.", coupon: result.coupon });
    } catch (error) {
      console.error("Admin update coupon error:", error.message);
      res.status(500).json({ error: "Failed to update coupon." });
    }
  }
);

app.delete("/api/admin/coupons/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await deleteAdminCoupon(req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    res.json({ message: "Coupon deleted.", deleted: result.deleted });
  } catch (error) {
    console.error("Admin delete coupon error:", error.message);
    res.status(500).json({ error: "Failed to delete coupon." });
  }
});

// Admin Orders Fulfillment & Tracking Number Management
app.get("/api/admin/orders", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const orders = await listAdminOrders({
      status: typeof req.query.status === "string" ? req.query.status : "",
      q: typeof req.query.q === "string" ? req.query.q : "",
      limit: req.query.limit,
    });
    res.json({ orders });
  } catch (error) {
    console.error("Admin list orders error:", error.message);
    res.status(500).json({ error: "Failed to load orders." });
  }
});

app.patch(
  "/api/admin/orders/:id",
  authMiddleware,
  adminMiddleware,
  adminOrderUpdateValidation,
  validate,
  async (req, res) => {
    try {
      const result = await updateAdminOrder(req.params.id, req.body);
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.json({
        message: "Order updated.",
        order: result.order,
        stock_restored: result.stock_restored,
      });
    } catch (error) {
      console.error("Admin update order error:", error.message);
      res.status(500).json({ error: "Failed to update order." });
    }
  }
);

// Admin Users & RBAC Role Management
app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await listAdminUsers();
    res.json(result);
  } catch (error) {
    console.error("Admin list users error:", error.message);
    res.status(500).json({ error: "Failed to load users." });
  }
});

app.patch(
  "/api/admin/users/:id/role",
  authMiddleware,
  adminMiddleware,
  adminUserRoleValidation,
  validate,
  async (req, res) => {
    try {
      const result = await updateAdminUserRole({
        targetUserId: req.params.id,
        nextRole: req.body.role,
        actorUserId: req.userId,
      });
      if (!result.ok) {
        return res.status(result.status || 400).json({ error: result.error });
      }
      res.json({ message: "User role updated.", user: result.user });
    } catch (error) {
      console.error("Admin update user role error:", error.message);
      res.status(500).json({ error: "Failed to update user role." });
    }
  }
);

// === GLOBAL ERROR HANDLER (CORS & UNHANDLED ERRORS) ===
app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS policy: Origin not allowed." });
  }
  console.error("Unhandled server error:", err?.message || err);
  return res.status(500).json({ message: "Internal server error" });
});

export default app;

if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server TrueKicks berjalan di http://localhost:${PORT}`);
  });
}

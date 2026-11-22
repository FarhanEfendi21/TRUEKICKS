import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import supabase from "./config/supabase.js";
import bcrypt from "bcryptjs";

// Security Middleware
import { generateToken, authMiddleware } from "./middleware/auth.js";
import {
  registerValidation,
  loginValidation,
  orderValidation,
  updateProfileValidation,
  reviewValidation,
  validate,
} from "./middleware/validation.js";
import { authLimiter, apiLimiter } from "./middleware/rateLimit.js";

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

// === SERVER-SIDE HELPERS (PRICE & COUPON VERIFICATION) ===
const getAuthoritativePrice = (table, product) => {
  if (table === "sale_products" && product.discount_price != null) {
    return Number(product.discount_price);
  }
  return Number(product.price);
};

const resolveProductFromDB = async (item) => {
  const productId = Number(item.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return { error: `Invalid product ID: ${item.id}` };
  }

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

    const unitPrice = getAuthoritativePrice(requestedType, data);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: `Invalid product pricing for product #${productId}.` };
    }

    return {
      product: {
        id: data.id,
        productType: requestedType,
        name: data.name,
        price: unitPrice,
        image: data.image_url,
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
      const unitPrice = getAuthoritativePrice(table, data);
      return {
        product: {
          id: data.id,
          productType: table,
          name: data.name,
          price: unitPrice,
          image: data.image_url,
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
    res.json(data);
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
    res.json(data);
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
    res.json(data);
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

    // Remove password from response for security
    const userResponse = { ...data[0] };
    delete userResponse.password;

    res.status(201).json({ message: "Registration successful!", user: userResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === 6. ROUTE LOGIN (Masuk) ===
app.post("/api/login", authLimiter, loginValidation, validate, async (req, res) => {
  const { email, password } = req.body;

  // Normalize email (already validated by middleware)
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Remove password from response for security
    const userResponse = { ...user };
    delete userResponse.password;

    // Set token as an HttpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // 'none' is REQUIRED for cross-origin Vercel deployments
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
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  res.json({ message: "Logout successful!" });
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

    // Remove password hash from response
    const userResponse = { ...data[0] };
    delete userResponse.password;

    res.json({ message: "Profile updated successfully!", user: userResponse });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// === 7. ROUTE DETAIL PRODUK (DINAMIS) ===
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

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const verifiedItems = [];
    let subtotal = 0;

    for (const rawItem of items) {
      const quantity = Number(rawItem.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ error: "Invalid item quantity." });
      }

      const resolved = await resolveProductFromDB(rawItem);
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

    const orderPayload = {
      user_id: authenticatedUserId,
      full_name: full_name.trim(),
      address: address.trim(),
      city: (city || "").trim(),
      postal_code: (postal_code || "").trim(),
      phone: phone.trim(),
      total_price: verifiedTotalPrice,
      items: verifiedItems,
      status: "Processing",
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Order berhasil dibuat!",
      order: data,
      pricing: {
        subtotal,
        discount_amount: discountAmount,
        total_price: verifiedTotalPrice,
      },
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

    res.json(data || []);
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

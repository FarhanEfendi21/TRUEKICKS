import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import supabase from "./config/supabase.js";
import bcrypt from "bcryptjs";

// Security Middleware
import { generateToken, authMiddleware } from "./middleware/auth.js";
import { registerValidation, loginValidation, validate } from "./middleware/validation.js";
import { authLimiter, apiLimiter } from "./middleware/rateLimit.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// === SECURITY MIDDLEWARE ===
app.use(helmet()); // Security headers
app.use(cors({ origin: true, credentials: true })); // CORS with credentials allowed
app.use(express.json({ limit: '10mb' })); // Body parser with size limit
app.use(cookieParser()); // Parse Cookie header
app.use('/api', apiLimiter); // General rate limiting for all API routes
app.use('/api', apiLimiter); // General rate limiting for all API routes

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

// === 6b. ROUTE UPDATE USER PROFILE (Protected) ===
app.put("/api/users/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { full_name } = req.body;

  try {
    const parsed_user_id = parseInt(id);

    if (isNaN(parsed_user_id)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    if (!full_name || full_name.trim() === "") {
      return res.status(400).json({ error: "Name is required." });
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

    res.json({ message: "Profile updated successfully!", user: data[0] });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// === 7. ROUTE DETAIL PRODUK (DINAMIS) ===
app.get("/api/detail/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  const allowedTables = ["products", "sneakers", "apparel", "sale_products"];
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ message: "Akses tabel ditolak." }); // <--- Ini penyebab Error 400 Anda
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

// === 8. ROUTE ORDER / CHECKOUT (Protected) ===
app.post("/api/orders", authMiddleware, async (req, res) => {
  const { user_id, full_name, address, city, postal_code, phone, total_price, items } = req.body;

  try {
    const parsed_user_id = parseInt(user_id);
    const parsed_total_price = parseFloat(total_price);

    if (
      isNaN(parsed_user_id) ||
      !full_name ||
      !address ||
      !items ||
      items.length === 0
    ) {
      return res.status(400).json({ error: "Missing required order data." });
    }

    const orderPayload = {
      user_id: parsed_user_id,
      full_name: full_name,
      address: address,
      city: city || "",
      postal_code: postal_code || "",
      phone: phone,
      total_price: parsed_total_price,
      items: items,
      status: "Processing",
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select();

    if (error) throw error;

    res.status(201).json({ message: "Order berhasil dibuat!", order: data });
  } catch (error) {
    console.error("Error Detail:", error.message);
    res.status(500).json({ error: "DB Insert Failed: " + error.message });
  }
});

// === 8b. ROUTE GET USER ORDERS (Protected) ===
app.get("/api/orders/user/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;

  try {
    const parsed_user_id = parseInt(userId);

    if (isNaN(parsed_user_id)) {
      return res.status(400).json({ error: "Invalid user ID." });
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

app.post("/api/reviews", async (req, res) => {
  const { user_id, product_id, product_type, rating, comment } = req.body;
  try {
    const { data, error } = await supabase
      .from("reviews")
      .insert([{ user_id, product_id, product_type, rating, comment }])
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
  const cleanCode = code ? code.trim().toUpperCase() : "";

  console.log("--- DEBUG START ---");
  console.log(`Received code (raw): '${code}'`);
  console.log(`Cleaned code: '${cleanCode}'`);
  console.log(`Total Amount: ${totalAmount}`);

  try {
    // DEBUG: Cek apakah server bisa melihat APAPUN di tabel coupons
    const { data: allCoupons, error: listError } = await supabase.from("coupons").select("*");
    console.log("Visible Coupons in DB:", allCoupons);

    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .ilike("code", cleanCode) // Case-insensitive match
      .single();

    if (error) {
      console.error("Single Fetch Error:", error);
    }

    if (error || !coupon) {
      console.log("❌ Coupon not found via query.");
      return res.status(404).json({ message: "Invalid coupon code" });
    }

    console.log("✅ Coupon found:", coupon);

    // Cek Expiry
    if (new Date(coupon.expiry_date) < new Date()) {
      return res.status(400).json({ message: "Coupon has expired" });
    }

    // Cek Min Purchase
    if (totalAmount < coupon.min_purchase) {
      return res.status(400).json({
        message: `Minimum purchase for this coupon is Rp ${(
          coupon.min_purchase / 1000
        ).toLocaleString()}K`,
      });
    }

    res.json({
      message: "Coupon applied!",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      code: coupon.code,
    });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    console.log("--- DEBUG END ---");
  }
});

export default app;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server TrueKicks berjalan di http://localhost:${PORT}`);
  });
}

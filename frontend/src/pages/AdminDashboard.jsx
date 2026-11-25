import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api, { clearSessionClientState, setSessionUser } from "../lib/api";
import { formatRupiah, getOrderStatusBadge } from "../lib/pricing";
import { translateOrderStatus } from "../lib/translations";
import { useLanguage } from "../Context/LanguageContext";
import { useTheme } from "../Context/ThemeContext";
import RevenueChart from "../components/admin/RevenueChart";
import {
  ProductFormModal,
  VariantStockModal,
  DetailGalleryModal,
  SaleFormModal,
  CouponFormModal,
  OrderFulfillmentModal,
} from "../components/admin/AdminModals";

const NAV_TABS = [
  { id: "overview", idLabel: "Ringkasan", enLabel: "Overview" },
  { id: "orders", idLabel: "Pesanan", enLabel: "Orders" },
  { id: "products", idLabel: "Produk & Stok", enLabel: "Catalog & Stock" },
  { id: "promotions", idLabel: "Promo & Kupon", enLabel: "Promos & Coupons" },
  { id: "users", idLabel: "Pengguna & RBAC", enLabel: "Users & Roles" },
];

const ORDER_FILTERS = [
  { key: "all", idLabel: "Semua", enLabel: "All" },
  { key: "Pending Payment", idLabel: "Menunggu Bayar", enLabel: "Pending Payment" },
  { key: "Processing", idLabel: "Diproses", enLabel: "Processing" },
  { key: "Shipped", idLabel: "Dikirim", enLabel: "Shipped" },
  { key: "Delivered", idLabel: "Terkirim", enLabel: "Delivered" },
  { key: "Cancelled", idLabel: "Dibatalkan", enLabel: "Cancelled" },
];

function TabIcon({ id, className = "w-4 h-4" }) {
  switch (id) {
    case "overview":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      );
    case "orders":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      );
    case "products":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      );
    case "promotions":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      );
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { language, setLanguage, locale, pick } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  // RBAC Guard state
  const [authState, setAuthState] = useState("checking"); // checking | authorized | forbidden
  const [currentUser, setCurrentUser] = useState(null);

  // Navigation & filter state
  const [activeTab, setActiveTab] = useState("overview");
  const [promoSubTab, setPromoSubTab] = useState("sales");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");

  // Data state
  const [loadingData, setLoadingData] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleColumnAvailable, setRoleColumnAvailable] = useState(true);

  // Modals state
  const [productModal, setProductModal] = useState({ open: false, item: null });
  const [stockModal, setStockModal] = useState({ open: false, item: null });
  const [galleryModal, setGalleryModal] = useState({ open: false, item: null });
  const [saleModal, setSaleModal] = useState({ open: false, item: null });
  const [couponModal, setCouponModal] = useState({ open: false, item: null });
  const [orderModal, setOrderModal] = useState({ open: false, item: null });
  const [deletingKey, setDeletingKey] = useState(null);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

  // 1. Verify live RBAC session from server on mount
  useEffect(() => {
    let active = true;
    const verifyAdminSession = async () => {
      try {
        const res = await api.get("/api/auth/me", { skipAuthRedirect: true });
        if (!active) return;
        const freshUser = res.data?.user;
        if (!freshUser) {
          clearSessionClientState();
          navigate("/login", { replace: true, state: { from: "/admin" } });
          return;
        }
        const syncedUser = setSessionUser(freshUser) || freshUser;
        setCurrentUser(syncedUser);

        if (syncedUser.role === "admin") {
          setAuthState("authorized");
        } else {
          setAuthState("forbidden");
        }
      } catch (err) {
        if (!active) return;
        if (err.response?.status === 401) {
          clearSessionClientState();
          navigate("/login", { replace: true, state: { from: "/admin" } });
        } else {
          setAuthState("forbidden");
        }
      }
    };
    verifyAdminSession();
    return () => {
      active = false;
    };
  }, [navigate]);

  // 2. Load all admin datasets cleanly
  const loadDashboardData = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoadingData(true);
      try {
        const [analyticsRes, productsRes, salesRes, couponsRes, ordersRes, usersRes] =
          await Promise.all([
            api.get("/api/admin/analytics"),
            api.get("/api/admin/products"),
            api.get("/api/admin/sales"),
            api.get("/api/admin/coupons"),
            api.get("/api/admin/orders"),
            api.get("/api/admin/users"),
          ]);

        setAnalytics(analyticsRes.data || null);
        setProducts(productsRes.data?.products || []);
        setSales(salesRes.data?.sales || []);
        setCoupons(couponsRes.data?.coupons || []);
        setOrders(ordersRes.data?.orders || []);
        setUsers(usersRes.data?.users || []);
        setRoleColumnAvailable(usersRes.data?.role_column_available !== false);
      } catch (err) {
        if (err.response?.status === 403) {
          setAuthState("forbidden");
        } else {
          toast.error(
            err.response?.data?.error ||
              pick("Gagal memuat data admin.", "Failed to load admin data.")
          );
        }
      } finally {
        if (!silent) setLoadingData(false);
      }
    },
    [pick]
  );

  useEffect(() => {
    if (authState === "authorized") {
      loadDashboardData();
    }
  }, [authState, loadDashboardData]);

  // Filtered views
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (productTypeFilter !== "all" && p.product_type !== productTypeFilter) return false;
      if (!q) return true;
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q) ||
        String(p.categories || "").toLowerCase().includes(q) ||
        String(p.id).includes(q)
      );
    });
  }, [products, productTypeFilter, productSearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (
        orderStatusFilter !== "all" &&
        String(o.status || "").toLowerCase() !== orderStatusFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(o.id || "").toLowerCase().includes(q) ||
        String(o.full_name || "").toLowerCase().includes(q) ||
        String(o.tracking_number || "").toLowerCase().includes(q) ||
        String(o.courier || "").toLowerCase().includes(q)
      );
    });
  }, [orders, orderStatusFilter, orderSearch]);

  // Delete & role toggle handlers
  const handleDeleteProduct = async (item) => {
    const key = `product:${item.product_type}:${item.id}`;
    if (deletingKey !== key) {
      setDeletingKey(key);
      return;
    }
    try {
      await api.delete(`/api/admin/products/${item.product_type}/${item.id}`);
      toast.success(pick("Produk dihapus.", "Product deleted."));
      setDeletingKey(null);
      loadDashboardData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || pick("Gagal menghapus produk.", "Failed to delete product."));
    }
  };

  const handleDeleteSale = async (sale) => {
    const key = `sale:${sale.id}`;
    if (deletingKey !== key) {
      setDeletingKey(key);
      return;
    }
    try {
      await api.delete(`/api/admin/sales/${sale.id}`);
      toast.success(pick("Promo dihapus.", "Sale removed."));
      setDeletingKey(null);
      loadDashboardData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || pick("Gagal menghapus promo.", "Failed to remove sale."));
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    const key = `coupon:${coupon.id}`;
    if (deletingKey !== key) {
      setDeletingKey(key);
      return;
    }
    try {
      await api.delete(`/api/admin/coupons/${coupon.id}`);
      toast.success(pick("Kupon dihapus.", "Coupon deleted."));
      setDeletingKey(null);
      loadDashboardData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || pick("Gagal menghapus kupon.", "Failed to delete coupon."));
    }
  };

  const handleToggleUserRole = async (u) => {
    const nextRole = u.role === "admin" ? "customer" : "admin";
    setUpdatingRoleId(u.id);
    try {
      await api.patch(`/api/admin/users/${u.id}/role`, { role: nextRole });
      toast.success(
        nextRole === "admin"
          ? pick(`${u.full_name} dipromosikan menjadi Admin.`, `${u.full_name} promoted to Admin.`)
          : pick(`Akses Admin ${u.full_name} dicabut.`, `Admin role revoked for ${u.full_name}.`)
      );
      loadDashboardData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || pick("Gagal mengubah peran.", "Failed to update role."));
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const formatShortDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  };

  // ============================================================
  // GUARD STATES (CHECKING / 403 FORBIDDEN)
  // ============================================================
  if (authState === "checking") {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex items-center justify-center font-poppins">
        <div className="text-center space-y-3">
          <div className="w-7 h-7 border-2 border-gray-200 dark:border-gray-800 border-t-gray-950 dark:border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {pick("Memverifikasi akses admin...", "Verifying admin permissions...")}
          </p>
        </div>
      </div>
    );
  }

  if (authState === "forbidden") {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex items-center justify-center px-4 font-poppins">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF5500]">
            403 · RBAC
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white mt-2">
            {pick("Akses Admin Diperlukan", "Admin Access Required")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            {pick(
              "Halaman konsol pengelola toko hanya dapat diakses oleh akun dengan peran Admin.",
              "The store operations console is restricted to accounts with the Admin role."
            )}
          </p>
          {currentUser?.email && (
            <div className="mt-5 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200/80 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
              {pick("Masuk sebagai", "Signed in as")}{" "}
              <span className="font-semibold text-gray-950 dark:text-white">
                {currentUser.email}
              </span>{" "}
              ({currentUser.role || "customer"})
            </div>
          )}
          <div className="mt-6 flex items-center justify-center gap-2.5">
            <Link
              to="/home"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 transition-opacity"
            >
              {pick("Kembali ke Toko", "Back to Storefront")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const summary = analytics?.summary || {};

  // ============================================================
  // AUTHORIZED ADMIN CONSOLE
  // ============================================================
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-poppins flex flex-col lg:flex-row">
      {/* LEFT RAIL SIDEBAR (Desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white dark:bg-gray-950 border-r border-gray-200/80 dark:border-gray-800/90 z-30">
        {/* Brand */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-900">
          <Link to="/home" className="flex items-center gap-2">
            <span className="text-lg font-black italic tracking-tighter text-gray-950 dark:text-white">
              TRUE<span className="text-[#FF5500]">KICKS</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
              Admin
            </span>
          </Link>
        </div>

        {/* Section Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setDeletingKey(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  active
                    ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-950 dark:hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <TabIcon id={tab.id} />
                  <span>{pick(tab.idLabel, tab.enLabel)}</span>
                </span>
                {tab.id === "orders" && (summary.pending_orders || 0) > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                      active
                        ? "bg-white/20 dark:bg-black/15"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {summary.pending_orders}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Identity + Exit */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-900 space-y-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-950 dark:text-white truncate">
              {currentUser?.full_name}
            </p>
            <p className="text-[11px] text-gray-400 truncate">{currentUser?.email}</p>
          </div>
          <Link
            to="/home"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            {pick("Ke Storefront", "Storefront")}
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="flex-1 lg:pl-60 min-w-0 flex flex-col">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-20 bg-[#FAFAFA]/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/90">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/home"
                className="lg:hidden text-base font-black italic tracking-tighter text-gray-950 dark:text-white flex-shrink-0"
              >
                TRUE<span className="text-[#FF5500]">KICKS</span>
              </Link>
              <div className="hidden lg:block min-w-0">
                <h1 className="text-sm font-bold text-gray-950 dark:text-white tracking-tight truncate">
                  {pick(
                    NAV_TABS.find((t) => t.id === activeTab)?.idLabel || "",
                    NAV_TABS.find((t) => t.id === activeTab)?.enLabel || ""
                  )}
                </h1>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadDashboardData()}
                disabled={loadingData}
                title={pick("Muat ulang data", "Refresh data")}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                {loadingData ? pick("Memuat...", "Syncing...") : pick("Segarkan", "Refresh")}
              </button>

              {/* ID | EN Switcher */}
              <div className="flex items-center rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-0.5">
                {["id", "en"].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${
                      language === lang
                        ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950"
                        : "text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? "Light mode" : "Dark mode"}
                className="p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-amber-400 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                {isDark ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Horizontal Tab Rail */}
          <div className="lg:hidden overflow-x-auto border-t border-gray-100 dark:border-gray-900">
            <div className="flex items-center gap-1 px-4 py-2 min-w-max">
              {NAV_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setDeletingKey(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {pick(tab.idLabel, tab.enLabel)}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* WORKSPACE CANVAS */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* ==================================================
              TAB 1: OVERVIEW (ANALYTICS & REVENUE)
             ================================================== */}
          {activeTab === "overview" && (
            <>
              {/* 4 KPI Strip */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    {pick("Omzet Terkonfirmasi", "Confirmed Revenue")}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-950 dark:text-white mt-2 tabular-nums tracking-tight">
                    {formatRupiah(summary.total_revenue || 0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                    {summary.paid_orders || 0} {pick("pesanan lunas", "paid orders")}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    {pick("Total Pesanan", "Total Orders")}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-950 dark:text-white mt-2 tabular-nums tracking-tight">
                    {summary.total_orders || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                    {summary.pending_orders || 0} {pick("menunggu", "pending")} · {summary.cancelled_orders || 0}{" "}
                    {pick("batal", "cancelled")}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    {pick("Rata-Rata Order", "Avg. Order Value")}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-950 dark:text-white mt-2 tabular-nums tracking-tight">
                    {formatRupiah(summary.avg_order_value || 0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                    {summary.total_customers || 0} {pick("akun terdaftar", "registered users")}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 sm:p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    {pick("Katalog & Stok", "Catalog & Stock")}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-950 dark:text-white mt-2 tabular-nums tracking-tight">
                    {summary.total_products || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                    {(summary.low_stock_variants || 0) + (summary.out_of_stock_variants || 0)}{" "}
                    {pick("ukuran menipis/habis", "low/out sizes")}
                  </p>
                </div>
              </section>

              {/* Revenue Chart */}
              <RevenueChart
                daily={analytics?.daily_revenue || []}
                monthly={analytics?.monthly_revenue || []}
                pick={pick}
              />

              {/* Bottom 2-Col Insights */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {/* Low Stock Alerts */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                      {pick("Peringatan Stok Ukuran", "Low Stock Variants")}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("products")}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-950 dark:hover:text-white transition-colors"
                    >
                      {pick("Kelola", "Manage")}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
                    {(analytics?.low_stock_alerts || []).length === 0 ? (
                      <p className="px-5 py-8 text-xs text-center text-gray-400">
                        {pick("Seluruh ukuran stok masih aman.", "All tracked size variants are healthy.")}
                      </p>
                    ) : (
                      analytics.low_stock_alerts.slice(0, 6).map((alert) => (
                        <div
                          key={`${alert.product_type}-${alert.product_id}-${alert.size}`}
                          className="px-5 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-950 dark:text-white truncate">
                              {alert.product_name}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {alert.product_type} · {pick("Ukuran", "Size")} {alert.size}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span
                              className={`text-xs font-bold tabular-nums ${
                                alert.stock === 0 ? "text-red-500" : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {alert.stock === 0
                                ? pick("Habis", "Out")
                                : `${pick("Sisa", "Left")} ${alert.stock}`}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setStockModal({
                                  open: true,
                                  item: {
                                    id: alert.product_id,
                                    product_type: alert.product_type,
                                    name: alert.product_name,
                                  },
                                })
                              }
                              className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              {pick("Restock", "Restock")}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                      {pick("Pesanan Terbaru", "Recent Orders")}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("orders")}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-950 dark:hover:text-white transition-colors"
                    >
                      {pick("Lihat semua", "View all")}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
                    {(analytics?.recent_orders || []).length === 0 ? (
                      <p className="px-5 py-8 text-xs text-center text-gray-400">
                        {pick("Belum ada pesanan masuk.", "No orders yet.")}
                      </p>
                    ) : (
                      analytics.recent_orders.map((ord) => (
                        <button
                          key={ord.id}
                          type="button"
                          onClick={() => setOrderModal({ open: true, item: ord })}
                          className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-950 dark:text-white truncate">
                              {ord.full_name}
                              <span className="ml-2 font-mono text-[11px] text-gray-400">
                                #{String(ord.id).slice(0, 8).toUpperCase()}
                              </span>
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                              {formatShortDate(ord.created_at)} · {(ord.items || []).length}{" "}
                              {pick("item", "items")}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-bold text-gray-950 dark:text-white tabular-nums">
                              {formatRupiah(ord.total_price)}
                            </p>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getOrderStatusBadge(
                                ord.status
                              )}`}
                            >
                              {translateOrderStatus(ord.status, language)}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ==================================================
              TAB 2: ORDERS FULFILLMENT & TRACKING
             ================================================== */}
          {activeTab === "orders" && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {ORDER_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setOrderStatusFilter(f.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        orderStatusFilter === f.key
                          ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white"
                      }`}
                    >
                      {pick(f.idLabel, f.enLabel)}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder={pick("Cari ID, pembeli, atau resi...", "Search ID, customer, or AWB...")}
                  className="w-full sm:w-64 px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-gray-950 dark:focus:border-white"
                />
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                        <th className="py-3.5 px-5">{pick("Pesanan", "Order")}</th>
                        <th className="py-3.5 px-4">{pick("Pembeli", "Customer")}</th>
                        <th className="py-3.5 px-4">{pick("Kurir & Resi", "Courier & AWB")}</th>
                        <th className="py-3.5 px-4">{pick("Status", "Status")}</th>
                        <th className="py-3.5 px-4 text-right">{pick("Total", "Total")}</th>
                        <th className="py-3.5 px-5 text-right">{pick("Aksi", "Action")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-gray-400">
                            {pick("Tidak ada pesanan yang cocok.", "No matching orders found.")}
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((ord) => (
                          <tr
                            key={ord.id}
                            className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                          >
                            <td className="py-3.5 px-5 whitespace-nowrap">
                              <p className="font-mono font-semibold text-gray-950 dark:text-white">
                                #{String(ord.id).slice(0, 8).toUpperCase()}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                                {formatShortDate(ord.created_at)}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 max-w-[200px]">
                              <p className="font-semibold text-gray-950 dark:text-white truncate">
                                {ord.full_name}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {ord.city || "—"} · {(ord.items || []).length} {pick("item", "items")}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <p className="font-medium text-gray-800 dark:text-gray-200">
                                {ord.courier || "TrueKicks Express"}
                              </p>
                              <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                                {ord.tracking_number || "—"}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getOrderStatusBadge(
                                  ord.status
                                )}`}
                              >
                                {translateOrderStatus(ord.status, language)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-gray-950 dark:text-white tabular-nums whitespace-nowrap">
                              {formatRupiah(ord.total_price)}
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setOrderModal({ open: true, item: ord })}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                {pick("Kelola", "Manage")}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ==================================================
              TAB 3: PRODUCTS & VARIANT INVENTORY
             ================================================== */}
          {activeTab === "products" && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {[
                    { key: "all", label: pick("Semua", "All") },
                    { key: "sneakers", label: "Sneakers" },
                    { key: "apparel", label: "Apparel" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setProductTypeFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        productTypeFilter === tab.key
                          ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950"
                          : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={pick("Cari produk...", "Search products...")}
                    className="flex-1 sm:w-56 px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-gray-950 dark:focus:border-white"
                  />
                  <button
                    type="button"
                    onClick={() => setProductModal({ open: true, item: null })}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    + {pick("Produk", "Product")}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                        <th className="py-3.5 px-5">{pick("Produk", "Product")}</th>
                        <th className="py-3.5 px-4">{pick("Tipe", "Type")}</th>
                        <th className="py-3.5 px-4 text-right">{pick("Harga", "Price")}</th>
                        <th className="py-3.5 px-4 text-right">{pick("Stok", "Stock")}</th>
                        <th className="py-3.5 px-5 text-right">{pick("Aksi", "Actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-gray-400">
                            {pick("Tidak ada produk ditemukan.", "No products found.")}
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((item) => {
                          const delKey = `product:${item.product_type}:${item.id}`;
                          return (
                            <tr
                              key={`${item.product_type}-${item.id}`}
                              className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                            >
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-3 min-w-[220px]">
                                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-200 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="w-full h-full object-contain mix-blend-multiply"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-gray-950 dark:text-white truncate max-w-[260px]">
                                      {item.name}
                                    </p>
                                    <p className="text-[11px] text-gray-400 truncate">
                                      {item.category}
                                      {item.categories ? ` · ${item.categories}` : ""}
                                      {item.product_type === "sneakers" && (
                                        <span className="ml-1.5 text-gray-500 dark:text-gray-400 tabular-nums">
                                          ·{" "}
                                          {item.detail_image_count > 0
                                            ? pick(
                                                `${item.detail_image_count} foto detail`,
                                                `${item.detail_image_count} detail photos`
                                              )
                                            : pick("Belum ada foto detail", "No detail photos")}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300 capitalize">
                                  {item.product_type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                                {item.is_on_sale ? (
                                  <div>
                                    <p className="font-bold text-[#FF5500]">
                                      {formatRupiah(item.discount_price)}
                                    </p>
                                    <p className="text-[11px] text-gray-400 line-through">
                                      {formatRupiah(item.price)}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="font-semibold text-gray-950 dark:text-white">
                                    {formatRupiah(item.price)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                                {item.stock_tracked ? (
                                  <div>
                                    <span className="font-semibold text-gray-950 dark:text-white">
                                      {item.total_stock}
                                    </span>
                                    {(item.sold_out_sizes > 0 || item.low_stock_sizes > 0) && (
                                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                        {item.sold_out_sizes > 0
                                          ? `${item.sold_out_sizes} ${pick("habis", "out")}`
                                          : `${item.low_stock_sizes} ${pick("tipis", "low")}`}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  {item.product_type === "sneakers" && (
                                    <button
                                      type="button"
                                      onClick={() => setGalleryModal({ open: true, item })}
                                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                      {pick("Foto", "Photos")}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setStockModal({ open: true, item })}
                                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                  >
                                    {pick("Stok", "Stock")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setProductModal({ open: true, item })}
                                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                  >
                                    {pick("Edit", "Edit")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(item)}
                                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                                      deletingKey === delKey
                                        ? "bg-red-600 text-white"
                                        : "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                    }`}
                                  >
                                    {deletingKey === delKey
                                      ? pick("Yakin?", "Confirm?")
                                      : pick("Hapus", "Delete")}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ==================================================
              TAB 4: PROMOTIONS (SALE LISTINGS & COUPONS)
             ================================================== */}
          {activeTab === "promotions" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPromoSubTab("sales");
                      setDeletingKey(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      promoSubTab === "sales"
                        ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950"
                        : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {pick("Daftar Diskon", "Sale Listings")} ({sales.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPromoSubTab("coupons");
                      setDeletingKey(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      promoSubTab === "coupons"
                        ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950"
                        : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {pick("Kupon Promo", "Promo Coupons")} ({coupons.length})
                  </button>
                </div>

                {promoSubTab === "sales" ? (
                  <button
                    type="button"
                    onClick={() => setSaleModal({ open: true, item: null })}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 transition-opacity"
                  >
                    + {pick("Promo", "Sale")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCouponModal({ open: true, item: null })}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:opacity-90 transition-opacity"
                  >
                    + {pick("Kupon", "Coupon")}
                  </button>
                )}
              </div>

              {promoSubTab === "sales" ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                          <th className="py-3.5 px-5">{pick("Produk", "Product")}</th>
                          <th className="py-3.5 px-4 text-right">{pick("Harga Normal", "Regular")}</th>
                          <th className="py-3.5 px-4 text-right">{pick("Harga Diskon", "Sale Price")}</th>
                          <th className="py-3.5 px-4 text-right">{pick("Potongan", "Discount")}</th>
                          <th className="py-3.5 px-5 text-right">{pick("Aksi", "Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
                        {sales.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-400">
                              {pick("Belum ada produk promo aktif.", "No active sale listings.")}
                            </td>
                          </tr>
                        ) : (
                          sales.map((sale) => {
                            const delKey = `sale:${sale.id}`;
                            return (
                              <tr key={sale.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                                <td className="py-3 px-5">
                                  <div className="flex items-center gap-3 min-w-[200px]">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-200 p-1 flex-shrink-0">
                                      <img
                                        src={sale.image_url}
                                        alt={sale.name}
                                        className="w-full h-full object-contain mix-blend-multiply"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-gray-950 dark:text-white truncate max-w-[240px]">
                                        {sale.name}
                                      </p>
                                      <p className="text-[11px] text-gray-400">
                                        {sale.brand || sale.category}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right text-gray-400 line-through tabular-nums whitespace-nowrap">
                                  {formatRupiah(sale.price)}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-gray-950 dark:text-white tabular-nums whitespace-nowrap">
                                  {formatRupiah(sale.discount_price)}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <span className="font-bold text-[#FF5500] tabular-nums">
                                    -{sale.discount_percentage}%
                                  </span>
                                </td>
                                <td className="py-3 px-5 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSaleModal({ open: true, item: sale })}
                                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                      {pick("Edit", "Edit")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSale(sale)}
                                      className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                                        deletingKey === delKey
                                          ? "bg-red-600 text-white"
                                          : "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                      }`}
                                    >
                                      {deletingKey === delKey
                                        ? pick("Yakin?", "Confirm?")
                                        : pick("Hapus", "Delete")}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                          <th className="py-3.5 px-5">{pick("Kode", "Code")}</th>
                          <th className="py-3.5 px-4">{pick("Potongan", "Discount")}</th>
                          <th className="py-3.5 px-4 text-right">{pick("Min. Belanja", "Min. Purchase")}</th>
                          <th className="py-3.5 px-4">{pick("Berlaku Hingga", "Expires")}</th>
                          <th className="py-3.5 px-5 text-right">{pick("Aksi", "Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
                        {coupons.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-400">
                              {pick("Belum ada kupon promo.", "No coupons configured.")}
                            </td>
                          </tr>
                        ) : (
                          coupons.map((c) => {
                            const delKey = `coupon:${c.id}`;
                            return (
                              <tr key={c.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                                <td className="py-3.5 px-5 whitespace-nowrap">
                                  <span className="font-mono font-bold text-gray-950 dark:text-white tracking-wider">
                                    {c.code}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap">
                                  {c.discount_type === "percent"
                                    ? `${c.discount_value}%`
                                    : formatRupiah(c.discount_value)}
                                </td>
                                <td className="py-3.5 px-4 text-right text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
                                  {Number(c.min_purchase) > 0
                                    ? formatRupiah(c.min_purchase)
                                    : pick("Tanpa batas", "No minimum")}
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span
                                    className={`text-xs font-medium tabular-nums ${
                                      c.is_expired ? "text-red-500" : "text-gray-600 dark:text-gray-300"
                                    }`}
                                  >
                                    {c.expiry_date
                                      ? formatShortDate(c.expiry_date)
                                      : pick("Selamanya", "No expiry")}
                                    {c.is_expired && ` (${pick("Kedaluwarsa", "Expired")})`}
                                  </span>
                                </td>
                                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setCouponModal({ open: true, item: c })}
                                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                      {pick("Edit", "Edit")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCoupon(c)}
                                      className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                                        deletingKey === delKey
                                          ? "bg-red-600 text-white"
                                          : "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                      }`}
                                    >
                                      {deletingKey === delKey
                                        ? pick("Yakin?", "Confirm?")
                                        : pick("Hapus", "Delete")}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ==================================================
              TAB 5: USERS & RBAC PERMISSIONS
             ================================================== */}
          {activeTab === "users" && (
            <section className="space-y-4">
              {!roleColumnAvailable && (
                <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200">
                  {pick(
                    "Jalankan backend/migrations/tier1_admin_rbac.sql di Supabase SQL Editor untuk mengaktifkan perubahan peran langsung dari dashboard.",
                    "Run backend/migrations/tier1_admin_rbac.sql in Supabase SQL Editor to persist role changes directly from this dashboard."
                  )}
                </div>
              )}

              <div className="bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                        <th className="py-3.5 px-5">{pick("Pengguna", "User")}</th>
                        <th className="py-3.5 px-4">{pick("Peran", "Role")}</th>
                        <th className="py-3.5 px-4 text-right">{pick("Pesanan", "Orders")}</th>
                        <th className="py-3.5 px-4 text-right">{pick("Total Belanja", "Lifetime Spend")}</th>
                        <th className="py-3.5 px-5 text-right">{pick("Akses", "Access")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
                      {users.map((u) => {
                        const isSelf = Number(u.id) === Number(currentUser?.id);
                        return (
                          <tr key={u.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                            <td className="py-3.5 px-5">
                              <p className="font-semibold text-gray-950 dark:text-white">
                                {u.full_name}
                                {isSelf && (
                                  <span className="ml-1.5 text-[10px] text-gray-400 font-normal">
                                    ({pick("Anda", "You")})
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-gray-400">{u.email}</p>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  u.role === "admin"
                                    ? "bg-gray-950 dark:bg-white text-white dark:text-gray-950 border-gray-950 dark:border-white"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                                }`}
                              >
                                {u.role === "admin" ? "Admin" : pick("Pelanggan", "Customer")}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {u.order_count}
                            </td>
                            <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-gray-950 dark:text-white">
                              {formatRupiah(u.total_spent)}
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                disabled={isSelf || updatingRoleId === u.id}
                                onClick={() => handleToggleUserRole(u)}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {updatingRoleId === u.id
                                  ? "..."
                                  : u.role === "admin"
                                    ? pick("Cabut Admin", "Revoke Admin")
                                    : pick("Jadikan Admin", "Make Admin")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* PORTAL MODALS */}
      <ProductFormModal
        isOpen={productModal.open}
        onClose={() => setProductModal({ open: false, item: null })}
        initialProduct={productModal.item}
        onSaved={() => {
          toast.success(
            productModal.item
              ? pick("Produk diperbarui.", "Product updated.")
              : pick("Produk ditambahkan.", "Product created.")
          );
          loadDashboardData({ silent: true });
        }}
        pick={pick}
      />

      <VariantStockModal
        isOpen={stockModal.open}
        onClose={() => setStockModal({ open: false, item: null })}
        product={stockModal.item}
        onSaved={() => {
          toast.success(pick("Stok ukuran diperbarui.", "Size inventory updated."));
          loadDashboardData({ silent: true });
        }}
        pick={pick}
      />

      <DetailGalleryModal
        isOpen={galleryModal.open}
        onClose={() => setGalleryModal({ open: false, item: null })}
        product={galleryModal.item}
        onSaved={() => {
          toast.success(pick("Galeri foto detail diperbarui.", "Detail photo gallery updated."));
          loadDashboardData({ silent: true });
        }}
        pick={pick}
      />

      <SaleFormModal
        isOpen={saleModal.open}
        onClose={() => setSaleModal({ open: false, item: null })}
        initialSale={saleModal.item}
        catalogProducts={products}
        onSaved={() => {
          toast.success(
            saleModal.item
              ? pick("Promo diperbarui.", "Sale updated.")
              : pick("Promo ditambahkan.", "Sale created.")
          );
          loadDashboardData({ silent: true });
        }}
        pick={pick}
      />

      <CouponFormModal
        isOpen={couponModal.open}
        onClose={() => setCouponModal({ open: false, item: null })}
        initialCoupon={couponModal.item}
        onSaved={() => {
          toast.success(
            couponModal.item
              ? pick("Kupon diperbarui.", "Coupon updated.")
              : pick("Kupon dibuat.", "Coupon created.")
          );
          loadDashboardData({ silent: true });
        }}
        pick={pick}
      />

      <OrderFulfillmentModal
        isOpen={orderModal.open}
        onClose={() => setOrderModal({ open: false, item: null })}
        order={orderModal.item}
        onSaved={() => {
          toast.success(pick("Pesanan diperbarui.", "Order updated."));
          loadDashboardData({ silent: true });
        }}
        pick={pick}
      />
    </div>
  );
}

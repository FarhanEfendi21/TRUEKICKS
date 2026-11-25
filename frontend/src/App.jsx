import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactLenis } from "lenis/react";
import { CartProvider } from "./Context/CartContext.jsx";
import { WishlistProvider } from "./Context/WishlistContext.jsx";
import { ThemeProvider } from "./Context/ThemeContext.jsx";
import { LanguageProvider, useLanguage } from "./Context/LanguageContext.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import Layout from "./components/Layout.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import axios from "axios";
import { Toaster } from "react-hot-toast";
import api, {
  clearSessionClientState,
  getUser,
  purgeLegacyApiCache,
  setSessionUser,
} from "./lib/api";

const lazyWithRetry = (importer) =>
  lazy(async () => {
    const key = "truekicks_chunk_reloaded";
    try {
      const mod = await importer();
      sessionStorage.removeItem(key);
      return mod;
    } catch (error) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(key);
      throw error;
    }
  });

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const LENIS_OPTIONS = {
  lerp: prefersReducedMotion ? 1 : 0.1,
  smoothWheel: !prefersReducedMotion,
  anchors: true,
  autoRaf: true,
};

// === GLOBAL AXIOS CONFIG FOR HTTPONLY COOKIES ===
axios.defaults.withCredentials = true;

// === LAZY LOADING PAGES (Code Splitting with Stale-Chunk Recovery) ===
// Halaman berat di-load hanya saat dibutuhkan
const Splash = lazyWithRetry(() => import("./pages/Splash.jsx"));
const Login = lazyWithRetry(() => import("./pages/Login.jsx"));
const Home = lazyWithRetry(() => import("./pages/Home.jsx"));
const Profile = lazyWithRetry(() => import("./pages/Profile.jsx"));
const Sneakers = lazyWithRetry(() => import("./pages/Sneakers.jsx"));
const Apparel = lazyWithRetry(() => import("./pages/Apparel.jsx"));
const ProductDetail = lazyWithRetry(() => import("./pages/ProductDetail.jsx"));
const Sale = lazyWithRetry(() => import("./pages/Sale.jsx"));
const Cart = lazyWithRetry(() => import("./pages/Cart.jsx"));
const Wishlist = lazyWithRetry(() => import("./pages/Wishlist.jsx"));
const Checkout = lazyWithRetry(() => import("./pages/Checkout.jsx"));
const OrderHistory = lazyWithRetry(() => import("./pages/OrderHistory.jsx"));
const Search = lazyWithRetry(() => import("./pages/Search.jsx"));
const VerifyAuthenticity = lazyWithRetry(() => import("./pages/VerifyAuthenticity.jsx"));
const Drops = lazyWithRetry(() => import("./pages/Drops.jsx"));
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard.jsx"));

// === REACT QUERY CLIENT ===
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// === LOADING FALLBACK COMPONENT ===
function PageLoader() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-800 border-t-[#FF5500] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t("common.loading")}</p>
      </div>
    </div>
  );
}

function OfflineBanner() {
  const { t } = useLanguage();
  return (
    <div className="bg-red-500 text-white text-xs font-bold text-center py-1 fixed top-0 w-full z-[100]">
      {t("common.offlineBanner")}
    </div>
  );
}

function App() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // === 1. LOGIKA DETEKSI OFFLINE ===
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      console.log("Back Online!");
    };

    const handleOffline = () => {
      setIsOffline(true);
      console.log("Gone Offline - Switching to Guest Mode");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // === 2. PURGE LEGACY POISONED BACKUP_USER + AUTHORITATIVE SESSION RECONCILIATION ===
  // Ensures localStorage.user always matches the server HttpOnly JWT session on every refresh
  // and never silently switches back to a previous user via stale sessionStorage/SW cache.
  useEffect(() => {
    try {
      sessionStorage.removeItem("backup_user");
      localStorage.removeItem("profileImage");
    } catch {
      // Ignore storage errors
    }
    purgeLegacyApiCache();

    if (isOffline) return undefined;

    let active = true;
    const reconcileSession = async () => {
      const localUser = getUser();
      try {
        const res = await api.get("/api/auth/me", {
          skipAuthRedirect: true,
          headers: { "Cache-Control": "no-cache" },
        });
        if (!active) return;

        const serverUser = res.data?.user;
        if (!serverUser?.id) {
          if (localUser) {
            clearSessionClientState();
            queryClient.clear();
          }
          return;
        }

        const userChanged =
          !localUser ||
          Number(localUser.id) !== Number(serverUser.id) ||
          localUser.email !== serverUser.email ||
          localUser.role !== serverUser.role ||
          localUser.full_name !== serverUser.full_name;

        if (userChanged) {
          const identitySwitched =
            localUser && Number(localUser.id) !== Number(serverUser.id);
          setSessionUser(serverUser);
          if (identitySwitched) {
            queryClient.clear();
          }
        }
      } catch (err) {
        if (!active) return;
        // Only clear local session if server explicitly confirms 401 (no valid cookie)
        if (err.response?.status === 401 && localUser) {
          clearSessionClientState();
          queryClient.clear();
        }
      }
    };

    reconcileSession();
    return () => {
      active = false;
    };
  }, [isOffline]);

  return (
    <ReactLenis root options={LENIS_OPTIONS}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ThemeProvider>
            <CartProvider>
              <WishlistProvider>
                <BrowserRouter>
                  <ScrollToTop />
                  <Toaster
                    position="top-center"
                    reverseOrder={false}
                    toastOptions={{
                      duration: 3000,
                      style: {
                        borderRadius: "12px",
                        background: "#1F2937",
                        color: "#fff",
                        fontSize: "14px",
                      },
                    }}
                  />
                  {isOffline && <OfflineBanner />}

                  <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Splash />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/admin" element={<AdminDashboard />} />

                        {/* Layout membungkus semua halaman utama */}
                        <Route element={<Layout />}>
                          <Route path="/home" element={<Home />} />
                          <Route path="/catalog" element={<Navigate to="/sneakers" replace />} />
                          <Route path="/sneakers" element={<Sneakers />} />
                          <Route path="/apparel" element={<Apparel />} />
                          <Route path="/drops" element={<Drops />} />
                          <Route path="/sale" element={<Sale />} />
                          <Route path="/wishlist" element={<Wishlist />} />
                          <Route path="/product/:type/:id" element={<ProductDetail />} />
                          <Route path="/cart" element={<Cart />} />
                          <Route path="/checkout" element={<Checkout />} />
                          <Route path="/orders" element={<OrderHistory />} />
                          <Route path="/search" element={<Search />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/verify" element={<VerifyAuthenticity />} />
                          <Route path="/verify/:code" element={<VerifyAuthenticity />} />
                        </Route>

                        <Route path="*" element={<Navigate to="/home" replace />} />
                      </Routes>
                    </Suspense>
                  </ErrorBoundary>
                </BrowserRouter>
              </WishlistProvider>
            </CartProvider>
          </ThemeProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ReactLenis>
  );
}

export default App;
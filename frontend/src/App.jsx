import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartProvider } from "./Context/CartContext.jsx";
import { WishlistProvider } from "./Context/WishlistContext.jsx";
import { ThemeProvider } from "./Context/ThemeContext.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import Layout from "./components/Layout.jsx";

// === LAZY LOADING PAGES (Code Splitting) ===
// Halaman berat di-load hanya saat dibutuhkan
const Splash = lazy(() => import("./pages/Splash.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const Catalog = lazy(() => import("./pages/Catalog.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Sneakers = lazy(() => import("./pages/Sneakers.jsx"));
const Apparel = lazy(() => import("./pages/Apparel.jsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.jsx"));
const Sale = lazy(() => import("./pages/Sale.jsx"));
const Cart = lazy(() => import("./pages/Cart.jsx"));
const Wishlist = lazy(() => import("./pages/Wishlist.jsx"));
const Checkout = lazy(() => import("./pages/Checkout.jsx"));
const OrderHistory = lazy(() => import("./pages/OrderHistory.jsx"));
const Search = lazy(() => import("./pages/Search.jsx"));

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
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#FF5500] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm font-medium">Loading...</p>
      </div>
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

  // === 2. LOGIKA GUEST MODE OVERRIDE ===
  useEffect(() => {
    if (isOffline) {
      const realUser = localStorage.getItem('user');
      if (realUser) sessionStorage.setItem('backup_user', realUser);

      const guestData = JSON.stringify({ full_name: 'Guest', email: 'guest@truekicks.com' });
      localStorage.setItem('user', guestData);

      window.dispatchEvent(new Event('storage'));
    } else {
      const backupUser = sessionStorage.getItem('backup_user');
      if (backupUser) {
        localStorage.setItem('user', backupUser);
        window.dispatchEvent(new Event('storage'));
      }
    }
  }, [isOffline]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CartProvider>
          <WishlistProvider>
            <BrowserRouter>
              <ScrollToTop />
              {isOffline && (
                <div className="bg-red-500 text-white text-xs font-bold text-center py-1 fixed top-0 w-full z-[100]">
                  OFFLINE MODE - GUEST ACCESS
                </div>
              )}

              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Splash />} />
                  <Route path="/login" element={<Login />} />

                  {/* Layout membungkus semua halaman utama */}
                  <Route element={<Layout />}>
                    <Route path="/home" element={<Home />} />
                    <Route path="/catalog" element={<Catalog />} />
                    <Route path="/sneakers" element={<Sneakers />} />
                    <Route path="/apparel" element={<Apparel />} />
                    <Route path="/sale" element={<Sale />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/product/:type/:id" element={<ProductDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/orders" element={<OrderHistory />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </WishlistProvider>
        </CartProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom"; //
import { useQuery } from "@tanstack/react-query";
import { useLenis } from "lenis/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { hasActiveDiscount, getEffectivePrice } from "../lib/pricing";
import { useWishlist } from "../Context/WishlistContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BackInBlackBanner from "../components/BackInBlackBanner";
import HeroSneakerSlider from "../components/HeroSneakerSlider";

import nikeLogo from "../assets/nike.png";
import adidasLogo from "../assets/adidas.png";
import newBalanceLogo from "../assets/newbalance.png";
import pumaLogo from "../assets/puma.png";
import converseLogo from "../assets/converse.png";

// ========== CUSTOM HOOK UNTUK SCROLL ANIMATION ==========
const useScrollAnimation = (options = {}) => {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
        ...options,
      }
    );

    const currentElement = elementRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, []);

  return [elementRef, isVisible];
};

const AnimatedImage = ({ src, alt, className }) => {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.2 });

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      className={`${className} transition-all duration-1000 ease-out will-change-transform
        ${isVisible
          ? "opacity-100 translate-y-0 scale-100 blur-0 grayscale-0"
          : "opacity-0 translate-y-12 scale-95 blur-sm grayscale"
        }`}
    />
  );
};

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const lenis = useLenis();
  const scrollRef = useRef(null);
  const topPicksRef = useRef(null);
  const blackCollectionRef = useRef(null);
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const handleWishlistToggle = (e, item) => {
    e.stopPropagation();
    const storedUser = localStorage.getItem("user");
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const isGuest =
      !parsedUser ||
      !parsedUser.id ||
      (parsedUser.email && parsedUser.email.includes("guest"));

    if (isGuest) {
      toast.error("Please log in to save items to your Wishlist.");
      navigate("/login");
      return;
    }

    if (isInWishlist(item.id, "products")) {
      removeFromWishlist(item.id, "products");
      toast.success(`${item.name} removed from Wishlist!`);
    } else {
      addToWishlist({
        id: item.id,
        name: item.name,
        price: getEffectivePrice(item),
        image: item.image_url,
        productType: "products",
      });
      toast.success(`${item.name} added to Wishlist!`);
    }
  };

  // 1. FETCH DATA DARI API SUPABASE WITH REACT QUERY
  const fetchProducts = async () => {
    const { data } = await api.get("/api/products");
    return data;
  };

  const { data: products = [], isLoading: loading } = useQuery({
    queryKey: ['homeProducts'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  });

  // 2. MEMBAGI DATA (Slicing)
  const topPicks = products.slice(0, 3).concat(products.slice(13, 17));
  const newArrivals = products.slice(3, 7);
  const blackCollection = products.slice(7, 13);

  // 3. FUNGSI SCROLL CAROUSEL
  const scroll = (direction) => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = 320;
      if (direction === "left") {
        current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      } else {
        current.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    if (location.state && location.state.scrollTo) {
      const elemId = location.state.scrollTo;
      const element = document.getElementById(elemId);

      if (element) {
        setTimeout(() => {
          if (lenis) {
            lenis.scrollTo(element, { offset: -80 });
          } else {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      }
    }
  }, [location, lenis]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 font-poppins overflow-x-hidden transition-colors duration-300">
      <Navbar />

      {/* ===========================
          1. HERO SECTION - 5-SNEAKER SHOWCASE SLIDER
         =========================== */}
      <section className="relative w-full min-h-[88vh] lg:min-h-screen flex items-center justify-center pt-24 pb-14 px-4 overflow-hidden bg-gradient-to-b from-white via-gray-50/70 to-white dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 transition-colors duration-300">
        {/* Subtle studio backdrop vignette */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[420px] bg-gradient-to-r from-gray-200/35 via-white/40 to-gray-200/35 dark:from-white/[0.04] dark:via-white/[0.02] dark:to-white/[0.04] rounded-full blur-3xl" />
        </div>

        {/* Showcase Slider */}
        <div className="relative z-10 w-full">
          <HeroSneakerSlider
            products={products}
            onExplore={(sneaker, matchedProduct) => {
              if (matchedProduct) {
                navigate(`/product/products/${matchedProduct.id}`);
              } else {
                navigate("/sneakers", { state: { brand: sneaker.filterBrand } });
              }
            }}
          />
        </div>
      </section>

      {/* ===========================
          2. BRAND LOGOS (DESKTOP ONLY)
          Tambahkan 'hidden md:block' agar hilang di mobile
         =========================== */}
      <section className="hidden md:block py-10 border-y-2 border-gray-200/50 dark:border-gray-700/50 bg-white dark:bg-gray-900 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          {/* Optional: Subtitle */}
          <p className="text-center text-gray-400 text-xs font-medium uppercase tracking-widest mb-6 hidden sm:block">
            Trusted by the world's leading sneaker enthusiasts
          </p>

          <div className="flex justify-around items-center gap-16 sm:gap-20 overflow-x-auto no-scrollbar opacity-60 dark:opacity-80 grayscale hover:grayscale-0 dark:invert transition-all duration-700">
            <img
              src={nikeLogo}
              alt="Nike Logo"
              className="h-20 sm:h-20 md:h-20  flex-shrink-0"
            />
            <img
              src={adidasLogo}
              alt="Adidas Logo"
              className="h-7 sm:h-9 md:h-12 flex-shrink-0"
            />
            <img
              src={newBalanceLogo}
              alt="New Balance Logo"
              className="h-20 sm:h-20 md:h-20 flex-shrink-0"
            />
            <img
              src={pumaLogo}
              alt="Puma Logo"
              className="h-7 sm:h-9 md:h-12 flex-shrink-0"
            />
            <img
              src={converseLogo}
              alt="Converse Logo"
              className="h-20 sm:h-20 md:h-20  flex-shrink-0"
            />
          </div>
        </div>
      </section>



      {/* ===========================
          3. OUR TOP PICKS (Carousel) - RESPONSIVE TUNED
         =========================== */}
      <section
        id="best-sellers"
        ref={topPicksRef}
        className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24 scroll-mt-32 relative"
      >
        {/* Decorative Background Blob */}
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-orange-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-y-1/2 -z-10"></div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 md:mb-12 gap-6">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-orange-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-orange-600 font-bold text-sm tracking-widest uppercase">
                Curated Collection
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight">
              TOP{" "}
              <span className="relative inline-block">
                PICKS
                <span className="absolute bottom-1 left-0 w-full h-2 md:h-3 bg-orange-200/50 -z-10 rounded-sm transform -rotate-1"></span>
              </span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 md:mt-4 text-sm md:text-lg">
              The most sought-after silhouettes of the season.
            </p>
          </div>

          {/* Custom Navigation Buttons (Hidden di Mobile agar lebih bersih) */}
          <div className="hidden md:flex gap-4">
            <button
              onClick={() => scroll("left")}
              className="group w-14 h-14 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center hover:bg-black dark:hover:bg-white hover:border-black dark:hover:border-white transition-all duration-300 shadow-sm hover:shadow-xl"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-6 h-6 text-gray-700 dark:text-gray-200 group-hover:text-white dark:group-hover:text-gray-900 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              className="group w-14 h-14 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center hover:bg-black dark:hover:bg-white hover:border-black dark:hover:border-white transition-all duration-300 shadow-sm hover:shadow-xl"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-6 h-6 text-gray-700 dark:text-gray-200 group-hover:text-white dark:group-hover:text-gray-900 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-12 pt-4 scroll-smooth px-2 md:px-4"
        >
          {loading && topPicks.length === 0
            ? [...Array(3)].map((_, i) => (
              <div
                key={i}
                // SKELETON RESPONSIVE
                className="min-w-[260px] md:min-w-[340px] h-[350px] md:h-[400px] bg-gray-100 dark:bg-gray-800 rounded-[2rem] animate-pulse flex-shrink-0"
              ></div>
            ))
            : topPicks.map((item, index) => (
              <div
                key={item.id}
                // UBAH LEBAR KARTU DI SINI (260px di mobile, 340px di desktop)
                className="min-w-[260px] md:min-w-[340px] snap-center flex-shrink-0 group"
              >
                <div
                  onClick={() => navigate(`/product/products/${item.id}`)}
                  // Enhanced hover with lift and glow effect
                  className="bg-white dark:bg-gray-900 p-4 md:p-5 rounded-[2rem] relative transition-all duration-700 hover:-translate-y-4 hover:shadow-[0_25px_50px_-12px_rgba(249,115,22,0.4)] border border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-500/40 h-full flex flex-col justify-between cursor-pointer overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-50/0 before:to-orange-50/0 hover:before:from-orange-50/50 hover:before:to-purple-50/30 dark:hover:before:from-orange-500/5 dark:hover:before:to-purple-500/5 before:transition-all before:duration-700 before:opacity-0 hover:before:opacity-100"
                >
                  {/* Image Area */}
                  <div>
                    {/* TINGGI GAMBAR DIKURANGI DI MOBILE (h-[180px]) */}
                    <div className="relative h-[180px] md:h-[240px] rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center mb-4 md:mb-6 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-100 dark:to-gray-200 group-hover:from-orange-50/50 group-hover:to-purple-50/30 transition-all duration-700">
                      {/* Ranking Badge with pulse */}
                      <div className="absolute top-3 left-3 md:top-4 md:left-4 z-20">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-gray-900 to-black text-white rounded-full flex items-center justify-center font-black text-xs md:text-sm shadow-lg shadow-black/30 group-hover:shadow-black/50 transition-all duration-500 group-hover:scale-110 relative">
                          <span className="relative z-10">#{index + 1}</span>
                          <span className="absolute inset-0 rounded-full bg-orange-500 opacity-0 group-hover:opacity-20 animate-pulse"></span>
                        </div>
                      </div>

                      {/* Favorite Button with enhanced interaction */}
                      <button
                        onClick={(e) => handleWishlistToggle(e, item)}
                        aria-label={`Toggle wishlist for ${item.name}`}
                        className={`absolute top-3 right-3 md:top-4 md:right-4 z-20 w-8 h-8 md:w-10 md:h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all shadow-lg hover:shadow-red-200/50 transform duration-500 hover:scale-110 active:scale-95 ${
                          isInWishlist(item.id, "products")
                            ? "text-red-500 opacity-100"
                            : "text-gray-400 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:translate-y-2 md:group-hover:translate-y-0"
                        }`}
                      >
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 transition-transform hover:scale-110"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      {/* Animated glow background */}
                      <div className="absolute w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-orange-400/30 to-purple-400/30 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-150"></div>

                      {/* Animated Image (Lebar disesuaikan agar tidak terlalu penuh di mobile) */}
                      <AnimatedImage
                        src={item.image_url}
                        className="w-[85%] md:w-[90%] h-[85%] md:h-[90%] object-contain mix-blend-multiply z-10 transition-all duration-700 ease-out group-hover:scale-[1.15] group-hover:-rotate-12 drop-shadow-xl group-hover:drop-shadow-2xl"
                        alt={item.name}
                      />
                    </div>

                    {/* Content */}
                    <div className="px-1 md:px-2 relative z-10">
                      <p className="text-orange-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-orange-600 transition-colors">
                        {item.category}
                      </p>
                      <h3 className="font-black text-gray-900 dark:text-white text-lg md:text-xl leading-tight mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors duration-300">
                        {item.name}
                      </h3>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="px-1 md:px-2 pt-3 md:pt-4 flex items-center justify-between border-t border-dashed border-gray-100 dark:border-gray-800 group-hover:border-orange-200/50 mt-2 transition-colors relative z-10">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-medium uppercase group-hover:text-orange-500 transition-colors">
                        Current Price
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors">
                          {(getEffectivePrice(item) / 1000).toLocaleString()}K
                        </p>
                        {hasActiveDiscount(item) && (
                          <span className="text-xs text-gray-400 line-through font-medium">
                            {(Number(item.price) / 1000).toLocaleString()}K
                          </span>
                        )}
                      </div>
                    </div>

                    <button className="relative overflow-hidden w-10 h-10 md:w-12 md:h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl md:rounded-2xl flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-orange-600 group-hover:text-white transition-all duration-500 shadow-lg shadow-gray-900/20 group-hover:shadow-orange-500/50 group-hover:scale-110 active:scale-95">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                        className="w-4 h-4 md:w-5 md:h-5 relative z-10 transition-transform group-hover:rotate-90 duration-500"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4.5v15m7.5-7.5h-15"
                        />
                      </svg>
                      {/* Ripple effect */}
                      <span className="absolute inset-0 rounded-xl md:rounded-2xl bg-white opacity-0 group-hover:opacity-20 group-active:opacity-30 transition-opacity"></span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* ===========================
          4. NEW ARRIVALS - RESPONSIVE 2-COLUMN GRID
         =========================== */}
      <section
        id="new-arrivals"
        className="max-w-7xl mx-auto px-4 md:px-6 mb-24 scroll-mt-32"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
              </span>
              <span className="text-purple-600 font-bold text-sm tracking-widest uppercase">
                Just Dropped
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-none">
              FRESH{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500">
                KICKS.
              </span>
            </h2>
          </div>
        </div>

        {/* GRID LAYOUT PERBAIKAN:
            - grid-cols-2 (Mobile)
            - gap-3 (Mobile) -> gap-8 (Desktop)
        */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
          {loading && newArrivals.length === 0 ? (
            <p className="col-span-2 lg:col-span-4 text-center py-20 text-gray-400 animate-pulse">
              Fetching latest drops...
            </p>
          ) : (
            newArrivals.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/product/products/${item.id}`)}
                // Enhanced hover with smooth lift and purple theme
                className="group relative bg-white dark:bg-gray-900 rounded-2xl md:rounded-[2rem] p-3 md:p-4 transition-all duration-700 hover:shadow-[0_25px_60px_-15px_rgba(124,58,237,0.25)] hover:-translate-y-3 border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-500/40 cursor-pointer h-full flex flex-col justify-between overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-purple-50/0 before:to-blue-50/0 hover:before:from-purple-50/40 hover:before:to-blue-50/30 dark:hover:before:from-purple-500/5 dark:hover:before:to-blue-500/5 before:transition-all before:duration-700 before:opacity-0 hover:before:opacity-100"
              >
                {/* Image Container */}
                <div>
                  {/* Tinggi gambar lebih kecil di mobile (h-[140px]) */}
                  <div className="relative h-[140px] md:h-[220px] bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] dark:from-gray-100 dark:to-gray-200 rounded-xl md:rounded-[1.5rem] flex items-center justify-center mb-3 md:mb-5 overflow-hidden group-hover:from-purple-50/70 group-hover:to-blue-50/40 transition-all duration-700">
                    {/* Floating Badge with enhanced animation */}
                    <div className="absolute top-2 left-2 md:top-4 md:left-4 z-20">
                      <div className="bg-white/90 backdrop-blur-md px-2 py-1 md:px-3 md:py-1.5 rounded-full shadow-lg border border-white/50 flex items-center gap-1.5 group-hover:shadow-purple-200/50 group-hover:scale-105 transition-all duration-500">
                        <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse"></div>
                        <span className="text-[8px] md:text-[10px] font-bold text-gray-800 tracking-wider uppercase">
                          New
                        </span>
                      </div>
                    </div>

                    {/* Gradient glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-200/30 to-blue-200/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                    {/* Animated Image */}
                    <AnimatedImage
                      src={item.image_url}
                      className="w-[85%] md:w-[90%] h-[85%] md:h-[90%] object-contain mix-blend-multiply transition-all duration-700 ease-out group-hover:scale-[1.12] group-hover:-rotate-[10deg] drop-shadow-lg group-hover:drop-shadow-2xl relative z-10"
                      alt={item.name}
                    />
                  </div>

                  {/* Product Info */}
                  <div className="px-1 md:px-2 pb-2 relative z-10">
                    <p className="text-[10px] md:text-xs font-bold text-gray-400 group-hover:text-purple-500 mb-0.5 md:mb-1 uppercase tracking-wide truncate transition-colors duration-300">
                      {item.category}
                    </p>
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 text-sm md:text-lg leading-tight mb-2 md:mb-3 transition-colors duration-300 line-clamp-2 md:line-clamp-1 h-[2.5em] md:h-auto">
                      {item.name}
                    </h3>
                  </div>
                </div>

                {/* Footer Price & Button */}
                <div className="px-1 md:px-2 flex items-center justify-between border-t border-gray-50 dark:border-gray-800 group-hover:border-purple-100/50 pt-2 md:pt-4 mt-auto transition-colors relative z-10">
                  <div className="flex flex-col">
                    <span className="hidden md:block text-[10px] text-gray-400 group-hover:text-purple-500 font-medium transition-colors">
                      Price
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 font-black text-sm md:text-lg transition-colors">
                        {(getEffectivePrice(item) / 1000).toLocaleString()}K
                      </span>
                      {hasActiveDiscount(item) && (
                        <span className="text-[11px] text-gray-400 line-through font-medium">
                          {(Number(item.price) / 1000).toLocaleString()}K
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/product/products/${item.id}`);
                    }}
                    aria-label={`View ${item.name}`}
                    className="h-8 w-8 md:h-10 md:w-10 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-gray-900 shadow-lg shadow-gray-900/20 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-purple-600 group-hover:to-purple-700 group-hover:text-white group-hover:shadow-purple-600/40 transition-all duration-500 active:scale-95 relative overflow-hidden"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-4 h-4 md:w-5 md:h-5 transition-transform duration-500 group-hover:rotate-90 relative z-10"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    {/* Ripple effect */}
                    <span className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 group-active:opacity-30 transition-opacity"></span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>



      {/* 6. BLACK COLLECTION - MODERN DARK MODE STYLE (RESPONSIVE GRID) */}
      {blackCollection.length > 0 && (
        <section
          ref={blackCollectionRef}
          className="max-w-7xl mx-auto px-4 md:px-6 mb-32 scroll-mt-24"
        >
          {/* Back In Black Banner */}
          <BackInBlackBanner
            onScrollToProducts={() =>
              lenis
                ? lenis.scrollTo(window.scrollY + 400)
                : window.scrollTo({ top: window.scrollY + 400, behavior: "smooth" })
            }
          />

          {/* GRID LAYOUT:
              - grid-cols-2 (Mobile)
              - grid-cols-3 (Desktop)
              - gap-3 (Mobile) -> gap-8 (Desktop)
          */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
            {blackCollection.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/product/products/${item.id}`)}
                // Enhanced dark theme with dramatic hover
                className="group relative bg-gradient-to-br from-[#0F0F0F] to-[#1A1A1A] rounded-2xl md:rounded-[2.5rem] p-3 md:p-6 overflow-hidden border border-white/5 hover:border-white/30 transition-all duration-700 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] hover:-translate-y-3 cursor-pointer h-full flex flex-col justify-between before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/0 before:to-white/0 hover:before:from-white/5 hover:before:to-transparent before:transition-all before:duration-700 before:opacity-0 hover:before:opacity-100"
              >
                {/* Background Accents - Enhanced */}
                <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-white/5 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-all duration-700 group-hover:scale-150"></div>

                {/* Badge with enhanced visibility */}
                <div className="absolute top-3 left-3 md:top-6 md:left-6 z-20">
                  <span className="px-2 py-1 md:px-3 md:py-1 bg-white/10 backdrop-blur-md border border-white/10 group-hover:bg-white/20 group-hover:border-white/30 text-white text-[8px] md:text-[10px] font-bold tracking-widest uppercase rounded-full transition-all duration-500 shadow-lg group-hover:shadow-white/25 group-hover:scale-105">
                    Premium
                  </span>
                </div>

                {/* Image Area */}
                <div>
                  {/* Tinggi gambar dikurangi di mobile (h-[140px]) */}
                  <div className="relative h-[140px] md:h-[260px] flex items-center justify-center mb-2 md:mb-6 z-10">
                    {/* Enhanced Glow */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 md:w-40 md:h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 group-hover:bg-white/20 transition-all duration-700"></div>
                    </div>

                    {/* Animated Image with enhanced drop shadow */}
                    <AnimatedImage
                      src={item.image_url}
                      alt={item.name}
                      className="relative z-10 w-[95%] h-[95%] object-contain drop-shadow-[0_20px_40px_rgba(255,255,255,0.1)] transition-all duration-700 ease-out group-hover:scale-[1.15] group-hover:-rotate-[15deg] group-hover:translate-x-2 group-hover:drop-shadow-[0_30px_60px_rgba(255,255,255,0.2)]"
                    />
                  </div>

                  {/* Content Area */}
                  <div className="relative z-20 px-1 md:px-0">
                    <h3 className="text-sm md:text-xl font-bold text-white leading-tight mb-1 group-hover:text-gray-200 transition-colors duration-300 line-clamp-1">
                      {item.name}
                    </h3>
                    <p className="text-gray-500 group-hover:text-gray-400 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-2 truncate transition-colors duration-300">
                      {item.category || "Running / Lifestyle"}
                    </p>
                  </div>
                </div>

                {/* Footer (Price & Button) */}
                <div className="relative z-20 flex items-center justify-between border-t border-white/10 group-hover:border-white/20 pt-2 md:pt-5 mt-auto px-1 md:px-0 transition-colors duration-300">
                  <div className="flex flex-col">
                    {hasActiveDiscount(item) && (
                      <span className="text-[11px] text-gray-500 line-through font-medium">
                        Rp {(Number(item.price) / 1000).toLocaleString()}K
                      </span>
                    )}
                    <p className="text-sm md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 group-hover:from-white group-hover:to-gray-300 transition-all">
                      Rp {(getEffectivePrice(item) / 1000).toLocaleString()}K
                    </p>
                  </div>

                  <button className="w-8 h-8 md:w-12 md:h-12 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200 hover:scale-110 transition-all duration-500 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95 relative overflow-hidden group/btn">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4 md:w-5 md:h-5 transition-transform duration-500 group-hover/btn:rotate-90 relative z-10"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {/* Ripple effect */}
                    <span className="absolute inset-0 rounded-full bg-black opacity-0 group-hover/btn:opacity-10 group-active/btn:opacity-20 transition-opacity"></span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

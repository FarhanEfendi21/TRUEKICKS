import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLenis } from "lenis/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import {
  hasActiveDiscount,
  getEffectivePrice,
  getDiscountPercentage,
  formatRupiahShort,
} from "../lib/pricing";
import { useWishlist } from "../Context/WishlistContext";
import { useLanguage } from "../Context/LanguageContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BackInBlackBanner from "../components/BackInBlackBanner";
import HeroSneakerSlider from "../components/HeroSneakerSlider";

import nikeLogo from "../assets/nike.png";
import adidasLogo from "../assets/adidas.png";
import newBalanceLogo from "../assets/newbalance.png";
import pumaLogo from "../assets/puma.png";
import converseLogo from "../assets/converse.png";

const BRAND_LOGOS = [
  { name: "Nike", logo: nikeLogo, heightClass: "h-12 md:h-16" },
  { name: "Adidas", logo: adidasLogo, heightClass: "h-7 md:h-10" },
  { name: "New Balance", logo: newBalanceLogo, heightClass: "h-12 md:h-16" },
  { name: "Puma", logo: pumaLogo, heightClass: "h-7 md:h-10" },
  { name: "Converse", logo: converseLogo, heightClass: "h-12 md:h-16" },
];

const useScrollAnimation = (threshold = 0.1) => {
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
        threshold,
        rootMargin: "50px",
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
  }, [threshold]);

  return [elementRef, isVisible];
};

const AnimatedImage = ({ src, alt, className }) => {
  const [ref, isVisible] = useScrollAnimation(0.2);

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      className={`${className} transition-all duration-700 ease-out will-change-transform ${
        isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-6 scale-95"
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
  const blackGridRef = useRef(null);
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { pick } = useLanguage();

  const handleWishlistToggle = (e, item) => {
    e.stopPropagation();
    let parsedUser = null;
    try {
      const storedUser = localStorage.getItem("user");
      parsedUser = storedUser ? JSON.parse(storedUser) : null;
    } catch {
      parsedUser = null;
    }
    const isGuest =
      !parsedUser ||
      !parsedUser.id ||
      (parsedUser.email && parsedUser.email.includes("guest"));

    if (isGuest) {
      toast.error(pick("Silakan masuk untuk menyimpan ke Wishlist.", "Please log in to save items to your Wishlist."));
      navigate("/login", { state: { from: "/home" } });
      return;
    }

    if (isInWishlist(item.id, "products")) {
      removeFromWishlist(item.id, "products");
      toast.success(pick(`${item.name} dihapus dari Wishlist!`, `${item.name} removed from Wishlist!`));
    } else {
      addToWishlist({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        discount_price: hasActiveDiscount(item)
          ? Number(item.discount_price)
          : null,
        discount_percentage: getDiscountPercentage(item),
        category: item.category || "",
        image: item.image_url,
        productType: "products",
      });
      toast.success(pick(`${item.name} ditambahkan ke Wishlist!`, `${item.name} added to Wishlist!`));
    }
  };

  const fetchProducts = async () => {
    const { data } = await api.get("/api/products");
    return data;
  };

  const { data: products = [], isLoading: loading } = useQuery({
    queryKey: ["homeProducts"],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000,
  });

  const topPicks = products.slice(0, 3).concat(products.slice(13, 17));
  const newArrivals = products.slice(3, 7);
  const blackCollection = products.slice(7, 13);

  const scrollCarousel = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const scrollToBlackGrid = () => {
    if (lenis && blackGridRef.current) {
      lenis.scrollTo(blackGridRef.current, { offset: -96 });
    } else {
      blackGridRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="min-h-screen bg-white dark:bg-gray-950 font-poppins overflow-x-hidden transition-colors duration-300">
      <Navbar />

      {/* ===========================
          1. HERO SECTION - 5-SNEAKER SHOWCASE SLIDER
         =========================== */}
      <section className="relative w-full min-h-[88vh] lg:min-h-screen flex items-center justify-center pt-24 pb-14 px-4 overflow-hidden bg-gradient-to-b from-white via-gray-50/70 to-white dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 transition-colors duration-300">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[420px] bg-gradient-to-r from-gray-200/35 via-white/40 to-gray-200/35 dark:from-white/[0.04] dark:via-white/[0.02] dark:to-white/[0.04] rounded-full blur-3xl" />
        </div>

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
          2. INTERACTIVE BRAND STRIP (EDITORIAL)
         =========================== */}
      <section
        aria-label="Shop by brand"
        className="py-8 md:py-10 border-y border-gray-200/70 dark:border-gray-800/80 bg-white dark:bg-gray-950 transition-colors duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <p className="text-center text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-400 dark:text-gray-500 mb-6">
            {pick("Belanja Berdasarkan Merek", "Shop By Brand")}
          </p>

          <div className="flex items-center justify-start md:justify-around gap-10 md:gap-16 overflow-x-auto no-scrollbar px-2">
            {BRAND_LOGOS.map((brand) => (
              <button
                key={brand.name}
                type="button"
                onClick={() =>
                  navigate("/sneakers", { state: { brand: brand.name } })
                }
                aria-label={`Browse ${brand.name} sneakers`}
                className="flex-shrink-0 group py-2 px-3 rounded-xl opacity-55 hover:opacity-100 focus-visible:opacity-100 transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className={`${brand.heightClass} object-contain grayscale group-hover:grayscale-0 dark:invert transition-all duration-300`}
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===========================
          3. TOP PICKS (EDITORIAL CAROUSEL)
         =========================== */}
      <section
        id="best-sellers"
        ref={topPicksRef}
        className="max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24 scroll-mt-28"
      >
        {/* Editorial Section Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 md:mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.25em] uppercase text-gray-400 dark:text-gray-500 mb-3">
              <span>01</span>
              <span className="w-8 h-[1px] bg-gray-300 dark:bg-gray-700" />
              <span>{pick("Koleksi Pilihan", "Curated Collection")}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-gray-950 dark:text-white leading-none">
              {pick("Pilihan Utama", "Top Picks")}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-3 text-sm md:text-base max-w-md">
              {pick("Siluet paling dicari musim ini.", "The most sought-after silhouettes of the season.")}
            </p>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-4">
            <Link
              to="/sneakers"
              className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white transition-colors"
            >
              {pick("Lihat Semua", "View All")}
            </Link>
            <div className="hidden md:flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => scrollCarousel("left")}
                aria-label="Scroll top picks left"
                className="w-11 h-11 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-950 hover:text-white hover:border-gray-950 dark:hover:bg-white dark:hover:text-gray-950 dark:hover:border-white transition-all duration-200 active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel("right")}
                aria-label="Scroll top picks right"
                className="w-11 h-11 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-950 hover:text-white hover:border-gray-950 dark:hover:bg-white dark:hover:text-gray-950 dark:hover:border-white transition-all duration-200 active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Track */}
        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-6 pt-2 scroll-smooth"
        >
          {loading && topPicks.length === 0
            ? [...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="min-w-[260px] md:min-w-[310px] h-[360px] md:h-[400px] bg-gray-100 dark:bg-gray-900 rounded-3xl animate-pulse flex-shrink-0 border border-gray-100 dark:border-gray-800"
                />
              ))
            : topPicks.map((item, index) => {
                const isOnSale = hasActiveDiscount(item);
                const discountPercent = getDiscountPercentage(item);
                const liked = isInWishlist(item.id, "products");

                return (
                  <div
                    key={item.id}
                    className="min-w-[260px] md:min-w-[310px] snap-start flex-shrink-0 group"
                  >
                    <div
                      onClick={() => navigate(`/product/products/${item.id}`)}
                      className="bg-white dark:bg-gray-900 p-4 rounded-2xl md:rounded-3xl border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/[0.06] dark:hover:shadow-black/40 h-full flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        {/* Studio Light Image Frame */}
                        <div className="relative h-[185px] md:h-[230px] p-4 rounded-xl md:rounded-2xl bg-gray-50 dark:bg-gray-100 flex items-center justify-center mb-4 overflow-hidden">
                          {/* Rank Pill */}
                          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-full bg-gray-950 text-white text-[10px] font-bold tracking-wider">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {isOnSale && (
                              <span className="px-2 py-1 rounded-full bg-[#FF5500] text-white text-[10px] font-black tracking-wide">
                                -{discountPercent}%
                              </span>
                            )}
                          </div>

                          {/* Wishlist Button */}
                          <button
                            type="button"
                            onClick={(e) => handleWishlistToggle(e, item)}
                            aria-label={
                              liked
                                ? `Remove ${item.name} from wishlist`
                                : `Save ${item.name} to wishlist`
                            }
                            className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200/70 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${
                              liked
                                ? "text-red-500 opacity-100"
                                : "text-gray-400 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            }`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill={liked ? "currentColor" : "none"}
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                              />
                            </svg>
                          </button>

                          <AnimatedImage
                            src={item.image_url}
                            className="w-[88%] h-[88%] object-contain mix-blend-multiply z-10 transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-rotate-3"
                            alt={item.name}
                          />
                        </div>

                        {/* Product Copy */}
                        <div className="px-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500 mb-1">
                            {item.category}
                          </p>
                          <h3 className="font-bold text-gray-950 dark:text-white text-sm md:text-base leading-snug line-clamp-2 group-hover:text-[#FF5500] transition-colors">
                            {item.name}
                          </h3>
                        </div>
                      </div>

                      {/* Price & Action */}
                      <div className="px-1 pt-3.5 mt-4 flex items-end justify-between border-t border-gray-100 dark:border-gray-800">
                        <div className="flex flex-col">
                          {isOnSale && (
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 line-through font-medium leading-none mb-0.5">
                              {formatRupiahShort(item.price)}
                            </span>
                          )}
                          <p className="text-base md:text-lg font-black tracking-tight text-gray-950 dark:text-white">
                            {formatRupiahShort(getEffectivePrice(item))}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/product/products/${item.id}`);
                          }}
                          aria-label={`View ${item.name}`}
                          className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gray-950 dark:bg-white text-white dark:text-gray-950 flex items-center justify-center group-hover:bg-[#FF5500] dark:group-hover:bg-[#FF5500] dark:group-hover:text-white transition-all duration-200 active:scale-95"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2.2}
                            stroke="currentColor"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 4.5v15m7.5-7.5h-15"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </section>

      {/* ===========================
          4. NEW ARRIVALS (EDITORIAL GRID)
         =========================== */}
      <section
        id="new-arrivals"
        className="max-w-7xl mx-auto px-4 md:px-6 pb-20 md:pb-28 scroll-mt-28"
      >
        {/* Editorial Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.25em] uppercase text-gray-400 dark:text-gray-500 mb-3">
              <span>02</span>
              <span className="w-8 h-[1px] bg-gray-300 dark:bg-gray-700" />
              <span>{pick("Baru Rilis", "Just Dropped")}</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-gray-950 dark:text-white leading-none">
              {pick("Rilisan Terbaru", "Fresh Kicks")}
            </h2>
          </div>

          <Link
            to="/sneakers"
            className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white transition-colors"
          >
            {pick("Jelajahi Semua", "Explore All")}
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {loading && newArrivals.length === 0
            ? [...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-900 p-4 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-800 flex flex-col gap-3"
                >
                  <div className="w-full h-[160px] md:h-[220px] bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
                  <div className="w-2/3 h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="w-1/2 h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              ))
            : newArrivals.map((item) => {
                const isOnSale = hasActiveDiscount(item);
                const discountPercent = getDiscountPercentage(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/product/products/${item.id}`)}
                    className="group bg-white dark:bg-gray-900 rounded-2xl md:rounded-3xl p-3 md:p-4 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/[0.06] dark:hover:shadow-black/40 cursor-pointer h-full flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-[145px] md:h-[220px] p-3 md:p-5 bg-gray-50 dark:bg-gray-100 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 overflow-hidden">
                        <div className="absolute top-2.5 left-2.5 md:top-3 md:left-3 z-20 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-white/95 text-gray-900 border border-gray-200/80 text-[9px] md:text-[10px] font-bold tracking-wider uppercase shadow-sm">
                            {pick("Baru", "New")}
                          </span>
                          {isOnSale && (
                            <span className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-[#FF5500] text-white text-[9px] md:text-[10px] font-black tracking-wide">
                              -{discountPercent}%
                            </span>
                          )}
                        </div>

                        <AnimatedImage
                          src={item.image_url}
                          className="w-[88%] h-[88%] object-contain mix-blend-multiply transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-rotate-2"
                          alt={item.name}
                        />
                      </div>

                      <div className="px-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500 mb-1 truncate">
                          {item.category}
                        </p>
                        <h3 className="font-bold text-gray-950 dark:text-white group-hover:text-[#FF5500] text-xs md:text-base leading-snug line-clamp-2 transition-colors">
                          {item.name}
                        </h3>
                      </div>
                    </div>

                    <div className="px-1 pt-3 mt-3 md:mt-4 flex items-end justify-between border-t border-gray-100 dark:border-gray-800">
                      <div className="flex flex-col">
                        {isOnSale && (
                          <span className="text-[10px] md:text-[11px] text-gray-400 dark:text-gray-500 line-through font-medium leading-none mb-0.5">
                            {formatRupiahShort(item.price)}
                          </span>
                        )}
                        <span className="text-gray-950 dark:text-white font-black text-xs md:text-base tracking-tight">
                          {formatRupiahShort(getEffectivePrice(item))}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/product/products/${item.id}`);
                        }}
                        aria-label={`View ${item.name}`}
                        className="h-8 w-8 md:h-9 md:w-9 bg-gray-950 dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-gray-950 group-hover:bg-[#FF5500] dark:group-hover:bg-[#FF5500] dark:group-hover:text-white transition-all duration-200 active:scale-95 flex-shrink-0"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.2}
                          stroke="currentColor"
                          className="w-3.5 h-3.5 md:w-4 md:h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
        </div>
      </section>

      {/* ===========================
          5. BACK IN BLACK (MONOCHROME DARK EDITORIAL)
         =========================== */}
      {blackCollection.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 mb-28 scroll-mt-24">
          <BackInBlackBanner onScrollToProducts={scrollToBlackGrid} />

          <div
            ref={blackGridRef}
            className="scroll-mt-28 grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6"
          >
            {blackCollection.map((item) => {
              const isOnSale = hasActiveDiscount(item);
              const discountPercent = getDiscountPercentage(item);
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/product/products/${item.id}`)}
                  className="group relative bg-gradient-to-br from-[#0E0E10] to-[#17171A] rounded-2xl md:rounded-3xl p-3 md:p-6 overflow-hidden border border-white/10 hover:border-white/25 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1.5 cursor-pointer h-full flex flex-col justify-between"
                >
                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 md:top-5 md:left-5 z-20 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 bg-white/10 backdrop-blur-md border border-white/10 text-white text-[9px] md:text-[10px] font-bold tracking-[0.18em] uppercase rounded-full">
                      Stealth
                    </span>
                    {isOnSale && (
                      <span className="px-2 py-1 bg-[#FF5500] text-white text-[9px] md:text-[10px] font-black rounded-full">
                        -{discountPercent}%
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="relative h-[145px] md:h-[240px] flex items-center justify-center mb-3 md:mb-5 z-10">
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="w-28 h-28 md:w-44 md:h-44 bg-white/[0.06] rounded-full blur-3xl group-hover:bg-white/[0.11] transition-colors duration-500" />
                      </div>

                      <AnimatedImage
                        src={item.image_url}
                        alt={item.name}
                        className="relative z-10 w-[88%] h-[88%] object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.65)] transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-rotate-3"
                      />
                    </div>

                    <div className="relative z-20 px-1 md:px-0">
                      <p className="text-gray-500 text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] mb-1 truncate">
                        {item.category || "Lifestyle"}
                      </p>
                      <h3 className="text-sm md:text-lg font-bold text-white leading-snug line-clamp-1 group-hover:text-gray-200 transition-colors">
                        {item.name}
                      </h3>
                    </div>
                  </div>

                  <div className="relative z-20 flex items-end justify-between border-t border-white/10 pt-3 md:pt-4 mt-4 px-1 md:px-0">
                    <div className="flex flex-col">
                      {isOnSale && (
                        <span className="text-[10px] md:text-[11px] text-gray-500 line-through font-medium leading-none mb-0.5">
                          {formatRupiahShort(item.price)}
                        </span>
                      )}
                      <p className="text-sm md:text-xl font-black text-white tracking-tight">
                        {formatRupiahShort(getEffectivePrice(item))}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/product/products/${item.id}`);
                      }}
                      aria-label={`View ${item.name}`}
                      className="w-8 h-8 md:w-10 md:h-10 bg-white text-gray-950 rounded-xl flex items-center justify-center group-hover:bg-[#FF5500] group-hover:text-white transition-all duration-200 active:scale-95 flex-shrink-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.2}
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4.5v15m7.5-7.5h-15"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

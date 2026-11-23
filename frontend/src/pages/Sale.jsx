import { useEffect, useState, useRef, useMemo } from "react";
import { useLenis } from "lenis/react";
import api from "../lib/api";
import {
  getEffectivePrice,
  getDiscountPercentage,
  formatRangeLabel,
} from "../lib/pricing";
import { useLanguage } from "../Context/LanguageContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SaleBanner from "../components/SaleBanner";
import SortDropdown from "../components/SortDropdown";
import Pagination from "../components/Pagination";
import ProductCard from "../components/ProductCard";

const SORT_OPTIONS = [
  { value: "discount-desc", label: "Biggest Discount" },
  { value: "price-asc", label: "Lowest Price" },
  { value: "price-desc", label: "Highest Price" },
  { value: "reviewed", label: "Most Reviewed" },
];

const DISCOUNT_TIERS = [
  { value: 0, label: "All Deals" },
  { value: 10, label: "10%+ Off" },
  { value: 20, label: "20%+ Off" },
  { value: 30, label: "30%+ Off" },
  { value: 50, label: "50%+ Off" },
];

const PRICE_PRESETS = [
  { label: "< 1Jt", range: [0, 1000000] },
  { label: "1-2Jt", range: [1000000, 2000000] },
  { label: "2-3Jt", range: [2000000, 3000000] },
  { label: "> 3Jt", range: [3000000, 5000000] },
  { label: "All", range: [0, 5000000] },
];

export default function Sale() {
  const lenis = useLenis();
  const { pick, t } = useLanguage();
  const productsGridRef = useRef(null);

  const sortOptions = useMemo(
    () => [
      { value: "discount-desc", label: pick("Diskon Terbesar", "Biggest Discount") },
      { value: "price-asc", label: pick("Harga Terendah", "Lowest Price") },
      { value: "price-desc", label: pick("Harga Tertinggi", "Highest Price") },
      { value: "reviewed", label: pick("Paling Banyak Diulas", "Most Reviewed") },
    ],
    [pick]
  );

  const discountTiers = useMemo(
    () => [
      { value: 0, label: pick("Semua Promo", "All Deals") },
      { value: 10, label: pick("Diskon 10%+", "10%+ Off") },
      { value: 20, label: pick("Diskon 20%+", "20%+ Off") },
      { value: 30, label: pick("Diskon 30%+", "30%+ Off") },
      { value: 50, label: pick("Diskon 50%+", "50%+ Off") },
    ],
    [pick]
  );

  const pricePresets = useMemo(
    () => [
      { label: pick("< 1 Jt", "< 1M"), range: [0, 1000000] },
      { label: pick("1-2 Jt", "1-2M"), range: [1000000, 2000000] },
      { label: pick("2-3 Jt", "2-3M"), range: [2000000, 3000000] },
      { label: pick("> 3 Jt", "> 3M"), range: [3000000, 5000000] },
      { label: t("common.all"), range: [0, 5000000] },
    ],
    [pick, t]
  );

  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Scalable filter states
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeBrand, setActiveBrand] = useState("All");
  const [minDiscount, setMinDiscount] = useState(0);
  const [priceRange, setPriceRange] = useState([0, 5000000]);
  const [sortBy, setSortBy] = useState("discount-desc");
  const [currentPage, setCurrentPage] = useState(1);

  const minPrice = 0;
  const maxPrice = 5000000;
  const itemsPerPage = 16;

  useEffect(() => {
    const fetchSaleData = async () => {
      try {
        const [saleRes, reviewsRes] = await Promise.all([
          api.get("/api/sale"),
          api.get("/api/all-reviews"),
        ]);
        setProducts(saleRes.data || []);
        setReviews(reviewsRes.data || []);
      } catch (error) {
        console.error("Gagal mengambil data sale:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSaleData();
  }, []);

  // Dynamic facet counts so users never hit empty filter dead-ends on large catalogs
  const categoryFacets = useMemo(() => {
    const counts = new Map();
    for (const p of products) {
      const cat = p.category?.trim();
      if (cat) counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return [
      { name: "All", count: products.length },
      ...Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
    ];
  }, [products]);

  const brandFacets = useMemo(() => {
    const counts = new Map();
    for (const p of products) {
      const brand = p.brand?.trim();
      if (brand) counts.set(brand, (counts.get(brand) || 0) + 1);
    }
    return [
      { name: "All", count: products.length },
      ...Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
    ];
  }, [products]);

  const maxDiscount = useMemo(() => {
    if (products.length === 0) return 30;
    const highest = Math.max(...products.map((p) => getDiscountPercentage(p)));
    return highest > 0 ? highest : 30;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((item) => {
      if (
        activeCategory !== "All" &&
        (item.category || "").toLowerCase() !== activeCategory.toLowerCase()
      ) {
        return false;
      }

      if (
        activeBrand !== "All" &&
        (item.brand || "").toLowerCase() !== activeBrand.toLowerCase()
      ) {
        return false;
      }

      if (minDiscount > 0 && getDiscountPercentage(item) < minDiscount) {
        return false;
      }

      const effPrice = getEffectivePrice(item);
      if (effPrice < priceRange[0] || effPrice > priceRange[1]) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered];
    if (sortBy === "discount-desc") {
      sorted.sort((a, b) => getDiscountPercentage(b) - getDiscountPercentage(a));
    } else if (sortBy === "price-asc") {
      sorted.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
    } else if (sortBy === "price-desc") {
      sorted.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
    } else if (sortBy === "reviewed") {
      sorted.sort((a, b) => {
        const aCount = reviews.filter(
          (r) =>
            String(r.product_id) === String(a.id) &&
            r.product_type === "sale_products"
        ).length;
        const bCount = reviews.filter(
          (r) =>
            String(r.product_id) === String(b.id) &&
            r.product_type === "sale_products"
        ).length;
        return bCount - aCount;
      });
    }
    return sorted;
  }, [
    products,
    reviews,
    activeCategory,
    activeBrand,
    minDiscount,
    priceRange,
    sortBy,
  ]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (activeCategory !== "All") {
      chips.push({
        key: "category",
        label: `${pick("Kategori", "Category")}: ${activeCategory}`,
        clear: () => {
          setActiveCategory("All");
          setCurrentPage(1);
        },
      });
    }
    if (activeBrand !== "All") {
      chips.push({
        key: "brand",
        label: `${pick("Merek", "Brand")}: ${activeBrand}`,
        clear: () => {
          setActiveBrand("All");
          setCurrentPage(1);
        },
      });
    }
    if (minDiscount > 0) {
      chips.push({
        key: "discount",
        label: `${pick("Diskon", "Discount")}: ${minDiscount}%+`,
        clear: () => {
          setMinDiscount(0);
          setCurrentPage(1);
        },
      });
    }
    if (priceRange[0] !== minPrice || priceRange[1] !== maxPrice) {
      chips.push({
        key: "price",
        label: `Rp ${formatRangeLabel(priceRange[0])} - ${formatRangeLabel(priceRange[1])}`,
        clear: () => {
          setPriceRange([minPrice, maxPrice]);
          setCurrentPage(1);
        },
      });
    }
    return chips;
  }, [activeCategory, activeBrand, minDiscount, priceRange, pick]);

  const resetAllFilters = () => {
    setActiveCategory("All");
    setActiveBrand("All");
    setMinDiscount(0);
    setPriceRange([minPrice, maxPrice]);
    setSortBy("discount-desc");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const indexOfLastItem = safePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProducts.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  const scrollToDeals = () => {
    if (lenis && productsGridRef.current) {
      lenis.scrollTo(productsGridRef.current, { offset: -96 });
    } else {
      productsGridRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    scrollToDeals();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-poppins transition-colors duration-300">
      <Navbar />

      <div className="pt-24 md:pt-32 pb-32 md:pb-20 max-w-7xl mx-auto px-4 md:px-6">
        {/* === SALE BANNER === */}
        <SaleBanner maxDiscount={maxDiscount} onShopNow={scrollToDeals} />

        {/* === SCALABLE FILTER & SORT TOOLBAR === */}
        <div ref={productsGridRef} className="scroll-mt-28 mb-6 md:mb-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Left: Expandable Filter Toggle + Live Result Count */}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="group flex items-center gap-3 text-gray-900 dark:text-white hover:text-[#FF5500] dark:hover:text-[#FF5500] transition-colors"
            >
              <div
                className={`relative p-2 rounded-full transition-colors ${
                  showFilters
                    ? "bg-black dark:bg-[#FF5500] text-white"
                    : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 shadow-sm"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                {activeFilterChips.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF5500] text-white text-[9px] font-black flex items-center justify-center">
                    {activeFilterChips.length}
                  </span>
                )}
              </div>
              <div className="text-left">
                <span className="block font-bold text-sm tracking-wide leading-none mb-1">
                  {showFilters
                    ? pick("Sembunyikan Filter", "Hide Filters")
                    : pick("Tampilkan Filter", "Show Filters")}
                </span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {filteredProducts.length} {pick("Hasil", "Results")}
                </span>
              </div>
            </button>

            {/* Right: Custom Minimalist Sort Dropdown */}
            <SortDropdown
              options={sortOptions}
              value={sortBy}
              ariaLabel={pick("Urutkan produk diskon", "Sort sale products")}
              onChange={(val) => {
                setSortBy(val);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Active Filter Chips Bar */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:border-red-400 hover:text-red-500 dark:hover:border-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <span>{chip.label}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 opacity-60">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] font-bold text-red-500 hover:text-red-600 px-2 py-1 underline underline-offset-2"
              >
                {pick("Atur Ulang Semua", "Reset All")}
              </button>
            </div>
          )}

          {/* Expandable Multi-Facet Filter Panel (Scales cleanly for large catalogs) */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              showFilters ? "max-h-[900px] opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            <div className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg dark:shadow-none space-y-6">
              {/* Row 1: Category & Brand */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-[#FF5500]" />
                    {pick("Kategori", "Category")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categoryFacets.map((cat) => {
                      const isActive = activeCategory === cat.name;
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => {
                            setActiveCategory(cat.name);
                            setCurrentPage(1);
                          }}
                          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border inline-flex items-center gap-1.5 ${
                            isActive
                              ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                        >
                          <span>{cat.name === "All" ? t("common.all") : cat.name}</span>
                          <span
                            className={`text-[10px] ${
                              isActive ? "text-white/75" : "text-gray-400"
                            }`}
                          >
                            ({cat.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Brand */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-[#FF5500]" />
                    {pick("Merek", "Brand")}
                  </h3>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                    {brandFacets.map((brand) => {
                      const isActive = activeBrand === brand.name;
                      return (
                        <button
                          key={brand.name}
                          type="button"
                          onClick={() => {
                            setActiveBrand(brand.name);
                            setCurrentPage(1);
                          }}
                          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border inline-flex items-center gap-1.5 ${
                            isActive
                              ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                        >
                          <span>{brand.name === "All" ? t("common.all") : brand.name}</span>
                          <span
                            className={`text-[10px] ${
                              isActive ? "text-white/75" : "text-gray-400"
                            }`}
                          >
                            ({brand.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 2: Minimum Discount & Sale Price Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                {/* Minimum Discount Tier */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {pick("Diskon Minimum", "Minimum Discount")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {discountTiers.map((tier) => {
                      const isActive = minDiscount === tier.value;
                      return (
                        <button
                          key={tier.value}
                          type="button"
                          onClick={() => {
                            setMinDiscount(tier.value);
                            setCurrentPage(1);
                          }}
                          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                            isActive
                              ? "bg-red-500 text-white border-red-500"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                        >
                          {tier.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sale Price Range */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-[#FF5500]" />
                    {pick("Rentang Harga Diskon", "Sale Price Range")}
                  </h3>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-200 mb-3">
                    <span>Rp {formatRangeLabel(priceRange[0])}</span>
                    <span className="text-gray-400 font-normal">{pick("hingga", "to")}</span>
                    <span>Rp {formatRangeLabel(priceRange[1])}</span>
                  </div>

                  <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4">
                    <div
                      className="absolute h-full bg-gray-900 dark:bg-[#FF5500] rounded-full"
                      style={{
                        left: `${(priceRange[0] / maxPrice) * 100}%`,
                        right: `${100 - (priceRange[1] / maxPrice) * 100}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={minPrice}
                      max={maxPrice}
                      step={100000}
                      value={priceRange[0]}
                      onChange={(e) => {
                        const val = Math.min(
                          Number(e.target.value),
                          priceRange[1] - 100000
                        );
                        setPriceRange([val, priceRange[1]]);
                        setCurrentPage(1);
                      }}
                      className={`absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none ${
                        priceRange[0] > maxPrice - 500000 ? "z-30" : "z-20"
                      } [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-900 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer`}
                    />
                    <input
                      type="range"
                      min={minPrice}
                      max={maxPrice}
                      step={100000}
                      value={priceRange[1]}
                      onChange={(e) => {
                        const val = Math.max(
                          Number(e.target.value),
                          priceRange[0] + 100000
                        );
                        setPriceRange([priceRange[0], val]);
                        setCurrentPage(1);
                      }}
                      className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-900 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {pricePresets.map((preset) => {
                      const isPresetActive =
                        priceRange[0] === preset.range[0] &&
                        priceRange[1] === preset.range[1];
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setPriceRange(preset.range);
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            isPresetActive
                              ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === GRID PRODUK SALE === */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-3"
              >
                <div className="w-full h-[180px] bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="flex justify-between items-center mt-4">
                  <div className="w-1/3 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="w-9 h-9 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : currentItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mb-12 md:mb-16">
              {currentItems.map((item, index) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  index={index}
                  reviews={reviews}
                  productType="sale_products"
                />
              ))}
            </div>

            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={paginate}
              items={filteredProducts}
              itemsPerPage={itemsPerPage}
            />
          </>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-lg font-bold text-gray-400">
              {pick("Belum ada produk diskon yang cocok dengan filter ini", "No sale items match your current filters")}
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-4 text-[#FF5500] font-bold hover:underline"
            >
              {pick("Atur Ulang Semua Filter", "Reset All Filters")}
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

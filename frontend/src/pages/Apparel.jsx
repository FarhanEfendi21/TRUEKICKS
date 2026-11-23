import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useLenis } from "lenis/react";
import api from "../lib/api";
import { getEffectivePrice, formatRangeLabel } from "../lib/pricing";
import { useLanguage } from "../Context/LanguageContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ApparelBanner from "../components/ApparelBanner";
import SortDropdown from "../components/SortDropdown";
import Pagination from "../components/Pagination";
import ProductCard from "../components/ProductCard";

const APPAREL_CATEGORIES = [
  "All",
  "Hoodies",
  "T-Shirts",
  "Jackets",
  "Pants",
  "Jersey",
];

const SORT_OPTIONS = [
  { value: "price-asc", label: "Lowest Price" },
  { value: "price-desc", label: "Highest Price" },
  { value: "reviewed", label: "Most Reviewed" },
];

const PRICE_PRESETS = [
  { label: "< 1Jt", range: [0, 1000000] },
  { label: "1-2Jt", range: [1000000, 2000000] },
  { label: "2-3Jt", range: [2000000, 3000000] },
  { label: "> 3Jt", range: [3000000, 5000000] },
  { label: "All", range: [0, 5000000] },
];

export default function Apparel() {
  const location = useLocation();
  const lenis = useLenis();
  const { pick, t } = useLanguage();
  const productsGridRef = useRef(null);

  const sortOptions = useMemo(
    () => [
      { value: "price-asc", label: pick("Harga Terendah", "Lowest Price") },
      { value: "price-desc", label: pick("Harga Tertinggi", "Highest Price") },
      { value: "reviewed", label: pick("Paling Banyak Diulas", "Most Reviewed") },
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

  const displayApparelCategory = (name) => {
    if (name === "All") return t("common.all");
    const map = {
      hoodies: pick("Hoodie", "Hoodies"),
      "t-shirts": pick("Kaos", "T-Shirts"),
      jackets: pick("Jaket", "Jackets"),
      pants: pick("Celana", "Pants"),
      jersey: "Jersey",
    };
    return map[name.toLowerCase()] || name;
  };

  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchKeyword, setSearchKeyword] = useState(
    location.state?.keyword || ""
  );
  const [activeCategory, setActiveCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 5000000]);
  const [sortOption, setSortOption] = useState("price-asc");
  const [currentPage, setCurrentPage] = useState(1);

  const minPrice = 0;
  const maxPrice = 5000000;
  const itemsPerPage = 16;

  // Render-time sync when receiving keyword via router state
  const [lastLocationKey, setLastLocationKey] = useState(location.key);
  if (location.key !== lastLocationKey) {
    setLastLocationKey(location.key);
    if (location.state?.keyword) {
      setSearchKeyword(location.state.keyword);
      setActiveCategory("All");
      setCurrentPage(1);
    }
  }

  useEffect(() => {
    if (location.state) {
      window.scrollTo(0, 0);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [apparelRes, reviewsRes] = await Promise.all([
          api.get("/api/apparel"),
          api.get("/api/all-reviews"),
        ]);
        setProducts(apparelRes.data || []);
        setReviews(reviewsRes.data || []);
      } catch (error) {
        console.error("Failed to fetch apparel:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const categoryFacets = useMemo(() => {
    return APPAREL_CATEGORIES.map((cat) => {
      if (cat === "All") {
        return { name: cat, count: products.length };
      }
      const count = products.filter(
        (item) => (item.category || "").toLowerCase() === cat.toLowerCase()
      ).length;
      return { name: cat, count };
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeCategory !== "All") {
      const lowerCat = activeCategory.toLowerCase();
      result = result.filter(
        (item) => (item.category || "").toLowerCase() === lowerCat
      );
    }

    if (searchKeyword) {
      const lowerKeyword = searchKeyword.toLowerCase();
      result = result.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(lowerKeyword) ||
          (item.category || "").toLowerCase().includes(lowerKeyword)
      );
    }

    result = result.filter((item) => {
      const price = getEffectivePrice(item);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    const sorted = [...result];
    if (sortOption === "price-asc") {
      sorted.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
    } else if (sortOption === "price-desc") {
      sorted.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
    } else if (sortOption === "reviewed") {
      sorted.sort((a, b) => {
        const aReviews = reviews.filter(
          (r) =>
            String(r.product_id) === String(a.id) &&
            r.product_type === "apparel"
        ).length;
        const bReviews = reviews.filter(
          (r) =>
            String(r.product_id) === String(b.id) &&
            r.product_type === "apparel"
        ).length;
        return bReviews - aReviews;
      });
    }

    return sorted;
  }, [products, reviews, activeCategory, searchKeyword, priceRange, sortOption]);

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
    if (searchKeyword) {
      chips.push({
        key: "keyword",
        label: `${pick("Cari", "Search")}: "${searchKeyword}"`,
        clear: () => {
          setSearchKeyword("");
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
  }, [activeCategory, searchKeyword, priceRange, pick]);

  const resetAllFilters = () => {
    setActiveCategory("All");
    setPriceRange([minPrice, maxPrice]);
    setSortOption("price-asc");
    setSearchKeyword("");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const indexOfLastItem = safePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

  const scrollToProducts = () => {
    if (lenis && productsGridRef.current) {
      lenis.scrollTo(productsGridRef.current, { offset: -96 });
    } else {
      productsGridRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    scrollToProducts();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-poppins transition-colors duration-300">
      <Navbar />

      <div className="pt-24 md:pt-32 pb-32 md:pb-20 max-w-7xl mx-auto px-4 md:px-6">
        {/* === APPAREL BANNER === */}
        <ApparelBanner
          searchKeyword={searchKeyword}
          onShopNow={scrollToProducts}
        />

        {/* === UNIFIED FILTER & SORT TOOLBAR === */}
        <div ref={productsGridRef} className="scroll-mt-28 mb-6 md:mb-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Left: Expandable Filter Toggle + Active Count Badge */}
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

            {/* Right: Shared Minimalist Sort Dropdown */}
            <SortDropdown
              options={sortOptions}
              value={sortOption}
              ariaLabel={pick("Urutkan pakaian", "Sort apparel")}
              onChange={(val) => {
                setSortOption(val);
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-3 h-3 opacity-60"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
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

          {/* Expandable Multi-Facet Filter Panel */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              showFilters ? "max-h-[700px] opacity-100 mt-3" : "max-h-0 opacity-0"
            }`}
          >
            <div className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg dark:shadow-none">
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
                            setSearchKeyword("");
                            setCurrentPage(1);
                          }}
                          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border inline-flex items-center gap-1.5 ${
                            isActive
                              ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                        >
                          <span>{displayApparelCategory(cat.name)}</span>
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

                {/* Price Range */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-[#FF5500]" />
                    {pick("Rentang Harga", "Price Range")}
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
                      step={50000}
                      value={priceRange[0]}
                      onChange={(e) => {
                        const val = Math.min(
                          Number(e.target.value),
                          priceRange[1] - 50000
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
                      step={50000}
                      value={priceRange[1]}
                      onChange={(e) => {
                        const val = Math.max(
                          Number(e.target.value),
                          priceRange[0] + 50000
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

        {/* === PRODUCT GRID === */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-3"
              >
                <div className="w-full h-[220px] bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
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
                  productType="apparel"
                />
              ))}
            </div>

            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={paginate}
              items={filteredProducts}
              itemsPerPage={itemsPerPage}
              totalItems={filteredProducts.length}
              itemLabel="apparel"
            />
          </>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-lg font-bold text-gray-400">
              {pick("Belum ada pakaian yang cocok dengan filter ini", "No apparel matches your current filters")}
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

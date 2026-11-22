import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLenis } from "lenis/react";
import api from "../lib/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SneakersBanner from "../components/SneakersBanner";
import Pagination from "../components/Pagination";
import ProductCard from "../components/ProductCard";

const BRAND_CATEGORIES = [
  "All",
  "Nike",
  "Adidas",
  "New Balance",
  "Puma",
  "Converse",
  "Vans",
  "Salomon",
  "ASICS",
];

export default function Sneakers() {
  const location = useLocation();
  const lenis = useLenis();
  const [searchKeyword, setSearchKeyword] = useState(location.state?.keyword || "");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(() => {
    if (location.state?.brand) {
      return (
        BRAND_CATEGORIES.find(
          (b) => b.toLowerCase() === location.state.brand.toLowerCase()
        ) || location.state.brand
      );
    }
    return location.state?.category || "All";
  });
  const [activeTypeFilter, setActiveTypeFilter] = useState(
    location.state?.typeFilter || "All Types"
  );
  const [showFilters, setShowFilters] = useState(false);
  const [reviews, setReviews] = useState([]);

  // --- DATA FILTER ---
  const brandCategories = BRAND_CATEGORIES;
  const [shoeTypes, setShoeTypes] = useState([
    "All Types",
    "Running",
    "Basketball",
    "Lifestyle",
    "Skateboarding",
    "Training",
    "Sandals",
  ]);

  // --- STATE PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 16;

  // --- STATE PRICE RANGE ---
  const [priceRange, setPriceRange] = useState([0, 5000000]);
  const minPrice = 0;
  const maxPrice = 5000000;

  // --- STATE SORT ---
  const [sortOption, setSortOption] = useState("price-asc");
  const sortOptions = [
    { value: "price-asc", label: "Price ↑" },
    { value: "price-desc", label: "Price ↓" },
    { value: "reviewed", label: "Reviewed" },
  ];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  // --- USE EFFECT: FETCH PRODUCTS ONCE ON MOUNT (AND DERIVE CATEGORIES) ---
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get("/api/sneakers");
        const items = response.data || [];
        setProducts(items);

        const uniqueTypes = [
          "All Types",
          ...new Set(items.map((item) => item.categories).filter(Boolean)),
        ];
        if (uniqueTypes.length > 1) {
          setShoeTypes(uniqueTypes);
        }
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // --- USE EFFECT: FETCH ALL REVIEWS ---
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await api.get("/api/all-reviews");
        setReviews(response.data || []);
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      }
    };
    fetchReviews();
  }, []);

  // --- USE EFFECT: SYNC FILTER STATE FROM NAVBAR / SEARCH NAVIGATION ---
  useEffect(() => {
    if (location.state) {
      if (location.state.typeFilter) {
        setActiveTypeFilter(location.state.typeFilter);
        setActiveCategory("All");
        setSearchKeyword("");
      } else if (location.state.category) {
        setActiveCategory(location.state.category);
        setActiveTypeFilter("All Types");
        setSearchKeyword("");
      } else if (location.state.brand) {
        const matchedBrand =
          BRAND_CATEGORIES.find(
            (b) => b.toLowerCase() === location.state.brand.toLowerCase()
          ) || location.state.brand;
        setActiveCategory(matchedBrand);
        setActiveTypeFilter("All Types");
        setSearchKeyword("");
      } else if (location.state.keyword) {
        setActiveCategory("All");
        setActiveTypeFilter("All Types");
        setSearchKeyword(location.state.keyword);
      }

      // Reset ke halaman 1 setiap kali filter berubah
      setCurrentPage(1);
      window.scrollTo(0, 0);
      // Clear state agar refresh tidak re-apply filter
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // --- USE EFFECT: APPLY CLIENT-SIDE FILTERS & SORT WITHOUT REFETCH ---
  useEffect(() => {
    let result = products;

    // 1. Filter Berdasarkan Brand
    if (activeCategory !== "All") {
      const lowerBrand = activeCategory.toLowerCase();
      result = result.filter(
        (item) =>
          (item.category || "").toLowerCase().includes(lowerBrand) ||
          (item.name || "").toLowerCase().includes(lowerBrand)
      );
    }

    // 2. Filter Berdasarkan Tipe Sepatu
    if (activeTypeFilter !== "All Types") {
      const lowerShoeType = activeTypeFilter.toLowerCase();
      result = result.filter((item) => {
        const itemCat = (item.categories || "").toLowerCase();
        return itemCat.includes(lowerShoeType);
      });
    }

    // 3. Filter Berdasarkan Keyword Pencarian
    if (searchKeyword) {
      const lowerKeyword = searchKeyword.toLowerCase();
      result = result.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(lowerKeyword) ||
          (item.description || "").toLowerCase().includes(lowerKeyword) ||
          (item.category || "").toLowerCase().includes(lowerKeyword) ||
          (item.categories || "").toLowerCase().includes(lowerKeyword)
      );
    }

    // 4. Filter Berdasarkan Price Range
    result = result.filter(
      (item) => item.price >= priceRange[0] && item.price <= priceRange[1]
    );

    // 5. Sort
    switch (sortOption) {
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "reviewed":
        result = [...result].sort((a, b) => {
          const aReviews = reviews.filter(
            (r) => String(r.product_id) === String(a.id) && r.product_type === "sneakers"
          ).length;
          const bReviews = reviews.filter(
            (r) => String(r.product_id) === String(b.id) && r.product_type === "sneakers"
          ).length;
          return bReviews - aReviews;
        });
        break;
      default:
        result = [...result].sort((a, b) => b.id - a.id);
        break;
    }

    setFilteredProducts(result);
    setCurrentPage(1);
  }, [products, searchKeyword, activeCategory, activeTypeFilter, priceRange, sortOption, reviews]);

  // Handler untuk Filter Brand
  const handleBrandFilter = (category) => {
    setActiveCategory(category);
  };

  // Handler untuk Filter Tipe Sepatu
  const handleTypeFilter = (type) => {
    setActiveTypeFilter(type);
  };

  // Handler untuk Price Range
  const handlePriceChange = (newRange) => {
    setPriceRange(newRange);
  };

  // Handler untuk Sort
  const handleSortChange = (sort) => {
    setSortOption(sort);
  };

  // Format price for display
  const formatPriceLabel = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}Jt`;
    }
    return `${(value / 1000).toFixed(0)}K`;
  };

  // --- LOGIKA PAGINATION ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProducts.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Fungsi Ganti Halaman
  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    if (lenis) {
      lenis.scrollTo(0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-poppins transition-colors duration-300">
      <Navbar />
      <div className="pt-24 md:pt-32 pb-32 md:pb-20 max-w-7xl mx-auto px-4 md:px-6">

        {/* TRUEKICKS BANNER - BACK IN BLACK STYLE */}
        <SneakersBanner searchKeyword={searchKeyword} />

        {/* ========================================================
            MODERN COMPACT FILTER (RESPONSIVE)
        ======================================================== */}
        {/* Kurangi margin bawah container utama dari mb-8 jadi mb-4 di mobile */}
        <div className="lg:col-span-3 mb-4 lg:mb-8">
          {/* 1. TOP BAR (Control & Status) */}
          {/* UBAH 2: Kurangi margin bawah tombol toggle dari mb-4 jadi mb-2 */}
          <div className="flex items-center justify-between mb-2 lg:mb-4 px-1">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="group flex items-center gap-3 text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              <div
                className={`p-2 rounded-full transition-colors ${showFilters
                  ? "bg-black dark:bg-[#FF5500] text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
              >
                {/* Icon Filter */}
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
                  <line x1="4" y1="21" x2="4" y2="14"></line>
                  <line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line>
                  <line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line>
                  <line x1="9" y1="8" x2="15" y2="8"></line>
                  <line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
              </div>
              <div className="text-left">
                <span className="block font-bold text-sm tracking-wide leading-none mb-1">
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {filteredProducts.length} Results
                </span>
              </div>
            </button>

            {/* Tombol Reset (Opsional) - Tampil jika ada filter aktif */}
            {(activeCategory !== "All" || activeTypeFilter !== "All Types" || priceRange[0] !== minPrice || priceRange[1] !== maxPrice || sortOption !== "price-asc" || searchKeyword !== "") && (
              <button
                onClick={() => {
                  setActiveCategory("All");
                  setActiveTypeFilter("All Types");
                  setPriceRange([minPrice, maxPrice]);
                  setSortOption("price-asc");
                  setSearchKeyword("");
                  setCurrentPage(1);
                }}
                className="text-[10px] font-bold text-red-500 hover:text-red-700 underline underline-offset-2"
              >
                Reset All
              </button>
            )}
          </div>

          {/* 2. EXPANDABLE FILTER PANEL */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${showFilters ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
              }`}
          >
            <div className="bg-white dark:bg-gray-900 p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg space-y-6">

              {/* ROW 1: Category & Brand side by side on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* CATEGORY */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-[#FF5500]"></span>
                    Category
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {shoeTypes.map((typeCat) => {
                      const isActive = activeTypeFilter === typeCat;
                      return (
                        <button
                          key={typeCat}
                          onClick={() => handleTypeFilter(typeCat)}
                          className={`
                            px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                            ${isActive
                              ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                            }
                          `}
                        >
                          {typeCat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* BRAND */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-[#FF5500]"></span>
                    Brand
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {brandCategories.map((cat) => {
                      const isActive = activeCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => handleBrandFilter(cat)}
                          className={`
                            px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                            ${isActive
                              ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                            }
                          `}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px w-full bg-gray-100 dark:bg-gray-800"></div>

              {/* ROW 2: Price Range & Sort side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* PRICE RANGE */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-[#FF5500]"></span>
                    Price Range
                  </h3>

                  {/* Price Labels */}
                  <div className="flex justify-between mb-3 text-sm font-bold text-gray-900 dark:text-white">
                    <span>Rp {formatPriceLabel(priceRange[0])}</span>
                    <span>Rp {formatPriceLabel(priceRange[1])}</span>
                  </div>

                  {/* Slider Track */}
                  <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4">
                    <div
                      className="absolute h-full bg-gray-900 dark:bg-[#FF5500] rounded-full"
                      style={{
                        left: `${(priceRange[0] / maxPrice) * 100}%`,
                        right: `${100 - (priceRange[1] / maxPrice) * 100}%`
                      }}
                    ></div>
                    <input
                      type="range"
                      min={minPrice}
                      max={maxPrice}
                      step={100000}
                      value={priceRange[0]}
                      onChange={(e) => {
                        const value = Math.min(Number(e.target.value), priceRange[1] - 100000);
                        handlePriceChange([value, priceRange[1]]);
                      }}
                      className={`absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none ${priceRange[0] > maxPrice - 500000 ? "z-30" : "z-20"} [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-900 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer`}
                    />
                    <input
                      type="range"
                      min={minPrice}
                      max={maxPrice}
                      step={100000}
                      value={priceRange[1]}
                      onChange={(e) => {
                        const value = Math.max(Number(e.target.value), priceRange[0] + 100000);
                        handlePriceChange([priceRange[0], value]);
                      }}
                      className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-900 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer"
                    />
                  </div>

                  {/* Quick Price Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "< 1Jt", range: [0, 1000000] },
                      { label: "1-2Jt", range: [1000000, 2000000] },
                      { label: "2-3Jt", range: [2000000, 3000000] },
                      { label: "> 3Jt", range: [3000000, 5000000] },
                      { label: "All", range: [0, 5000000] },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() => handlePriceChange(item.range)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${priceRange[0] === item.range[0] && priceRange[1] === item.range[1]
                          ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SORT BY */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-[#FF5500]"></span>
                    Sort By
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {sortOptions.map((option) => {
                      const isActive = sortOption === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => handleSortChange(option.value)}
                          className={`
                            px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                            ${isActive
                              ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                            }
                          `}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* GRID PRODUK */}
        {loading ? (
          // SKELETON LOADING (Enhanced)
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-3"
              >
                <div className="w-full h-[180px] bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
                <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                <div className="flex justify-between items-center mt-4">
                  <div className="w-1/3 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                  <div className="w-9 h-9 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
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
                  productType="sneakers"
                />
              ))}
            </div>
            {/* === PAGINATION CONTROLS === */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={paginate}
              items={filteredProducts}
              itemsPerPage={itemsPerPage}
              totalItems={filteredProducts.length}
              itemLabel="sneakers"
            />
          </>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
            {" "}
            <p className="text-xl font-bold text-gray-400">
              No sneakers found for "{activeCategory}"
            </p>
            {" "}
            <button
              onClick={() => handleBrandFilter("All")}
              className="mt-4 text-[#FF5500] font-bold hover:underline"
            >
              View All Sneakers
            </button>
            {" "}
          </div>
        )}
        {" "}
      </div>
      <Footer />
    </div>
  );
}
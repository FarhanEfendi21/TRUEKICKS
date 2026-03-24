import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SneakersBanner from "../components/SneakersBanner";
import LazyImage from "../components/LazyImage";
import { supabase } from "../lib/supabaseClient";
import Pagination from "../components/Pagination";
import ProductCard from "../components/ProductCard";

 

export default function Sneakers() {
  const location = useLocation();
  const [searchKeyword, setSearchKeyword] = useState("");
  const initialTypeFilter = location.state?.typeFilter || "All Types";
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTypeFilter, setActiveTypeFilter] = useState(initialTypeFilter);
  const [showFilters, setShowFilters] = useState(false);
  const [reviews, setReviews] = useState([]);
  const navigate = useNavigate();

  // --- DATA FILTER ---F
  const brandCategories = [
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

  // --- FUNGSI UTAMA UNTUK FILTERING SIMULTAN ---
  const applyFilter = (list, keyword, brand, shoeType, priceMin, priceMax, sort) => {
    let result = list;

    // 1. Filter Berdasarkan Brand
    if (brand !== "All") {
      const lowerBrand = brand.toLowerCase();
      result = result.filter(
        (item) =>
          (item.category || "").toLowerCase().includes(lowerBrand) ||
          (item.name || "").toLowerCase().includes(lowerBrand)
      );
    }

    // 2. Filter Berdasarkan Tipe Sepatu
    if (shoeType !== "All Types") {
      const lowerShoeType = shoeType.toLowerCase();
      result = result.filter((item) => {
        const itemCat = (item.categories || "").toLowerCase();
        return itemCat.includes(lowerShoeType);
      });
    }

    // 3. Filter Berdasarkan Keyword Pencarian
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
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
      (item) => item.price >= priceMin && item.price <= priceMax
    );

    // 5. Sort
    switch (sort) {
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "reviewed":
        // Will be handled separately with reviews data
        break;
      case "newest":
      default:
        result = [...result].sort((a, b) => b.id - a.id);
        break;
    }

    return result;
  };
  // -------------------------------------

  // --- USE EFFECT: FETCH KATEGORI DARI SUPABASE ---
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from("sneakers")
          .select("categories")
          .not("categories", "is", null);

        if (error) throw error;

        const allTypes = data.map((item) => item.categories);
        const uniqueTypes = ["All Types", ...new Set(allTypes)].filter(
          (name) => name
        );

        setShoeTypes(uniqueTypes);
      } catch (error) {
        console.error("Gagal mengambil kategori:", error);
        setShoeTypes([
          "All Types",
          "Running",
          "Basketball",
          "Lifestyle",
          "Skateboarding",
          "Training",
          "Sandals",
        ]);
      }
    };
    fetchCategories();
  }, []);

  // --- USE EFFECT: FETCH PRODUCTS & APPLY INITIAL FILTER ---
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // 1. Ambil URL Backend dari Environment Variable
        const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

        // 2. Gunakan URL dinamis
        const response = await axios.get(`${API_URL}/api/sneakers`);

        const fetchedProducts = response.data;
        setProducts(fetchedProducts);

        // Logic filter tetap sama
        const initialFiltered = applyFilter(
          fetchedProducts,
          searchKeyword,
          activeCategory,
          initialTypeFilter,
          priceRange[0],
          priceRange[1],
          sortOption
        );
        setFilteredProducts(initialFiltered);
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
    // Pastikan dependency array sudah sesuai kebutuhan logic kamu
  }, [searchKeyword, initialTypeFilter, activeCategory]);

  // --- USE EFFECT: FETCH ALL REVIEWS ---
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
        const response = await axios.get(`${API_URL}/api/all-reviews`);
        console.log("Fetched reviews:", response.data);
        setReviews(response.data || []);
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      }
    };
    fetchReviews();
  }, []);

  useEffect(() => {
    if (location.state) {
      // Jika ada filter kategori (misal: Running, Basketball)
      if (location.state.category) {
        setActiveCategory(location.state.category);
        setSearchKeyword(""); // Reset keyword
      }
      // Jika ada filter brand atau model (misal: Nike, Air Jordan)
      else if (location.state.brand) {
        setActiveCategory("All"); // Reset kategori
        setSearchKeyword(location.state.brand);
      }
      // Jika ada keyword umum (Search bar)
      else if (location.state.keyword) {
        setActiveCategory("All");
        setSearchKeyword(location.state.keyword);
      }

      // Reset ke halaman 1 setiap kali filter berubah
      setCurrentPage(1);
      window.scrollTo(0, 0);
      // Clear state agar refresh tidak re-apply filter
      window.history.replaceState({}, document.title);
    }
  }, [location.state]); // Jalankan setiap kali lokasi/state berubah

  // Handler untuk Filter Brand
  const handleBrandFilter = (category) => {
    setActiveCategory(category);
    setCurrentPage(1);
    const result = applyFilter(
      products,
      searchKeyword,
      category,
      activeTypeFilter,
      priceRange[0],
      priceRange[1],
      sortOption
    );
    setFilteredProducts(result);
  };

  // Handler untuk Filter Tipe Sepatu
  const handleTypeFilter = (type) => {
    setActiveTypeFilter(type);
    setCurrentPage(1);
    const result = applyFilter(
      products,
      searchKeyword,
      activeCategory,
      type,
      priceRange[0],
      priceRange[1],
      sortOption
    );
    setFilteredProducts(result);
  };

  // Handler untuk Price Range
  const handlePriceChange = (newRange) => {
    setPriceRange(newRange);
    setCurrentPage(1);
    const result = applyFilter(
      products,
      searchKeyword,
      activeCategory,
      activeTypeFilter,
      newRange[0],
      newRange[1],
      sortOption
    );
    setFilteredProducts(result);
  };

  // Handler untuk Sort
  const handleSortChange = (sort) => {
    setSortOption(sort);
    setCurrentPage(1);
    let result = applyFilter(
      products,
      searchKeyword,
      activeCategory,
      activeTypeFilter,
      priceRange[0],
      priceRange[1],
      sort
    );

    // Handle "reviewed" sort separately (needs reviews data)
    if (sort === "reviewed") {
      result = [...result].sort((a, b) => {
        const aReviews = reviews.filter(r => String(r.product_id) === String(a.id)).length;
        const bReviews = reviews.filter(r => String(r.product_id) === String(b.id)).length;
        return bReviews - aReviews; // Products with more reviews first
      });
    }

    setFilteredProducts(result);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-poppins transition-colors duration-300">
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
              className="group flex items-center gap-3 text-gray-900 hover:text-orange-600 transition-colors"
            >
              <div
                className={`p-2 rounded-full transition-colors ${showFilters
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600"
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
            {(activeCategory !== "All" || activeTypeFilter !== "All Types" || priceRange[0] !== minPrice || priceRange[1] !== maxPrice || sortOption !== "newest") && (
              <button
                onClick={() => {
                  setActiveCategory("All");
                  setActiveTypeFilter("All Types");
                  setPriceRange([minPrice, maxPrice]);
                  setSortOption("newest");
                  setCurrentPage(1);
                  const result = applyFilter(products, searchKeyword, "All", "All Types", minPrice, maxPrice, "newest");
                  setFilteredProducts(result);
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
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-lg space-y-6">

              {/* ROW 1: Category & Brand side by side on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* CATEGORY */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900"></span>
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
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
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
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900"></span>
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
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
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
              <div className="h-px w-full bg-gray-100"></div>

              {/* ROW 2: Price Range & Sort side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* PRICE RANGE */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900"></span>
                    Price Range
                  </h3>

                  {/* Price Labels */}
                  <div className="flex justify-between mb-3 text-sm font-bold text-gray-900">
                    <span>Rp {formatPriceLabel(priceRange[0])}</span>
                    <span>Rp {formatPriceLabel(priceRange[1])}</span>
                  </div>

                  {/* Slider Track */}
                  <div className="relative h-2 bg-gray-200 rounded-full mb-4">
                    <div
                      className="absolute h-full bg-gray-900 rounded-full"
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
                      className="absolute w-full h-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
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
                      className="absolute w-full h-full appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
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
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
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
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-900"></span>
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
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
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
                className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3"
              >
                <div className="w-full h-[180px] bg-gray-200 rounded-2xl animate-pulse"></div>
                <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-1/2 h-3 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex justify-between items-center mt-4">
                  <div className="w-1/3 h-5 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-9 h-9 bg-gray-200 rounded-xl animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : currentItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mb-32">
              {currentItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  navigate={navigate}
                  reviews={reviews}
                />
              ))}
            </div>
            {/* === PAGINATION CONTROLS === */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={paginate}
            />
          </>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
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
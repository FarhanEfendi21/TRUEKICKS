import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ApparelBanner from "../components/ApparelBanner";
import Pagination from "../components/Pagination";
import ProductCard from "../components/ProductCard";
import { supabase } from "../lib/supabaseClient";

 

// =========================================
// MAIN COMPONENT: APPAREL
// =========================================
export default function Apparel() {
  const location = useLocation();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  // --- BARU: State untuk menyembunyikan/menampilkan filter ---
  const [showFilters, setShowFilters] = useState(false);
  const [reviews, setReviews] = useState([]);

  const navigate = useNavigate();

  // --- STATE PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 16; // Batas 16 item per halaman

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

  // Filter Tab
  const categories = [
    "All",
    "Hoodies",
    "T-Shirts",
    "Jackets",
    "Pants",
    "Jersey",
  ];

  useEffect(() => {
    const fetchApparel = async () => {
      try {
        // 1. Ambil URL dasar dari Environment Variable
        const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

        // 2. Gunakan URL tersebut untuk memanggil endpoint apparel
        const response = await axios.get(`${API_URL}/api/apparel`);

        setProducts(response.data);
        setFilteredProducts(response.data);
      } catch (error) {
        console.error("Gagal mengambil data apparel:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchApparel();
  }, []);

  // --- USE EFFECT: FETCH ALL REVIEWS ---
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
        const response = await axios.get(`${API_URL}/api/all-reviews`);
        setReviews(response.data || []);
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      }
    };
    fetchReviews();
  }, []);

  // Handle location state (from search bar)
  useEffect(() => {
    if (location.state?.keyword) {
      setSearchKeyword(location.state.keyword);
      setActiveCategory("All");
    }
  }, [location.state]);

  // Apply filter when any filter criteria changes
  useEffect(() => {
    let result = products;

    // Filter by category
    if (activeCategory !== "All") {
      result = result.filter((item) => item.category === activeCategory);
    }

    // Filter by search keyword (name only)
    if (searchKeyword) {
      const lowerKeyword = searchKeyword.toLowerCase();
      result = result.filter((item) =>
        (item.name || "").toLowerCase().includes(lowerKeyword)
      );
    }

    // Filter by price range
    result = result.filter(
      (item) => item.price >= priceRange[0] && item.price <= priceRange[1]
    );

    // Sort
    switch (sortOption) {
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "reviewed":
        result = [...result].sort((a, b) => {
          const aReviews = reviews.filter(r => String(r.product_id) === String(a.id)).length;
          const bReviews = reviews.filter(r => String(r.product_id) === String(b.id)).length;
          return bReviews - aReviews;
        });
        break;
      default:
        break;
    }

    setFilteredProducts(result);
    setCurrentPage(1);
  }, [products, activeCategory, searchKeyword, priceRange, sortOption, reviews]);

  // Filter by category tab
  const handleFilter = (category) => {
    setActiveCategory(category);
    setSearchKeyword(""); // Clear search when changing category
    setCurrentPage(1);
  };

  // Handler untuk Price Range
  const handlePriceChange = (newRange) => {
    setPriceRange(newRange);
    setCurrentPage(1);
  };

  // Handler untuk Sort
  const handleSortChange = (sort) => {
    setSortOption(sort);
    setCurrentPage(1);
  };

  // Format price for display
  const formatPriceLabel = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}Jt`;
    }
    return `${(value / 1000).toFixed(0)}K`;
  };

  // Handler untuk Reset All Filters
  const handleResetFilters = () => {
    setActiveCategory("All");
    setPriceRange([0, maxPrice]);
    setSortOption("price-asc");
    setSearchKeyword("");
    setCurrentPage(1);
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

      <div className="pt-32 pb-20 max-w-7xl mx-auto px-6">
        {/* TRUEKICKS BANNER - BACK IN BLACK STYLE */}
        <ApparelBanner />

        {/* 1. CONTAINER UTAMA (Compact Spacing) */}
        <div className="lg:col-span-3 mb-4 lg:mb-8">
          {/* 2. TOP BAR (Clean Toggle Style) */}
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
                {/* Icon Filter Lines */}
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
                  {showFilters ? "Hide Categories" : "Show Categories"}
                </span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  {filteredProducts.length} Items
                </span>
              </div>
            </button>

            {/* Reset All Button */}
            <button
              onClick={handleResetFilters}
              className="text-sm font-bold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Reset All
            </button>
          </div>

          {/* 3. EXPANDABLE PANEL (Responsive Scroll) */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${showFilters ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
              }`}
          >
            <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-100/50">
              {/* Header Kategori */}
              <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-2 md:mb-4 flex items-center gap-2 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                Category
              </h3>
              <div className="flex flex-nowrap overflow-x-auto md:overflow-visible md:flex-wrap gap-2.5 pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar snap-x">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => handleFilter(cat)}
                      className={`
                                        flex-shrink-0 snap-start
                                        px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border whitespace-nowrap
                                        ${isActive
                          ? /* Active: Solid Black (Sesuai tema Category) */
                          "bg-black text-white border-black shadow-lg shadow-black/20 transform scale-105"
                          : /* Inactive: Clean White */
                          "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                        }
                                    `}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* PRICE RANGE & SORT BY - Row Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-100">
                {/* PRICE RANGE */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                    Price Range
                  </h3>

                  {/* Price Labels */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-gray-900">Rp {formatPriceLabel(priceRange[0])}</span>
                    <span className="text-sm font-bold text-gray-900">Rp {formatPriceLabel(priceRange[1])}</span>
                  </div>

                  {/* Dual Range Slider */}
                  <div className="relative h-2 mb-4">
                    <div className="absolute w-full h-full bg-gray-200 rounded-full"></div>
                    <div
                      className="absolute h-full bg-gradient-to-r from-gray-800 to-black rounded-full"
                      style={{
                        left: `${(priceRange[0] / maxPrice) * 100}%`,
                        right: `${100 - (priceRange[1] / maxPrice) * 100}%`,
                      }}
                    ></div>
                    {/* Left Thumb */}
                    <div
                      className="absolute w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow-md -translate-y-1/4 cursor-pointer"
                      style={{ left: `calc(${(priceRange[0] / maxPrice) * 100}% - 8px)` }}
                    ></div>
                    {/* Right Thumb */}
                    <div
                      className="absolute w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow-md -translate-y-1/4 cursor-pointer"
                      style={{ left: `calc(${(priceRange[1] / maxPrice) * 100}% - 8px)` }}
                    ></div>
                    <input
                      type="range"
                      min={minPrice}
                      max={maxPrice}
                      step={50000}
                      value={priceRange[0]}
                      onChange={(e) => {
                        const value = Math.min(Number(e.target.value), priceRange[1] - 50000);
                        handlePriceChange([value, priceRange[1]]);
                      }}
                      className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <input
                      type="range"
                      min={minPrice}
                      max={maxPrice}
                      step={50000}
                      value={priceRange[1]}
                      onChange={(e) => {
                        const value = Math.max(Number(e.target.value), priceRange[0] + 50000);
                        handlePriceChange([priceRange[0], value]);
                      }}
                      className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                    />
                  </div>

                  {/* Quick Price Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "< 1Jt", range: [0, 1000000] },
                      { label: "1-2Jt", range: [1000000, 2000000] },
                      { label: "2-3Jt", range: [2000000, 3000000] },
                      { label: "> 3Jt", range: [3000000, maxPrice] },
                      { label: "All", range: [0, maxPrice] },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => handlePriceChange(preset.range)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${priceRange[0] === preset.range[0] && priceRange[1] === preset.range[1]
                          ? "bg-black text-white border-black"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                          }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SORT BY */}
                <div>
                  <h3 className="font-bold text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                    Sort By
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSortChange(option.value)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${sortOption === option.value
                          ? "bg-black text-white border-black shadow-lg shadow-black/20"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === PRODUCT GRID === */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3"
              >
                <div className="w-full h-[220px] bg-gray-200 rounded-2xl animate-pulse"></div>
                <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex items-center gap-1 mt-1">
                   <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse"></div>
                   <div className="w-8 h-3 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex justify-between items-center mt-4">
                   <div className="w-1/3 h-5 bg-gray-200 rounded animate-pulse"></div>
                   <div className="w-9 h-9 bg-gray-200 rounded-xl animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : currentItems.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-16">
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

            {/* === PAGINATION CONTROLS === */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={paginate}
            />
          </>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <p className="text-xl font-bold text-gray-400">
              No apparel found for "{activeCategory}"
            </p>
            <button
              onClick={() => handleFilter("All")}
              className="mt-4 text-[#FF5500] font-bold hover:underline"
            >
              View All Apparel
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

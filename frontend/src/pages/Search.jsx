import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import {
    hasActiveDiscount,
    getEffectivePrice,
    getDiscountPercentage,
    formatRupiahShort,
} from "../lib/pricing";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useLanguage } from "../Context/LanguageContext";

const normalizeName = (name) =>
    typeof name === "string" ? name.trim().toLowerCase().replace(/\s+/g, " ") : "";

export default function Search() {
    const location = useLocation();
    const navigate = useNavigate();
    const { pick, t } = useLanguage();
    const [searchParams] = useSearchParams();

    const keyword = (
        searchParams.get("q") ||
        location.state?.keyword ||
        ""
    ).trim();

    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("all");

    const openGlobalSearch = (initialQuery = "") => {
        window.dispatchEvent(
            new CustomEvent("truekicks:open-search", {
                detail: { query: initialQuery },
            })
        );
    };

    useEffect(() => {
        window.scrollTo(0, 0);
        setActiveFilter("all");
        if (!keyword) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        const fetchResults = async () => {
            setIsLoading(true);
            try {
                const [sneakersRes, apparelRes, saleRes] = await Promise.all([
                    api.get("/api/sneakers"),
                    api.get("/api/apparel"),
                    api.get("/api/sale"),
                ]);

                const lowerKeyword = keyword.toLowerCase();

                const filterProducts = (products, type) =>
                    products
                        .filter(
                            (p) =>
                                p.name?.toLowerCase().includes(lowerKeyword) ||
                                p.brand?.toLowerCase().includes(lowerKeyword) ||
                                p.category?.toLowerCase().includes(lowerKeyword)
                        )
                        .map((p) => ({ ...p, productType: type }));

                const sneakersMatches = filterProducts(sneakersRes.data || [], "sneakers");
                const apparelMatches = filterProducts(apparelRes.data || [], "apparel");
                const saleMatches = filterProducts(saleRes.data || [], "sale_products");

                setResults([...sneakersMatches, ...apparelMatches, ...saleMatches]);
            } catch (error) {
                console.error("Search error:", error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchResults();
    }, [keyword]);

    // Deduplicate overlapping sale items on the "All" tab while preserving each specific tab
    const deduplicatedAll = useMemo(() => {
        const seenNames = new Set();
        const unique = [];
        for (const item of results) {
            const key = normalizeName(item.name);
            if (key && seenNames.has(key)) continue;
            if (key) seenNames.add(key);
            unique.push(item);
        }
        return unique;
    }, [results]);

    const filteredResults =
        activeFilter === "all"
            ? deduplicatedAll
            : results.filter((r) => r.productType === activeFilter);

    const counts = {
        all: deduplicatedAll.length,
        sneakers: results.filter((r) => r.productType === "sneakers").length,
        apparel: results.filter((r) => r.productType === "apparel").length,
        sale_products: results.filter((r) => r.productType === "sale_products").length,
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950 font-poppins transition-colors duration-300">
            <Navbar />

            <main className="pt-28 md:pt-32 pb-24 max-w-7xl mx-auto px-4 md:px-8">
                {/* Header */}
                <div className="mb-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">
                        {keyword
                            ? pick("Hasil pencarian untuk", "Search results for")
                            : pick("Cari di TrueKicks", "Search TrueKicks")}
                    </p>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        {keyword ? `"${keyword}"` : pick("Temukan Pilihanmu", "Find Your Pair")}
                    </h1>
                    {keyword && !isLoading && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                            {counts.all}{" "}
                            {pick(
                                "produk ditemukan",
                                counts.all === 1 ? "product found" : "products found"
                            )}
                        </p>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {[
                        { key: "all", label: t("common.all") },
                        { key: "sneakers", label: t("nav.sneakers") },
                        { key: "apparel", label: t("nav.apparel") },
                        { key: "sale_products", label: t("nav.sale") },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveFilter(tab.key)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                                activeFilter === tab.key
                                    ? "bg-gray-900 dark:bg-[#FF5500] text-white"
                                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
                            }`}
                        >
                            {tab.label}
                            <span
                                className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                                    activeFilter === tab.key
                                        ? "bg-white/20 text-white"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                }`}
                            >
                                {counts[tab.key]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {[...Array(8)].map((_, i) => (
                            <div
                                key={i}
                                className="bg-white dark:bg-gray-900 rounded-3xl p-4 animate-pulse"
                            >
                                <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4" />
                                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4 mb-2" />
                                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && filteredResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mb-6">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-12 h-12 text-gray-300 dark:text-gray-600"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                                />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {t("search.noProductsFound")}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                            {keyword
                                ? pick(
                                      `Tidak ditemukan produk untuk "${keyword}". Coba kata kunci lain atau jelajahi koleksi kami.`,
                                      `We couldn't find any products matching "${keyword}". Try another keyword or browse our collections.`
                                  )
                                : pick(
                                      "Gunakan tombol pencarian di bilah navigasi atau tekan Ctrl+K untuk mulai mencari.",
                                      "Use the search button in the navigation bar or press Ctrl+K to start searching."
                                  )}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => openGlobalSearch("")}
                                className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                            >
                                {keyword
                                    ? pick("Cari Kata Kunci Lain", "Search Again")
                                    : pick("Buka Pencarian", "Open Search")}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/sneakers")}
                                className="px-6 py-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-full text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                {pick("Jelajahi Semua Produk", "Browse All Products")}
                            </button>
                        </div>
                    </div>
                )}

                {/* Results Grid */}
                {!isLoading && filteredResults.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {filteredResults.map((item) => (
                            <div
                                key={`${item.productType}-${item.id}`}
                                onClick={() =>
                                    navigate(`/product/${item.productType}/${item.id}`)
                                }
                                className="group bg-white dark:bg-gray-900 rounded-3xl p-4 cursor-pointer hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/40 transition-all duration-300 border border-transparent dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700"
                            >
                                {/* Product Type & Sale Badges */}
                                <div className="flex justify-between items-center mb-2">
                                    <span
                                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                                            item.productType === "sneakers"
                                                ? "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300"
                                                : item.productType === "apparel"
                                                ? "bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-300"
                                                : "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300"
                                        }`}
                                    >
                                        {item.productType === "sale_products"
                                            ? t("nav.sale")
                                            : item.productType === "apparel"
                                            ? t("nav.apparel")
                                            : t("nav.sneakers")}
                                    </span>
                                    {hasActiveDiscount(item) && (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FF5500] text-white">
                                            -{getDiscountPercentage(item)}%
                                        </span>
                                    )}
                                </div>

                                {/* Product Image */}
                                <div className="aspect-square bg-gray-50 dark:bg-gray-100 rounded-2xl flex items-center justify-center p-4 mb-4 overflow-hidden">
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="w-[85%] h-[85%] object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"
                                    />
                                </div>

                                {/* Product Info */}
                                <h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-white line-clamp-2 mb-1 group-hover:text-[#FF5500] transition-colors">
                                    {item.name}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-[#FF5500]">
                                        {formatRupiahShort(getEffectivePrice(item))}
                                    </p>
                                    {hasActiveDiscount(item) && (
                                        <p className="text-[11px] text-gray-400 line-through">
                                            {formatRupiahShort(item.price)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useLanguage } from "../Context/LanguageContext";
import {
    hasActiveDiscount,
    getEffectivePrice,
    formatRupiahShort,
} from "../lib/pricing";

export default function SearchBar({ onClose }) {
    const { t, pick } = useLanguage();
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const navigate = useNavigate();

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setQuery("");
                setResults([]);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape") {
                setIsOpen(false);
                setQuery("");
                setResults([]);
                onClose?.();
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    // Debounced live search across sneakers & apparel (prices already sale-synced by backend)
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const [sneakersRes, apparelRes] = await Promise.all([
                    api.get("/api/sneakers"),
                    api.get("/api/apparel"),
                ]);

                const lowerQuery = query.toLowerCase();

                const filterProducts = (products, type) =>
                    products
                        .filter(
                            (p) =>
                                p.name?.toLowerCase().includes(lowerQuery) ||
                                p.category?.toLowerCase().includes(lowerQuery)
                        )
                        .map((p) => ({ ...p, productType: type }));

                const allResults = [
                    ...filterProducts(sneakersRes.data || [], "sneakers"),
                    ...filterProducts(apparelRes.data || [], "apparel"),
                ].slice(0, 5);

                setResults(allResults);
            } catch (error) {
                console.error("Search error:", error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Navigate to dedicated /search page with keyword
    const handleSearch = (e) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (trimmed) {
            navigate(`/search?q=${encodeURIComponent(trimmed)}`, {
                state: { keyword: trimmed },
            });
            setQuery("");
            setIsOpen(false);
            setResults([]);
            onClose?.();
        }
    };

    const handleResultClick = (item) => {
        navigate(`/product/${item.productType}/${item.id}`);
        setQuery("");
        setIsOpen(false);
        setResults([]);
    };

    const closeSearch = () => {
        setIsOpen(false);
        setQuery("");
        setResults([]);
        onClose?.();
    };

    const suggestions = [
        { label: "Air Jordan", page: "sneakers" },
        { label: "New Balance", page: "sneakers" },
        { label: "Hoodie", page: "apparel" },
        { label: "Jacket", page: "apparel" },
    ];

    return (
        <div ref={containerRef} className="relative">
            {/* Search Icon Button (Always rendered on mobile; hidden on desktop when inline input is open) */}
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label={t("search.buttonLabel")}
                title={t("search.buttonLabel")}
                className={`${isOpen ? "lg:hidden" : ""} group p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white bg-gray-100/80 hover:bg-gray-200/80 dark:bg-gray-800/80 dark:hover:bg-gray-700/80 border border-gray-200/60 dark:border-gray-700/60 backdrop-blur-md rounded-full transition-all duration-200 active:scale-95`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5 transition-transform group-hover:scale-110"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                </svg>
            </button>

            {/* Expanded Search Input & Results (Overlay on mobile, inline popover on desktop) */}
            {isOpen && (
                <>
                    {/* Subtle mobile backdrop */}
                    <div
                        onClick={closeSearch}
                        className="fixed inset-0 top-16 bg-black/30 backdrop-blur-[2px] z-40 lg:hidden"
                    />

                    <div className="fixed top-[72px] left-4 right-4 z-50 lg:static lg:inset-auto lg:z-auto animate-fade-in">
                        <form onSubmit={handleSearch}>
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-2xl shadow-xl lg:shadow-lg shadow-gray-200/50 dark:shadow-black/40 border border-gray-200 dark:border-gray-700 focus-within:border-[#FF5500] focus-within:ring-2 focus-within:ring-orange-100 dark:focus-within:ring-orange-900/30 transition-all duration-200 px-4 py-2.5">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className="w-5 h-5 text-gray-400 flex-shrink-0"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                                    />
                                </svg>

                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={t("search.placeholder")}
                                    aria-label={t("search.placeholder")}
                                    className="flex-1 lg:w-64 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none font-medium"
                                />

                                {isLoading && (
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-[#FF5500] rounded-full animate-spin flex-shrink-0" />
                                )}

                                {query && !isLoading && (
                                    <button
                                        type="button"
                                        onClick={() => setQuery("")}
                                        aria-label={t("search.clearText")}
                                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
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
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={closeSearch}
                                    aria-label={t("search.closeSearch")}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
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
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </form>

                        {/* Dropdown Results */}
                        <div
                            data-lenis-prevent
                            className="mt-2.5 lg:absolute lg:top-full lg:right-0 lg:mt-3 w-full lg:w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-gray-200/50 dark:shadow-black/50 border border-gray-100 dark:border-gray-800 overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
                        >
                            {/* Live Search Results */}
                            {results.length > 0 && (
                                <div className="p-2">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold px-3 py-2">
                                        {t("search.productsHeading")}
                                    </p>
                                    <div className="space-y-1">
                                        {results.map((item) => {
                                            const isOnSale = hasActiveDiscount(item);
                                            const effectivePrice = getEffectivePrice(item);
                                            return (
                                                <button
                                                    key={`${item.productType}-${item.id}`}
                                                    type="button"
                                                    onClick={() => handleResultClick(item)}
                                                    className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors group text-left"
                                                >
                                                    {/* Light image surface so mix-blend-multiply stays crisp in dark mode */}
                                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
                                                        <img
                                                            src={item.image_url}
                                                            alt={item.name}
                                                            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform"
                                                        />
                                                    </div>

                                                    <div className="flex-grow min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-[#FF5500] transition-colors">
                                                            {item.name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                            <span
                                                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                                    item.productType === "sneakers"
                                                                        ? "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300"
                                                                        : "bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-300"
                                                                }`}
                                                            >
                                                                {item.productType === "sneakers"
                                                                    ? t("nav.sneakers")
                                                                    : t("nav.apparel")}
                                                            </span>
                                                            <span className="text-xs text-gray-700 dark:text-gray-200 font-bold">
                                                                {formatRupiahShort(effectivePrice)}
                                                            </span>
                                                            {isOnSale && (
                                                                <span className="text-[10px] text-gray-400 line-through">
                                                                    {formatRupiahShort(item.price)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        strokeWidth={2}
                                                        stroke="currentColor"
                                                        className="w-4 h-4 text-gray-300 group-hover:text-[#FF5500] group-hover:translate-x-1 transition-all flex-shrink-0"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                                        />
                                                    </svg>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSearch}
                                        className="w-full mt-1 py-2 text-xs font-bold text-[#FF5500] hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl transition-colors"
                                    >
                                        {t("search.viewAllResults", { query: query.trim() })}
                                    </button>
                                </div>
                            )}

                            {/* No Results */}
                            {query.trim().length >= 2 && results.length === 0 && !isLoading && (
                                <div className="p-6 text-center">
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={1.5}
                                            stroke="currentColor"
                                            className="w-6 h-6 text-gray-400"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                                            />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {t("search.noProductsFound")}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t("search.tryDifferent")}
                                    </p>
                                </div>
                            )}

                            {/* Quick Suggestions (when empty) */}
                            {query.trim().length < 2 && (
                                <div className="p-3">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold px-2 mb-2">
                                        {t("search.popularSearches")}
                                    </p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {suggestions.map((item) => (
                                            <button
                                                key={item.label}
                                                type="button"
                                                onClick={() => {
                                                    navigate(`/search?q=${encodeURIComponent(item.label)}`, {
                                                        state: { keyword: item.label },
                                                    });
                                                    closeSearch();
                                                }}
                                                className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors group"
                                            >
                                                <span className="group-hover:text-gray-950 dark:group-hover:text-white transition-colors truncate">
                                                    {item.label}
                                                </span>
                                                <span className="text-[9px] font-bold uppercase text-gray-400">
                                                    {item.page === "sneakers"
                                                        ? pick("SEP", "SNK")
                                                        : pick("PKN", "APP")}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

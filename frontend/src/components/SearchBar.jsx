import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const navigate = useNavigate();

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    onClose?.();
  }, [onClose]);

  // Focus input & lock scroll while search overlay is open
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Global keyboard shortcuts & programmatic trigger from pages (e.g. Search empty state)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closeSearch();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    const handleExternalOpen = (e) => {
      const nextQuery = typeof e?.detail?.query === "string" ? e.detail.query : "";
      if (nextQuery) setQuery(nextQuery);
      setIsOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("truekicks:open-search", handleExternalOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("truekicks:open-search", handleExternalOpen);
    };
  }, [closeSearch, isOpen]);

  // Debounced live search across sneakers & apparel
  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setResults([]);
      return undefined;
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
                p.brand?.toLowerCase().includes(lowerQuery) ||
                p.category?.toLowerCase().includes(lowerQuery)
            )
            .map((p) => ({ ...p, productType: type }));

        const allResults = [
          ...filterProducts(sneakersRes.data || [], "sneakers"),
          ...filterProducts(apparelRes.data || [], "apparel"),
        ].slice(0, 6);

        setResults(allResults);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [isOpen, query]);

  const handleSearch = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`, {
        state: { keyword: trimmed },
      });
      closeSearch();
    }
  };

  const handleResultClick = (item) => {
    navigate(`/product/${item.productType}/${item.id}`);
    closeSearch();
  };

  const suggestions = [
    { label: "Air Jordan", page: "sneakers" },
    { label: "New Balance", page: "sneakers" },
    { label: "Hoodie", page: "apparel" },
    { label: "Jacket", page: "apparel" },
  ];

  const searchOverlay =
    typeof document !== "undefined" && isOpen
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("search.buttonLabel")}
            className="fixed inset-0 z-[9995] flex items-start justify-center pt-16 sm:pt-24 px-4 font-poppins"
          >
            {/* Atmospheric Backdrop */}
            <div
              onClick={closeSearch}
              className="fixed inset-0 bg-black/45 dark:bg-black/65 backdrop-blur-[3px] animate-fade-in"
            />

            {/* Unified Centered Spotlight Card */}
            <div
              data-lenis-prevent
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-xl bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-2xl overflow-hidden animate-fade-in"
            >
              {/* Search Input Row */}
              <form
                onSubmit={handleSearch}
                className="flex items-center gap-3 px-4 sm:px-5 h-14 border-b border-gray-100 dark:border-gray-900"
              >
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
                  className="flex-1 min-w-0 bg-transparent text-sm sm:text-[15px] text-gray-950 dark:text-white placeholder:text-gray-400 focus:outline-none font-medium"
                />

                {isLoading && (
                  <div className="w-4 h-4 border-2 border-gray-200 dark:border-gray-700 border-t-gray-900 dark:border-t-white rounded-full animate-spin flex-shrink-0" />
                )}

                {query && !isLoading && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    aria-label={t("search.clearText")}
                    className="w-7 h-7 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-3.5 h-3.5"
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
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-950 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-600 transition-colors flex-shrink-0"
                >
                  ESC
                </button>
              </form>

              {/* Results / Suggestions Area */}
              <div className="max-h-[65vh] overflow-y-auto custom-scrollbar">
                {/* Live Results */}
                {results.length > 0 && (
                  <div className="p-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold px-3 py-1.5">
                      {t("search.productsHeading")}
                    </p>
                    <div className="divide-y divide-gray-100 dark:divide-gray-900">
                      {results.map((item) => {
                        const isOnSale = hasActiveDiscount(item);
                        const effectivePrice = getEffectivePrice(item);
                        return (
                          <button
                            key={`${item.productType}-${item.id}`}
                            type="button"
                            onClick={() => handleResultClick(item)}
                            className="w-full flex items-center gap-3.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/70 rounded-xl transition-colors group text-left"
                          >
                            <div className="w-12 h-12 bg-[#F6F6F6] dark:bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 p-1.5">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-950 dark:text-white truncate group-hover:text-[#FF5500] transition-colors">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs">
                                <span className="text-gray-400">
                                  {item.productType === "sneakers"
                                    ? t("nav.sneakers")
                                    : t("nav.apparel")}
                                </span>
                                <span className="text-gray-300 dark:text-gray-700">·</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                                  {formatRupiahShort(effectivePrice)}
                                </span>
                                {isOnSale && (
                                  <span className="text-[11px] text-gray-400 line-through tabular-nums">
                                    {formatRupiahShort(item.price)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.8}
                              stroke="currentColor"
                              className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-gray-950 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0"
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

                    <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-900">
                      <button
                        type="button"
                        onClick={handleSearch}
                        className="w-full py-2.5 text-xs font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-colors"
                      >
                        {t("search.viewAllResults", { query: query.trim() })}
                      </button>
                    </div>
                  </div>
                )}

                {/* No Results */}
                {query.trim().length >= 2 && results.length === 0 && !isLoading && (
                  <div className="py-10 px-6 text-center">
                    <p className="text-sm font-semibold text-gray-950 dark:text-white">
                      {t("search.noProductsFound")}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t("search.tryDifferent")}
                    </p>
                  </div>
                )}

                {/* Popular Searches */}
                {query.trim().length < 2 && (
                  <div className="p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold px-1 mb-2.5">
                      {t("search.popularSearches")}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
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
                          className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800/80 rounded-xl transition-colors group"
                        >
                          <span className="group-hover:text-gray-950 dark:group-hover:text-white transition-colors truncate">
                            {item.label}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 flex-shrink-0">
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
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t("search.buttonLabel")}
        aria-expanded={isOpen}
        title={`${t("search.buttonLabel")} (Ctrl+K)`}
        className="group p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white bg-gray-100/80 hover:bg-gray-200/80 dark:bg-gray-800/80 dark:hover:bg-gray-700/80 border border-gray-200/60 dark:border-gray-700/60 backdrop-blur-md rounded-full transition-all duration-200 active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-5 h-5 transition-transform group-hover:scale-105"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </button>

      {searchOverlay}
    </>
  );
}

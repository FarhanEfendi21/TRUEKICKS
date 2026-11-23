import { useState, useId, useMemo, useRef } from "react";
import { motion as Motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../Context/LanguageContext";

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  items = [],
  itemsPerPage = 16,
  variant = "default",
}) => {
  const { pick } = useLanguage();
  const layoutId = useId();
  const [hoveredPage, setHoveredPage] = useState(null);
  const closeTimerRef = useRef(null);

  const isSale = variant === "sale";

  const clampedPreviewPage =
    hoveredPage !== null
      ? Math.min(Math.max(1, hoveredPage), Math.max(1, totalPages))
      : null;

  const previewThumbs = useMemo(() => {
    if (!clampedPreviewPage || items.length === 0) return [];
    const startIdx = (clampedPreviewPage - 1) * itemsPerPage;
    return items.slice(startIdx, startIdx + 4);
  }, [clampedPreviewPage, items, itemsPerPage]);

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(
        1,
        "...",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      );
    } else {
      pages.push(
        1,
        "...",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "...",
        totalPages
      );
    }
    return pages;
  };

  const openPreview = (page) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (page >= 1 && page <= totalPages) {
      setHoveredPage(page);
    }
  };

  const closePreview = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setHoveredPage(null);
    }, 100);
  };

  const handleSelectPage = (page) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setHoveredPage(null);
    onPageChange(page);
  };

  const activePillClass = isSale
    ? "bg-gradient-to-r from-purple-600 to-pink-600 shadow-md shadow-purple-500/25"
    : "bg-gray-900 dark:bg-white shadow-sm";

  return (
    <nav
      aria-label="Pagination"
      className="relative flex justify-center mt-10 mb-4 select-none"
    >
      <div
        className="relative inline-flex flex-col items-center"
        onMouseLeave={closePreview}
      >
        {/* Minimalist Floating Thumbnail Preview */}
        <AnimatePresence>
          {clampedPreviewPage !== null && previewThumbs.length > 0 && (
            <Motion.div
              key="minimal-page-preview"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => {
                if (closeTimerRef.current) {
                  window.clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = null;
                }
              }}
              className="pointer-events-none absolute bottom-full mb-2.5 z-40 flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800 shadow-xl"
            >
              {previewThumbs.map((product) => (
                <div
                  key={product.id}
                  className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-gray-100 p-1 flex items-center justify-center overflow-hidden"
                >
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>
              ))}
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Minimalist Translucent Pill Dock */}
        <div
          className={`flex items-center gap-1 p-1 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border shadow-sm transition-colors ${
            isSale
              ? "border-purple-500/20"
              : "border-gray-200/80 dark:border-gray-800"
          }`}
        >
          {/* Prev */}
          <button
            type="button"
            onClick={() => handleSelectPage(currentPage - 1)}
            onMouseEnter={() =>
              currentPage > 1 && openPreview(currentPage - 1)
            }
            onFocus={() => currentPage > 1 && openPreview(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label={pick("Halaman sebelumnya", "Previous page")}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              currentPage === 1
                ? "text-gray-300 dark:text-gray-700 cursor-not-allowed"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-950 dark:hover:text-white active:scale-95"
            }`}
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

          {/* Page Numbers */}
          <div className="flex items-center gap-0.5">
            {getPageNumbers().map((page, index) => {
              if (page === "...") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="w-7 h-9 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500"
                  >
                    ...
                  </span>
                );
              }

              const isActive = page === currentPage;

              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => handleSelectPage(page)}
                  onMouseEnter={() => openPreview(page)}
                  onFocus={() => openPreview(page)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={pick(`Halaman ${page}`, `Page ${page}`)}
                  className={`relative w-9 h-9 rounded-full text-xs font-semibold flex items-center justify-center transition-colors ${
                    isActive
                      ? isSale
                        ? "text-white"
                        : "text-white dark:text-gray-950"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-gray-800/70"
                  }`}
                >
                  {isActive && (
                    <Motion.span
                      layoutId={`active-page-${layoutId}`}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 32,
                      }}
                      className={`absolute inset-0 rounded-full ${activePillClass}`}
                    />
                  )}
                  <span className="relative z-10">{page}</span>
                </button>
              );
            })}
          </div>

          {/* Next */}
          <button
            type="button"
            onClick={() => handleSelectPage(currentPage + 1)}
            onMouseEnter={() =>
              currentPage < totalPages && openPreview(currentPage + 1)
            }
            onFocus={() =>
              currentPage < totalPages && openPreview(currentPage + 1)
            }
            disabled={currentPage === totalPages}
            aria-label={pick("Halaman berikutnya", "Next page")}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              currentPage === totalPages
                ? "text-gray-300 dark:text-gray-700 cursor-not-allowed"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-950 dark:hover:text-white active:scale-95"
            }`}
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
    </nav>
  );
};

export default Pagination;

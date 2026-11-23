import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineHeart } from "react-icons/hi2";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useWishlist } from "../Context/WishlistContext";
import { useLanguage } from "../Context/LanguageContext";
import {
  formatRupiahShort,
  getEffectivePrice,
  getDiscountPercentage,
  hasActiveDiscount,
} from "../lib/pricing";

export default function Wishlist() {
  const { wishlistItems, removeFromWishlist } = useWishlist();
  const { pick } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleRemove = (e, item) => {
    e.stopPropagation();
    removeFromWishlist(item.id, item.productType);
    toast.success(pick(`${item.name} dihapus dari wishlist`, `${item.name} removed from wishlist`));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-poppins transition-colors duration-300">
      <Navbar />

      <div className="pt-28 md:pt-32 pb-28 md:pb-24 max-w-7xl mx-auto px-4 md:px-6">
        {/* Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.25em] uppercase text-gray-400 dark:text-gray-500 mb-2">
              <span>{pick("Produk Tersimpan", "Saved Items")}</span>
              <span className="w-8 h-[1px] bg-gray-300 dark:bg-gray-700" />
              <span>
                {wishlistItems.length}{" "}
                {pick("Item", wishlistItems.length === 1 ? "Item" : "Items")}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-gray-950 dark:text-white">
              {pick("Wishlist Saya", "My Wishlist")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              {pick(
                "Simpan produk incaranmu dan checkout sebelum kehabisan.",
                "Keep track of your favorite pairs and grab them before they sell out."
              )}
            </p>
          </div>
        </div>

        {wishlistItems.length === 0 ? (
          <div className="text-center py-20 px-6 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-5 text-gray-400 dark:text-gray-500">
              <HiOutlineHeart className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1.5">
              {pick("Wishlist masih kosong", "Your wishlist is empty")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
              {pick(
                "Tekan ikon hati pada produk favoritmu agar tersimpan di sini.",
                "Tap the heart icon on any product to save it here for quick access later."
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/sneakers")}
                className="px-6 py-2.5 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                {pick("Jelajahi Sneakers", "Explore Sneakers")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/sale")}
                className="px-6 py-2.5 rounded-full bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs font-bold uppercase tracking-wider hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                {pick("Belanja Promo", "Shop Sale")}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {wishlistItems.map((item) => {
              const isOnSale = hasActiveDiscount(item);
              const effectivePrice = getEffectivePrice(item);
              const discountPercent = getDiscountPercentage(item);
              const detailPath = `/product/${item.productType || "sneakers"}/${item.id}`;

              return (
                <div
                  key={`${item.productType || "sneakers"}-${item.id}`}
                  onClick={() => navigate(detailPath)}
                  className="bg-white dark:bg-gray-900 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xl hover:shadow-black/[0.06] dark:hover:shadow-black/40 hover:-translate-y-1 transition-all duration-300 relative group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Remove Button */}
                    <button
                      type="button"
                      aria-label={`Remove ${item.name} from wishlist`}
                      onClick={(e) => handleRemove(e, item)}
                      className="absolute top-5 right-5 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-full flex items-center justify-center text-gray-500 hover:bg-red-500 hover:border-red-500 hover:text-white transition-colors shadow-sm"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.2}
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

                    {/* Studio Light Image Frame */}
                    <div className="relative h-[155px] md:h-[205px] p-4 bg-gray-50 dark:bg-gray-100 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 overflow-hidden">
                      {/* Category / Sale Badges */}
                      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1">
                        {item.category && (
                          <span className="px-2 py-0.5 rounded-md bg-white/90 text-gray-700 text-[9px] font-semibold uppercase tracking-wide border border-gray-100 shadow-sm">
                            {item.category}
                          </span>
                        )}
                        {isOnSale && (
                          <span className="px-2 py-0.5 rounded-md bg-[#FF5500] text-white text-[9px] font-black tracking-wide w-fit">
                            -{discountPercent}%
                          </span>
                        )}
                      </div>

                      <img
                        src={item.image}
                        className="w-[86%] h-[86%] object-contain mix-blend-multiply group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-500"
                        alt={item.name}
                      />
                    </div>

                    <h3 className="font-bold text-gray-950 dark:text-white text-xs md:text-sm line-clamp-2 leading-snug group-hover:text-[#FF5500] transition-colors">
                      {item.name}
                    </h3>

                    <div className="flex items-baseline gap-2 mt-1.5">
                      <p className="text-[#FF5500] font-black text-sm md:text-base tracking-tight">
                        {formatRupiahShort(effectivePrice)}
                      </p>
                      {isOnSale && (
                        <p className="text-[11px] text-gray-400 line-through font-medium">
                          {formatRupiahShort(item.price)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick CTA */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(detailPath);
                    }}
                    className="mt-4 w-full py-2.5 rounded-xl bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:bg-[#FF5500] dark:hover:bg-[#FF5500] dark:hover:text-white text-[11px] font-bold uppercase tracking-wider transition-colors active:scale-95"
                  >
                    {pick("Pilih Ukuran", "Select Size")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

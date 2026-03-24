import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import LazyImage from "./LazyImage";

// =========================================
// 1. CUSTOM HOOK: SCROLL ANIMATION
// =========================================
export const useScrollAnimation = () => {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Trigger animasi saat 10% elemen masuk layar
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px", // Pre-load sedikit agar smooth di mobile
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) observer.disconnect();
    };
  }, []);

  return [elementRef, isVisible];
};

// =========================================
// 2. SHARED PRODUCT CARD COMPONENT
// =========================================
export default function ProductCard({ 
  item, 
  index = 0, 
  reviews = [], 
  productType = "sneakers", // "sneakers" | "apparel" | "sale_products"
  onWishlistToggle, 
  isInWishlist = false 
}) {
  const navigate = useNavigate();
  const [ref, isVisible] = useScrollAnimation();
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorite, setIsFavorite] = useState(isInWishlist);

  // Hitung delay: item ke-1 = 0ms, item ke-2 = 100ms, dst
  const delay = (index % 6) * 100;

  // Calculate rating from reviews
  const productReviews = reviews.filter(r => String(r.product_id) === String(item.id));
  const avgRating = productReviews.length > 0
    ? (productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length).toFixed(1)
    : 0;
  const reviewCount = productReviews.length;

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
    if (onWishlistToggle) onWishlistToggle(item);
  };

  const handleProductClick = () => {
    // Navigate dynamically based on the product type
    navigate(`/product/${productType}/${item.id}`);
  };

  return (
    <div
      ref={ref}
      onClick={handleProductClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ transitionDelay: `${delay}ms` }}
      className={`
        bg-white p-4 rounded-3xl shadow-sm border border-gray-100 
        hover:shadow-xl hover:border-gray-200 transition-all duration-500 ease-out 
        hover:-translate-y-2 cursor-pointer h-full flex flex-col justify-between group
        transform will-change-transform
        ${isVisible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-12 scale-95"
        }
      `}
    >
      <div>
        {/* Image Container */}
        <div className="relative h-[180px] md:h-[220px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center mb-4 overflow-hidden group-hover:from-orange-50 group-hover:to-orange-100/50 transition-colors duration-500">
          {/* Category Badge */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
            <span className="bg-white/90 backdrop-blur-sm text-gray-700 text-[9px] px-2 py-1 rounded-md font-semibold border border-gray-100 shadow-sm uppercase">
              {item.category || "General"}
            </span>
          </div>

          {/* Product Image */}
          <LazyImage
            src={item.image_url}
            className={`w-[80%] h-[80%] md:w-full md:h-full object-contain mix-blend-multiply transition-all duration-500 ${
              isHovered ? "scale-105 md:scale-110 -rotate-3" : "scale-100 rotate-0"
            }`}
            alt={item.name}
            placeholderColor="bg-transparent"
          />

          {/* Quick View Overlay on Hover */}
          <div className={`absolute inset-0 bg-black/5 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300 ${isHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <span className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105">
              Quick View
            </span>
          </div>
        </div>

        {/* Product Info */}
        <h3 className="font-bold text-gray-900 text-sm line-clamp-2 min-h-[40px] group-hover:text-[#FF5500] transition-colors mb-1">
          {item.name}
        </h3>

        {/* Rating Stars */}
        {reviewCount > 0 && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="w-3.5 h-3.5" fill={star <= Math.round(avgRating) ? "#FACC15" : "#E5E7EB"} viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-xs text-gray-500 font-medium">{avgRating}</span>
            <span className="text-[10px] text-gray-400">({reviewCount})</span>
          </div>
        )}

        {/* No Reviews State */}
        {reviewCount === 0 && (
          <p className="text-xs text-gray-400 mt-1.5 font-medium">No reviews yet</p>
        )}
      </div>

      {/* Price & Add Button */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-[#FF5500] font-black text-sm md:text-base tracking-tight">
          Rp {(item.price / 1000).toLocaleString()}K
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            /* Add fast add-to-cart logic here later */
          }}
          className="w-8 h-8 md:w-9 md:h-9 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-black hover:scale-110 active:scale-95 transition-all duration-200 shadow-md group-hover:shadow-lg group-hover:shadow-gray-400/30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

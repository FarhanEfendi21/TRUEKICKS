import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useLenis } from "lenis/react";
import api from "../lib/api";
import {
  hasActiveDiscount,
  getEffectivePrice,
  getDiscountPercentage,
  formatRupiah,
  formatRupiahShort,
} from "../lib/pricing";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useCart } from "../Context/CartContext";
import { useWishlist } from "../Context/WishlistContext";
import { useLanguage } from "../Context/LanguageContext";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import SizeGuide from "../components/SizeGuide";
import ZoomLoupe from "../components/ZoomLoupe";

// --- HELPER COMPONENTS ---

const formatDate = (dateString, locale = "id-ID") => {
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(dateString).toLocaleDateString(locale, options);
};

const StarRating = ({ rating, interactive = false, setRating }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          onClick={() => interactive && setRating(star)}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={star <= rating ? "#FACC15" : "#E5E7EB"}
          className={`w-5 h-5 ${interactive
            ? "cursor-pointer hover:scale-110 transition-transform"
            : ""
            }`}
        >
          <path
            fillRule="evenodd"
            d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
            clipRule="evenodd"
          />
        </svg>
      ))}
    </div>
  );
};

const AccordionItem = ({ title, isOpen, onClick, children }) => {
  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-none">
      <button
        className="w-full py-5 flex justify-between items-center text-left group"
        onClick={onClick}
      >
        <span className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider group-hover:text-black dark:group-hover:text-[#FF5500] transition-colors">
          {title}
        </span>
        <span
          className={`transform transition-transform duration-300 text-gray-400 group-hover:text-black dark:group-hover:text-white ${isOpen ? "rotate-45" : "rotate-0"
            }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-all duration-500 ease-in-out ${isOpen
          ? "grid-rows-[1fr] opacity-100 mb-5"
          : "grid-rows-[0fr] opacity-0"
          }`}
      >
        <div className="overflow-hidden text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

export default function ProductDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const lenis = useLenis();

  const { addToCart, cartItems } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { pick, locale, t } = useLanguage();

  // STATES
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(null);
  const [openAccordion, setOpenAccordion] = useState("desc");
  const [reviews, setReviews] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [user, setUser] = useState(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [variantState, setVariantState] = useState({
    tracked: false,
    canonical_type: null,
    canonical_id: null,
    total_stock: null,
    variants: [],
  });

  const reviewsRef = useRef(null);
  const sizeSectionRef = useRef(null);
  const selectedSizeRef = useRef(null);

  useEffect(() => {
    selectedSizeRef.current = selectedSize;
  }, [selectedSize]);

  // --- LOGIKA UKURAN BERDASARKAN TIPE ---
  const apparelSizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const shoeSizes = [38, 39, 40, 40.5, 41, 42, 42.5, 43, 44, 45, 46];

  const isApparel =
    type === "apparel" ||
    (product?.category &&
      /apparel|hoodie|shirt|jacket|pants|jersey/i.test(product.category));

  // VARIABEL FINAL UKURAN: Dipilih berdasarkan 'type' dari URL (fallback jika tabel stok belum dimigrasi)
  const sizes = isApparel ? apparelSizes : shoeSizes;

  const displayedVariants =
    variantState.variants.length > 0
      ? variantState.variants
      : sizes.map((s) => ({
          size: String(s),
          stock: null,
          low_stock_threshold: 3,
          sku: null,
          status: "untracked",
        }));

  const variantBySize = new Map(
    displayedVariants.map((v) => [String(v.size), v])
  );
  const selectedVariant =
    selectedSize != null ? variantBySize.get(String(selectedSize)) || null : null;
  const isAllSoldOut =
    variantState.tracked &&
    displayedVariants.length > 0 &&
    displayedVariants.every((v) => v.stock === 0);

  const getInCartQtyForSize = (sizeVal) => {
    if (!product || sizeVal == null) return 0;
    const match = cartItems.find(
      (item) =>
        String(item.id) === String(product.id) &&
        String(item.size) === String(sizeVal) &&
        (item.productType || "sneakers") === (type || "sneakers")
    );
    return match ? Number(match.quantity) || 0 : 0;
  };

  const inCartQty = getInCartQtyForSize(selectedSize);
  const remainingForAdd =
    variantState.tracked && selectedVariant && selectedVariant.stock != null
      ? Math.max(0, selectedVariant.stock - inCartQty)
      : null;
  const maxQuantityAllowed =
    remainingForAdd !== null ? Math.max(1, remainingForAdd) : 100;
  const isSelectedSoldOut = Boolean(
    variantState.tracked && selectedVariant && selectedVariant.stock === 0
  );
  const reachedCartStockLimit = Boolean(
    variantState.tracked &&
      selectedVariant &&
      selectedVariant.stock > 0 &&
      remainingForAdd === 0
  );
  // ------------------------------------

  const isDiscounted = hasActiveDiscount(product);
  const effectivePrice = getEffectivePrice(product);
  const discountPercent = getDiscountPercentage(product);

  // LOGIKA UTAMA
  const isLiked = product ? isInWishlist(product.id, type) : false;

  const handleWishlistToggle = () => {
    if (!user) {
      toast.error(pick("Silakan masuk untuk menyimpan ke Wishlist.", "Please log in to save items to your Wishlist."));
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (!product) return;
    if (isLiked) {
      removeFromWishlist(product.id, type);
      toast.success(pick(`${product.name} dihapus dari Wishlist!`, `${product.name} removed from Wishlist!`));
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        discount_price: isDiscounted ? Number(product.discount_price) : null,
        discount_percentage: discountPercent,
        category: product.category || "",
        image: product.image_url,
        productType: type,
      });
      toast.success(pick(`${product.name} ditambahkan ke Wishlist!`, `${product.name} added to Wishlist!`));
    }
  };

  const scrollToSizeSelector = () => {
    if (lenis && sizeSectionRef.current) {
      lenis.scrollTo(sizeSectionRef.current, { offset: -110 });
    } else {
      sizeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // --- HANDLE SIZE SELECTION (Guest bebas eksplorasi ukuran sebelum login) ---
  const handleSizeSelect = (size) => {
    const sizeKey = String(size);
    const variant = variantBySize.get(sizeKey);
    if (variantState.tracked && variant && variant.stock === 0) {
      return;
    }
    setSelectedSize(sizeKey);
    if (variantState.tracked && variant && variant.stock != null) {
      const rem = Math.max(1, variant.stock - getInCartQtyForSize(sizeKey));
      setQuantity((prev) => Math.max(1, Math.min(prev, rem)));
    }
  };

  const handleAddToCart = () => {
    if (!user) {
      toast.error(pick("Silakan masuk untuk menambahkan ke keranjang.", "Please log in to add items to your bag."));
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (isAllSoldOut) {
      toast.error(pick("Produk ini sedang habis di semua ukuran.", "This product is currently sold out in all sizes."));
      return;
    }
    if (!selectedSize) {
      toast.error(pick("Pilih ukuran terlebih dahulu!", "Please select a size first!"));
      return;
    }
    if (isSelectedSoldOut) {
      toast.error(pick(`Ukuran ${selectedSize} sudah habis.`, `Size ${selectedSize} is sold out.`));
      return;
    }
    if (variantState.tracked && remainingForAdd !== null) {
      if (remainingForAdd <= 0) {
        toast.error(
          pick(
            `Stok maksimal ukuran ${selectedSize} (${selectedVariant.stock}) sudah ada di keranjangmu.`,
            `Maximum available stock for size ${selectedSize} (${selectedVariant.stock}) is already in your bag.`
          )
        );
        return;
      }
      if (quantity > remainingForAdd) {
        setQuantity(remainingForAdd);
        toast.error(
          pick(
            `Stok tersisa untuk ukuran ${selectedSize} hanya ${remainingForAdd} lagi.`,
            `Only ${remainingForAdd} more left in stock for size ${selectedSize}.`
          )
        );
        return;
      }
    }

    addToCart({
      id: product.id,
      productType: type,
      name: product.name,
      price: effectivePrice,
      image: product.image_url,
      size: String(selectedSize),
      quantity: quantity,
      available_stock: variantState.tracked ? selectedVariant?.stock ?? null : null,
      low_stock_threshold: selectedVariant?.low_stock_threshold ?? 3,
      stock_status: variantState.tracked
        ? selectedVariant?.status ?? "in_stock"
        : "untracked",
      sku: selectedVariant?.sku ?? null,
    });
    if (variantState.tracked && remainingForAdd !== null) {
      const nextRem = Math.max(1, remainingForAdd - quantity);
      setQuantity((prev) => Math.min(prev, nextRem));
    }
    toast.success(pick(`Masuk keranjang · ${formatRupiah(effectivePrice)}`, `Added to bag at ${formatRupiah(effectivePrice)}`));
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error(pick("Silakan masuk untuk menulis ulasan.", "Please log in to submit a review."));
      navigate("/login");
      return;
    }
    if (!newComment.trim()) return toast.error(pick("Tuliskan ulasan terlebih dahulu", "Please write a comment"));

    try {
      await api.post("/api/reviews", {
        product_id: Number(id),
        product_type: type,
        rating: newRating,
        comment: newComment.trim(),
      });

      setNewComment("");
      setNewRating(5);
      toast.success(pick("Ulasan berhasil dikirim!", "Review submitted successfully!"));
    } catch (error) {
      console.error("Failed to submit review", error);
      const errMsg =
        error.response?.data?.errors?.[0] ||
        error.response?.data?.message ||
        pick("Gagal mengirim ulasan. Silakan coba lagi.", "Error submitting review. Please try again.");
      toast.error(errMsg);
    }
  };

  const toggleAccordion = (key) =>
    setOpenAccordion(openAccordion === key ? null : key);

  const applyVariantPayload = useCallback(
    (payload) => {
      if (!payload || !Array.isArray(payload.variants)) return;
      const tracked = Boolean(payload.tracked ?? payload.stock_tracked);
      const nextVariants = payload.variants;
      setVariantState({
        tracked,
        canonical_type:
          payload.canonical_type || payload.canonical_product_type || type,
        canonical_id:
          payload.canonical_id || payload.canonical_product_id || Number(id),
        total_stock: payload.total_stock ?? null,
        variants: nextVariants,
      });

      const activeSize = selectedSizeRef.current;
      if (tracked && activeSize != null) {
        const current = nextVariants.find(
          (v) => String(v.size) === String(activeSize)
        );
        if (current && current.stock === 0) {
          setSelectedSize(null);
          setQuantity(1);
          toast.error(
            pick(
              `Ukuran ${activeSize} baru saja habis.`,
              `Size ${activeSize} just sold out.`
            )
          );
        } else if (current && current.stock > 0) {
          setQuantity((prev) => Math.max(1, Math.min(prev, current.stock)));
        }
      }
    },
    [id, pick, type]
  );

  const refreshVariants = useCallback(async () => {
    try {
      const res = await api.get(`/api/variants/${type}/${id}`, {
        skipAuthRedirect: true,
      });
      if (res.data) {
        applyVariantPayload(res.data);
      }
    } catch {
      // Keep last known stock silently if offline
    }
  }, [applyVariantPayload, id, type]);

  // --- USE EFFECTS ---

  useEffect(() => {
    const fetchData = async () => {
      try {
        setSelectedSize(null);
        setQuantity(1);

        // === PERBAIKAN DI SINI ===
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);

          // VALIDASI GUEST:
          // Jika email mengandung 'guest', paksa state user jadi NULL
          if (parsedUser.email && parsedUser.email.includes("guest")) {
            setUser(null);
          } else {
            setUser(parsedUser);
          }
        }
        // =========================

        // === 2. Gunakan instance api untuk fetch Detail Produk ===
        const productRes = await api.get(`/api/detail/${type}/${id}`);

        setProduct(productRes.data);
        setActiveImage(productRes.data.image_url);
        if (Array.isArray(productRes.data?.variants)) {
          setVariantState({
            tracked: Boolean(productRes.data.stock_tracked),
            canonical_type: productRes.data.canonical_product_type || type,
            canonical_id: productRes.data.canonical_product_id || Number(id),
            total_stock: productRes.data.total_stock ?? null,
            variants: productRes.data.variants,
          });
        } else {
          setVariantState({
            tracked: false,
            canonical_type: type,
            canonical_id: Number(id),
            total_stock: null,
            variants: [],
          });
        }

        // Bagian Reviews: Fetch dari Backend API
        const reviewsRes = await api.get(`/api/reviews/${id}?type=${type}`);
        setReviews(reviewsRes.data || []);

        // === FETCH SIMILAR PRODUCTS VIA BACKEND API ===
        try {
          const listEndpoint =
            type === "sale_products" ? "/api/sale" : `/api/${type}`;
          const similarRes = await api.get(listEndpoint);
          const similarList = (similarRes.data || [])
            .filter((item) => String(item.id) !== String(id))
            .slice(0, 4);
          setSimilarProducts(similarList);
        } catch (similarErr) {
          console.error("Gagal ambil produk serupa:", similarErr);
          setSimilarProducts([]);
        }

      } catch (error) {
        console.error("Gagal ambil data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [type, id]);

  // Refresh stock when user returns to tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshVariants();
      }
    };
    window.addEventListener("focus", refreshVariants);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", refreshVariants);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshVariants]);

  // Supabase Realtime subscription for live stock changes per size
  useEffect(() => {
    if (!supabase || !variantState.canonical_id || !variantState.canonical_type) {
      return undefined;
    }

    const canonicalId = variantState.canonical_id;
    const canonicalType = variantState.canonical_type;

    const channel = supabase
      .channel(`realtime-variants-${canonicalType}-${canonicalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_variants",
          filter: `product_id=eq.${canonicalId}`,
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row || row.product_type !== canonicalType) return;

          if (payload.eventType === "UPDATE" && payload.new) {
            const updatedSize = String(payload.new.size);
            const updatedStock = Math.max(0, Number(payload.new.stock) || 0);
            const threshold = Number(payload.new.low_stock_threshold) || 3;
            const nextStatus =
              updatedStock <= 0
                ? "out_of_stock"
                : updatedStock <= threshold
                  ? "low_stock"
                  : "in_stock";

            setVariantState((prev) => {
              const updatedList = prev.variants.map((v) =>
                String(v.size) === updatedSize
                  ? {
                      ...v,
                      stock: updatedStock,
                      low_stock_threshold: threshold,
                      status: nextStatus,
                    }
                  : v
              );
              const total = updatedList.reduce(
                (sum, v) => sum + (Number(v.stock) || 0),
                0
              );
              return {
                ...prev,
                tracked: true,
                total_stock: total,
                variants: updatedList,
              };
            });

            if (String(selectedSizeRef.current) === updatedSize) {
              if (updatedStock <= 0) {
                setSelectedSize(null);
                setQuantity(1);
                toast.error(
                  pick(
                    `Ukuran ${updatedSize} baru saja habis.`,
                    `Size ${updatedSize} just sold out.`
                  )
                );
              } else {
                setQuantity((prev) => Math.max(1, Math.min(prev, updatedStock)));
              }
            }
          } else {
            refreshVariants();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pick, refreshVariants, variantState.canonical_id, variantState.canonical_type]);

  useEffect(() => {
    if (!supabase) return undefined;

    const channel = supabase
      .channel("realtime-reviews")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reviews",
          filter: `product_id=eq.${id}`,
        },
        async (payload) => {
          if (payload.new.product_type !== type) return;

          try {
            const reviewsRes = await api.get(`/api/reviews/${id}?type=${type}`, {
              skipAuthRedirect: true,
            });
            if (Array.isArray(reviewsRes.data)) {
              setReviews(reviewsRes.data);
            }
          } catch {
            // Fallback to anonymous display if backend refresh fails offline
            setReviews((prevReviews) => [
              { ...payload.new, users: { full_name: "Anonymous" } },
              ...prevReviews,
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, type]);

  // --- RENDER LOGIC ---

  const averageRating =
    reviews.length > 0
      ? (
        reviews.reduce((acc, review) => acc + review.rating, 0) /
        reviews.length
      ).toFixed(1)
      : 0;

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-800 border-t-black dark:border-t-[#FF5500] rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest animate-pulse">
            {pick("Memuat Produk...", "Loading Product...")}
          </p>
        </div>
      </div>
    );

  if (!product)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
        {pick("Produk tidak ditemukan.", "Product not found.")}
      </div>
    );

  const currentMainImage = activeImage || product.image_url;
  const details = product.detail_images || [];
  const galleryImages = [product.image_url, ...details];

  const handleScrollToReviews = () => {
    // 1. PAKSA BUKA Accordion Review terlebih dahulu
    setOpenAccordion("reviews");

    // 2. Beri jeda sedikit (300ms) agar browser sempat me-render accordion yang terbuka
    setTimeout(() => {
      if (lenis && reviewsRef.current) {
        lenis.scrollTo(reviewsRef.current, { offset: -96 });
      } else {
        reviewsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start", // Scroll hingga bagian atas review pas di atas layar
        });
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-poppins text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Navbar />
      <main className="pt-24 pb-32 md:pt-28 md:pb-20 max-w-7xl mx-auto px-4 md:px-6">
        {/* BREADCRUMB */}
        <nav className="text-[10px] md:text-xs font-medium text-gray-400 mb-6 md:mb-10 flex items-center gap-2 md:gap-3 uppercase tracking-wide overflow-hidden whitespace-nowrap">
          <span
            onClick={() => navigate("/home")}
            className="cursor-pointer hover:text-black dark:hover:text-white transition-colors"
          >
            {t("nav.home")}
          </span>
          <span className="text-gray-300 dark:text-gray-700">/</span>

          <span
            onClick={() => {
              if (type === "sale_products") {
                // Handle SALE
                navigate("/sale");
              } else if (type === "products") {
                const isApparel = product.category
                  ?.toLowerCase()
                  .match(/hoodie|shirt|jacket|pants|jersey/);
                navigate(isApparel ? "/apparel" : "/sneakers");
              } else {
                navigate(`/${type}`);
              }
            }}
            className="cursor-pointer hover:text-black dark:hover:text-white transition-colors"
          >
            {type === "sale_products"
              ? t("nav.sale")
              : type === "products"
                ? product.category
                  ?.toLowerCase()
                  .match(/hoodie|shirt|jacket|pants|jersey/)
                  ? t("nav.apparel")
                  : t("nav.sneakers")
                : type === "apparel"
                ? t("nav.apparel")
                : t("nav.sneakers")}
          </span>

          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="text-black dark:text-white font-semibold truncate max-w-[150px] md:max-w-[250px]">
            {product.name}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* KIRI: GALLERY IMAGE */}
          <div className="lg:col-span-7 relative lg:min-h-screen">
            <div className="sticky top-24 lg:top-28">
              <ZoomLoupe
                src={currentMainImage}
                alt={product.name}
                badge={
                  <span className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-sm border border-gray-100">
                    {isDiscounted
                      ? pick(`Diskon -${discountPercent}%`, `Sale -${discountPercent}%`)
                      : pick("100% Asli", "Authentic")}
                  </span>
                }
              />

              {/* GALLERY THUMBNAILS (Fixed Border Version) */}
              <div className="flex gap-3 md:gap-4 mt-6 md:mt-8 overflow-x-auto no-scrollbar pb-4 snap-x px-1 scroll-smooth pl-1">
                {galleryImages.map((imgUrl, i) => {
                  const isActive = currentMainImage === imgUrl;

                  return (
                    <div
                      key={i}
                      onClick={() => setActiveImage(imgUrl)}
                      className={`
          relative flex-shrink-0 cursor-pointer transition-all duration-300 ease-out snap-start 
          w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center overflow-hidden border-2 p-[2px]
          ${isActive
                          ? "bg-white border-black shadow-md scale-100 opacity-100"
                          : "bg-[#F8F8F8] border-transparent hover:border-gray-300 opacity-70 hover:opacity-100 hover:bg-white"
                        }
        `}
                    >
                      {/* Inner Container untuk Gambar - memastikan background putih bersih di dalam border */}
                      <div className="w-full h-full rounded-[10px] flex items-center justify-center bg-white">
                        <img
                          src={imgUrl}
                          // Sedikit animasi rotasi dan scale untuk kesan dinamis
                          className={`
                w-[85%] h-[85%] object-contain mix-blend-multiply transition-transform duration-500
                ${isActive ? "scale-110 rotate-[-3deg]" : "scale-100 rotate-0"}
              `}
                          alt={`thumb-${i}`}
                          onError={(e) => {
                            e.target.src =
                              "https://via.placeholder.com/100?text=No+Image";
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* === KANAN: INFO PRODUK === */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="mb-6">
              <h2 className="text-orange-600 dark:text-[#FF5500] font-bold text-xs uppercase tracking-[0.25em] mb-3">
                {product.category}
              </h2>
              <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-5">
                {product.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatRupiah(effectivePrice)}
                  </span>
                  {isDiscounted && (
                    <>
                      <span className="text-base text-gray-400 line-through">
                        {formatRupiah(product.price)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#FF5500]/10 text-[#FF5500] text-xs font-bold">
                        -{discountPercent}%
                      </span>
                    </>
                  )}
                </div>

                <div
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={handleScrollToReviews}
                >
                  <div className="flex items-center gap-3 text-sm border-l-2 border-gray-200 dark:border-gray-800 pl-6 py-1">
                    <StarRating rating={Math.round(averageRating)} />
                    <span className="text-gray-700 dark:text-gray-200 font-bold ml-1">
                      {averageRating}
                    </span>
                    <span
                      onClick={() => toggleAccordion("reviews")}
                      className="text-gray-400 underline decoration-gray-300 dark:decoration-gray-700 underline-offset-4 cursor-pointer hover:text-black dark:hover:text-white transition-colors"
                    >
                      ({reviews.length} {pick("Ulasan", "Reviews")})
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full h-px bg-gray-100 dark:bg-gray-800 mb-8"></div>

            {/* SIZE SELECTOR */}
            <div ref={sizeSectionRef} className="mb-10 scroll-mt-28">
              <div className="flex justify-between items-end mb-5">
                <span className="font-bold text-sm uppercase tracking-wider text-gray-900 dark:text-white">
                  {isApparel
                    ? pick("Pilih Ukuran", "Select Size")
                    : pick("Pilih Ukuran (EU)", "Select Size (EU)")}
                </span>
                <button
                  onClick={() => setShowSizeGuide(true)}
                  className="text-xs font-medium text-gray-500 dark:text-gray-400 underline underline-offset-4 hover:text-black dark:hover:text-white transition-colors flex-shrink-0"
                >
                  {pick("Panduan Ukuran", "Size Guide")}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {displayedVariants.map((variant) => {
                  const size = String(variant.size);
                  const isSelected = String(selectedSize) === size;
                  const isSoldOut = variantState.tracked && variant.stock === 0;
                  const isLowStock =
                    variantState.tracked && variant.status === "low_stock";

                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={isSoldOut}
                      onClick={() => handleSizeSelect(size)}
                      aria-label={
                        isSoldOut
                          ? `${size} (${pick("Habis", "Sold Out")})`
                          : isLowStock
                            ? `${size} (${pick(`Sisa ${variant.stock}`, `${variant.stock} left`)})`
                            : size
                      }
                      className={`min-h-[3.5rem] py-1.5 px-1 rounded-xl border-2 text-sm font-bold transition-all duration-200 relative overflow-hidden flex flex-col items-center justify-center
                        ${
                          isSoldOut
                            ? "bg-gray-100/80 dark:bg-gray-900/50 text-gray-300 dark:text-gray-600 border-gray-100 dark:border-gray-800/80 cursor-not-allowed"
                            : isSelected
                              ? "bg-black dark:bg-[#FF5500] text-white border-black dark:border-[#FF5500] shadow-md transform scale-[1.02] active:scale-95"
                              : "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:border-black dark:hover:border-white hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95"
                        }`}
                    >
                      <span
                        className={`leading-none ${
                          isSoldOut
                            ? "line-through decoration-gray-400/70 dark:decoration-gray-600"
                            : ""
                        }`}
                      >
                        {size}
                      </span>
                      {isSoldOut && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600 leading-none mt-1">
                          {pick("Habis", "Sold Out")}
                        </span>
                      )}
                      {isLowStock && (
                        <span
                          className={`text-[9px] font-bold tracking-tight leading-none mt-1 ${
                            isSelected
                              ? "text-amber-200"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {pick(`Sisa ${variant.stock}`, `${variant.stock} left`)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* MINIMALIST STOCK FEEDBACK */}
              {isAllSoldOut ? (
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 px-3.5 py-2.5 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
                  <span>
                    {pick(
                      "Semua ukuran saat ini sedang habis. Simpan ke Wishlist untuk memantau restock.",
                      "All sizes are currently sold out. Save to your Wishlist to watch for restocks."
                    )}
                  </span>
                </div>
              ) : selectedSize && variantState.tracked && selectedVariant ? (
                <div className="mt-3.5 space-y-1.5">
                  {selectedVariant.status === "low_stock" ? (
                    <div className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/90 dark:bg-gray-900/70 border border-gray-200/80 dark:border-gray-800 px-3 py-1.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 flex-shrink-0" />
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        {pick("Stok menipis", "Low stock")}
                      </span>
                      <span className="text-gray-300 dark:text-gray-700">·</span>
                      <span>
                        {pick(
                          `Tersisa ${selectedVariant.stock} ${isApparel ? "item" : "pasang"} (Ukuran ${selectedSize})`,
                          `Only ${selectedVariant.stock} left for size ${selectedSize}`
                        )}
                        {inCartQty > 0 &&
                          pick(
                            ` · ${inCartQty} di keranjang`,
                            ` · ${inCartQty} in bag`
                          )}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/90 dark:bg-gray-900/70 border border-gray-200/80 dark:border-gray-800 px-3 py-1.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-900/40 dark:bg-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {pick("Tersedia", "In stock")}
                      </span>
                      <span className="text-gray-300 dark:text-gray-700">·</span>
                      <span>
                        {pick(
                          `${selectedVariant.stock} stok untuk ukuran ${selectedSize}`,
                          `${selectedVariant.stock} available for size ${selectedSize}`
                        )}
                        {inCartQty > 0 &&
                          pick(
                            ` · ${inCartQty} di keranjang`,
                            ` · ${inCartQty} in bag`
                          )}
                      </span>
                    </div>
                  )}

                  {reachedCartStockLimit && (
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 pl-1">
                      {pick(
                        "Seluruh sisa stok untuk ukuran ini sudah berada di keranjangmu.",
                        "All remaining stock for this size is already in your bag."
                      )}
                    </p>
                  )}
                </div>
              ) : (
                !selectedSize && (
                  <p className="text-xs font-medium text-gray-400 mt-3">
                    {pick(
                      "* Pilih ukuran untuk melihat ketersediaan & tambah ke keranjang",
                      "* Select a size to check availability & add to bag"
                    )}
                  </p>
                )
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col xl:flex-row gap-3 mb-8 md:mb-12">
              {/* Quantity: Full width on mobile/tablet/lg, compact inline on xl */}
              <div className="flex items-center justify-between xl:justify-start bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-full h-14 px-5 xl:px-3.5 w-full xl:w-auto flex-shrink-0">
                <span className="xl:hidden font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {pick("Jumlah", "Quantity")}
                </span>
                <div className="flex items-center gap-4 xl:gap-3">
                  <button
                    type="button"
                    disabled={isAllSoldOut || quantity <= 1}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                    className="w-8 h-8 flex items-center justify-center text-lg text-gray-500 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors bg-white dark:bg-gray-800 xl:bg-transparent dark:xl:bg-transparent rounded-full xl:rounded-none shadow-sm xl:shadow-none hover:bg-gray-100 xl:hover:bg-transparent disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <span className="font-bold w-5 text-center text-base tabular-nums dark:text-white">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={
                      isAllSoldOut ||
                      reachedCartStockLimit ||
                      quantity >= maxQuantityAllowed
                    }
                    onClick={() =>
                      setQuantity((prev) => Math.min(maxQuantityAllowed, prev + 1))
                    }
                    aria-label="Increase quantity"
                    className="w-8 h-8 flex items-center justify-center text-lg text-gray-500 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors bg-white dark:bg-gray-800 xl:bg-transparent dark:xl:bg-transparent rounded-full xl:rounded-none shadow-sm xl:shadow-none hover:bg-gray-100 xl:hover:bg-transparent disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Tombol Add & Wishlist */}
              <div className="flex gap-2.5 sm:gap-3 w-full xl:flex-1 min-w-0">
                {/* Add to Bag */}
                <button
                  type="button"
                  disabled={isAllSoldOut || isSelectedSoldOut || reachedCartStockLimit}
                  onClick={handleAddToCart}
                  className={`flex-1 min-w-0 px-5 text-white h-14 rounded-full font-bold text-xs uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden shadow-md md:shadow-none
                        ${
                          isAllSoldOut || isSelectedSoldOut || reachedCartStockLimit
                            ? "bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                            : !selectedSize && user
                              ? "bg-gray-400 dark:bg-gray-700 active:scale-95"
                              : "bg-gradient-to-r from-gray-900 to-black dark:from-[#FF5500] dark:to-orange-600 hover:shadow-lg hover:shadow-black/30 dark:hover:shadow-orange-500/30 active:scale-95"
                        }`}
                >
                  <span className="relative z-10 truncate">
                    {isAllSoldOut || isSelectedSoldOut
                      ? pick("Stok Habis", "Sold Out")
                      : reachedCartStockLimit
                        ? pick("Stok Maks. di Keranjang", "Max Stock in Bag")
                        : !user
                          ? pick("Masuk untuk Membeli", "Sign In to Buy")
                          : pick("Tambah ke Keranjang", "Add to Bag")}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4 flex-shrink-0 relative z-10 group-hover:translate-x-0.5 transition-transform"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </button>

                {/* Wishlist */}
                <button
                  type="button"
                  onClick={handleWishlistToggle}
                  aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
                  className={`w-14 h-14 border-2 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 group flex-shrink-0
                        ${isLiked && user
                        ? "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-500"
                        : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill={isLiked && user ? "currentColor" : "none"}
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* TRUST BADGES (SVG Icons) */}
            <div className="grid grid-cols-3 gap-6 mb-10 py-8 border-y border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 rounded-2xl px-4">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300">
                  {t("common.freeShipping")}
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300">
                  {t("common.original")}
                </span>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300">
                  {t("common.easyReturns")}
                </span>
              </div>
            </div>

            {/* ACCORDIONS & REVIEWS */}
            <div className="space-y-2">
              <AccordionItem
                title={pick("Deskripsi", "Description")}
                isOpen={openAccordion === "desc"}
                onClick={() => toggleAccordion("desc")}
              >
                <p className="py-2">{product.description}</p>
              </AccordionItem>

              <AccordionItem
                title={pick("Spesifikasi", "Specifications")}
                isOpen={openAccordion === "specs"}
                onClick={() => toggleAccordion("specs")}
              >
                <ul className="list-disc list-inside space-y-3 py-2">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold min-w-[80px]">
                      {pick("Material:", "Material:")}
                    </span>{" "}
                    {pick("Sintetis Premium & Mesh", "Premium Synthetic & Mesh")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold min-w-[80px]">{pick("Sol:", "Sole:")}</span>{" "}
                    {pick("Outsole Karet", "Rubber Outsole")}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold min-w-[80px]">{pick("Pengikat:", "Closure:")}</span>{" "}
                    {pick("Bertali", "Lace-up")}
                  </li>
                </ul>
              </AccordionItem>
              <div ref={reviewsRef} className="scroll-mt-32">
                <AccordionItem
                  title={`${pick("Ulasan", "Reviews")} (${reviews.length})`}
                  isOpen={openAccordion === "reviews"}
                  onClick={() => toggleAccordion("reviews")}
                >
                  <div className="space-y-8 py-4">
                    {user ? (
                      <form
                        onSubmit={handleSubmitReview}
                        className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
                      >
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                          {pick(`Tulis Ulasan sebagai ${user.full_name}`, `Write a Review as ${user.full_name}`)}
                        </h4>
                        <div className="mb-4">
                          <StarRating
                            rating={newRating}
                            interactive
                            setRating={setNewRating}
                          />
                        </div>
                        <textarea
                          className="w-full p-4 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-black dark:focus:border-[#FF5500] focus:ring-1 focus:ring-black dark:focus:ring-[#FF5500] resize-none transition-all"
                          rows="3"
                          placeholder={pick("Bagaimana produknya? Bagikan pengalamanmu...", "How was the product? Share your thoughts...")}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                        ></textarea>
                        <button
                          type="submit"
                          className="mt-4 bg-black dark:bg-[#FF5500] text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-orange-600 transition-colors"
                        >
                          {pick("Kirim Ulasan", "Submit Review")}
                        </button>
                      </form>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 text-center shadow-sm">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                          {pick("Masuk terlebih dahulu untuk membagikan pengalamanmu.", "Please login to share your experience.")}
                        </p>
                        <button
                          onClick={() => navigate("/login")}
                          className="text-xs font-bold uppercase tracking-wider underline underline-offset-4 text-gray-900 dark:text-white hover:text-[#FF5500] transition-colors"
                        >
                          {pick("Masuk untuk Menulis Ulasan", "Login to Write a Review")}
                        </button>
                      </div>
                    )}

                    {reviews.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-gray-400 italic font-medium">
                          {pick("Belum ada ulasan. Jadilah yang pertama mengulas!", "No reviews yet. Be the first to review!")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {reviews.map((review) => (
                          <div
                            key={review.id}
                            className="flex gap-5 border-b border-gray-100 dark:border-gray-800 pb-6 last:border-0 animate-fade-in"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border border-gray-300 dark:border-gray-700 rounded-full flex items-center justify-center font-bold text-gray-700 dark:text-gray-200 text-sm flex-shrink-0 shadow-sm">
                              {review.users?.full_name
                                ? review.users.full_name.charAt(0).toUpperCase()
                                : "U"}
                            </div>
                            <div className="flex-grow">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-bold text-sm text-gray-900 dark:text-white">
                                    {review.users?.full_name || "Anonymous"}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <StarRating rating={review.rating} />
                                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                                      {formatDate(review.created_at, locale)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50/50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                "{review.comment}"
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionItem>
              </div>
            </div>
          </div>
        </div>

        {/* === RECOMMENDATIONS SECTION === */}
        {similarProducts.length > 0 && (
          <div className="mt-20 md:mt-32 border-t border-gray-100 dark:border-gray-800 pt-16">
            <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-8 tracking-tight uppercase">
              {pick("Mungkin Kamu Suka", "You Might Also Like")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {similarProducts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(`/product/${type}/${item.id}`);
                    if (lenis) {
                      lenis.scrollTo(0, { immediate: true });
                    } else {
                      window.scrollTo(0, 0);
                    }
                  }}
                  className="group cursor-pointer"
                >
                  <div className="bg-gray-50 dark:bg-gray-100 rounded-3xl aspect-square flex items-center justify-center p-4 mb-4 relative overflow-hidden transition-all duration-500 hover:shadow-lg">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-[85%] h-[85%] object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"
                    />
                  </div>
                  <h4 className="font-bold text-sm md:text-base text-gray-900 dark:text-white line-clamp-1 group-hover:text-[#FF5500] transition-colors">
                    {item.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-900 dark:text-gray-200 font-bold">
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
          </div>
        )}
      </main>
      <div className="pb-24 lg:pb-0">
        <Footer />
      </div>

      {/* === STICKY MOBILE CTA BAR === */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-t border-gray-200/80 dark:border-gray-800 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] dark:shadow-black/40">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-black text-gray-950 dark:text-white tracking-tight">
                {formatRupiah(effectivePrice)}
              </span>
              {isDiscounted && (
                <span className="text-[11px] text-gray-400 line-through">
                  {formatRupiah(product.price)}
                </span>
              )}
            </div>
            {selectedSize ? (
              <button
                type="button"
                onClick={scrollToSizeSelector}
                className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {pick(`Ukuran ${selectedSize} · Jumlah ${quantity}`, `Size ${selectedSize} · Qty ${quantity}`)}
              </button>
            ) : (
              <button
                type="button"
                onClick={scrollToSizeSelector}
                className="text-[11px] font-semibold text-[#FF5500] underline underline-offset-2"
              >
                {isApparel ? pick("Pilih ukuran", "Select size") : pick("Pilih ukuran EU", "Select EU size")}
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={isAllSoldOut || isSelectedSoldOut || reachedCartStockLimit}
            onClick={() => {
              if (!user) {
                handleAddToCart();
              } else if (!selectedSize) {
                scrollToSizeSelector();
                toast(pick("Pilih ukuran terlebih dahulu", "Please select a size first"));
              } else {
                handleAddToCart();
              }
            }}
            className={`flex-shrink-0 px-6 h-12 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-md ${
              isAllSoldOut || isSelectedSoldOut || reachedCartStockLimit
                ? "bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-gray-950 dark:bg-[#FF5500] text-white active:scale-95"
            }`}
          >
            <span>
              {isAllSoldOut || isSelectedSoldOut
                ? pick("Stok Habis", "Sold Out")
                : reachedCartStockLimit
                  ? pick("Stok Maks.", "Max in Bag")
                  : !user
                    ? pick("Masuk untuk Beli", "Sign In to Buy")
                    : !selectedSize
                      ? pick("Pilih Ukuran", "Choose Size")
                      : pick("Tambah", "Add to Bag")}
            </span>
          </button>
        </div>
      </div>

      {/* SIZE GUIDE MODAL */}
      <SizeGuide
        isOpen={showSizeGuide}
        onClose={() => setShowSizeGuide(false)}
        type={isApparel ? "apparel" : "sneakers"}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatRupiah } from "../lib/pricing";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import HoldButton from "../components/HoldButton.jsx";
import { useCart } from "../Context/CartContext.jsx";
import { useLanguage } from "../Context/LanguageContext.jsx";

const TrashIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const CheckIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default function Cart() {
  const {
    cartItems,
    totalItems,
    removeFromCart,
    updateQuantity,
    refreshCart,
    totalPrice,
    discount,
    applyCoupon,
    removeCoupon,
    finalPrice,
  } = useCart();
  const navigate = useNavigate();
  const { pick } = useLanguage();
  const [couponCode, setCouponCode] = useState("");
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsCheckingCoupon(true);
    try {
      const response = await api.post("/api/coupons/verify", {
        code: couponCode,
        totalAmount: totalPrice,
      });

      applyCoupon(response.data);
      toast.success(pick("Kupon berhasil diterapkan!", "Coupon applied!"));
      setCouponCode("");
    } catch (error) {
      toast.error(error.response?.data?.message || pick("Kupon tidak valid", "Invalid coupon"));
      removeCoupon();
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    refreshCart();
  }, [refreshCart]);

  const handleUpdateQty = (id, size, qty, productType, availableStock = null) => {
    if (availableStock != null && availableStock > 0 && qty > availableStock) {
      toast.error(
        pick(
          `Stok tersedia hanya ${availableStock} item.`,
          `Only ${availableStock} left in stock.`
        ),
        { id: "cart-stock-limit" }
      );
      return;
    }
    updateQuantity(id, size, qty, productType);
  };

  const hasStockIssues = cartItems.some(
    (item) =>
      item.available_stock != null &&
      (item.available_stock <= 0 || item.quantity > item.available_stock)
  );

  // Hapus item setelah animasi HoldButton selesai
  const handleHoldRemove = (item) => {
    setTimeout(() => {
      removeFromCart(item.id, item.size, item.productType);
      toast.success(pick(`${item.name} dihapus dari keranjang`, `${item.name} removed from bag`));
    }, 350);
  };

  const handleTapRemoveHint = () => {
    toast(pick("Tahan untuk menghapus item", "Hold to remove item"), {
      id: "hold-remove-hint",
      duration: 1500,
    });
  };

  // === TAMPILAN KOSONG (EMPTY STATE) ===
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-poppins flex flex-col transition-colors duration-300">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center text-center px-6 pt-20 animate-fade-in">
          <div className="relative mb-8 group">
            <div className="absolute inset-0 bg-orange-200 dark:bg-orange-500/20 rounded-full blur-2xl opacity-50 group-hover:opacity-70 transition-opacity"></div>
            <div className="relative w-32 h-32 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center shadow-xl border-4 border-gray-50 dark:border-gray-800 transform group-hover:scale-110 transition-transform duration-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 text-gray-300 dark:text-gray-600 group-hover:text-orange-500 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-3 tracking-tighter">
            {pick("KERANJANG MASIH KOSONG", "YOUR BAG IS EMPTY")}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto leading-relaxed text-sm md:text-base">
            {pick(
              "Sepertinya kamu belum memilih produk. Temukan koleksi terbaru kami sekarang.",
              "Looks like you haven't made your choice yet. Discover our latest collection now."
            )}
          </p>
          <button
            onClick={() => navigate("/sneakers")}
            className="group relative bg-black dark:bg-white text-white dark:text-gray-900 px-10 py-4 rounded-full font-bold uppercase tracking-widest text-xs md:text-sm overflow-hidden shadow-lg hover:shadow-orange-500/30 transition-all hover:-translate-y-1"
          >
            <span className="relative z-10 group-hover:text-white transition-colors">
              {pick("Mulai Belanja", "Start Shopping")}
            </span>
            <div className="absolute inset-0 bg-[#FF5500] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></div>
          </button>
        </div>
      </div>
    );
  }

  // === TAMPILAN UTAMA (CART FILLED) ===
  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950 font-poppins flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-grow pt-32 pb-40 md:pt-40 md:pb-24 max-w-7xl mx-auto px-4 md:px-8 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter mb-2">
              {pick("KERANJANG BELANJA", "SHOPPING BAG")}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm flex items-center gap-2">
              <span className="bg-black dark:bg-[#FF5500] text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                {totalItems} {pick("ITEM", totalItems === 1 ? "ITEM" : "ITEMS")}
              </span>
              {pick("di keranjangmu", "in your cart")}
            </p>
          </div>
          <button
            onClick={() => navigate("/sneakers")}
            className="text-xs font-bold text-gray-400 hover:text-black dark:hover:text-white hover:underline underline-offset-4 transition-colors flex items-center gap-1 group"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3 h-3 group-hover:-translate-x-1 transition-transform"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            {pick("Lanjut Belanja", "Continue Shopping")}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* === KIRI: ITEM LIST (Column 8) === */}
          <div className="lg:col-span-8 space-y-6">
            {cartItems.map((item) => {
              const itemPrice = Number(item.price) || 0;
              const isTrackedStock = item.available_stock != null;
              const isSoldOut = isTrackedStock && item.available_stock <= 0;
              const exceedsStock =
                isTrackedStock &&
                item.available_stock > 0 &&
                item.quantity > item.available_stock;
              const isLowStock =
                isTrackedStock &&
                item.available_stock > 0 &&
                !exceedsStock &&
                item.stock_status === "low_stock";
              const atMaxStock =
                isTrackedStock && item.quantity >= Math.max(0, item.available_stock);

              return (
                <div
                  key={`${item.productType || "sneakers"}-${item.id}-${item.size}`}
                  className={`group bg-white dark:bg-gray-900 p-4 md:p-6 rounded-[2rem] shadow-sm border transition-all duration-300 flex flex-row gap-4 md:gap-6 items-center relative overflow-hidden ${
                    isSoldOut || exceedsStock
                      ? "border-red-200 dark:border-red-900/60"
                      : "border-transparent dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 hover:shadow-xl"
                  }`}
                >
                  {/* Gambar Produk (Klik untuk lihat detail) */}
                  <div
                    onClick={() =>
                      navigate(`/product/${item.productType || "sneakers"}/${item.id}`)
                    }
                    className="w-24 h-24 md:w-32 md:h-32 bg-gray-50 dark:bg-gray-100 rounded-2xl flex-shrink-0 flex items-center justify-center p-2 relative overflow-hidden cursor-pointer"
                  >
                    <img
                      src={item.image || item.image_url}
                      alt={item.name}
                      className={`w-[90%] h-[90%] object-contain mix-blend-multiply transform group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 ease-out ${
                        isSoldOut ? "opacity-45 grayscale" : ""
                      }`}
                    />
                  </div>

                  {/* Detail */}
                  <div className="flex-grow flex flex-col justify-between py-1 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3
                          onClick={() =>
                            navigate(`/product/${item.productType || "sneakers"}/${item.id}`)
                          }
                          className="font-bold text-sm md:text-lg text-gray-900 dark:text-white leading-snug line-clamp-2 mb-1 group-hover:text-[#FF5500] transition-colors cursor-pointer"
                        >
                          {item.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs text-gray-400 font-medium">
                            {pick("Ukuran:", "Size:")}{" "}
                            <span className="text-gray-800 dark:text-gray-200 font-bold">
                              {item.size}
                            </span>
                          </p>
                          {isSoldOut && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-900">
                              {pick("Stok Habis", "Sold Out")}
                            </span>
                          )}
                          {exceedsStock && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-900">
                              {pick(
                                `Sisa stok ${item.available_stock}`,
                                `Only ${item.available_stock} left`
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateQty(
                                    item.id,
                                    item.size,
                                    item.available_stock,
                                    item.productType,
                                    item.available_stock
                                  )
                                }
                                className="underline underline-offset-2 hover:text-red-800 dark:hover:text-red-200"
                              >
                                {pick("Sesuaikan", "Adjust")}
                              </button>
                            </span>
                          )}
                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {pick(
                                `Stok Menipis · Sisa ${item.available_stock}`,
                                `Low Stock · ${item.available_stock} left`
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tombol Hapus Icon Sampah (Hold to Delete + Progress Bar) */}
                      <div className="flex-shrink-0">
                        <HoldButton
                          doneLabel={null}
                          icon={TrashIcon}
                          doneIcon={CheckIcon}
                          ariaLabel={`Hold to remove ${item.name}`}
                          backgroundColor="#f3f4f6"
                          fillColor="#FF5500"
                          textColor="#6b7280"
                          fillTextColor="#ffffff"
                          size="icon"
                          radius={9999}
                          fillDirection="up"
                          holdTime={1200}
                          releaseTime={200}
                          pressScale={0.92}
                          wave
                          waveAmplitude={4}
                          glow
                          showProgressBar
                          resetAfter={0}
                          onHold={() => handleHoldRemove(item)}
                          onTap={handleTapRemoveHint}
                          className="hold-button--glass"
                        >
                          {null}
                        </HoldButton>
                      </div>
                    </div>

                    {/* Control Bawah */}
                    <div className="flex justify-between items-end mt-4">
                      {/* Qty Control */}
                      <div className="flex items-center bg-gray-100/80 dark:bg-gray-800 rounded-xl p-1 h-9 md:h-10">
                        <button
                          onClick={() =>
                            handleUpdateQty(
                              item.id,
                              item.size,
                              Math.max(1, item.quantity - 1),
                              item.productType,
                              item.available_stock
                            )
                          }
                          disabled={isSoldOut}
                          className="w-8 h-full flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-black dark:hover:text-white rounded-lg transition-all active:scale-90 disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-xs md:text-sm font-bold tabular-nums dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            handleUpdateQty(
                              item.id,
                              item.size,
                              item.quantity + 1,
                              item.productType,
                              item.available_stock
                            )
                          }
                          disabled={atMaxStock}
                          className="w-8 h-full flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-black dark:hover:text-white rounded-lg transition-all active:scale-90 disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>

                      {/* Harga */}
                      <div className="text-right">
                        <p className="text-sm md:text-lg font-black text-gray-900 dark:text-white">
                          {formatRupiah(itemPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* === KANAN: ORDER SUMMARY (Sticky - Column 4) === */}
          <div className="lg:col-span-4">
            <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-white dark:border-gray-800 sticky top-28 lg:top-32 relative overflow-hidden">
              {/* Background Dekoratif */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-100 dark:from-orange-500/10 to-transparent rounded-bl-[100%] opacity-50 -z-10"></div>

              <h2 className="font-black text-xl text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                {pick("RINGKASAN", "SUMMARY")}
              </h2>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatRupiah(totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 items-center">
                  <span>{pick("Pengiriman", "Shipping")}</span>
                  <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">
                    {pick("Gratis", "Free")}
                  </span>
                </div>
                {discount.type && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400 items-center animate-fade-in">
                    <span className="flex items-center gap-1.5">
                      {pick("Diskon", "Discount")} ({discount.code})
                      <button
                        type="button"
                        onClick={removeCoupon}
                        aria-label={pick("Hapus kupon", "Remove coupon")}
                        className="p-0.5 text-red-500 hover:text-red-700 rounded-full transition-colors"
                        title={pick("Hapus kupon", "Remove coupon")}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                    <span className="font-bold">
                      -{formatRupiah(totalPrice - finalPrice)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>{pick("Pajak (Termasuk)", "Tax (Included)")}</span>
                  <span className="text-gray-900 dark:text-white">-</span>
                </div>
              </div>

              {/* PROMO CODE INPUT - Responsive */}
              <div className="mb-6">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {pick("Kode Promo", "Promo Code")}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder={pick("Masukkan kode", "Enter code")}
                    className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-3 py-3 text-sm font-bold uppercase placeholder:normal-case placeholder:text-gray-400 focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-500/20 transition-all"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={isCheckingCoupon || !couponCode}
                    className="flex-shrink-0 bg-[#FF5500] text-white px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-1"
                  >
                    {isCheckingCoupon ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      pick("PAKAI", "APPLY")
                    )}
                  </button>
                </div>
                {discount.type && (
                  <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {pick(`Kupon ${discount.code} aktif!`, `Coupon ${discount.code} applied!`)}
                  </p>
                )}
              </div>

              {/* Divider Garis Putus */}
              <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-6"></div>

              <div className="flex justify-between items-end mb-8">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                  Total
                </span>
                <span className="font-black text-3xl text-gray-900 dark:text-white tracking-tight">
                  {formatRupiah(finalPrice)}
                </span>
              </div>

              {hasStockIssues && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
                  {pick(
                    "Beberapa item di keranjang habis atau melebihi stok tersedia. Sesuaikan jumlah atau hapus item terlebih dahulu.",
                    "Some items in your bag are sold out or exceed available stock. Please adjust or remove them first."
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  if (hasStockIssues) {
                    toast.error(
                      pick(
                        "Periksa kembali ketersediaan stok di keranjangmu.",
                        "Please resolve stock availability issues in your bag first."
                      )
                    );
                    return;
                  }
                  navigate("/checkout");
                }}
                disabled={hasStockIssues}
                className={`w-full group relative h-14 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all overflow-hidden flex items-center justify-center gap-3 ${
                  hasStockIssues
                    ? "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "bg-black dark:bg-white text-white dark:text-gray-900 shadow-lg shadow-gray-900/20 hover:shadow-orange-500/40 active:scale-95"
                }`}
              >
                <span className={`relative z-10 ${hasStockIssues ? "" : "group-hover:text-white transition-colors"}`}>
                  {pick("Lanjut ke Pembayaran", "Checkout")}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className={`w-5 h-5 relative z-10 ${hasStockIssues ? "" : "group-hover:translate-x-1 transition-transform"}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"
                  />
                </svg>
                {/* Efek Hover Background */}
                {!hasStockIssues && (
                  <div className="absolute inset-0 bg-[#FF5500] transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                )}
              </button>

              <div className="mt-6 flex items-center justify-center gap-2 text-gray-400 text-[10px] font-bold uppercase tracking-wider opacity-60">
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
                    d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                  />
                </svg>
                {pick("Pembayaran Aman", "Secure Checkout")}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer desktop only (mobile pakai bottom nav) */}
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SlideCommit from "../components/SlideCommit";
import { useCart } from "../Context/CartContext";
import toast from "react-hot-toast";

export default function Checkout() {
  const { cartItems, totalPrice, finalPrice, discount, clearCart } = useCart();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    address: "",
    city: "",
    phone: "",
    postalCode: "",
  });

  const [loading, setLoading] = useState(false);
  const [slideError, setSlideError] = useState("Order failed");
  const [desktopWidth, setDesktopWidth] = useState(320);
  const [mobileWidth, setMobileWidth] = useState(320);

  const desktopSlotRef = useRef(null);
  const mobileSlotRef = useRef(null);
  const orderCompletedRef = useRef(false);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    const observe = (el, setter) => {
      if (!el) return null;
      const update = () => {
        const w = Math.floor(el.getBoundingClientRect().width);
        if (w > 0) setter(Math.max(220, w));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return ro;
    };

    const roDesktop = observe(desktopSlotRef.current, setDesktopWidth);
    const roMobile = observe(mobileSlotRef.current, setMobileWidth);

    return () => {
      roDesktop?.disconnect();
      roMobile?.disconnect();
      clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // Helper: Format Harga
  const formatPrice = (price) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const isGuestUser =
      !parsedUser ||
      !parsedUser.id ||
      (parsedUser.email && parsedUser.email.includes("guest"));

    if (isGuestUser) {
      toast.error("Please login to checkout");

      // === PERBAIKAN: TAMBAHKAN { replace: true } ===
      // Agar kalau user tekan Back, dia tidak kembali ke halaman Checkout yang kosong/error
      navigate("/login", { replace: true });
      return;
    }

    if (cartItems.length === 0 && !orderCompletedRef.current) {
      navigate("/cart", { replace: true }); // Ini juga bagus pakai replace
    }
  }, [cartItems, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePlaceOrder = async () => {
    if (
      !formData.fullName.trim() ||
      !formData.address.trim() ||
      !formData.phone.trim() ||
      !formData.city.trim() ||
      !formData.postalCode.trim()
    ) {
      setSlideError("Complete shipping form");
      toast.error("Please fill in all required fields.");
      throw new Error("Missing required fields");
    }

    setLoading(true);
    try {
      const payload = {
        full_name: formData.fullName.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        postal_code: formData.postalCode.trim(),
        phone: formData.phone.trim(),
        coupon_code: discount?.code || undefined,
        items: cartItems.map((item) => ({
          id: item.id,
          productType: item.productType,
          name: item.name,
          size: item.size,
          quantity: item.quantity,
        })),
      };

      const response = await api.post("/api/orders", payload);

      if (response.status === 201) {
        orderCompletedRef.current = true;
        return response.data;
      }

      throw new Error("Unexpected server response");
    } catch (error) {
      console.error("Checkout Error:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.errors?.[0] ||
        error.response?.data?.message ||
        "Failed to place order. Please try again.";
      setSlideError("Order failed");
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleOrderDone = () => {
    toast.success("Order Placed Successfully!");
    redirectTimerRef.current = setTimeout(() => {
      clearCart();
      navigate("/profile", { replace: true });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950 font-poppins transition-colors duration-300">
      <Navbar />

      <main className="pt-28 pb-40 md:pt-36 md:pb-20 max-w-6xl mx-auto px-4 md:px-8">
        {/* Header */}
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
            {/* Back Button (Mobile Only) */}
            <button
              onClick={() => navigate(-1)}
              className="md:hidden w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-900 dark:text-white active:scale-95 transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>

            <div className="text-left flex-1">
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                Checkout
              </h1>
            </div>
          </div>

          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 text-left md:text-left ml-14 md:ml-0">
            Please provide your delivery details to complete the order.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* === KIRI: FORMULIR PENGIRIMAN === */}
          {/* Mobile: Order 1 (First), Desktop: Order 1 (Left) */}
          <div className="lg:col-span-7 order-1">
            <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-xl text-gray-900 dark:text-white mb-6 flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
                <span className="w-8 h-8 bg-black dark:bg-[#FF5500] text-white rounded-full flex items-center justify-center text-sm">
                  1
                </span>
                Shipping Information
              </h2>

              <form
                id="checkout-form"
                onSubmit={(e) => e.preventDefault()}
                className="space-y-5 md:space-y-6"
              >
                {/* Full Name & Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
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
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                          />
                        </svg>
                      </span>
                      <input
                        required
                        name="fullName"
                        onChange={handleChange}
                        type="text"
                        placeholder="e.g. John Doe"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-black dark:focus:border-[#FF5500] focus:bg-white dark:focus:bg-gray-800 transition-all"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
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
                            d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                          />
                        </svg>
                      </span>
                      <input
                        required
                        name="phone"
                        onChange={handleChange}
                        type="tel"
                        placeholder="e.g. 081234567890"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-black dark:focus:border-[#FF5500] focus:bg-white dark:focus:bg-gray-800 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                    Full Address
                  </label>
                  <div className="relative">
                    <span className="absolute top-3.5 left-0 pl-4 flex items-start pointer-events-none text-gray-400">
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
                          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                        />
                      </svg>
                    </span>
                    <textarea
                      required
                      name="address"
                      onChange={handleChange}
                      rows="3"
                      placeholder="Street name, House number, etc."
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-black dark:focus:border-[#FF5500] focus:bg-white dark:focus:bg-gray-800 transition-all resize-none"
                    ></textarea>
                  </div>
                </div>

                {/* City & Postal Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                      City
                    </label>
                    <input
                      required
                      name="city"
                      onChange={handleChange}
                      type="text"
                      placeholder="e.g. Jakarta Selatan"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-black dark:focus:border-[#FF5500] focus:bg-white dark:focus:bg-gray-800 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                      Postal Code
                    </label>
                    <input
                      required
                      name="postalCode"
                      onChange={handleChange}
                      type="text"
                      placeholder="e.g. 12345"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-black dark:focus:border-[#FF5500] focus:bg-white dark:focus:bg-gray-800 transition-all"
                    />
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* === KANAN: RINGKASAN PESANAN (Sticky di Desktop) === */}
          {/* Mobile: Order 2 (Second), Desktop: Order 2 (Right) */}
          <div className="lg:col-span-5 order-2">
            <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[2rem] shadow-lg dark:shadow-none border border-gray-100 dark:border-gray-800 lg:sticky lg:top-32">
              <h2 className="font-bold text-xl text-gray-900 dark:text-white mb-6 flex items-center justify-between">
                Order Summary
                <span className="text-sm font-medium text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  {cartItems.length} Items
                </span>
              </h2>

              {/* Daftar Item (Scrollable dengan custom scrollbar) */}
              <div data-lenis-prevent className="space-y-4 mb-6 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 group">
                    {/* Gambar Produk Kecil */}
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100 group-hover:border-gray-200 transition-colors">
                      <img
                        src={item.image || item.image_url}
                        className="w-[80%] object-contain mix-blend-multiply"
                        alt={item.name}
                      />
                    </div>
                    {/* Detail Produk */}
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1">
                        {item.name}
                      </p>
                      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 inline-block px-2 py-0.5 rounded-md">
                        Size: {item.size} | Qty: {item.quantity}
                      </p>
                    </div>
                    {/* Harga Total per Item */}
                    <p className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Rincian Biaya */}
              <div className="border-t border-dashed border-gray-200 dark:border-gray-800 pt-4 space-y-3">
                <div className="flex justify-between text-sm font-medium text-gray-500 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium text-gray-500 dark:text-gray-400">
                  <span>Shipping</span>
                  <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                    Free Shipping
                  </span>
                </div>
                {/* Display Discount if applied */}
                {discount.type && (
                  <div className="flex justify-between text-sm font-medium text-green-600 dark:text-green-400">
                    <span>Discount ({discount.code})</span>
                    <span className="font-bold">
                      -{formatPrice(totalPrice - finalPrice)}
                    </span>
                  </div>
                )}
                {/* Bisa tambah Tax disini jika ada */}
                <div className="flex justify-between items-end mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                    Total To Pay
                  </span>
                  <span className="text-2xl md:text-3xl font-black text-[#FF5500] leading-none">
                    {formatPrice(finalPrice)}
                  </span>
                </div>
              </div>

              {/* Tombol Bayar Slider (Hanya di Desktop) */}
              <div ref={desktopSlotRef} className="hidden md:block w-full mt-8">
                <SlideCommit
                  label="Slide to place order"
                  doneLabel="Order Placed"
                  errorLabel={slideError}
                  onConfirm={handlePlaceOrder}
                  onDone={handleOrderDone}
                  trackColor="#f3f4f6"
                  handleColor="#111827"
                  successColor="#10b981"
                  dangerColor="#ef4444"
                  width={desktopWidth}
                  height={54}
                  radius={27}
                  speed={50}
                  returnBounce={0.38}
                  landingDip={0.024}
                  holdMs={0}
                  disabled={loading}
                  className="slide-commit--glass"
                />
              </div>

              <p className="hidden md:flex mt-4 justify-center items-center gap-2 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 text-green-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 12c0 5.082 3.048 9.676 7.667 11.371.55.203 1.16.203 1.71 0C16.202 21.676 19.25 17.082 19.25 12v-6.235a.75.75 0 00-.722-.515 11.209 11.209 0 01-7.877-3.08zM12 13.25a.75.75 0 00.75-.75V6a.75.75 0 00-1.5 0v6.5c0 .414.336.75.75.75zm0 1.5a1 1 0 100 2 1 1 0 000-2z"
                    clipRule="evenodd"
                  />
                </svg>
                SSL Secure Payment
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* === MOBILE STICKY CHECKOUT BAR (Hanya di Mobile) === */}
      {/* UX Terbaik untuk Mobile: Total harga dan tombol bayar selalu terlihat di bawah */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-950/85 backdrop-blur-xl p-4 border-t border-gray-200/70 dark:border-gray-800 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] z-40 pb-6">
        <div className="flex flex-col gap-3 max-w-6xl mx-auto">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Total to Pay
            </span>
            <span className="text-xl font-black text-[#FF5500] leading-none">
              {formatPrice(finalPrice)}
            </span>
          </div>
          <div ref={mobileSlotRef} className="w-full">
            <SlideCommit
              label="Slide to place order"
              doneLabel="Order Placed"
              errorLabel={slideError}
              onConfirm={handlePlaceOrder}
              onDone={handleOrderDone}
              trackColor="#f3f4f6"
              handleColor="#111827"
              successColor="#10b981"
              dangerColor="#ef4444"
              width={mobileWidth}
              height={50}
              radius={25}
              speed={50}
              returnBounce={0.38}
              landingDip={0.024}
              holdMs={0}
              disabled={loading}
              className="slide-commit--glass"
            />
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}

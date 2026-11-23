import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatRupiah } from "../lib/pricing";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SlideCommit from "../components/SlideCommit";
import PaymentModal from "../components/PaymentModal";
import { openMidtransSnap } from "../lib/midtransSnap";
import { useCart } from "../Context/CartContext";
import { useLanguage } from "../Context/LanguageContext";
import toast from "react-hot-toast";

export default function Checkout() {
  const { cartItems, totalPrice, finalPrice, discount, clearCart, refreshCart } = useCart();
  const { pick } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      const defaultName =
        stored?.full_name && !stored.email?.includes("guest")
          ? stored.full_name
          : "";
      return {
        fullName: defaultName,
        address: "",
        city: "",
        phone: "",
        postalCode: "",
      };
    } catch {
      return {
        fullName: "",
        address: "",
        city: "",
        phone: "",
        postalCode: "",
      };
    }
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressLabel, setAddressLabel] = useState("Home");

  const [loading, setLoading] = useState(false);
  const [slideError, setSlideError] = useState(() => pick("Pesanan gagal", "Order failed"));
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState(null);
  const [desktopWidth, setDesktopWidth] = useState(320);
  const [mobileWidth, setMobileWidth] = useState(320);

  const desktopSlotRef = useRef(null);
  const mobileSlotRef = useRef(null);
  const orderCompletedRef = useRef(false);
  const lastOrderMetaRef = useRef(null);
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

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const isGuestUser =
      !parsedUser ||
      !parsedUser.id ||
      (parsedUser.email && parsedUser.email.includes("guest"));

    if (isGuestUser) {
      toast.error(pick("Silakan masuk untuk melanjutkan checkout", "Please login to checkout"));
      navigate("/login", { replace: true, state: { from: "/checkout" } });
      return;
    }

    if (cartItems.length === 0 && !orderCompletedRef.current) {
      navigate("/cart", { replace: true });
    }
  }, [cartItems, navigate, pick]);

  // Load Saved Shipping Addresses (Cloud + localStorage fallback)
  useEffect(() => {
    let parsedUser = null;
    try {
      parsedUser = JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      parsedUser = null;
    }
    if (!parsedUser?.id || parsedUser.email?.includes("guest")) return;

    const localKey = `savedAddresses_${parsedUser.id}`;
    const readLocal = () => {
      try {
        const raw = localStorage.getItem(localKey);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    };

    const applyDefaultAddress = (list) => {
      if (!Array.isArray(list) || list.length === 0) return;
      const defaultAddr = list.find((a) => a.is_default) || list[0];
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        setFormData({
          fullName: defaultAddr.full_name || "",
          phone: defaultAddr.phone || "",
          address: defaultAddr.address || "",
          city: defaultAddr.city || "",
          postalCode: defaultAddr.postal_code || "",
        });
        setSaveAddress(false);
      }
    };

    const loadAddresses = async () => {
      const localList = readLocal();
      if (localList.length > 0) {
        setSavedAddresses(localList);
        applyDefaultAddress(localList);
      }

      try {
        const res = await api.get("/api/addresses", { skipAuthRedirect: true });
        if (res.data?.synced && Array.isArray(res.data.addresses)) {
          setSavedAddresses(res.data.addresses);
          localStorage.setItem(localKey, JSON.stringify(res.data.addresses));
          if (res.data.addresses.length > 0 && localList.length === 0) {
            applyDefaultAddress(res.data.addresses);
          }
        }
      } catch {
        // Stay on local fallback
      }
    };

    loadAddresses();
  }, []);

  const handleSelectSavedAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setFormData({
      fullName: addr.full_name || "",
      phone: addr.phone || "",
      address: addr.address || "",
      city: addr.city || "",
      postalCode: addr.postal_code || "",
    });
    setFieldErrors({});
    setSaveAddress(false);
  };

  const handleDeleteSavedAddress = async (e, addrId) => {
    e.stopPropagation();
    const next = savedAddresses.filter((a) => String(a.id) !== String(addrId));
    setSavedAddresses(next);
    if (String(selectedAddressId) === String(addrId)) {
      setSelectedAddressId(null);
    }
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (stored?.id) {
        localStorage.setItem(`savedAddresses_${stored.id}`, JSON.stringify(next));
      }
      await api.delete(`/api/addresses/${addrId}`, { skipAuthRedirect: true });
    } catch {
      // Removed locally
    }
    toast.success(pick("Alamat tersimpan dihapus", "Saved address removed"));
  };

  const validateField = (name, value) => {
    const v = (value || "").trim();
    if (name === "fullName") {
      if (!v) return pick("Nama lengkap wajib diisi", "Full name is required");
      if (v.length < 2) return pick("Minimal 2 karakter", "Enter at least 2 characters");
    }
    if (name === "phone") {
      if (!v) return pick("Nomor telepon wajib diisi", "Phone number is required");
      const digits = v.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return pick("Masukkan 8–15 digit", "Enter 8–15 digits");
    }
    if (name === "address") {
      if (!v) return pick("Alamat pengiriman wajib diisi", "Shipping address is required");
      if (v.length < 8) return pick("Sertakan detail jalan & nomor rumah", "Please include street & house details");
    }
    if (name === "city") {
      if (!v) return pick("Kota wajib diisi", "City is required");
    }
    if (name === "postalCode") {
      if (!v) return pick("Kode pos wajib diisi", "Postal code is required");
      if (v.length < 4) return pick("Masukkan kode pos yang valid", "Enter a valid postal code");
    }
    return "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handlePlaceOrder = async () => {
    const nextErrors = {
      fullName: validateField("fullName", formData.fullName),
      phone: validateField("phone", formData.phone),
      address: validateField("address", formData.address),
      city: validateField("city", formData.city),
      postalCode: validateField("postalCode", formData.postalCode),
    };
    setFieldErrors(nextErrors);

    const firstError = Object.values(nextErrors).find(Boolean);
    if (firstError) {
      setSlideError(pick("Lengkapi formulir", "Complete shipping form"));
      toast.error(firstError);
      throw new Error("Missing or invalid shipping fields");
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
        lastOrderMetaRef.current = {
          order: response.data?.order?.[0] || null,
          payment: response.data?.payment || null,
          authenticityCode: response.data?.authenticity_code || null,
          emailSent: Boolean(response.data?.email_sent),
        };

        // Best-effort save shipping address to cloud + localStorage if checked
        if (saveAddress) {
          const newAddrPayload = {
            label: addressLabel || "Home",
            full_name: payload.full_name,
            phone: payload.phone,
            address: payload.address,
            city: payload.city,
            postal_code: payload.postal_code,
            is_default: savedAddresses.length === 0,
          };
          try {
            const addrRes = await api.post("/api/addresses", newAddrPayload, {
              skipAuthRedirect: true,
            });
            const stored = JSON.parse(localStorage.getItem("user") || "null");
            const savedItem = addrRes.data?.address || {
              ...newAddrPayload,
              id: `local-${Date.now()}`,
            };
            if (stored?.id) {
              const updatedList = [savedItem, ...savedAddresses];
              localStorage.setItem(
                `savedAddresses_${stored.id}`,
                JSON.stringify(updatedList)
              );
            }
          } catch {
            // Never block completed checkout if address save fails
          }
        }

        return response.data;
      }

      throw new Error("Unexpected server response");
    } catch (error) {
      console.error("Checkout Error:", error);
      const isStockConflict =
        error.response?.status === 409 ||
        error.response?.data?.code === "INSUFFICIENT_STOCK";

      if (isStockConflict) {
        const conflict = error.response?.data?.conflict;
        const conflictMsg = conflict
          ? conflict.available <= 0
            ? pick(
                `Stok ${conflict.name} ukuran ${conflict.size} baru saja habis.`,
                `${conflict.name} size ${conflict.size} just sold out.`
              )
            : pick(
                `Stok ${conflict.name} ukuran ${conflict.size} tersisa ${conflict.available} (diminta ${conflict.requested}).`,
                `${conflict.name} size ${conflict.size} only has ${conflict.available} left (requested ${conflict.requested}).`
              )
          : error.response?.data?.error ||
            pick(
              "Stok beberapa produk tidak mencukupi. Periksa kembali keranjangmu.",
              "Insufficient stock for one or more items. Please review your bag."
            );
        setSlideError(pick("Stok tidak cukup", "Insufficient stock"));
        toast.error(conflictMsg, { duration: 5000 });
        refreshCart();
        throw error;
      }

      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.errors?.[0] ||
        error.response?.data?.message ||
        pick("Gagal memproses pesanan. Silakan coba lagi.", "Failed to place order. Please try again.");
      setSlideError(pick("Pesanan gagal", "Order failed"));
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleOrderDone = async () => {
    const meta = lastOrderMetaRef.current;
    const createdOrder = meta?.order;
    const payment = meta?.payment;

    clearCart();

    if (
      createdOrder &&
      payment &&
      payment.mode !== "sandbox_simulator" &&
      (payment.token || payment.redirect_url)
    ) {
      try {
        await openMidtransSnap({
          token: payment.token,
          clientKey: payment.client_key,
          snapScriptUrl: payment.snap_script_url,
          redirectUrl: payment.redirect_url,
          onSuccess: async () => {
            try {
              await api.get(`/api/orders/${createdOrder.id}/payment-status`);
            } catch {
              // Webhook will finalize status asynchronously
            }
            toast.success(
              pick("Pembayaran berhasil diverifikasi!", "Payment verified successfully!"),
              { duration: 4000 }
            );
            navigate("/orders", { replace: true });
          },
          onPending: () => {
            toast(
              pick(
                "Menunggu pembayaran. Kamu bisa melanjutkan dari Riwayat Pesanan.",
                "Payment pending. You can resume anytime from Order History."
              ),
              { duration: 4000 }
            );
            navigate("/orders", { replace: true });
          },
          onError: () => {
            toast.error(
              pick(
                "Pembayaran belum selesai. Coba bayar ulang di Riwayat Pesanan.",
                "Payment failed. You can retry from Order History."
              )
            );
            navigate("/orders", { replace: true });
          },
          onClose: () => {
            toast(
              pick(
                "Pesanan disimpan sebagai Menunggu Pembayaran.",
                "Order saved as Pending Payment."
              )
            );
            navigate("/orders", { replace: true });
          },
        });
        return;
      } catch {
        toast(
          pick(
            "Popup pembayaran tidak terbuka. Lanjutkan pembayaran dari Riwayat Pesanan.",
            "Payment popup unavailable. Continue payment from Order History."
          )
        );
        navigate("/orders", { replace: true });
        return;
      }
    }

    if (createdOrder) {
      setPendingPaymentOrder(createdOrder);
      return;
    }

    redirectTimerRef.current = setTimeout(() => {
      navigate("/orders", { replace: true });
    }, 1000);
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
            {pick("Lengkapi detail pengiriman untuk menyelesaikan pesanan.", "Please provide your delivery details to complete the order.")}
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
                {pick("Informasi Pengiriman", "Shipping Information")}
              </h2>

              {/* Saved Address Book Selector */}
              {savedAddresses.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                      {pick("Alamat Tersimpan", "Saved Addresses")}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId(null);
                        setFormData((prev) => ({
                          ...prev,
                          phone: "",
                          address: "",
                          city: "",
                          postalCode: "",
                        }));
                        setSaveAddress(true);
                      }}
                      className="text-[11px] font-bold text-[#FF5500] hover:underline"
                    >
                      {pick("+ Pakai Alamat Baru", "+ Use New Address")}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {savedAddresses.map((addr) => {
                      const isSelected =
                        String(selectedAddressId) === String(addr.id);
                      return (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`relative p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "border-gray-900 dark:border-[#FF5500] bg-gray-50 dark:bg-gray-800/80 shadow-sm"
                              : "border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              {addr.label || "Home"}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSavedAddress(e, addr.id)}
                              aria-label={`Delete ${addr.label || "saved"} address`}
                              className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors"
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
                          </div>
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                            {addr.full_name}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                            {addr.address}, {addr.city}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <form
                id="checkout-form"
                onSubmit={(e) => e.preventDefault()}
                className="space-y-5 md:space-y-6"
              >
                {/* Full Name & Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                      {pick("Nama Lengkap", "Full Name")}
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
                        value={formData.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        type="text"
                        placeholder="e.g. John Doe"
                        className={`w-full bg-gray-50 dark:bg-gray-800 border text-gray-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-800 transition-all ${
                          fieldErrors.fullName
                            ? "border-red-400 focus:border-red-500"
                            : "border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-[#FF5500]"
                        }`}
                      />
                    </div>
                    {fieldErrors.fullName && (
                      <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.fullName}</p>
                    )}
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                      {pick("Nomor Telepon", "Phone Number")}
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
                        value={formData.phone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        type="tel"
                        placeholder="e.g. 081234567890"
                        className={`w-full bg-gray-50 dark:bg-gray-800 border text-gray-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-800 transition-all ${
                          fieldErrors.phone
                            ? "border-red-400 focus:border-red-500"
                            : "border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-[#FF5500]"
                        }`}
                      />
                    </div>
                    {fieldErrors.phone && (
                      <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.phone}</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                    {pick("Alamat Lengkap", "Full Address")}
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
                      value={formData.address}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      rows="3"
                      placeholder={pick("Nama jalan, nomor rumah, RT/RW, dsb.", "Street name, House number, etc.")}
                      className={`w-full bg-gray-50 dark:bg-gray-800 border text-gray-900 dark:text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-800 transition-all resize-none ${
                        fieldErrors.address
                          ? "border-red-400 focus:border-red-500"
                          : "border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-[#FF5500]"
                      }`}
                    ></textarea>
                  </div>
                  {fieldErrors.address && (
                    <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.address}</p>
                  )}
                </div>

                {/* City & Postal Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                      {pick("Kota", "City")}
                    </label>
                    <input
                      required
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      type="text"
                      placeholder="e.g. Jakarta Selatan"
                      className={`w-full bg-gray-50 dark:bg-gray-800 border text-gray-900 dark:text-white rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-800 transition-all ${
                        fieldErrors.city
                          ? "border-red-400 focus:border-red-500"
                          : "border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-[#FF5500]"
                      }`}
                    />
                    {fieldErrors.city && (
                      <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.city}</p>
                    )}
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 ml-1">
                      {pick("Kode Pos", "Postal Code")}
                    </label>
                    <input
                      required
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      type="text"
                      placeholder="e.g. 12345"
                      className={`w-full bg-gray-50 dark:bg-gray-800 border text-gray-900 dark:text-white rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-800 transition-all ${
                        fieldErrors.postalCode
                          ? "border-red-400 focus:border-red-500"
                          : "border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-[#FF5500]"
                      }`}
                    />
                    {fieldErrors.postalCode && (
                      <p className="text-xs text-red-500 mt-1 ml-1">{fieldErrors.postalCode}</p>
                    )}
                  </div>
                </div>

                {/* Save Address Option */}
                {!selectedAddressId && (
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#FF5500] focus:ring-[#FF5500]"
                      />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {pick("Simpan alamat untuk checkout lebih cepat", "Save address for faster checkout")}
                      </span>
                    </label>

                    {saveAddress && (
                      <div className="flex items-center gap-1.5">
                        {[
                          { value: "Home", label: pick("Rumah", "Home") },
                          { value: "Office", label: pick("Kantor", "Office") },
                          { value: "Other", label: pick("Lainnya", "Other") },
                        ].map((lbl) => (
                          <button
                            key={lbl.value}
                            type="button"
                            onClick={() => setAddressLabel(lbl.value)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                              addressLabel === lbl.value
                                ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
                                : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                            }`}
                          >
                            {lbl.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* === KANAN: RINGKASAN PESANAN (Sticky di Desktop) === */}
          {/* Mobile: Order 2 (Second), Desktop: Order 2 (Right) */}
          <div className="lg:col-span-5 order-2">
            <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-[2rem] shadow-lg dark:shadow-none border border-gray-100 dark:border-gray-800 lg:sticky lg:top-32">
              <h2 className="font-bold text-xl text-gray-900 dark:text-white mb-6 flex items-center justify-between">
                {pick("Ringkasan Pesanan", "Order Summary")}
                <span className="text-sm font-medium text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  {cartItems.length} {pick("Item", "Items")}
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 inline-block px-2 py-0.5 rounded-md">
                          {pick(`Ukuran: ${item.size} | Jml: ${item.quantity}`, `Size: ${item.size} | Qty: ${item.quantity}`)}
                        </p>
                        {item.available_stock != null && item.available_stock <= 0 && (
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 rounded">
                            {pick("Habis", "Sold Out")}
                          </span>
                        )}
                        {item.available_stock != null &&
                          item.available_stock > 0 &&
                          item.stock_status === "low_stock" && (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                              {pick(`Sisa ${item.available_stock}`, `${item.available_stock} left`)}
                            </span>
                          )}
                      </div>
                    </div>
                    {/* Harga Total per Item */}
                    <p className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap">
                      {formatRupiah(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Rincian Biaya */}
              <div className="border-t border-dashed border-gray-200 dark:border-gray-800 pt-4 space-y-3">
                <div className="flex justify-between text-sm font-medium text-gray-500 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatRupiah(totalPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium text-gray-500 dark:text-gray-400">
                  <span>{pick("Pengiriman", "Shipping")}</span>
                  <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                    {pick("Gratis Ongkir", "Free Shipping")}
                  </span>
                </div>
                {/* Display Discount if applied */}
                {discount.type && (
                  <div className="flex justify-between text-sm font-medium text-green-600 dark:text-green-400">
                    <span>{pick("Diskon", "Discount")} ({discount.code})</span>
                    <span className="font-bold">
                      -{formatRupiah(totalPrice - finalPrice)}
                    </span>
                  </div>
                )}
                {/* Bisa tambah Tax disini jika ada */}
                <div className="flex justify-between items-end mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                    {pick("Total Bayar", "Total To Pay")}
                  </span>
                  <span className="text-2xl md:text-3xl font-black text-[#FF5500] leading-none">
                    {formatRupiah(finalPrice)}
                  </span>
                </div>
              </div>

              {/* Tombol Bayar Slider (Hanya di Desktop) */}
              <div ref={desktopSlotRef} className="hidden md:block w-full mt-8">
                <SlideCommit
                  label={pick("Geser untuk pesan", "Slide to place order")}
                  doneLabel={pick("Pesanan Dibuat", "Order Placed")}
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
                {pick("Pembayaran Aman · QRIS, Virtual Account & E-Wallet", "Secure Payment · QRIS, Virtual Account & E-Wallet")}
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
              {pick("Total Bayar", "Total to Pay")}
            </span>
            <span className="text-xl font-black text-[#FF5500] leading-none">
              {formatRupiah(finalPrice)}
            </span>
          </div>
          <div ref={mobileSlotRef} className="w-full">
            <SlideCommit
              label={pick("Geser untuk pesan", "Slide to place order")}
              doneLabel={pick("Pesanan Dibuat", "Order Placed")}
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

      <PaymentModal
        isOpen={Boolean(pendingPaymentOrder)}
        order={pendingPaymentOrder}
        onPaid={() => {
          setPendingPaymentOrder(null);
          navigate("/orders", { replace: true });
        }}
        onPending={() => {
          setPendingPaymentOrder(null);
          toast(
            pick(
              "Pesanan tersimpan sebagai Menunggu Pembayaran.",
              "Order saved as Pending Payment."
            )
          );
          navigate("/orders", { replace: true });
        }}
        onExpired={() => {
          setPendingPaymentOrder(null);
          navigate("/orders", { replace: true });
        }}
        onClose={() => {
          setPendingPaymentOrder(null);
          navigate("/orders", { replace: true });
        }}
      />
    </div>
  );
}

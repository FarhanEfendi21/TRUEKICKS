import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api, { logout } from "../lib/api";
import { formatRupiah, getOrderStatusBadge } from "../lib/pricing";
import { translateOrderStatus } from "../lib/translations";
import { useLanguage } from "../Context/LanguageContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import OrderTrackingTimeline from "../components/OrderTrackingTimeline";
import PaymentModal from "../components/PaymentModal";
import { openMidtransSnap } from "../lib/midtransSnap";

export default function Profile() {
  const navigate = useNavigate();
  const { language, setLanguage, locale, pick } = useLanguage();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileImage, setProfileImage] = useState(
    localStorage.getItem('profileImage') || null
  );

  // Order History & Saved Address States
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);

  const [user, setUser] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user'));
      return storedUser || { full_name: 'Guest', email: 'guest@truekicks.com' };
    } catch {
      return { full_name: 'Guest', email: 'guest@truekicks.com' };
    }
  });
  const isGuest = !user || !user.id || user.email === 'guest@truekicks.com' || user.full_name === 'Guest';

  const [editForm, setEditForm] = useState({ full_name: user.full_name });
  const [isSaving, setIsSaving] = useState(false);

  // Close modals on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setShowEditModal(false);
        setShowLogoutModal(false);
      }
    };
    if (showEditModal || showLogoutModal) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showEditModal, showLogoutModal]);

  // Fetch Order History
  useEffect(() => {
    const fetchOrders = async () => {
      if (isGuest || !user.id) {
        setLoadingOrders(false);
        return;
      }
      try {
        const response = await api.get(`/api/orders/user/${user.id}`);
        setOrders(response.data || []);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchOrders();
  }, [user.id, isGuest]);

  // Fetch Saved Shipping Addresses (Cloud + localStorage fallback)
  useEffect(() => {
    if (isGuest || !user.id) {
      setSavedAddresses([]);
      return;
    }

    const localKey = `savedAddresses_${user.id}`;
    const readLocal = () => {
      try {
        const raw = localStorage.getItem(localKey);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    };

    const loadAddresses = async () => {
      const localList = readLocal();
      setSavedAddresses(localList);
      try {
        const res = await api.get("/api/addresses", { skipAuthRedirect: true });
        if (res.data?.synced && Array.isArray(res.data.addresses)) {
          setSavedAddresses(res.data.addresses);
          localStorage.setItem(localKey, JSON.stringify(res.data.addresses));
        }
      } catch {
        // Keep local fallback
      }
    };

    loadAddresses();
  }, [user.id, isGuest]);

  const handleDeleteAddress = async (addrId) => {
    const next = savedAddresses.filter((a) => String(a.id) !== String(addrId));
    setSavedAddresses(next);
    if (user?.id) {
      localStorage.setItem(`savedAddresses_${user.id}`, JSON.stringify(next));
    }
    try {
      await api.delete(`/api/addresses/${addrId}`, { skipAuthRedirect: true });
    } catch {
      // Already removed locally
    }
    toast.success(pick("Alamat dihapus", "Address removed"));
  };

  const updateSingleOrder = (updatedOrder) => {
    if (!updatedOrder?.id) return;
    setOrders((prev) =>
      prev.map((item) =>
        String(item.id) === String(updatedOrder.id) ? updatedOrder : item
      )
    );
  };

  const handlePayOrder = async (order) => {
    if (!order?.id || payingOrderId) return;
    setPayingOrderId(order.id);
    try {
      const res = await api.post(`/api/orders/${order.id}/pay`);
      const payment = res.data?.payment;
      const refreshedOrder = res.data?.order || order;
      updateSingleOrder(refreshedOrder);

      if (
        payment &&
        payment.mode !== "sandbox_simulator" &&
        (payment.token || payment.redirect_url)
      ) {
        await openMidtransSnap({
          token: payment.token,
          clientKey: payment.client_key,
          snapScriptUrl: payment.snap_script_url,
          redirectUrl: payment.redirect_url,
          onSuccess: async () => {
            try {
              const statusRes = await api.get(
                `/api/orders/${order.id}/payment-status`
              );
              if (statusRes.data?.order) {
                updateSingleOrder(statusRes.data.order);
              }
            } catch {
              // Webhook reconciles asynchronously
            }
            toast.success(
              pick("Pembayaran berhasil dikonfirmasi!", "Payment confirmed!")
            );
          },
          onPending: () => {
            toast(
              pick(
                "Pembayaran masih menunggu konfirmasi.",
                "Payment is still awaiting confirmation."
              )
            );
          },
          onError: () => {
            toast.error(
              pick(
                "Pembayaran gagal. Silakan coba lagi.",
                "Payment failed. Please try again."
              )
            );
          },
          onClose: () => {},
        });
      } else {
        setActivePaymentOrder(refreshedOrder);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          pick(
            "Gagal memulai pembayaran. Silakan coba lagi.",
            "Failed to initiate payment. Please try again."
          )
      );
    } finally {
      setPayingOrderId(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const handleLogout = async () => {
    await logout();
    localStorage.removeItem("profileImage");
    navigate("/login");
  };

  const getInitials = (name) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
        localStorage.setItem('profileImage', reader.result);
        window.dispatchEvent(new Event("storage"));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfileImage = () => {
    setProfileImage(null);
    localStorage.removeItem('profileImage');
    window.dispatchEvent(new Event("storage"));
  };

  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) {
      toast.error(pick("Nama tidak boleh kosong!", "Name cannot be empty!"));
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.put(`/api/users/${user.id}`, {
        full_name: editForm.full_name.trim()
      });

      if (response.data.user) {
        const updatedUser = { ...user, full_name: response.data.user.full_name };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setEditForm({ full_name: updatedUser.full_name });
        window.dispatchEvent(new Event("storage"));
        setShowEditModal(false);
        toast.success(pick("Profil berhasil diperbarui!", "Profile updated!"));
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(
        error.response?.data?.error ||
          pick("Gagal memperbarui profil. Silakan coba lagi.", "Failed to update profile. Please try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-poppins transition-colors duration-300">
        <Navbar />

        <div className="pt-20 pb-24 px-4 max-w-2xl mx-auto">

          {/* Profile Header - Minimalist */}
          <div className="py-8 text-center">
            {/* Avatar */}
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-gray-50 dark:border-gray-700 shadow-sm">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold text-gray-400 dark:text-gray-300">{getInitials(user.full_name)}</span>
                )}
              </div>
              {/* Photo edit removed - only available in Edit Profile modal */}
            </div>

            {/* Name & Email */}
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{user.full_name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>

            {isGuest && (
              <span className="inline-block mt-3 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/15 px-3 py-1 rounded-full">
                {pick("Mode Tamu", "Guest Mode")}
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3 mb-6">
            {isGuest ? (
              <button
                onClick={() => navigate("/login")}
                className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                {pick("Masuk / Daftar", "Create Account")}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {pick("Edit Profil", "Edit Profile")}
                </button>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="py-3 px-6 text-red-500 dark:text-red-400 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900 transition-colors"
                >
                  {pick("Keluar", "Logout")}
                </button>
              </>
            )}
          </div>

          {/* Language Preference Bar */}
          <div className="mb-8 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {pick("Bahasa Aplikasi & Kixo AI", "App & Kixo AI Language")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pick("Pilih bahasa utama untuk seluruh toko dan asisten AI.", "Choose your preferred storefront and AI assistant language.")}
              </p>
            </div>
            <div className="flex items-center rounded-full bg-white dark:bg-gray-950 p-1 border border-gray-200 dark:border-gray-800 flex-shrink-0">
              <button
                type="button"
                onClick={() => setLanguage("id")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  language === "id"
                    ? "bg-gray-950 dark:bg-[#FF5500] text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Indonesia
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  language === "en"
                    ? "bg-gray-950 dark:bg-[#FF5500] text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-800 mb-6"></div>

          {/* Order History Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {pick("Riwayat Pesanan", "Order History")}
              </h2>
              <span className="text-xs text-gray-400">
                {orders.length} {pick("pesanan", "orders")}
              </span>
            </div>

            {isGuest ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-transparent dark:border-gray-800">
                <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-sm text-gray-400">{pick("Masuk untuk melihat pesanan", "Login to view orders")}</p>
              </div>
            ) : loadingOrders ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse h-16 bg-gray-50 dark:bg-gray-900 rounded-xl"></div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-transparent dark:border-gray-800">
                <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-sm text-gray-400 mb-3">{pick("Belum ada pesanan", "No orders yet")}</p>
                <button
                  onClick={() => navigate("/sneakers")}
                  className="text-sm font-medium text-black dark:text-white underline underline-offset-4"
                >
                  {pick("Mulai Belanja", "Start Shopping")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-gray-50 dark:bg-gray-900 border border-transparent dark:border-gray-800 rounded-xl overflow-hidden"
                  >
                    {/* Order Row */}
                    <div
                      onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center shadow-sm">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{order.items?.length || 0} Item{(order.items?.length || 0) > 1 ? 's' : ''}</p>
                          <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatRupiah(order.total_price)}</p>
                          <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${getOrderStatusBadge(order.status)}`}>
                            {translateOrderStatus(order.status, language)}
                          </span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedOrder === order.id ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Items + Tracking Timeline + Invoice PDF + Auth Tag */}
                    {expandedOrder === order.id && (
                      <div className="px-4 pb-4 space-y-2">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg">
                            <div className="w-10 h-10 bg-white rounded flex items-center justify-center p-1 flex-shrink-0">
                              <img
                                src={item.image || item.image_url}
                                alt={item.name}
                                className="w-full h-full object-contain mix-blend-multiply"
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/40'; }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                              <p className="text-[10px] text-gray-400">
                                {pick(`Ukuran ${item.size} × ${item.quantity}`, `Size ${item.size} × ${item.quantity}`)}
                              </p>
                            </div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{formatRupiah(item.price * item.quantity)}</p>
                          </div>
                        ))}
                        <OrderTrackingTimeline
                          order={order}
                          compact
                          onPayNow={handlePayOrder}
                          paying={payingOrderId === order.id}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved Shipping Addresses Section */}
          {!isGuest && (
            <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {pick("Alamat Tersimpan", "Saved Addresses")}
                </h2>
                <span className="text-xs text-gray-400">
                  {savedAddresses.length} {pick("tersimpan", "saved")}
                </span>
              </div>

              {savedAddresses.length === 0 ? (
                <div className="text-center py-8 px-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-transparent dark:border-gray-800">
                  <p className="text-xs text-gray-400">
                    {pick(
                      'Belum ada alamat tersimpan. Centang "Simpan alamat" saat checkout agar otomatis terisi.',
                      'No saved shipping addresses yet. Check "Save address" during checkout for 1-click autofill.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">
                            {addr.label || "Home"}
                          </span>
                          {addr.is_default && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-500/15 text-[#FF5500]">
                              {pick("Utama", "Default")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                          {addr.full_name} · {addr.phone}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {addr.address}, {addr.city} {addr.postal_code}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        aria-label={`Remove ${addr.label || "saved"} address`}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex-shrink-0"
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
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Edit Modal - With Profile Photo Section */}
        {showEditModal && (
          <div data-lenis-prevent className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div data-lenis-prevent className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-xl max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sticky top-0 bg-white dark:bg-gray-900 z-10 pb-2">
                {pick("Edit Profil", "Edit Profile")}
              </h3>

              {/* Profile Photo Section */}
              <div className="flex items-center gap-4 mb-5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-semibold text-gray-400 dark:text-gray-300">{getInitials(user.full_name)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    {pick("Foto Profil", "Profile Photo")}
                  </p>
                  <div className="flex gap-2">
                    <label className="text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                      {pick("Ganti", "Change")}
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                    {profileImage && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <button
                          type="button"
                          onClick={removeProfileImage}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          {pick("Hapus", "Remove")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    {pick("Nama", "Name")}
                  </label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:border-gray-400 dark:focus:border-[#FF5500] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full px-3 py-2.5 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-400"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6 sticky bottom-0 bg-white dark:bg-gray-900 pt-2 pb-1">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {pick("Batal", "Cancel")}
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-black dark:bg-[#FF5500] text-white text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {isSaving ? pick("Menyimpan...", "Saving...") : pick("Simpan", "Save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout Modal - Minimalist */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl w-full max-w-xs p-6 shadow-xl text-center">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                {pick("Keluar akun?", "Logout?")}
              </h3>
              <p className="text-sm text-gray-400 mb-6">
                {pick("Kamu perlu masuk lagi untuk berbelanja.", "You'll need to login again")}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {pick("Batal", "Cancel")}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                >
                  {pick("Keluar", "Logout")}
                </button>
              </div>
            </div>
          </div>
        )}

        <Footer showOnMobile={true} />
      </div>

      <PaymentModal
        isOpen={Boolean(activePaymentOrder)}
        order={activePaymentOrder}
        onPaid={(updated) => {
          updateSingleOrder(updated);
          setActivePaymentOrder(null);
        }}
        onPending={() => setActivePaymentOrder(null)}
        onExpired={(updated) => {
          updateSingleOrder(updated);
          setActivePaymentOrder(null);
        }}
        onClose={() => setActivePaymentOrder(null)}
      />
    </>
  );
}
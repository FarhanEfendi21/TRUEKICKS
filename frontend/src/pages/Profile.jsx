import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { logout } from "../lib/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Profile() {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileImage, setProfileImage] = useState(
    localStorage.getItem('profileImage') || null
  );

  // Order History States
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);

  const storedUser = JSON.parse(localStorage.getItem('user'));
  const isGuest = !storedUser || storedUser.email === 'guest@truekicks.com' || storedUser.full_name === 'Guest';
  const user = storedUser || { full_name: 'Guest', email: 'guest@truekicks.com' };

  const [editForm, setEditForm] = useState({ full_name: user.full_name });
  const [isSaving, setIsSaving] = useState(false);

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

  const formatPrice = (price) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
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
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfileImage = () => {
    setProfileImage(null);
    localStorage.removeItem('profileImage');
  };

  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) {
      alert("Name cannot be empty!");
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
        setShowEditModal(false);
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert(error.response?.data?.error || "Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'text-green-600 bg-green-50';
      case 'processing':
      case 'shipped':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
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
                Guest Mode
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3 mb-8">
            {isGuest ? (
              <button
                onClick={() => navigate("/login")}
                className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                Create Account
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="py-3 px-6 text-red-500 dark:text-red-400 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-200 dark:hover:border-red-900 transition-colors"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-800 mb-6"></div>

          {/* Order History Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Order History</h2>
              <span className="text-xs text-gray-400">{orders.length} orders</span>
            </div>

            {isGuest ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-transparent dark:border-gray-800">
                <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-sm text-gray-400">Login to view orders</p>
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
                <p className="text-sm text-gray-400 mb-3">No orders yet</p>
                <button
                  onClick={() => navigate("/sneakers")}
                  className="text-sm font-medium text-black dark:text-white underline underline-offset-4"
                >
                  Start Shopping
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
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatPrice(order.total_price)}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                            {order.status || 'Processing'}
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

                    {/* Expanded Items */}
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
                              <p className="text-[10px] text-gray-400">Size {item.size} × {item.quantity}</p>
                            </div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{formatPrice(item.price * item.quantity)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Edit Modal - With Profile Photo Section */}
        {showEditModal && (
          <div data-lenis-prevent className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div data-lenis-prevent className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-xl max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sticky top-0 bg-white dark:bg-gray-900 z-10 pb-2">Edit Profile</h3>

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
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Profile Photo</p>
                  <div className="flex gap-2">
                    <label className="text-xs font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                      Change
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
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Name</label>
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
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-black dark:bg-[#FF5500] text-white text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save"}
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
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Logout?</h3>
              <p className="text-sm text-gray-400 mb-6">You'll need to login again</p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}

        <Footer showOnMobile={true} />
      </div>
    </>
  );
}
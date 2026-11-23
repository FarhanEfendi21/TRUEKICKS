import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatRupiah, getOrderStatusBadge } from "../lib/pricing";
import { translateOrderStatus } from "../lib/translations";
import { openMidtransSnap } from "../lib/midtransSnap";
import { useLanguage } from "../Context/LanguageContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Skeleton from "../components/Skeleton";
import OrderTrackingTimeline from "../components/OrderTrackingTimeline";
import PaymentModal from "../components/PaymentModal";

const getShortOrderId = (id) => {
  const raw = String(id || "");
  if (raw.includes("-")) return raw.split("-")[0].toUpperCase();
  return raw.padStart(5, "0");
};

const isOrderPendingPayment = (order) => {
  const statusLower = String(order?.status || "").toLowerCase();
  const payStatusLower = String(order?.payment_status || "").toLowerCase();
  return (
    statusLower === "pending payment" ||
    (statusLower === "pending" && payStatusLower !== "paid")
  );
};

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState({});
  const [activeFilter, setActiveFilter] = useState("all"); // all | pending | active | completed
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, locale, pick } = useLanguage();

  const updateSingleOrder = useCallback((updatedOrder) => {
    if (!updatedOrder?.id) return;
    setOrders((prev) =>
      prev.map((item) =>
        String(item.id) === String(updatedOrder.id) ? updatedOrder : item
      )
    );
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchOrders = async () => {
      let user = null;
      try {
        user = JSON.parse(localStorage.getItem("user"));
      } catch {
        user = null;
      }
      if (!user || !user.id || user.email?.includes("guest")) {
        navigate("/login", { replace: true, state: { from: "/orders" } });
        return;
      }

      try {
        const finishOrderId = searchParams.get("order");
        if (searchParams.get("payment") === "finish" && finishOrderId) {
          try {
            await api.get(
              `/api/orders/${encodeURIComponent(finishOrderId)}/payment-status`,
              { skipAuthRedirect: true }
            );
          } catch {
            // Reconcile best-effort; list fetch below still runs
          }
          setExpandedIds({ [String(finishOrderId)]: true });
          setSearchParams({}, { replace: true });
        }

        const response = await api.get(`/api/orders/user/${user.id}`);
        setOrders(response.data || []);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [navigate, searchParams, setSearchParams]);

  const toggleOrder = (orderId) => {
    const key = String(orderId);
    setExpandedIds((prev) => ({ ...prev, [key]: !prev[key] }));
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

  const filterCounts = useMemo(() => {
    const pending = orders.filter((o) => isOrderPendingPayment(o)).length;
    const active = orders.filter((o) =>
      ["paid", "processing", "packed", "shipped"].includes(
        String(o.status || "").toLowerCase()
      )
    ).length;
    const completed = orders.filter((o) =>
      ["delivered", "completed", "cancelled", "expired", "failed"].includes(
        String(o.status || "").toLowerCase()
      )
    ).length;
    return { all: orders.length, pending, active, completed };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === "pending") {
      return orders.filter((o) => isOrderPendingPayment(o));
    }
    if (activeFilter === "active") {
      return orders.filter((o) =>
        ["paid", "processing", "packed", "shipped"].includes(
          String(o.status || "").toLowerCase()
        )
      );
    }
    if (activeFilter === "completed") {
      return orders.filter((o) =>
        ["delivered", "completed", "cancelled", "expired", "failed"].includes(
          String(o.status || "").toLowerCase()
        )
      );
    }
    return orders;
  }, [activeFilter, orders]);

  const filterTabs = [
    { id: "all", label: pick("Semua", "All"), count: filterCounts.all },
    {
      id: "pending",
      label: pick("Belum Bayar", "Unpaid"),
      count: filterCounts.pending,
    },
    {
      id: "active",
      label: pick("Diproses", "In Progress"),
      count: filterCounts.active,
    },
    {
      id: "completed",
      label: pick("Selesai", "Finished"),
      count: filterCounts.completed,
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-poppins flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 w-full pt-28 md:pt-32 pb-28 max-w-4xl mx-auto px-4 md:px-6">
        {/* === MINIMALIST HEADER === */}
        <header className="pb-5 mb-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-950 dark:text-white">
              {pick("Pesanan Saya", "My Orders")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {pick(
                "Pilih pesanan untuk membuka rincian invoice, pelacakan, dan sertifikat.",
                "Select an order to view invoice details, tracking, and authenticity tag."
              )}
            </p>
          </div>
          {!loading && orders.length > 0 && (
            <span className="text-xs font-medium text-gray-400 tabular-nums">
              {orders.length} {pick("invoice", orders.length === 1 ? "invoice" : "invoices")}
            </span>
          )}
        </header>

        {/* === UNDERLINE FILTER BAR === */}
        {!loading && orders.length > 0 && (
          <div
            role="tablist"
            aria-label={pick("Filter pesanan", "Filter orders")}
            className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto no-scrollbar"
          >
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`pb-3 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                    active
                      ? "border-gray-950 dark:border-white text-gray-950 dark:text-white"
                      : "border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[11px] tabular-nums opacity-65">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* === CONTENT === */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="84px" className="rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-base font-bold text-gray-900 dark:text-white mb-1.5">
              {pick("Belum ada pesanan", "No orders yet")}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              {pick(
                "Pesanan dan invoice Anda akan tersimpan rapi di sini.",
                "Your orders and digital invoices will appear here."
              )}
            </p>
            <button
              type="button"
              onClick={() => navigate("/sneakers")}
              className="h-10 px-6 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-xs font-semibold tracking-wide hover:opacity-90 transition-opacity"
            >
              {pick("Mulai Belanja", "Start Shopping")}
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-14 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {pick("Tidak ada pesanan pada filter ini", "No orders in this filter")}
            </p>
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className="mt-3 text-xs font-semibold text-gray-500 underline underline-offset-4 hover:text-gray-950 dark:hover:text-white"
            >
              {pick("Tampilkan semua pesanan", "Show all orders")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const key = String(order.id);
              const isOpen = Boolean(expandedIds[key]);
              const isPendingPay = isOrderPendingPayment(order);
              const shortId = getShortOrderId(order.id);
              const items = Array.isArray(order.items) ? order.items : [];
              const firstItem = items[0];
              const extraCount = Math.max(0, items.length - 1);
              const totalQty = items.reduce(
                (sum, it) => sum + (Number(it.quantity) || 1),
                0
              );
              const discountAmount = Number(order.discount_amount) || 0;
              const subtotal = Number(order.total_price || 0) + discountAmount;
              const formattedDate = new Date(order.created_at).toLocaleDateString(
                locale,
                {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }
              );

              return (
                <section
                  key={order.id}
                  className={`rounded-2xl border bg-white dark:bg-gray-950 transition-colors ${
                    isOpen
                      ? "border-gray-300 dark:border-gray-700"
                      : "border-gray-200/80 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                  }`}
                >
                  {/* === COLLAPSED SUMMARY TRIGGER === */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    aria-controls={`invoice-panel-${shortId}`}
                    onClick={() => toggleOrder(order.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleOrder(order.id);
                      }
                    }}
                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer select-none"
                  >
                    {/* Left: Thumbnail + Invoice Meta */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#F6F6F6] dark:bg-gray-100 flex items-center justify-center p-1.5 flex-shrink-0">
                        {firstItem?.image ? (
                          <img
                            src={firstItem.image}
                            alt={firstItem.name || "Product"}
                            className="w-full h-full object-contain mix-blend-multiply"
                          />
                        ) : (
                          <span className="text-xs font-bold text-gray-400">
                            TK
                          </span>
                        )}
                        {extraCount > 0 && (
                          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-gray-950 text-white text-[9px] font-bold leading-none tabular-nums">
                            +{extraCount}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
                          <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                            INV-{shortId}
                          </span>
                          <span>·</span>
                          <span>{formattedDate}</span>
                        </div>

                        <p className="text-sm font-bold text-gray-950 dark:text-white truncate mt-0.5">
                          {firstItem?.name || pick("Pesanan TrueKicks", "TrueKicks Order")}
                          {extraCount > 0 && (
                            <span className="font-medium text-gray-400">
                              {" "}
                              {pick(`(+${extraCount} lainnya)`, `(+${extraCount} more)`)}
                            </span>
                          )}
                        </p>

                        {/* Mobile compact status & total */}
                        <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getOrderStatusBadge(
                              order.status
                            )}`}
                          >
                            {translateOrderStatus(order.status, language)}
                          </span>
                          <span className="text-xs font-bold text-gray-950 dark:text-white tabular-nums">
                            {formatRupiah(order.total_price)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status, Total, Quick Pay & Chevron */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-950 dark:text-white tabular-nums">
                          {formatRupiah(order.total_price)}
                        </span>
                        <span
                          className={`mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getOrderStatusBadge(
                            order.status
                          )}`}
                        >
                          {translateOrderStatus(order.status, language)}
                        </span>
                      </div>

                      {isPendingPay && (
                        <button
                          type="button"
                          disabled={payingOrderId === order.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePayOrder(order);
                          }}
                          className="h-8 px-3.5 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-[11px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {payingOrderId === order.id
                            ? "..."
                            : pick("Bayar", "Pay")}
                        </button>
                      )}

                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-gray-400 transition-transform duration-300 ${
                          isOpen
                            ? "rotate-180 text-gray-950 dark:text-white bg-gray-100 dark:bg-gray-900"
                            : ""
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  {/* === EXPANDABLE INVOICE DROPDOWN PANEL === */}
                  <div
                    id={`invoice-panel-${shortId}`}
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-gray-100 dark:border-gray-900 space-y-5">
                        {/* Invoice Metadata Grid */}
                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                              {pick("No. Invoice", "Invoice No.")}
                            </dt>
                            <dd className="font-mono font-semibold text-gray-950 dark:text-white mt-1">
                              INV-{shortId}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                              {pick("Pembayaran", "Payment")}
                            </dt>
                            <dd className="font-medium text-gray-800 dark:text-gray-200 mt-1">
                              {order.payment_method ||
                                (isPendingPay
                                  ? pick("Belum dibayar", "Unpaid")
                                  : pick("Terverifikasi", "Verified"))}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                              {pick("Penerima", "Recipient")}
                            </dt>
                            <dd className="font-medium text-gray-800 dark:text-gray-200 mt-1 truncate">
                              {order.full_name || "-"}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                              {pick("Tujuan", "Destination")}
                            </dt>
                            <dd className="font-medium text-gray-800 dark:text-gray-200 mt-1 line-clamp-2">
                              {[order.city, order.postal_code]
                                .filter(Boolean)
                                .join(" ") ||
                                order.address ||
                                "-"}
                            </dd>
                          </div>
                        </dl>

                        {/* Line Items */}
                        <div className="border-t border-gray-100 dark:border-gray-900 pt-4">
                          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                            <span>
                              {pick("Rincian Produk", "Items")} ({totalQty})
                            </span>
                            <span>{pick("Subtotal", "Subtotal")}</span>
                          </div>

                          <div className="divide-y divide-gray-100 dark:divide-gray-900">
                            {items.map((item, idx) => (
                              <div
                                key={idx}
                                onClick={() =>
                                  item.id &&
                                  navigate(
                                    `/product/${item.productType || "sneakers"}/${item.id}`
                                  )
                                }
                                className={`py-3 flex items-center gap-3.5 ${
                                  item.id
                                    ? "cursor-pointer group"
                                    : ""
                                }`}
                              >
                                <div className="w-12 h-12 rounded-xl bg-[#F6F6F6] dark:bg-gray-100 flex items-center justify-center p-1.5 flex-shrink-0">
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-contain mix-blend-multiply"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-950 dark:text-white truncate group-hover:text-[#FF5500] transition-colors">
                                    {item.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {pick(
                                      `Ukuran ${item.size} · ${item.quantity} × ${formatRupiah(item.price)}`,
                                      `Size ${item.size} · ${item.quantity} × ${formatRupiah(item.price)}`
                                    )}
                                  </p>
                                </div>
                                <p className="text-sm font-semibold text-gray-950 dark:text-white tabular-nums flex-shrink-0">
                                  {formatRupiah(
                                    (Number(item.price) || 0) *
                                      (Number(item.quantity) || 1)
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Invoice Totals Summary */}
                          <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-800 space-y-1.5 text-xs">
                            {discountAmount > 0 && (
                              <>
                                <div className="flex justify-between text-gray-500 dark:text-gray-400">
                                  <span>Subtotal</span>
                                  <span className="tabular-nums">
                                    {formatRupiah(subtotal)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                  <span>
                                    {pick("Diskon", "Discount")}
                                    {order.coupon_code
                                      ? ` (${order.coupon_code})`
                                      : ""}
                                  </span>
                                  <span className="tabular-nums font-medium">
                                    -{formatRupiah(discountAmount)}
                                  </span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between items-baseline pt-1 text-sm font-bold text-gray-950 dark:text-white">
                              <span>{pick("Total Invoice", "Invoice Total")}</span>
                              <span className="tabular-nums">
                                {formatRupiah(order.total_price)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Tracking Stepper, Pay Now, Auth Tag & Invoice PDF */}
                        <OrderTrackingTimeline
                          order={order}
                          onPayNow={handlePayOrder}
                          paying={payingOrderId === order.id}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

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
    </div>
  );
}

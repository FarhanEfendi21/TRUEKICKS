import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { downloadOrderInvoicePdf } from "../lib/invoicePdf";
import { useLanguage } from "../Context/LanguageContext";

const localizeStep = (step, courier, isEn) => {
  const map = {
    awaiting_payment: {
      label: isEn ? "Awaiting Payment" : "Menunggu Pembayaran",
      description: isEn
        ? "Complete payment via QRIS, Virtual Account, or e-wallet."
        : "Selesaikan pembayaran via QRIS, Virtual Account, atau e-wallet.",
    },
    placed: {
      label: isEn ? "Payment Confirmed" : "Pembayaran Dikonfirmasi",
      description: isEn
        ? "Payment verified and order confirmed."
        : "Pembayaran terverifikasi dan pesanan dikonfirmasi.",
    },
    processing: {
      label: isEn ? "Legit Check & Packed" : "Cek Keaslian & Dikemas",
      description: isEn
        ? "Multi-point authenticity inspection and secure packaging."
        : "Pemeriksaan keaslian berlapis dan pengemasan aman.",
    },
    shipped: {
      label: isEn ? `In Transit (${courier})` : `Dalam Pengiriman (${courier})`,
      description: isEn
        ? "Handed over to courier for delivery."
        : "Paket telah diserahkan ke kurir untuk dikirim.",
    },
    delivered: {
      label: isEn ? "Delivered" : "Terkirim",
      description: isEn
        ? "Package delivered to your address."
        : "Paket telah diterima di alamat tujuan.",
    },
    expired: {
      label: isEn ? "Payment Expired" : "Pembayaran Kedaluwarsa",
      description: isEn
        ? "Payment window expired and stock was released."
        : "Batas waktu pembayaran habis dan stok dikembalikan.",
    },
    cancelled: {
      label: isEn ? "Cancelled" : "Dibatalkan",
      description: isEn ? "Order was cancelled." : "Pesanan dibatalkan.",
    },
  };
  const localized = map[step.key];
  return localized
    ? { ...step, label: localized.label, description: localized.description }
    : step;
};

const DEFAULT_STEPS = (status = "Processing", courier = "TrueKicks Express", isEn = false) => {
  const s = status.toLowerCase();
  const isCancelled = s === "cancelled" || s === "expired" || s === "failed";
  if (isCancelled) {
    return [
      localizeStep({ key: "placed", completed: true, active: false }, courier, isEn),
      localizeStep(
        { key: s === "expired" ? "expired" : "cancelled", completed: true, active: true },
        courier,
        isEn
      ),
    ];
  }
  const rankMap = {
    "pending payment": 0,
    pending: 0,
    paid: 1,
    processing: 1,
    packed: 1,
    shipped: 2,
    delivered: 3,
    completed: 3,
  };
  const rank = rankMap[s] ?? 1;
  const isPendingPay = s === "pending payment" || s === "pending";
  return [
    localizeStep(
      { key: isPendingPay ? "awaiting_payment" : "placed", completed: !isPendingPay, active: rank === 0 },
      courier,
      isEn
    ),
    localizeStep({ key: "processing", completed: rank >= 1, active: rank === 1 }, courier, isEn),
    localizeStep({ key: "shipped", completed: rank >= 2, active: rank === 2 }, courier, isEn),
    localizeStep({ key: "delivered", completed: rank >= 3, active: rank === 3 }, courier, isEn),
  ];
};

export default function OrderTrackingTimeline({
  order,
  compact = false,
  onPayNow = null,
  paying = false,
}) {
  const [downloading, setDownloading] = useState(false);
  const { isEnglish, pick } = useLanguage();

  if (!order) return null;

  const courier = order.courier || "TrueKicks Express";
  const rawId = String(order.id || "00000");
  const shortId = rawId.includes("-")
    ? rawId.split("-")[0].toUpperCase()
    : rawId.padStart(5, "0");
  const trackingNumber = order.tracking_number || `TKX-${shortId}`;
  const authenticityCode = order.authenticity_code || null;
  const steps =
    Array.isArray(order.timeline) && order.timeline.length > 0
      ? order.timeline.map((step) => localizeStep(step, courier, isEnglish))
      : DEFAULT_STEPS(order.status, courier, isEnglish);
  const statusLower = (order.status || "").toLowerCase();
  const paymentStatusLower = (order.payment_status || "").toLowerCase();
  const isCancelled =
    statusLower === "cancelled" || statusLower === "expired" || statusLower === "failed";
  const isPendingPayment =
    !isCancelled &&
    (statusLower === "pending payment" ||
      (statusLower === "pending" && paymentStatusLower !== "paid"));

  const handleCopyTracking = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(trackingNumber);
      toast.success(
        pick(`Resi ${trackingNumber} disalin`, `Tracking ${trackingNumber} copied`)
      );
    } catch {
      toast.error(pick("Gagal menyalin nomor resi", "Failed to copy tracking number"));
    }
  };

  const handleDownloadPdf = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadOrderInvoicePdf(order);
      toast.success(
        pick(`Invoice #${shortId} diunduh`, `Invoice #${shortId} downloaded`)
      );
    } catch (err) {
      console.error("Invoice PDF error:", err);
      toast.error(pick("Gagal membuat PDF invoice", "Failed to generate invoice PDF"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
      {/* Tracking Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {courier}
          </span>
          {order.payment_method && (
            <>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {order.payment_method}
              </span>
            </>
          )}
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <button
            type="button"
            onClick={handleCopyTracking}
            title={pick("Salin nomor resi", "Copy tracking number")}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors"
          >
            <span>{trackingNumber}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
              />
            </svg>
          </button>
        </div>

        {/* Action Pills: Pay Now (if Pending Payment) + Authenticity + Invoice PDF */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPendingPayment && onPayNow && (
            <button
              type="button"
              disabled={paying}
              onClick={(e) => {
                e.stopPropagation();
                onPayNow(order);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FF5500] hover:bg-orange-600 text-white text-[11px] font-bold disabled:opacity-50 transition-colors"
            >
              <span>
                {paying
                  ? pick("Menyiapkan...", "Loading...")
                  : pick("Bayar Sekarang", "Pay Now")}
              </span>
            </button>
          )}

          {authenticityCode && !isPendingPayment && !isCancelled && (
            <Link
              to={`/verify/${encodeURIComponent(authenticityCode)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold hover:opacity-90 transition-opacity"
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
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
              <span>{compact ? pick("Sertifikat", "Auth Tag") : authenticityCode}</span>
            </Link>
          )}

          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            <span>{downloading ? pick("Membuat...", "Generating...") : "Invoice PDF"}</span>
          </button>
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className={`grid grid-cols-1 ${steps.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-4"} gap-3`}>
        {steps.map((step, idx) => {
          const isDone = step.completed;
          const isCurrent = step.active;
          const dotColor =
            isCancelled && (step.key === "cancelled" || step.key === "expired")
              ? "bg-red-500 text-white border-red-500"
              : isDone
              ? "bg-gray-900 dark:bg-[#FF5500] text-white border-gray-900 dark:border-[#FF5500]"
              : "bg-white dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700";

          return (
            <div
              key={step.key}
              className={`relative flex sm:flex-col items-start gap-3 sm:gap-2 p-3 rounded-xl border transition-colors ${
                isCurrent
                  ? "bg-white dark:bg-gray-800/80 border-gray-300 dark:border-gray-700 shadow-sm"
                  : "bg-gray-50/70 dark:bg-gray-900/60 border-gray-100 dark:border-gray-800/80"
              }`}
            >
              <div className="flex items-center gap-2 w-full sm:justify-between">
                <span
                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${dotColor}`}
                >
                  {isDone ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      className="w-3 h-3"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                {isCurrent && !isCancelled && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF5500] bg-orange-50 dark:bg-orange-500/15 px-2 py-0.5 rounded-full">
                    {pick("Saat Ini", "Current")}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p
                  className={`text-xs font-bold leading-snug ${
                    isDone
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {step.label}
                </p>
                {!compact && step.description && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

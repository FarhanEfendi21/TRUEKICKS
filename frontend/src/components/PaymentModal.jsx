import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatRupiah } from "../lib/pricing";
import { useLanguage } from "../Context/LanguageContext";

const PAYMENT_CHANNELS = [
  { id: "qris", label: "QRIS", metaId: "Instan", metaEn: "Instant" },
  { id: "bca_va", label: "BCA", metaId: "Virtual Account", metaEn: "Virtual Account" },
  { id: "mandiri_va", label: "Mandiri", metaId: "Virtual Account", metaEn: "Virtual Account" },
  { id: "gopay", label: "GoPay", metaId: "E-Wallet", metaEn: "E-Wallet" },
];

export default function PaymentModal({
  isOpen,
  order,
  onClose,
  onPaid,
  onPending,
  onExpired,
}) {
  const { pick } = useLanguage();
  const [selectedChannel, setSelectedChannel] = useState("qris");
  const [submittingAction, setSubmittingAction] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEsc = (e) => {
      if (e.key === "Escape" && !submittingAction) {
        onPending ? onPending() : onClose?.();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen, onClose, onPending, submittingAction]);

  if (!isOpen || !order) return null;

  const shortOrderId = String(order.id || "").includes("-")
    ? String(order.id).split("-")[0].toUpperCase()
    : String(order.id || "");
  const formattedTotal = formatRupiah(order.total_price);

  const handleSimulate = async (action) => {
    setSubmittingAction(action);
    try {
      const res = await api.post("/api/payments/sandbox/simulate", {
        order_id: order.id,
        action,
        payment_type: selectedChannel,
      });

      if (action === "settlement") {
        toast.success(
          pick("Pembayaran berhasil dikonfirmasi.", "Payment confirmed.")
        );
        onPaid?.(res.data?.order || order);
      } else {
        toast(
          pick(
            "Pesanan dibatalkan · Stok dikembalikan.",
            "Order cancelled · Stock restored."
          )
        );
        onExpired?.(res.data?.order || order);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          pick(
            "Gagal memproses pembayaran.",
            "Failed to process payment."
          )
      );
    } finally {
      setSubmittingAction(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 dark:bg-black/70 backdrop-blur-[3px] font-poppins"
      onClick={() => {
        if (!submittingAction) {
          onPending ? onPending() : onClose?.();
        }
      }}
    >
      <div
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-label={pick("Pembayaran Pesanan", "Order Payment")}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[400px] bg-white dark:bg-gray-950 rounded-t-3xl sm:rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-2xl p-6 sm:p-7 space-y-6"
      >
        {/* Top Meta & Close */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-mono font-medium text-gray-500 dark:text-gray-400">
              #{shortOrderId}
            </span>
            <span>·</span>
            <span>Sandbox</span>
          </div>
          <button
            type="button"
            disabled={Boolean(submittingAction)}
            onClick={() => (onPending ? onPending() : onClose?.())}
            aria-label={pick("Tutup", "Close")}
            className="w-8 h-8 -mr-2 rounded-full text-gray-400 hover:text-gray-950 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Focal Amount */}
        <div className="pb-5 border-b border-gray-100 dark:border-gray-900">
          <p className="text-xs text-gray-400 mb-1">
            {pick("Total pembayaran", "Total due")}
          </p>
          <p className="text-3xl font-black tracking-tight tabular-nums text-gray-950 dark:text-white">
            {formattedTotal}
          </p>
        </div>

        {/* 2x2 Minimalist Method Grid */}
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {pick("Pilih metode", "Choose method")}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {PAYMENT_CHANNELS.map((ch) => {
              const selected = selectedChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  disabled={Boolean(submittingAction)}
                  onClick={() => setSelectedChannel(ch.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    selected
                      ? "border-gray-950 dark:border-white bg-gray-950/[0.03] dark:bg-white/[0.06]"
                      : "border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-bold ${
                        selected
                          ? "text-gray-950 dark:text-white"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {ch.label}
                    </span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        selected
                          ? "border-gray-950 dark:border-white bg-gray-950 dark:bg-white"
                          : "border-gray-300 dark:border-gray-700"
                      }`}
                    >
                      {selected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-gray-950" />
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {pick(ch.metaId, ch.metaEn)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary CTA + Quiet Secondary Links */}
        <div className="space-y-3.5 pt-1">
          <button
            type="button"
            disabled={Boolean(submittingAction)}
            onClick={() => handleSimulate("settlement")}
            className="w-full h-12 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-sm font-semibold hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50 transition-colors active:scale-[0.99]"
          >
            {submittingAction === "settlement"
              ? pick("Memproses...", "Processing...")
              : pick(`Bayar ${formattedTotal}`, `Pay ${formattedTotal}`)}
          </button>

          <div className="flex items-center justify-center gap-3 text-xs">
            <button
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={() => (onPending ? onPending() : onClose?.())}
              className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white transition-colors"
            >
              {pick("Bayar nanti", "Pay later")}
            </button>
            <span className="text-gray-200 dark:text-gray-800">·</span>
            <button
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={() => handleSimulate("expire")}
              className="font-medium text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              {submittingAction === "expire"
                ? pick("Membatalkan...", "Cancelling...")
                : pick("Batalkan pesanan", "Cancel order")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

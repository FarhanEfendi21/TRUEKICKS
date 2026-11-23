import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatRupiah } from "../lib/pricing";
import { useCart } from "../Context/CartContext";
import { useLanguage } from "../Context/LanguageContext";

const DEFAULT_SHOE_SIZES = ["39", "40", "41", "42", "43", "44", "45"];

const formatTimerMMSS = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
};

const readAuthenticatedUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || parsed.email?.includes("guest")) return null;
    return parsed;
  } catch {
    return null;
  }
};

export default function HypeQueueModal({ isOpen, drop, onClose }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { pick } = useLanguage();

  const [stage, setStage] = useState("joining"); // joining | waiting | granted | expired | error
  const [ticket, setTicket] = useState(null);
  const [queuePosition, setQueuePosition] = useState(32);
  const [queueProgress, setQueueProgress] = useState(8);
  const [reservationLeft, setReservationLeft] = useState(180);
  const [errorMsg, setErrorMsg] = useState("");
  const [variants, setVariants] = useState([]);
  const [variantsTracked, setVariantsTracked] = useState(false);
  const [selectedSize, setSelectedSize] = useState(null);

  const startQueueSession = useCallback(async () => {
    if (!drop) return;
    setStage("joining");
    setErrorMsg("");
    setTicket(null);
    setSelectedSize(null);
    setQueueProgress(8);

    try {
      const [queueRes, variantsRes] = await Promise.allSettled([
        api.post(`/api/drops/${drop.id}/queue/join`, {}, { skipAuthRedirect: true }),
        drop.product_id
          ? api.get(
              `/api/variants/${drop.product_type || "sneakers"}/${drop.product_id}`,
              { skipAuthRedirect: true }
            )
          : Promise.resolve(null),
      ]);

      if (variantsRes.status === "fulfilled" && variantsRes.value?.data?.variants) {
        setVariants(variantsRes.value.data.variants);
        setVariantsTracked(Boolean(variantsRes.value.data.tracked));
      } else {
        setVariants(
          DEFAULT_SHOE_SIZES.map((s) => ({
            size: s,
            stock: null,
            status: "untracked",
          }))
        );
        setVariantsTracked(false);
      }

      if (queueRes.status === "rejected") {
        const err = queueRes.reason;
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          pick(
            "Tidak dapat bergabung ke antrean saat ini.",
            "Unable to join the release queue right now."
          );
        setErrorMsg(msg);
        setStage("error");
        return;
      }

      const nextTicket = queueRes.value?.data?.ticket;
      if (!nextTicket) {
        setErrorMsg(
          pick("Tiket antrean tidak tersedia.", "Queue ticket unavailable.")
        );
        setStage("error");
        return;
      }

      setTicket(nextTicket);
      setQueuePosition(nextTicket.initial_position || 32);
      setReservationLeft(nextTicket.reservation_window_seconds || 180);
      setStage("waiting");
    } catch {
      setErrorMsg(
        pick("Koneksi terganggu. Coba lagi.", "Connection interrupted. Please retry.")
      );
      setStage("error");
    }
  }, [drop, pick]);

  // Kick off queue handshake whenever modal opens for a drop
  useEffect(() => {
    if (!isOpen || !drop) return undefined;
    const timer = setTimeout(() => {
      startQueueSession();
    }, 0);
    return () => clearTimeout(timer);
  }, [drop, isOpen, startQueueSession]);

  // Lock body scroll & Escape key close
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  // Simulated hype queue advancement during `waiting` stage
  useEffect(() => {
    if (!isOpen || stage !== "waiting" || !ticket) return undefined;

    const totalWaitMs = Math.max(4, Number(ticket.estimated_wait_seconds) || 6) * 1000;
    const initialPos = Math.max(5, Number(ticket.initial_position) || 32);
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(1, elapsed / totalWaitMs);
      const eased = 1 - Math.pow(1 - ratio, 2.1);

      setQueueProgress(Math.round(8 + eased * 92));
      setQueuePosition(Math.max(1, Math.round(initialPos * (1 - eased))));

      if (ratio >= 1) {
        clearInterval(interval);
        setQueueProgress(100);
        setQueuePosition(1);
        setStage("granted");
      }
    }, 140);

    return () => clearInterval(interval);
  }, [isOpen, stage, ticket]);

  // Reservation window countdown during `granted` stage
  useEffect(() => {
    if (!isOpen || stage !== "granted") return undefined;

    const interval = setInterval(() => {
      setReservationLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setStage("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, stage]);

  if (!isOpen || !drop) return null;

  const selectedVariant = variants.find(
    (v) => String(v.size) === String(selectedSize)
  );

  const handleClaimToBag = () => {
    const authUser = readAuthenticatedUser();
    if (!authUser) {
      toast.error(
        pick(
          "Silakan masuk terlebih dahulu untuk klaim rilis.",
          "Please sign in first to claim your drop pair."
        )
      );
      onClose();
      navigate("/login", { state: { from: "/drops" } });
      return;
    }

    if (!selectedSize) {
      toast.error(pick("Pilih ukuran terlebih dahulu.", "Select your size first."));
      return;
    }

    if (variantsTracked && selectedVariant && selectedVariant.stock === 0) {
      toast.error(pick("Ukuran ini sudah habis.", "This size is sold out."));
      return;
    }

    addToCart({
      id: drop.product_id || drop.id,
      productType: drop.product_type || "sneakers",
      name: drop.title,
      price: drop.release_price,
      image: drop.image_url,
      size: String(selectedSize),
      quantity: 1,
      available_stock: variantsTracked ? selectedVariant?.stock ?? null : null,
      low_stock_threshold: selectedVariant?.low_stock_threshold ?? 3,
      stock_status: variantsTracked
        ? selectedVariant?.status ?? "in_stock"
        : "untracked",
    });

    toast.success(
      pick(
        `Slot terkunci! ${drop.title} (${selectedSize}) masuk keranjang.`,
        `Pair secured! ${drop.title} (${selectedSize}) added to bag.`
      )
    );
    onClose();
    navigate("/cart");
  };

  const handleViewProduct = () => {
    onClose();
    if (drop.product_id) {
      navigate(`/product/${drop.product_type || "sneakers"}/${drop.product_id}`);
    }
  };

  const checkpoints = [
    {
      label: pick("Verifikasi sesi anti-bot", "Anti-bot session verification"),
      done: queueProgress >= 32,
    },
    {
      label: pick("Sinkronisasi kuota tersisa", "Syncing remaining pair quota"),
      done: queueProgress >= 68,
    },
    {
      label: pick("Membuka akses ruang klaim", "Unlocking reservation room"),
      done: queueProgress >= 96,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md font-poppins animate-fade-in"
      onClick={onClose}
    >
      <div
        data-lenis-prevent
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={pick("Ruang Antrean Rilis", "Hype Queue Room")}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-950 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-2xl overflow-hidden"
      >
        {/* Top Bar */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${
                stage === "granted"
                  ? "bg-emerald-500"
                  : stage === "error" || stage === "expired"
                    ? "bg-gray-400"
                    : "bg-[#FF5500] animate-pulse"
              }`}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-900 dark:text-white">
              {pick("Ruang Antrean Rilis", "Hype Queue Room")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={pick("Tutup ruang antrean", "Close queue room")}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Product Summary Strip */}
        <div className="px-6 py-4 bg-gray-50/70 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-100 border border-gray-200/60 flex items-center justify-center p-2 flex-shrink-0">
            <img
              src={drop.image_url}
              alt={drop.title}
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
              {drop.brand}
            </p>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {drop.title}
            </h3>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-sm font-black text-gray-900 dark:text-white">
                {formatRupiah(drop.release_price)}
              </span>
              {drop.original_price && (
                <span className="text-xs text-gray-400 line-through">
                  {formatRupiah(drop.original_price)}
                </span>
              )}
            </div>
          </div>
          {ticket?.ticket_code && (
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                {pick("Tiket", "Ticket")}
              </p>
              <p className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                {ticket.ticket_code}
              </p>
            </div>
          )}
        </div>

        {/* Body by Stage */}
        <div className="p-6">
          {(stage === "joining" || stage === "waiting") && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-2">
                  {stage === "joining"
                    ? pick("Menghubungkan ke server rilis...", "Connecting to launch room...")
                    : pick("Posisi Antrean Anda", "Your Queue Position")}
                </p>
                <div className="text-5xl font-black tracking-tight tabular-nums text-gray-950 dark:text-white">
                  {stage === "joining" ? "..." : `#${queuePosition}`}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {pick(
                    "Jangan tutup jendela ini. Giliran Anda diproses otomatis.",
                    "Keep this window open. Your turn advances automatically."
                  )}
                </p>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  <span>{pick("Progres Antrean", "Queue Progress")}</span>
                  <span className="tabular-nums font-bold text-gray-900 dark:text-white">
                    {queueProgress}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full bg-gray-950 dark:bg-[#FF5500] rounded-full transition-all duration-200"
                    style={{ width: `${queueProgress}%` }}
                  />
                </div>
              </div>

              {/* Checkpoints */}
              <div className="space-y-2.5 bg-gray-50 dark:bg-gray-900/70 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                {checkpoints.map((cp) => (
                  <div
                    key={cp.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span
                      className={
                        cp.done
                          ? "text-gray-900 dark:text-white font-semibold"
                          : "text-gray-400 dark:text-gray-500"
                      }
                    >
                      {cp.label}
                    </span>
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        cp.done
                          ? "bg-gray-900 dark:bg-white text-white dark:text-gray-950"
                          : "border border-gray-300 dark:border-gray-700"
                      }`}
                    >
                      {cp.done ? "✓" : ""}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                <span>
                  {pick(
                    `Kuota rilis tersisa: ${drop.quota_remaining} / ${drop.quota_total}`,
                    `Remaining quota: ${drop.quota_remaining} / ${drop.quota_total}`
                  )}
                </span>
                <span>{pick("Simulasi Antrean", "Queue Simulation")}</span>
              </div>
            </div>
          )}

          {stage === "granted" && (
            <div className="space-y-5">
              {/* Access Granted Banner */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    {pick("Akses Rilis Terbuka", "Access Granted")}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {pick(
                      "Pilih ukuran Anda sebelum waktu reservasi habis.",
                      "Select your size before your reservation window expires."
                    )}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {pick("Sisa Waktu", "Time Left")}
                  </p>
                  <p className="text-lg font-mono font-black tabular-nums text-[#FF5500]">
                    {formatTimerMMSS(reservationLeft)}
                  </p>
                </div>
              </div>

              {/* Size Picker */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    {pick("Pilih Ukuran (EU)", "Select Size (EU)")}
                  </span>
                  {selectedSize && variantsTracked && selectedVariant && (
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      {pick(
                        `Tersedia ${selectedVariant.stock} pasang`,
                        `${selectedVariant.stock} pairs available`
                      )}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {variants.map((v) => {
                    const size = String(v.size);
                    const isSoldOut = variantsTracked && v.stock === 0;
                    const isLow = variantsTracked && v.status === "low_stock";
                    const isSelected = String(selectedSize) === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={isSoldOut}
                        onClick={() => setSelectedSize(size)}
                        className={`h-12 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all ${
                          isSoldOut
                            ? "bg-gray-100 dark:bg-gray-900/50 text-gray-300 dark:text-gray-600 border-gray-100 dark:border-gray-800 cursor-not-allowed line-through"
                            : isSelected
                              ? "bg-gray-950 dark:bg-[#FF5500] text-white border-gray-950 dark:border-[#FF5500]"
                              : "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-white"
                        }`}
                      >
                        <span>{size}</span>
                        {isLow && !isSoldOut && (
                          <span
                            className={`text-[9px] font-semibold leading-none mt-0.5 ${
                              isSelected
                                ? "text-amber-200"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {pick(`Sisa ${v.stock}`, `${v.stock} left`)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleClaimToBag}
                  disabled={!selectedSize}
                  className="flex-1 h-12 rounded-full bg-gray-950 dark:bg-[#FF5500] text-white text-xs font-bold uppercase tracking-wider hover:bg-black dark:hover:bg-orange-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  {pick("Klaim ke Keranjang", "Claim to Bag")}
                </button>
                {drop.product_id && (
                  <button
                    type="button"
                    onClick={handleViewProduct}
                    className="h-12 px-5 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:border-gray-900 dark:hover:border-white transition-colors"
                  >
                    {pick("Detail Produk", "Product Detail")}
                  </button>
                )}
              </div>
            </div>
          )}

          {stage === "expired" && (
            <div className="text-center py-6 space-y-4">
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {pick("Waktu Reservasi Habis", "Reservation Window Expired")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                {pick(
                  "Slot sementara Anda telah dilepaskan kembali ke antrean. Anda bisa bergabung ulang selama kuota tersedia.",
                  "Your temporary hold was released back to the pool. You can rejoin while quota lasts."
                )}
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={startQueueSession}
                  className="px-6 h-11 rounded-full bg-gray-950 dark:bg-[#FF5500] text-white text-xs font-bold uppercase tracking-wider"
                >
                  {pick("Masuk Antrean Lagi", "Rejoin Queue")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 h-11 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300"
                >
                  {pick("Tutup", "Close")}
                </button>
              </div>
            </div>
          )}

          {stage === "error" && (
            <div className="text-center py-6 space-y-4">
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {pick("Antrean Tidak Tersedia", "Queue Unavailable")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                {errorMsg}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 h-11 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-xs font-bold uppercase tracking-wider"
              >
                {pick("Kembali ke Jadwal", "Back to Drops")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

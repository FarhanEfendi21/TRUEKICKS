import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "motion/react";
import api from "../lib/api";
import { useLanguage } from "../Context/LanguageContext";
import {
  formatRupiahShort,
  hasActiveDiscount,
  getEffectivePrice,
  getDiscountPercentage,
} from "../lib/pricing";

// Minimalist geometric mascot emblem for Kixo (TrueKicks AI Curator)
function KixoAvatar({ size = "md", active = false }) {
  const dimensions = {
    xs: "w-6 h-6 rounded-lg",
    sm: "w-7 h-7 rounded-xl",
    md: "w-9 h-9 rounded-2xl",
    lg: "w-14 h-14 rounded-[20px]",
  }[size];

  const svgSize = {
    xs: "w-3.5 h-3.5",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-8 h-8",
  }[size];

  return (
    <div
      className={`relative ${dimensions} bg-gray-950 dark:bg-gray-900 border border-gray-800 dark:border-gray-700/80 flex items-center justify-center flex-shrink-0 shadow-sm`}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={svgSize}
        aria-hidden="true"
      >
        <rect
          x="4"
          y="8"
          width="24"
          height="16"
          rx="7"
          stroke="white"
          strokeOpacity="0.92"
          strokeWidth="2"
        />
        <rect
          x="10"
          y="13.5"
          width="4.2"
          height="5"
          rx="2.1"
          fill="#FF5500"
          className={active ? "animate-pulse" : ""}
        />
        <rect
          x="17.8"
          y="13.5"
          width="4.2"
          height="5"
          rx="2.1"
          fill="#FF5500"
          className={active ? "animate-pulse" : ""}
        />
        <path
          d="M11 27H21"
          stroke="#FF5500"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function ConciergeDrawer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastMode, setLastMode] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isCheckout = location.pathname === "/checkout";
  const isProductDetail = location.pathname.startsWith("/product/");
  const isLoginOrSplash =
    location.pathname === "/" || location.pathname === "/login";

  const starterCards = t("kixo.starters");

  // Lock body scroll & handle Escape when drawer is open
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEsc);
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen]);

  // Smooth scroll to latest message
  useEffect(() => {
    if (isOpen && (messages.length > 0 || isSending)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending, isOpen]);

  if (isCheckout || isLoginOrSplash) return null;

  const sendMessage = async (rawText) => {
    const text = String(rawText || "").trim();
    if (!text || isSending) return;

    const userTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      products: [],
      followups: [],
    };

    const historyPayload = messages
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userTurn]);
    setInput("");
    setIsSending(true);

    try {
      const res = await api.post(
        "/api/concierge/chat",
        {
          message: text,
          history: historyPayload,
          context: { currentPath: location.pathname, language },
        },
        { skipAuthRedirect: true }
      );

      const data = res.data || {};
      setLastMode(data.mode || null);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply || t("kixo.fallbackReply"),
          products: Array.isArray(data.products) ? data.products : [],
          followups: Array.isArray(data.followups) ? data.followups : [],
        },
      ]);
    } catch (error) {
      const apiMessage = error.response?.data?.message;
      const errText =
        apiMessage && apiMessage !== "Validation failed"
          ? apiMessage
          : apiMessage === "Validation failed"
          ? t("kixo.validationError")
          : t("kixo.busyError");
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: errText,
          products: [],
          followups: [],
          isError: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleResetChat = () => {
    setMessages([]);
    setLastMode(null);
    setInput("");
    inputRef.current?.focus();
  };

  const handleProductClick = (product) => {
    const type = product.productType || "sneakers";
    setIsOpen(false);
    navigate(`/product/${type}/${product.id}`);
  };

  const isEmpty = messages.length === 0 && !isSending;

  const drawerPortal =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {isOpen && (
              <div
                data-lenis-prevent
                role="dialog"
                aria-modal="true"
                aria-label={t("kixo.dialogLabel")}
                className="fixed inset-0 z-[9998] flex justify-end sm:p-4 font-poppins"
              >
                {/* Soft Atmospheric Backdrop */}
                <Motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  onClick={() => setIsOpen(false)}
                  className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[3px]"
                />

                {/* Minimalist Floating Sheet */}
                <Motion.aside
                  initial={{ x: "100%", opacity: 0.9 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "100%", opacity: 0.9 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="relative z-10 w-full sm:max-w-[430px] h-full sm:rounded-[28px] bg-white dark:bg-gray-950 sm:border border-gray-200/80 dark:border-gray-800/90 shadow-2xl shadow-black/20 flex flex-col overflow-hidden"
                >
                  {/* Minimalist Header */}
                  <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-900 flex items-center justify-between gap-2 bg-white/95 dark:bg-gray-950/95">
                    <div className="flex items-center gap-3 min-w-0">
                      <KixoAvatar size="md" active={isSending} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-[15px] font-bold tracking-tight text-gray-950 dark:text-white leading-none">
                            Kixo
                          </h2>
                          <span className="px-1.5 py-0.5 rounded-md bg-[#FF5500]/10 text-[#FF5500] text-[9px] font-bold uppercase tracking-wider leading-none">
                            AI
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {lastMode === "llm"
                              ? t("kixo.subtitleActive")
                              : t("kixo.subtitleIdle")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Compact Synced Language Pill */}
                      <div
                        role="group"
                        aria-label={t("common.languageLabel")}
                        className="flex items-center rounded-full bg-gray-100 dark:bg-gray-900 p-0.5 border border-gray-200/70 dark:border-gray-800 mr-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => setLanguage("id")}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                            language === "id"
                              ? "bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm"
                              : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                          }`}
                        >
                          ID
                        </button>
                        <button
                          type="button"
                          onClick={() => setLanguage("en")}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                            language === "en"
                              ? "bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm"
                              : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                          }`}
                        >
                          EN
                        </button>
                      </div>

                      {messages.length > 0 && (
                        <button
                          type="button"
                          onClick={handleResetChat}
                          title={t("kixo.newChatTitle")}
                          aria-label={t("kixo.newChatLabel")}
                          className="h-8 px-2 rounded-full text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 flex items-center gap-1 transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.9}
                            stroke="currentColor"
                            className="w-3.5 h-3.5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                            />
                          </svg>
                          <span>{t("kixo.newChat")}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        aria-label={t("kixo.closeLabel")}
                        className="w-8 h-8 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 flex items-center justify-center transition-colors"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </header>

                  {/* Main Body: Welcome Canvas or Editorial Thread */}
                  <div
                    data-lenis-prevent
                    className="flex-1 overflow-y-auto px-5 py-6 bg-white dark:bg-gray-950"
                  >
                    {isEmpty ? (
                      <div className="h-full flex flex-col justify-between gap-8">
                        {/* Editorial Welcome Hero */}
                        <div className="pt-4 space-y-4">
                          <KixoAvatar size="lg" />
                          <div className="space-y-1.5">
                            <h3 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white leading-snug">
                              {t("kixo.greeting")}
                            </h3>
                            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-[34ch]">
                              {t("kixo.subcopy")}
                            </p>
                          </div>
                        </div>

                        {/* Structured 2-Column Starter Grid */}
                        <div className="space-y-2.5 pb-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                            {t("kixo.quickStart")}
                          </p>
                          <div className="grid grid-cols-2 gap-2.5">
                            {(Array.isArray(starterCards) ? starterCards : []).map(
                              (card) => (
                                <button
                                  key={card.label}
                                  type="button"
                                  onClick={() => sendMessage(card.label)}
                                  className="group text-left p-3.5 rounded-2xl bg-gray-50/80 dark:bg-gray-900/70 border border-gray-200/70 dark:border-gray-800/80 hover:border-gray-950 dark:hover:border-gray-600 hover:bg-white dark:hover:bg-gray-900 transition-all duration-200 flex flex-col justify-between gap-2.5"
                                >
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 group-hover:text-[#FF5500] transition-colors">
                                    {card.tag}
                                  </span>
                                  <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                    {card.label}
                                  </span>
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {messages.map((msg, idx) => {
                          const isUser = msg.role === "user";
                          const isLatestAssistant =
                            !isUser && idx === messages.length - 1;

                          if (isUser) {
                            return (
                              <div key={msg.id} className="flex justify-end">
                                <div className="max-w-[82%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-[13px] leading-relaxed whitespace-pre-wrap">
                                  {msg.content}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={msg.id} className="space-y-3">
                              {/* Kixo Turn Header + Editorial Message */}
                              <div className="flex items-start gap-2.5">
                                <div className="mt-0.5">
                                  <KixoAvatar size="xs" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                                    Kixo
                                  </span>
                                  <div
                                    className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                                      msg.isError
                                        ? "px-3.5 py-2.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200/80 dark:border-red-900/70"
                                        : "text-gray-800 dark:text-gray-100"
                                    }`}
                                  >
                                    {msg.content}
                                  </div>
                                </div>
                              </div>

                              {/* Grounded Product Recommendation List */}
                              {msg.products?.length > 0 && (
                                <div className="pl-8 space-y-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                                    {t("kixo.catalogHeader", {
                                      count: msg.products.length,
                                    })}
                                  </p>
                                  <div className="space-y-2">
                                    {msg.products.map((item) => {
                                      const isOnSale = hasActiveDiscount(item);
                                      const effective = getEffectivePrice(item);
                                      const discountPct =
                                        getDiscountPercentage(item);

                                      return (
                                        <button
                                          key={`${item.productType}-${item.id}`}
                                          type="button"
                                          onClick={() =>
                                            handleProductClick(item)
                                          }
                                          className="w-full text-left flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50/70 dark:bg-gray-900/70 border border-gray-200/75 dark:border-gray-800/90 hover:bg-white dark:hover:bg-gray-900 hover:border-gray-950 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200 group"
                                        >
                                          <div className="relative w-16 h-16 rounded-xl bg-white dark:bg-gray-100 border border-gray-100 flex items-center justify-center p-2 flex-shrink-0 overflow-hidden">
                                            <img
                                              src={item.image_url}
                                              alt={item.name}
                                              className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                                            />
                                          </div>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">
                                                {item.category ||
                                                  item.productType}
                                              </span>
                                              {isOnSale && (
                                                <span className="px-1.5 py-0.5 rounded bg-[#FF5500] text-white text-[9px] font-bold leading-none flex-shrink-0">
                                                  -{discountPct}%
                                                </span>
                                              )}
                                            </div>

                                            <p className="text-[12.5px] font-semibold text-gray-950 dark:text-white line-clamp-1 mt-0.5 group-hover:text-[#FF5500] transition-colors">
                                              {item.name}
                                            </p>

                                            <div className="flex items-baseline gap-2 mt-1">
                                              <span
                                                className={`text-[12.5px] font-bold ${
                                                  isOnSale
                                                    ? "text-[#FF5500]"
                                                    : "text-gray-950 dark:text-white"
                                                }`}
                                              >
                                                {formatRupiahShort(effective)}
                                              </span>
                                              {isOnSale && (
                                                <span className="text-[10px] text-gray-400 line-through">
                                                  {formatRupiahShort(
                                                    item.price
                                                  )}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={1.8}
                                            stroke="currentColor"
                                            className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-950 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0 mr-0.5"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                            />
                                          </svg>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Minimalist Follow-up Chips */}
                              {isLatestAssistant &&
                                !isSending &&
                                msg.followups?.length > 0 && (
                                  <div className="pl-8 flex flex-wrap gap-1.5 pt-0.5">
                                    {msg.followups.map((suggestion) => (
                                      <button
                                        key={suggestion}
                                        type="button"
                                        onClick={() => sendMessage(suggestion)}
                                        className="px-3 py-1.5 rounded-full bg-transparent border border-gray-200 dark:border-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:border-gray-950 dark:hover:border-gray-500 hover:text-gray-950 dark:hover:text-white transition-colors"
                                      >
                                        {suggestion}
                                      </button>
                                    ))}
                                  </div>
                                )}
                            </div>
                          );
                        })}

                        {/* Minimalist Thinking Indicator */}
                        {isSending && (
                          <div className="flex items-start gap-2.5">
                            <KixoAvatar size="xs" active />
                            <div className="space-y-1 pt-0.5">
                              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                                Kixo
                              </span>
                              <div className="flex items-center gap-2 text-[12px] text-gray-400 dark:text-gray-500">
                                <span>{t("kixo.thinking")}</span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-[#FF5500] animate-bounce [animation-delay:-0.2s]" />
                                  <span className="w-1 h-1 rounded-full bg-[#FF5500] animate-bounce [animation-delay:-0.1s]" />
                                  <span className="w-1 h-1 rounded-full bg-[#FF5500] animate-bounce" />
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Minimalist Floating Composer */}
                  <footer className="px-4 pt-3 pb-3.5 border-t border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950">
                    <form
                      onSubmit={handleSubmit}
                      className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 focus-within:border-gray-950 dark:focus-within:border-gray-600 rounded-2xl pl-4 pr-1.5 py-1.5 transition-colors"
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        maxLength={500}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t("kixo.placeholder")}
                        aria-label={t("kixo.inputLabel")}
                        disabled={isSending}
                        className="flex-1 bg-transparent text-[13px] text-gray-950 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={isSending || !input.trim()}
                        aria-label={t("kixo.sendLabel")}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                          input.trim() && !isSending
                            ? "bg-[#FF5500] text-white hover:bg-[#e54c00] active:scale-95"
                            : "bg-gray-200/80 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                        }`}
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
                            d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
                          />
                        </svg>
                      </button>
                    </form>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center mt-2">
                      {t("kixo.footerNote")}
                    </p>
                  </footer>
                </Motion.aside>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <>
      {/* Minimalist Signature Mascot Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t("kixo.openLabel")}
        className={`${
          isProductDetail ? "hidden lg:inline-flex" : "inline-flex"
        } group fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 items-center gap-2.5 h-12 pl-2 pr-4 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 border border-gray-800/90 dark:border-gray-200 shadow-lg shadow-black/15 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 active:scale-95`}
      >
        <KixoAvatar size="sm" />
        <span className="flex flex-col items-start leading-none">
          <span className="text-[12px] font-bold tracking-tight">Kixo</span>
          <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
            {t("kixo.triggerSub")}
          </span>
        </span>
      </button>

      {drawerPortal}
    </>
  );
}

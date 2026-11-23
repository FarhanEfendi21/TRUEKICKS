import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatRupiah } from "../lib/pricing";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import HypeQueueModal from "../components/HypeQueueModal";
import { useLanguage } from "../Context/LanguageContext";

const GUEST_EMAIL_KEY = "truekicks_drop_notify_email";
const LOCAL_REMINDERS_KEY = "truekicks_drop_reminders";

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email || parsed.email.includes("guest")) return null;
    return parsed;
  } catch {
    return null;
  }
};

const readLocalReminderIds = () => {
  try {
    const raw = localStorage.getItem(LOCAL_REMINDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
};

const saveLocalReminderIds = (ids) => {
  try {
    localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Ignore storage quota errors
  }
};

const getEffectiveStatus = (drop, nowMs) => {
  if (!drop) return "ended";
  const releaseMs = drop.release_at ? Date.parse(drop.release_at) : NaN;
  const endsMs = drop.ends_at ? Date.parse(drop.ends_at) : null;
  if (
    drop.status === "ended" ||
    (endsMs && Number.isFinite(endsMs) && nowMs >= endsMs)
  ) {
    return "ended";
  }
  if (drop.status === "sold_out" || Number(drop.quota_remaining) <= 0) {
    return "sold_out";
  }
  if (Number.isFinite(releaseMs) && nowMs >= releaseMs) {
    return "live";
  }
  return "upcoming";
};

const getCountdownParts = (targetIso, nowMs) => {
  const targetMs = targetIso ? Date.parse(targetIso) : NaN;
  if (!Number.isFinite(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
  }
  const diff = Math.max(0, targetMs - nowMs);
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isOver: false,
  };
};

const pad2 = (n) => String(n).padStart(2, "0");

const formatCountdownString = (targetIso, nowMs, isIndonesian) => {
  const { days, hours, minutes, seconds } = getCountdownParts(targetIso, nowMs);
  const dayUnit = isIndonesian ? "h" : "d";
  if (days > 0) {
    return `${days}${dayUnit} ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
};

const formatReleaseSchedule = (iso, locale) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export default function Drops() {
  const navigate = useNavigate();
  const { pick, locale, isIndonesian } = useLanguage();

  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // all | live | upcoming | notified | past
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [user] = useState(readStoredUser);
  const [guestEmail, setGuestEmail] = useState(
    () => localStorage.getItem(GUEST_EMAIL_KEY) || ""
  );
  const [localNotifiedIds, setLocalNotifiedIds] = useState(readLocalReminderIds);
  const [submittingDropId, setSubmittingDropId] = useState(null);

  const [emailModalDrop, setEmailModalDrop] = useState(null);
  const [emailInput, setEmailInput] = useState(
    () => localStorage.getItem(GUEST_EMAIL_KEY) || ""
  );
  const [queueDrop, setQueueDrop] = useState(null);

  const fetchDrops = useCallback(async () => {
    try {
      const storedGuestEmail = localStorage.getItem(GUEST_EMAIL_KEY) || "";
      const params = !user && storedGuestEmail ? { email: storedGuestEmail } : {};
      const res = await api.get("/api/drops", {
        params,
        skipAuthRedirect: true,
      });
      if (Array.isArray(res.data?.drops)) {
        setDrops(res.data.drops);
      }
    } catch (err) {
      console.error("Failed loading drop calendar:", err);
      toast.error(
        pick("Gagal memuat jadwal rilis.", "Failed to load drop calendar.")
      );
    } finally {
      setLoading(false);
    }
  }, [pick, user]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchDrops();
  }, [fetchDrops]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!emailModalDrop) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setEmailModalDrop(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [emailModalDrop]);

  const enrichedDrops = useMemo(() => {
    return drops.map((drop) => {
      const liveStatus = getEffectiveStatus(drop, nowMs);
      const isNotified =
        Boolean(drop.user_notified) || localNotifiedIds.includes(Number(drop.id));
      return {
        ...drop,
        status: liveStatus,
        user_notified: isNotified,
      };
    });
  }, [drops, localNotifiedIds, nowMs]);

  const featuredDrop = useMemo(() => {
    return (
      enrichedDrops.find((d) => d.status === "live" && d.is_featured) ||
      enrichedDrops.find((d) => d.status === "live") ||
      enrichedDrops.find((d) => d.status === "upcoming") ||
      enrichedDrops[0] ||
      null
    );
  }, [enrichedDrops]);

  const counts = useMemo(() => {
    const live = enrichedDrops.filter((d) => d.status === "live").length;
    const upcoming = enrichedDrops.filter((d) => d.status === "upcoming").length;
    const notified = enrichedDrops.filter((d) => d.user_notified).length;
    const past = enrichedDrops.filter(
      (d) => d.status === "sold_out" || d.status === "ended"
    ).length;
    return { all: enrichedDrops.length, live, upcoming, notified, past };
  }, [enrichedDrops]);

  const filteredDrops = useMemo(() => {
    if (activeTab === "live") {
      return enrichedDrops.filter((d) => d.status === "live");
    }
    if (activeTab === "upcoming") {
      return enrichedDrops.filter((d) => d.status === "upcoming");
    }
    if (activeTab === "notified") {
      return enrichedDrops.filter((d) => d.user_notified);
    }
    if (activeTab === "past") {
      return enrichedDrops.filter(
        (d) => d.status === "sold_out" || d.status === "ended"
      );
    }
    // Avoid duplicating the featured drop immediately below when viewing All
    if (featuredDrop && enrichedDrops.length > 1) {
      return enrichedDrops.filter((d) => d.id !== featuredDrop.id);
    }
    return enrichedDrops;
  }, [activeTab, enrichedDrops, featuredDrop]);

  const submitNotify = async (drop, targetEmail) => {
    setSubmittingDropId(drop.id);
    try {
      const payload = targetEmail ? { email: targetEmail } : {};
      const res = await api.post(`/api/drops/${drop.id}/notify`, payload, {
        skipAuthRedirect: true,
      });

      if (targetEmail && !user) {
        localStorage.setItem(GUEST_EMAIL_KEY, targetEmail);
        setGuestEmail(targetEmail);
      }

      const nextLocal = [...new Set([...localNotifiedIds, Number(drop.id)])];
      setLocalNotifiedIds(nextLocal);
      saveLocalReminderIds(nextLocal);

      setDrops((prev) =>
        prev.map((item) =>
          item.id === drop.id
            ? {
                ...item,
                user_notified: true,
                reminder_count:
                  typeof res.data?.reminder_count === "number"
                    ? res.data.reminder_count
                    : (item.reminder_count || 0) + 1,
              }
            : item
        )
      );

      toast.success(
        pick(
          `Pengingat aktif untuk ${drop.title}.`,
          `Reminder set for ${drop.title}.`
        )
      );
      setEmailModalDrop(null);
    } catch (err) {
      const msg =
        err.response?.data?.errors?.[0] ||
        err.response?.data?.message ||
        pick("Gagal menyimpan pengingat.", "Failed to save drop reminder.");
      toast.error(msg);
    } finally {
      setSubmittingDropId(null);
    }
  };

  const removeNotify = async (drop) => {
    setSubmittingDropId(drop.id);
    try {
      const params = !user && guestEmail ? { email: guestEmail } : {};
      const res = await api.delete(`/api/drops/${drop.id}/notify`, {
        params,
        skipAuthRedirect: true,
      });

      const nextLocal = localNotifiedIds.filter((id) => id !== Number(drop.id));
      setLocalNotifiedIds(nextLocal);
      saveLocalReminderIds(nextLocal);

      setDrops((prev) =>
        prev.map((item) =>
          item.id === drop.id
            ? {
                ...item,
                user_notified: false,
                reminder_count:
                  typeof res.data?.reminder_count === "number"
                    ? res.data.reminder_count
                    : Math.max(0, (item.reminder_count || 1) - 1),
              }
            : item
        )
      );

      toast.success(
        pick("Pengingat rilis dibatalkan.", "Drop reminder removed.")
      );
    } catch {
      toast.error(
        pick("Gagal menghapus pengingat.", "Failed to remove drop reminder.")
      );
    } finally {
      setSubmittingDropId(null);
    }
  };

  const handleToggleNotify = (drop) => {
    if (submittingDropId === drop.id) return;
    if (drop.user_notified) {
      removeNotify(drop);
      return;
    }
    if (user?.email) {
      submitNotify(drop, user.email);
      return;
    }
    if (guestEmail) {
      submitNotify(drop, guestEmail);
      return;
    }
    setEmailInput("");
    setEmailModalDrop(drop);
  };

  const handleGuestEmailSubmit = (e) => {
    e.preventDefault();
    const cleaned = emailInput.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      toast.error(
        pick(
          "Masukkan alamat email yang valid.",
          "Please enter a valid email address."
        )
      );
      return;
    }
    if (emailModalDrop) {
      submitNotify(emailModalDrop, cleaned);
    }
  };

  const getDropTypeLabel = (dropType) => {
    if (dropType === "flash_sale") return "Flash Sale";
    if (dropType === "exclusive_collab") {
      return pick("Kolaborasi", "Collab");
    }
    return pick("Rilis Terbatas", "Limited");
  };

  const tabs = [
    { id: "all", label: pick("Semua", "All"), count: counts.all },
    { id: "live", label: pick("Live", "Live"), count: counts.live },
    {
      id: "upcoming",
      label: pick("Akan Datang", "Upcoming"),
      count: counts.upcoming,
    },
    {
      id: "notified",
      label: pick("Pengingat", "Saved Alerts"),
      count: counts.notified,
    },
    { id: "past", label: pick("Arsip", "Archive"), count: counts.past },
  ];

  const featuredCountdown = featuredDrop
    ? formatCountdownString(
        featuredDrop.status === "live"
          ? featuredDrop.ends_at
          : featuredDrop.release_at,
        nowMs,
        isIndonesian
      )
    : "";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-poppins text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Navbar />

      <main className="pt-28 pb-32 md:pt-32 md:pb-24 max-w-6xl mx-auto px-4 md:px-6">
        {/* === MINIMALIST EDITORIAL HEADER === */}
        <header className="pb-6 mb-10 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-950 dark:text-white">
              {pick("Jadwal Rilis", "Drop Calendar")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              {pick(
                "Rilis terbatas, flash sale aktif, dan ruang antrean TrueKicks.",
                "Scheduled limited releases, active flash sales, and queue access."
              )}
            </p>
          </div>

          <dl className="flex items-center divide-x divide-gray-200 dark:divide-gray-800 text-left">
            <div className="pr-5">
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {pick("Live", "Live")}
              </dt>
              <dd className="text-lg font-bold tabular-nums text-gray-950 dark:text-white mt-0.5 flex items-center gap-1.5">
                {counts.live > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
                )}
                {counts.live}
              </dd>
            </div>
            <div className="px-5">
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {pick("Akan Datang", "Upcoming")}
              </dt>
              <dd className="text-lg font-bold tabular-nums text-gray-950 dark:text-white mt-0.5">
                {counts.upcoming}
              </dd>
            </div>
            <div className="pl-5">
              <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {pick("Pengingat", "Alerts")}
              </dt>
              <dd className="text-lg font-bold tabular-nums text-gray-950 dark:text-white mt-0.5">
                {counts.notified}
              </dd>
            </div>
          </dl>
        </header>

        {/* === LOADING SKELETON === */}
        {loading ? (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10 border-b border-gray-100 dark:border-gray-800">
              <div className="lg:col-span-6 aspect-[4/3] rounded-2xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
              <div className="lg:col-span-6 space-y-4 py-2">
                <div className="h-4 w-32 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                <div className="h-9 w-3/4 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                <div className="h-20 w-full bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                <div className="h-11 w-48 bg-gray-100 dark:bg-gray-900 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {[1, 2, 3].map((n) => (
                <div key={n} className="space-y-3">
                  <div className="aspect-[4/3] rounded-2xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
                  <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                  <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-900 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* === FEATURED RELEASE SPLIT === */}
            {featuredDrop && activeTab === "all" && (
              <section className="pb-12 mb-10 border-b border-gray-200 dark:border-gray-800">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  {/* Left: Clean Studio Product Frame */}
                  <div
                    onClick={() => {
                      if (featuredDrop.product_id) {
                        navigate(
                          `/product/${featuredDrop.product_type || "sneakers"}/${featuredDrop.product_id}`
                        );
                      }
                    }}
                    className={`lg:col-span-6 aspect-[4/3] rounded-2xl bg-[#F6F6F6] dark:bg-gray-100 flex items-center justify-center p-8 md:p-12 overflow-hidden group ${
                      featuredDrop.product_id ? "cursor-pointer" : ""
                    }`}
                  >
                    <img
                      src={featuredDrop.image_url}
                      alt={featuredDrop.title}
                      className="w-[86%] h-[86%] object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-105 group-hover:-rotate-2"
                    />
                  </div>

                  {/* Right: Structured Release Details */}
                  <div className="lg:col-span-6 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 mb-3">
                        <span
                          className={
                            featuredDrop.status === "live"
                              ? "text-[#FF5500]"
                              : "text-gray-900 dark:text-white"
                          }
                        >
                          {featuredDrop.status === "live"
                            ? pick("Sedang Live", "Live Now")
                            : pick("Rilis Berikutnya", "Up Next")}
                        </span>
                        <span>·</span>
                        <span>{featuredDrop.brand}</span>
                        <span>·</span>
                        <span>{getDropTypeLabel(featuredDrop.drop_type)}</span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-gray-950 dark:text-white leading-[1.12]">
                        {featuredDrop.title}
                      </h2>

                      {featuredDrop.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed max-w-lg">
                          {featuredDrop.description}
                        </p>
                      )}
                    </div>

                    {/* Structured 3-Column Spec Grid */}
                    <dl className="grid grid-cols-3 gap-4 border-y border-gray-200 dark:border-gray-800 py-4 my-6">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                          {pick("Harga Rilis", "Release Price")}
                        </dt>
                        <dd className="mt-1">
                          <span className="text-sm sm:text-base font-bold text-gray-950 dark:text-white block">
                            {formatRupiah(featuredDrop.release_price)}
                          </span>
                          {featuredDrop.original_price && (
                            <span className="text-[11px] text-gray-400 line-through mr-1.5">
                              {formatRupiah(featuredDrop.original_price)}
                            </span>
                          )}
                          {featuredDrop.discount_percentage > 0 && (
                            <span className="text-[11px] font-semibold text-[#FF5500]">
                              -{featuredDrop.discount_percentage}%
                            </span>
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                          {featuredDrop.status === "live"
                            ? pick("Berakhir Dalam", "Ends In")
                            : pick("Rilis Dalam", "Drops In")}
                        </dt>
                        <dd className="text-sm sm:text-base font-mono font-bold tabular-nums text-gray-950 dark:text-white mt-1">
                          {featuredCountdown}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                          {pick("Kuota", "Quota")}
                        </dt>
                        <dd className="mt-1">
                          <span className="text-sm sm:text-base font-bold tabular-nums text-gray-950 dark:text-white">
                            {featuredDrop.quota_remaining}
                            <span className="text-gray-400 font-medium">
                              /{featuredDrop.quota_total}
                            </span>
                          </span>
                          <span className="block text-[11px] text-gray-400">
                            {pick("tersisa", "remaining")}
                          </span>
                        </dd>
                      </div>
                    </dl>

                    {/* Primary & Secondary Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      {featuredDrop.status === "live" ? (
                        <button
                          type="button"
                          onClick={() => setQueueDrop(featuredDrop)}
                          className="h-11 px-7 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-xs font-bold uppercase tracking-wider hover:bg-black dark:hover:bg-gray-200 transition-colors active:scale-95"
                        >
                          {pick("Masuk Antrean Rilis", "Enter Release Queue")}
                        </button>
                      ) : featuredDrop.status === "upcoming" ? (
                        <button
                          type="button"
                          disabled={submittingDropId === featuredDrop.id}
                          onClick={() => handleToggleNotify(featuredDrop)}
                          className={`h-11 px-7 rounded-full text-xs font-bold uppercase tracking-wider transition-colors active:scale-95 ${
                            featuredDrop.user_notified
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                              : "bg-gray-950 dark:bg-white text-white dark:text-gray-950 hover:bg-black dark:hover:bg-gray-200"
                          }`}
                        >
                          {featuredDrop.user_notified
                            ? pick("Pengingat Aktif ✓", "Reminder Set ✓")
                            : pick("Ingatkan Saya", "Notify Me")}
                        </button>
                      ) : null}

                      {featuredDrop.product_id && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/product/${featuredDrop.product_type || "sneakers"}/${featuredDrop.product_id}`
                            )
                          }
                          className="h-11 px-5 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:border-gray-950 dark:hover:border-white hover:text-gray-950 dark:hover:text-white transition-colors"
                        >
                          {pick("Lihat Detail Produk", "View Product")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* === UNDERLINE FILTER BAR === */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-200 dark:border-gray-800 mb-8">
              <div
                role="tablist"
                aria-label={pick("Filter jadwal rilis", "Filter drop schedule")}
                className="flex items-center gap-6 overflow-x-auto no-scrollbar -mb-px"
              >
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={active}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`pb-3.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
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

              {guestEmail && !user && (
                <p className="text-xs text-gray-400 pb-3">
                  {pick("Pengingat ke", "Alerts to")}{" "}
                  <span className="text-gray-700 dark:text-gray-200 font-medium">
                    {guestEmail}
                  </span>
                </p>
              )}
            </div>

            {/* === DROP SCHEDULE GRID === */}
            {filteredDrops.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {activeTab === "notified"
                    ? pick("Belum ada pengingat tersimpan", "No saved drop alerts")
                    : pick("Tidak ada rilis pada kategori ini", "No releases in this view")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 mb-5">
                  {activeTab === "notified"
                    ? pick(
                        "Aktifkan Ingatkan Saya pada rilis mendatang untuk menyimpannya di sini.",
                        "Enable Notify Me on any upcoming drop to track it here."
                      )
                    : pick(
                        "Lihat tab Semua untuk menelusuri seluruh jadwal rilis.",
                        "Switch to All to browse the full release calendar."
                      )}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className="h-9 px-5 rounded-full border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-900 dark:text-white hover:border-gray-950 dark:hover:border-white transition-colors"
                >
                  {pick("Lihat Semua", "View All")}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                {filteredDrops.map((drop) => {
                  const isLive = drop.status === "live";
                  const isUpcoming = drop.status === "upcoming";
                  const isPast =
                    drop.status === "sold_out" || drop.status === "ended";
                  const isBusy = submittingDropId === drop.id;
                  const countdownStr =
                    isLive || isUpcoming
                      ? formatCountdownString(
                          isLive ? drop.ends_at : drop.release_at,
                          nowMs,
                          isIndonesian
                        )
                      : null;

                  return (
                    <article
                      key={drop.id}
                      className="group flex flex-col justify-between"
                    >
                      <div>
                        {/* Clean Studio Image Frame */}
                        <div
                          onClick={() => {
                            if (drop.product_id) {
                              navigate(
                                `/product/${drop.product_type || "sneakers"}/${drop.product_id}`
                              );
                            }
                          }}
                          className={`aspect-[4/3] rounded-2xl bg-[#F6F6F6] dark:bg-gray-100 flex items-center justify-center p-6 mb-4 overflow-hidden ${
                            drop.product_id ? "cursor-pointer" : ""
                          }`}
                        >
                          <img
                            src={drop.image_url}
                            alt={drop.title}
                            className={`w-[84%] h-[84%] object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105 ${
                              isPast ? "opacity-50 grayscale" : ""
                            }`}
                          />
                        </div>

                        {/* Row 1: Schedule / Status & Drop Type */}
                        <div className="flex items-center justify-between gap-2 text-[11px] font-medium mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 ${
                              isLive
                                ? "font-semibold text-[#FF5500]"
                                : isPast
                                  ? "text-gray-400"
                                  : "text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {isLive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
                            )}
                            {isLive
                              ? pick("Sedang Live", "Live Now")
                              : isPast
                                ? drop.status === "sold_out"
                                  ? pick("Habis Terjual", "Sold Out")
                                  : pick("Berakhir", "Ended")
                                : formatReleaseSchedule(drop.release_at, locale)}
                          </span>

                          <span className="text-gray-400">
                            {drop.brand} · {getDropTypeLabel(drop.drop_type)}
                          </span>
                        </div>

                        {/* Row 2: Title & Pricing */}
                        <h3
                          onClick={() => {
                            if (drop.product_id) {
                              navigate(
                                `/product/${drop.product_type || "sneakers"}/${drop.product_id}`
                              );
                            }
                          }}
                          className={`text-base font-bold text-gray-950 dark:text-white leading-snug line-clamp-1 ${
                            drop.product_id
                              ? "cursor-pointer hover:text-[#FF5500] transition-colors"
                              : ""
                          }`}
                        >
                          {drop.title}
                        </h3>

                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatRupiah(drop.release_price)}
                          </span>
                          {drop.original_price && (
                            <span className="text-xs text-gray-400 line-through">
                              {formatRupiah(drop.original_price)}
                            </span>
                          )}
                          {drop.discount_percentage > 0 && !isPast && (
                            <span className="text-[11px] font-semibold text-[#FF5500]">
                              -{drop.discount_percentage}%
                            </span>
                          )}
                        </div>

                        {/* Row 3: Structured 2-Column Info Table */}
                        <dl className="grid grid-cols-2 gap-3 border-t border-gray-100 dark:border-gray-800/90 pt-3 mt-3.5 text-xs">
                          <div>
                            <dt className="text-[10px] uppercase tracking-wider text-gray-400">
                              {isLive
                                ? pick("Berakhir", "Ends in")
                                : isUpcoming
                                  ? pick("Rilis dalam", "Drops in")
                                  : pick("Jadwal", "Released")}
                            </dt>
                            <dd className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100 mt-0.5">
                              {countdownStr ||
                                formatReleaseSchedule(drop.release_at, locale)}
                            </dd>
                          </div>

                          <div className="text-right">
                            <dt className="text-[10px] uppercase tracking-wider text-gray-400">
                              {isUpcoming
                                ? pick("Alokasi", "Allocation")
                                : pick("Kuota", "Quota")}
                            </dt>
                            <dd className="font-medium tabular-nums text-gray-700 dark:text-gray-300 mt-0.5">
                              {isLive &&
                                pick(
                                  `${drop.quota_remaining}/${drop.quota_total} tersisa`,
                                  `${drop.quota_remaining}/${drop.quota_total} left`
                                )}
                              {isUpcoming &&
                                pick(
                                  `${drop.quota_total} psg · ${drop.reminder_count} minat`,
                                  `${drop.quota_total} prs · ${drop.reminder_count} alerts`
                                )}
                              {isPast &&
                                pick(
                                  `0/${drop.quota_total} tersisa`,
                                  `0/${drop.quota_total} left`
                                )}
                            </dd>
                          </div>
                        </dl>

                        {isLive && (
                          <div className="w-full h-[2px] bg-gray-100 dark:bg-gray-800 mt-3 overflow-hidden">
                            <div
                              className="h-full bg-gray-950 dark:bg-[#FF5500]"
                              style={{
                                width: `${Math.min(100, Math.max(8, drop.quota_claimed_pct))}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Row 4: Clean Action Button */}
                      <div className="mt-4">
                        {isLive && (
                          <button
                            type="button"
                            onClick={() => setQueueDrop(drop)}
                            className="w-full h-10 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-xs font-semibold uppercase tracking-wider hover:bg-black dark:hover:bg-gray-200 transition-colors active:scale-95"
                          >
                            {pick("Masuk Antrean", "Enter Queue")}
                          </button>
                        )}

                        {isUpcoming && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleNotify(drop)}
                            className={`w-full h-10 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors active:scale-95 ${
                              drop.user_notified
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                                : "border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-950 hover:text-white hover:border-gray-950 dark:hover:bg-white dark:hover:text-gray-950 dark:hover:border-white"
                            }`}
                          >
                            {drop.user_notified
                              ? pick("Pengingat Aktif ✓", "Reminder Set ✓")
                              : pick("Ingatkan Saya", "Notify Me")}
                          </button>
                        )}

                        {isPast && (
                          <button
                            type="button"
                            disabled={!drop.product_id}
                            onClick={() => {
                              if (drop.product_id) {
                                navigate(
                                  `/product/${drop.product_type || "sneakers"}/${drop.product_id}`
                                );
                              }
                            }}
                            className="w-full h-10 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 transition-colors"
                          >
                            {drop.product_id
                              ? pick("Lihat Detail", "View Detail")
                              : pick("Habis Terjual", "Sold Out")}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      {/* Hype Queue Simulation Modal */}
      <HypeQueueModal
        isOpen={Boolean(queueDrop)}
        drop={queueDrop}
        onClose={() => setQueueDrop(null)}
      />

      {/* Guest Email Notify Modal */}
      {emailModalDrop &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-poppins"
            onClick={() => setEmailModalDrop(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={pick("Pengingat Rilis", "Drop Reminder")}
              className="w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                    {pick("Pengingat Rilis", "Launch Alert")}
                  </p>
                  <h3 className="text-base font-bold text-gray-950 dark:text-white leading-snug">
                    {emailModalDrop.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailModalDrop(null)}
                  aria-label={pick("Tutup", "Close")}
                  className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {pick(
                  "Simpan email Anda untuk mengaktifkan pengingat jadwal rilis ini.",
                  "Save your email to activate a reminder for this release."
                )}
              </p>

              <form onSubmit={handleGuestEmailSubmit} className="space-y-3">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full h-11 px-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-gray-950 dark:focus:border-white"
                />
                <button
                  type="submit"
                  disabled={submittingDropId === emailModalDrop.id}
                  className="w-full h-11 rounded-full bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-xs font-bold uppercase tracking-wider hover:bg-black dark:hover:bg-gray-200 transition-colors"
                >
                  {submittingDropId === emailModalDrop.id
                    ? pick("Menyimpan...", "Saving...")
                    : pick("Aktifkan Pengingat", "Enable Reminder")}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

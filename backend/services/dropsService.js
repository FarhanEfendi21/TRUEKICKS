import crypto from "node:crypto";
import supabase from "../config/supabase.js";

const FALLBACK_CACHE_TTL_MS = 60 * 1000;
let fallbackSneakerCache = {
  rows: null,
  fetchedAt: 0,
};

export const isMissingDropsSchemaError = (error) => {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  return (
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "42P01" ||
    code === "42703" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    details.includes("does not exist")
  );
};

export const computeEffectiveDropStatus = (drop, nowMs = Date.now()) => {
  if (!drop) return "ended";
  const rawStatus = String(drop.status || "upcoming").toLowerCase();
  const releaseMs = drop.release_at ? Date.parse(drop.release_at) : NaN;
  const endsMs = drop.ends_at ? Date.parse(drop.ends_at) : null;
  const remaining = Math.max(0, Number(drop.quota_remaining ?? 0));

  if (rawStatus === "ended" || (endsMs && Number.isFinite(endsMs) && nowMs >= endsMs)) {
    return "ended";
  }
  if (rawStatus === "sold_out" || remaining <= 0) {
    return "sold_out";
  }
  if (Number.isFinite(releaseMs) && nowMs >= releaseMs) {
    return "live";
  }
  return "upcoming";
};

const formatDropPayload = (
  row,
  { reminderCount = 0, userNotified = false, nowMs = Date.now() } = {}
) => {
  const releasePrice = Number(row.release_price) || 0;
  const originalPrice =
    row.original_price != null && Number(row.original_price) > releasePrice
      ? Number(row.original_price)
      : null;
  const discountPercentage = originalPrice
    ? Math.round(((originalPrice - releasePrice) / originalPrice) * 100)
    : 0;
  const quotaTotal = Math.max(1, Number(row.quota_total) || 1);
  const quotaRemaining = Math.min(
    quotaTotal,
    Math.max(0, Number(row.quota_remaining ?? 0))
  );
  const status = computeEffectiveDropStatus(row, nowMs);

  return {
    id: Number(row.id),
    slug: row.slug || `drop-${row.id}`,
    title: row.title || "Limited Release",
    brand: row.brand || "TrueKicks",
    subtitle: row.subtitle || "",
    description: row.description || "",
    drop_type: row.drop_type || "limited_drop",
    product_id: row.product_id != null ? Number(row.product_id) : null,
    product_type: row.product_type || "sneakers",
    release_price: releasePrice,
    original_price: originalPrice,
    discount_percentage: discountPercentage,
    image_url: row.image_url || "",
    quota_total: quotaTotal,
    quota_remaining: quotaRemaining,
    quota_claimed_pct: Math.round(((quotaTotal - quotaRemaining) / quotaTotal) * 100),
    release_at: row.release_at,
    ends_at: row.ends_at || null,
    status,
    is_featured: Boolean(row.is_featured),
    reminder_count: Math.max(0, Number(reminderCount) || 0),
    user_notified: Boolean(userNotified),
  };
};

const sortDropsForCalendar = (drops) => {
  const rank = { live: 0, upcoming: 1, sold_out: 2, ended: 3 };
  return [...drops].sort((a, b) => {
    const rA = rank[a.status] ?? 4;
    const rB = rank[b.status] ?? 4;
    if (rA !== rB) return rA - rB;
    if (a.status === "live") {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      const endA = a.ends_at ? Date.parse(a.ends_at) : Infinity;
      const endB = b.ends_at ? Date.parse(b.ends_at) : Infinity;
      return endA - endB;
    }
    if (a.status === "upcoming") {
      return Date.parse(a.release_at) - Date.parse(b.release_at);
    }
    return Date.parse(b.release_at) - Date.parse(a.release_at);
  });
};

const buildFallbackDrops = async (nowMs = Date.now()) => {
  if (
    !fallbackSneakerCache.rows ||
    nowMs - fallbackSneakerCache.fetchedAt >= FALLBACK_CACHE_TTL_MS
  ) {
    const { data } = await supabase
      .from("sneakers")
      .select("id, name, category, price, image_url")
      .order("id", { ascending: true })
      .limit(6);

    fallbackSneakerCache = {
      rows: Array.isArray(data) ? data : [],
      fetchedAt: nowMs,
    };
  }

  const sneakers = fallbackSneakerCache.rows || [];
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const templates = [
    {
      drop_type: "flash_sale",
      subtitle: "Flash Sale · Limited Pairs",
      description:
        "Alokasi flash sale terbatas dengan verifikasi keaslian digital TrueKicks dan pengiriman ekspres gratis.",
      priceMultiplier: 0.78,
      quota_total: 40,
      quota_remaining: 11,
      releaseOffset: -2 * hour,
      endOffset: 18 * hour,
      status: "live",
      is_featured: true,
    },
    {
      drop_type: "limited_drop",
      subtitle: "Hype Queue · Live Now",
      description:
        "Rilis terbatas dengan sistem antrean hype untuk memastikan pembagian kuota adil per ukuran.",
      priceMultiplier: 1,
      quota_total: 30,
      quota_remaining: 7,
      releaseOffset: -45 * 60 * 1000,
      endOffset: 6 * hour,
      status: "live",
      is_featured: false,
    },
    {
      drop_type: "exclusive_collab",
      subtitle: "Exclusive Vault Release",
      description:
        "Edisi kurasi terbatas TrueKicks Vault. Aktifkan pengingat agar mendapat akses tepat saat rilis dibuka.",
      priceMultiplier: 1,
      quota_total: 25,
      quota_remaining: 25,
      releaseOffset: 14 * hour,
      endOffset: 38 * hour,
      status: "upcoming",
      is_featured: false,
    },
    {
      drop_type: "flash_sale",
      subtitle: "Weekend Flash Drop",
      description:
        "Harga spesial flash drop akhir pekan dalam jumlah sangat terbatas untuk anggota TrueKicks.",
      priceMultiplier: 0.8,
      quota_total: 60,
      quota_remaining: 60,
      releaseOffset: 2 * day + 5 * hour,
      endOffset: 3 * day + 5 * hour,
      status: "upcoming",
      is_featured: false,
    },
    {
      drop_type: "limited_drop",
      subtitle: "Collector Limited Edition",
      description:
        "Siluet incaran kolektor dengan stok ketat per ukuran EU dan sertifikat autentikasi digital.",
      priceMultiplier: 1,
      quota_total: 20,
      quota_remaining: 20,
      releaseOffset: 5 * day + 9 * hour,
      endOffset: 6 * day + 9 * hour,
      status: "upcoming",
      is_featured: false,
    },
    {
      drop_type: "limited_drop",
      subtitle: "Archive Drop · Sold Out",
      description:
        "Seluruh kuota rilis ini telah habis terjual dalam sesi antrean sebelumnya.",
      priceMultiplier: 1,
      quota_total: 35,
      quota_remaining: 0,
      releaseOffset: -3 * day,
      endOffset: -2 * day,
      status: "sold_out",
      is_featured: false,
    },
  ];

  const baseNow = Math.floor(nowMs / (60 * 1000)) * 60 * 1000;

  return sneakers.slice(0, templates.length).map((snk, idx) => {
    const tpl = templates[idx];
    const basePrice = Number(snk.price) || 1999000;
    const releasePrice =
      tpl.priceMultiplier < 1
        ? Math.round((basePrice * tpl.priceMultiplier) / 1000) * 1000
        : basePrice;

    return formatDropPayload(
      {
        id: idx + 1,
        slug: `fallback-drop-${snk.id}`,
        title: snk.name,
        brand: snk.category || "TrueKicks",
        subtitle: tpl.subtitle,
        description: tpl.description,
        drop_type: tpl.drop_type,
        product_id: snk.id,
        product_type: "sneakers",
        release_price: releasePrice,
        original_price: tpl.priceMultiplier < 1 ? basePrice : null,
        image_url: snk.image_url,
        quota_total: tpl.quota_total,
        quota_remaining: tpl.quota_remaining,
        release_at: new Date(baseNow + tpl.releaseOffset).toISOString(),
        ends_at: new Date(baseNow + tpl.endOffset).toISOString(),
        status: tpl.status,
        is_featured: tpl.is_featured,
      },
      { reminderCount: 0, userNotified: false, nowMs }
    );
  });
};

const summarizeCounts = (drops) => ({
  all: drops.length,
  live: drops.filter((d) => d.status === "live").length,
  upcoming: drops.filter((d) => d.status === "upcoming").length,
  ended: drops.filter((d) => d.status === "sold_out" || d.status === "ended").length,
});

export const listDrops = async ({ userId = null, email = null } = {}) => {
  const nowMs = Date.now();
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  const { data: dropRows, error } = await supabase
    .from("drops")
    .select("*")
    .order("release_at", { ascending: true });

  if (error) {
    if (isMissingDropsSchemaError(error)) {
      const fallbackDrops = sortDropsForCalendar(await buildFallbackDrops(nowMs));
      return {
        synced: false,
        migrationRequired: true,
        server_time: new Date(nowMs).toISOString(),
        counts: summarizeCounts(fallbackDrops),
        drops: fallbackDrops,
      };
    }
    throw error;
  }

  // Fetch reminder counts & current user's subscription state (never expose subscriber emails)
  const reminderCounts = new Map();
  const notifiedDropIds = new Set();

  const { data: reminderRows, error: remErr } = await supabase
    .from("drop_reminders")
    .select("drop_id, user_id, email");

  if (!remErr && Array.isArray(reminderRows)) {
    for (const r of reminderRows) {
      const dId = Number(r.drop_id);
      reminderCounts.set(dId, (reminderCounts.get(dId) || 0) + 1);
      if (
        (userId != null && Number(r.user_id) === Number(userId)) ||
        (normalizedEmail &&
          String(r.email || "").trim().toLowerCase() === normalizedEmail)
      ) {
        notifiedDropIds.add(dId);
      }
    }
  }

  const formatted = sortDropsForCalendar(
    (dropRows || []).map((row) =>
      formatDropPayload(row, {
        reminderCount: reminderCounts.get(Number(row.id)) || 0,
        userNotified: notifiedDropIds.has(Number(row.id)),
        nowMs,
      })
    )
  );

  return {
    synced: true,
    migrationRequired: false,
    server_time: new Date(nowMs).toISOString(),
    counts: summarizeCounts(formatted),
    drops: formatted,
  };
};

export const subscribeDropReminder = async ({
  dropId,
  userId = null,
  email,
}) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const numericDropId = Number(dropId);

  const { data: drop, error } = await supabase
    .from("drops")
    .select("*")
    .eq("id", numericDropId)
    .maybeSingle();

  if (error) {
    if (isMissingDropsSchemaError(error)) {
      const fallback = await buildFallbackDrops();
      const match = fallback.find((d) => d.id === numericDropId);
      if (!match) return { notFound: true };
      if (match.status === "ended" || match.status === "sold_out") {
        return {
          invalidStatus: true,
          message: "This drop has already ended or sold out.",
        };
      }
      return {
        synced: false,
        migrationRequired: true,
        drop_id: numericDropId,
        drop_title: match.title,
        notified: true,
        already_subscribed: false,
        reminder_count: 1,
      };
    }
    throw error;
  }

  if (!drop) {
    return { notFound: true };
  }

  const effectiveStatus = computeEffectiveDropStatus(drop);
  if (effectiveStatus === "ended" || effectiveStatus === "sold_out") {
    return {
      invalidStatus: true,
      message: "This drop has already ended or sold out.",
    };
  }

  // Check if reminder already exists so we can report already_subscribed accurately
  const { data: existing, error: existingErr } = await supabase
    .from("drop_reminders")
    .select("id")
    .eq("drop_id", numericDropId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingErr && isMissingDropsSchemaError(existingErr)) {
    return {
      synced: false,
      migrationRequired: true,
      drop_id: numericDropId,
      drop_title: drop.title,
      notified: true,
      already_subscribed: false,
      reminder_count: 1,
    };
  }

  let alreadySubscribed = Boolean(existing);

  if (!alreadySubscribed) {
    const { error: upsertErr } = await supabase.from("drop_reminders").upsert(
      [
        {
          drop_id: numericDropId,
          user_id: userId != null ? Number(userId) : null,
          email: normalizedEmail,
        },
      ],
      { onConflict: "drop_id,email" }
    );

    if (upsertErr) {
      if (isMissingDropsSchemaError(upsertErr)) {
        return {
          synced: false,
          migrationRequired: true,
          drop_id: numericDropId,
          drop_title: drop.title,
          notified: true,
          already_subscribed: false,
          reminder_count: 1,
        };
      }
      throw upsertErr;
    }
  }

  const { count } = await supabase
    .from("drop_reminders")
    .select("id", { count: "exact", head: true })
    .eq("drop_id", numericDropId);

  return {
    synced: true,
    migrationRequired: false,
    drop_id: numericDropId,
    drop_title: drop.title,
    notified: true,
    already_subscribed: alreadySubscribed,
    reminder_count: Number(count) || 1,
  };
};

export const unsubscribeDropReminder = async ({
  dropId,
  userId = null,
  email = null,
}) => {
  const numericDropId = Number(dropId);
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  let query = supabase
    .from("drop_reminders")
    .delete()
    .eq("drop_id", numericDropId);

  if (normalizedEmail) {
    query = query.eq("email", normalizedEmail);
  } else if (userId != null) {
    query = query.eq("user_id", Number(userId));
  } else {
    return { missingIdentity: true };
  }

  const { error } = await query;
  if (error) {
    if (isMissingDropsSchemaError(error)) {
      return {
        synced: false,
        migrationRequired: true,
        drop_id: numericDropId,
        notified: false,
        reminder_count: 0,
      };
    }
    throw error;
  }

  const { count } = await supabase
    .from("drop_reminders")
    .select("id", { count: "exact", head: true })
    .eq("drop_id", numericDropId);

  return {
    synced: true,
    migrationRequired: false,
    drop_id: numericDropId,
    notified: false,
    reminder_count: Number(count) || 0,
  };
};

export const joinHypeQueue = async ({ dropId }) => {
  const numericDropId = Number(dropId);
  const nowMs = Date.now();

  let drop = null;
  let migrationRequired = false;

  const { data, error } = await supabase
    .from("drops")
    .select("*")
    .eq("id", numericDropId)
    .maybeSingle();

  if (error) {
    if (isMissingDropsSchemaError(error)) {
      migrationRequired = true;
      const fallback = await buildFallbackDrops(nowMs);
      drop = fallback.find((d) => d.id === numericDropId) || null;
    } else {
      throw error;
    }
  } else {
    drop = data ? formatDropPayload(data, { nowMs }) : null;
  }

  if (!drop) {
    return { notFound: true };
  }

  if (drop.status === "upcoming") {
    return {
      status: 400,
      code: "DROP_NOT_LIVE",
      error: "This drop is not live yet. Enable Notify Me to get alerted at launch.",
    };
  }

  if (drop.status === "sold_out" || drop.status === "ended" || drop.quota_remaining <= 0) {
    return {
      status: 409,
      code: "DROP_SOLD_OUT",
      error: "This drop is sold out or has ended.",
    };
  }

  const ticketCode = `TK-Q-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const initialPosition = 18 + (crypto.randomBytes(1)[0] % 47);

  return {
    ok: true,
    synced: !migrationRequired,
    migrationRequired,
    ticket: {
      drop_id: drop.id,
      ticket_code: ticketCode,
      initial_position: initialPosition,
      estimated_wait_seconds: 6,
      reservation_window_seconds: 180,
      quota_remaining: drop.quota_remaining,
      quota_total: drop.quota_total,
      joined_at: new Date(nowMs).toISOString(),
    },
    drop,
  };
};

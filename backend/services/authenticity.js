import crypto from "crypto";

const getSigningSecret = () =>
  process.env.AUTHENTICITY_SECRET?.trim() ||
  process.env.JWT_SECRET?.trim() ||
  "truekicks-fallback-signing";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getOrderShortId = (orderId) => {
  if (orderId == null) return "00000";
  const raw = String(orderId).trim();
  if (UUID_REGEX.test(raw)) {
    return raw.slice(0, 8).toUpperCase();
  }
  const num = Number(raw);
  if (Number.isInteger(num) && num > 0) {
    return num.toString(16).toUpperCase().padStart(5, "0");
  }
  return raw.replace(/[^0-9A-Za-z]/g, "").slice(0, 8).toUpperCase() || "00000";
};

/**
 * Generates a deterministic, tamper-evident authenticity tag for an order.
 * Supports both UUID and integer primary keys.
 * Format: TK-AUTH-<SHORT_ID>-<HMAC_8>
 */
export const generateAuthenticityCode = (order) => {
  if (!order || order.id == null) return null;
  if (order.authenticity_code) return order.authenticity_code;

  const idPart = getOrderShortId(order.id);
  const payload = `${String(order.id)}:${order.user_id || 0}:${order.total_price || 0}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();

  return `TK-AUTH-${idPart}-${sig}`;
};

export const parseAuthenticityCode = (rawCode) => {
  if (typeof rawCode !== "string") return null;
  const cleaned = rawCode.trim().toUpperCase();
  const match = /^TK-AUTH-([0-9A-F]{4,12})-([0-9A-F]{8})$/.exec(cleaned);
  if (!match) return null;

  const idPrefix = match[1];
  const isUuidPrefix = idPrefix.length === 8;
  const numericOrderId = parseInt(idPrefix, 16);

  return {
    code: cleaned,
    idPrefix,
    isUuidPrefix,
    numericOrderId: Number.isInteger(numericOrderId) && numericOrderId > 0 ? numericOrderId : null,
    signature: match[2],
  };
};

export const verifyAuthenticityForOrder = (rawCode, order) => {
  if (!order || typeof rawCode !== "string") return false;
  const cleaned = rawCode.trim().toUpperCase();
  if (order.authenticity_code && order.authenticity_code.toUpperCase() === cleaned) {
    return true;
  }
  const expected = generateAuthenticityCode(order);
  if (!expected) return false;
  const a = Buffer.from(cleaned);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const generateTrackingNumber = (order) => {
  if (!order || order.id == null) return null;
  if (order.tracking_number) return order.tracking_number;

  const created = order.created_at ? new Date(order.created_at) : new Date();
  const y = created.getUTCFullYear();
  const m = String(created.getUTCMonth() + 1).padStart(2, "0");
  const d = String(created.getUTCDate()).padStart(2, "0");
  const shortId = getOrderShortId(order.id);
  return `TKX-${y}${m}${d}-${shortId}`;
};

export const buildOrderTimeline = (order) => {
  const status = (order?.status || "Processing").toLowerCase();
  const createdAt = order?.created_at || new Date().toISOString();
  const isCancelled = status === "cancelled" || status === "expired" || status === "failed";

  const statusRank = {
    "pending payment": 0,
    pending: 0,
    paid: 1,
    processing: 1,
    packed: 1,
    shipped: 2,
    delivered: 3,
    completed: 3,
  };
  const currentStep = isCancelled ? -1 : (statusRank[status] ?? 1);

  if (isCancelled) {
    const isExpired = status === "expired";
    return [
      {
        key: "placed",
        label: "Order Placed",
        description: "Order received by TrueKicks",
        completed: true,
        active: false,
        timestamp: createdAt,
      },
      {
        key: isExpired ? "expired" : "cancelled",
        label: isExpired ? "Payment Expired" : "Cancelled",
        description: isExpired
          ? "Payment window expired and stock was released"
          : "This order was cancelled",
        completed: true,
        active: true,
        timestamp: order?.updated_at || createdAt,
      },
    ];
  }

  const isPendingPayment = status === "pending payment" || status === "pending";

  return [
    {
      key: isPendingPayment ? "awaiting_payment" : "placed",
      label: isPendingPayment ? "Awaiting Payment" : "Payment Confirmed",
      description: isPendingPayment
        ? "Complete payment via QRIS, Virtual Account, or e-wallet"
        : "Payment verified & order confirmed",
      completed: !isPendingPayment,
      active: currentStep === 0,
      timestamp: order?.paid_at || createdAt,
    },
    {
      key: "processing",
      label: "Authenticity Check & Packed",
      description: "Multi-point legit check & studio packaging",
      completed: currentStep >= 1,
      active: currentStep === 1,
      timestamp: currentStep >= 1 ? order?.paid_at || createdAt : null,
    },
    {
      key: "shipped",
      label: "In Transit",
      description: `Handed to ${order?.courier || "TrueKicks Express"}`,
      completed: currentStep >= 2,
      active: currentStep === 2,
      timestamp: order?.shipped_at || null,
    },
    {
      key: "delivered",
      label: "Delivered",
      description: "Package arrived at destination",
      completed: currentStep >= 3,
      active: currentStep === 3,
      timestamp: order?.delivered_at || null,
    },
  ];
};

export const maskBuyerName = (fullName) => {
  if (!fullName || typeof fullName !== "string") return "TrueKicks Member";
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 1) return part;
      if (part.length === 2) return `${part[0]}*`;
      return `${part[0]}${"*".repeat(Math.min(4, part.length - 1))}`;
    })
    .join(" ");
};

export const enrichOrder = (order) => {
  if (!order) return order;
  const courier = order.courier || "TrueKicks Express";
  const tracking_number = generateTrackingNumber(order);
  const authenticity_code = generateAuthenticityCode(order);
  const statusLower = String(order.status || "").toLowerCase();
  const inferredPaymentStatus =
    order.payment_status ||
    (statusLower === "pending payment" || statusLower === "pending"
      ? "pending"
      : statusLower === "expired"
        ? "expired"
        : statusLower === "cancelled"
          ? "cancelled"
          : "paid");

  return {
    ...order,
    courier,
    tracking_number,
    authenticity_code,
    payment_status: inferredPaymentStatus,
    timeline: buildOrderTimeline({ ...order, courier }),
  };
};

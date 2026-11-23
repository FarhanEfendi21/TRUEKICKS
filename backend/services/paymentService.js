import crypto from "node:crypto";
import supabase from "../config/supabase.js";
import { enrichOrder, getOrderShortId } from "./authenticity.js";
import {
  resolveCanonicalVariantTarget,
  restoreStockAtomic,
} from "./inventoryService.js";

const MIDTRANS_TIMEOUT_MS = 12 * 1000;

export const isMidtransProduction = () =>
  String(process.env.MIDTRANS_IS_PRODUCTION || "").toLowerCase() === "true";

export const getMidtransServerKey = () =>
  process.env.MIDTRANS_SERVER_KEY?.trim() || "";

export const getMidtransClientKey = () =>
  process.env.MIDTRANS_CLIENT_KEY?.trim() || "";

export const isMidtransLiveConfigured = () => Boolean(getMidtransServerKey());

export const getSnapBaseUrl = () =>
  isMidtransProduction()
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";

export const getCoreApiBaseUrl = () =>
  isMidtransProduction()
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";

export const getSnapScriptUrl = () => `${getSnapBaseUrl()}/snap/snap.js`;

export const getPublicPaymentConfig = () => {
  const live = isMidtransLiveConfigured();
  const clientKey = getMidtransClientKey();
  return {
    provider: "midtrans",
    mode: live
      ? isMidtransProduction()
        ? "production"
        : "sandbox"
      : "sandbox_simulator",
    snap_configured: live && Boolean(clientKey),
    client_key: clientKey || null,
    snap_script_url: getSnapScriptUrl(),
    supported_methods: [
      "qris",
      "bca_va",
      "bni_va",
      "bri_va",
      "mandiri_va",
      "gopay",
      "shopeepay",
    ],
  };
};

const isMissingPaymentColumnError = (error) => {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("could not find the") ||
    msg.includes("does not exist")
  );
};

export const buildGatewayOrderId = (orderId) => {
  const shortId = getOrderShortId(orderId);
  const ts = Date.now().toString(36).toUpperCase();
  return `TK-${shortId}-${ts}`;
};

export const getWebhookSigningSecret = () => {
  const serverKey = getMidtransServerKey();
  if (serverKey) return serverKey;
  // In non-production local/sandbox mode without Midtrans key, use dedicated test secret or JWT_SECRET
  if (process.env.NODE_ENV !== "production" && !isMidtransProduction()) {
    return (
      process.env.MIDTRANS_WEBHOOK_TEST_SECRET?.trim() ||
      process.env.JWT_SECRET?.trim() ||
      ""
    );
  }
  return "";
};

export const computeMidtransSignature = (
  { order_id, status_code, gross_amount },
  secret
) => {
  const raw = `${String(order_id ?? "")}${String(status_code ?? "")}${String(
    gross_amount ?? ""
  )}${String(secret ?? "")}`;
  return crypto.createHash("sha512").update(raw).digest("hex");
};

export const verifyMidtransWebhookSignature = (payload) => {
  const secret = getWebhookSigningSecret();
  if (!secret) {
    return { valid: false, reason: "Webhook secret is not configured." };
  }

  const incoming = String(payload?.signature_key || "")
    .trim()
    .toLowerCase();
  if (!incoming || !/^[a-f0-9]{128}$/.test(incoming)) {
    return { valid: false, reason: "Missing or malformed signature_key." };
  }

  const expected = computeMidtransSignature(payload, secret).toLowerCase();
  const a = Buffer.from(incoming, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "Signature mismatch." };
  }

  return { valid: true };
};

export const formatPaymentMethodLabel = (payload) => {
  const type = String(payload?.payment_type || "").toLowerCase();
  if (!type) return null;

  if (type === "qris") return "QRIS";
  if (type === "gopay") return "GoPay";
  if (type === "shopeepay") return "ShopeePay";
  if (type === "dana") return "DANA";
  if (type === "credit_card") return "Credit Card";
  if (type === "echannel") return "Mandiri Virtual Account";
  if (type === "permata" || type === "permata_va") {
    return "Permata Virtual Account";
  }
  if (type === "bank_transfer") {
    const bank = String(
      payload?.va_numbers?.[0]?.bank || payload?.permata_va_number ? "permata" : ""
    ).toUpperCase();
    if (payload?.va_numbers?.[0]?.bank) {
      return `${String(payload.va_numbers[0].bank).toUpperCase()} Virtual Account`;
    }
    return bank ? `${bank} Virtual Account` : "Bank Transfer VA";
  }
  if (type.endsWith("_va")) {
    return `${type.replace(/_va$/, "").toUpperCase()} Virtual Account`;
  }
  return type
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
};

export const mapMidtransTransactionState = ({
  transaction_status,
  fraud_status,
}) => {
  const tx = String(transaction_status || "").toLowerCase();
  const fraud = String(fraud_status || "").toLowerCase();

  if (tx === "settlement" || (tx === "capture" && (!fraud || fraud === "accept"))) {
    return {
      orderStatus: "Paid",
      paymentStatus: "paid",
      shouldRestoreStock: false,
    };
  }
  if (tx === "pending" || (tx === "capture" && fraud === "challenge")) {
    return {
      orderStatus: "Pending Payment",
      paymentStatus: "pending",
      shouldRestoreStock: false,
    };
  }
  if (tx === "expire") {
    return {
      orderStatus: "Expired",
      paymentStatus: "expired",
      shouldRestoreStock: true,
    };
  }
  if (tx === "cancel") {
    return {
      orderStatus: "Cancelled",
      paymentStatus: "cancelled",
      shouldRestoreStock: true,
    };
  }
  if (tx === "deny" || tx === "failure") {
    return {
      orderStatus: "Cancelled",
      paymentStatus: "failed",
      shouldRestoreStock: true,
    };
  }
  if (tx === "refund" || tx === "partial_refund") {
    return {
      orderStatus: "Cancelled",
      paymentStatus: "refunded",
      shouldRestoreStock: true,
    };
  }
  return {
    orderStatus: "Pending Payment",
    paymentStatus: "pending",
    shouldRestoreStock: false,
  };
};

export const createSnapTransaction = async ({
  order,
  items = [],
  discountAmount = 0,
  customerEmail = "",
  frontendUrl = "",
}) => {
  const gatewayOrderId = buildGatewayOrderId(order.id);
  const grossAmount = Math.max(1, Math.round(Number(order.total_price) || 0));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (!isMidtransLiveConfigured()) {
    const simToken = `SIM-SNAP-${crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()}`;
    return {
      mode: "sandbox_simulator",
      gateway: "midtrans_sandbox_sim",
      gateway_order_id: gatewayOrderId,
      token: simToken,
      redirect_url: null,
      client_key: null,
      snap_script_url: null,
      expires_at: expiresAt,
      status: "pending",
    };
  }

  const itemDetails = (items || []).map((item, idx) => ({
    id: `${item.productType || "item"}-${item.id || idx}-${item.size || "std"}`.slice(
      0,
      50
    ),
    price: Math.round(Number(item.price) || 0),
    quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    name: `${item.name || "TrueKicks Item"} (${item.size || "-"})`.slice(0, 50),
  }));

  const roundedDiscount = Math.round(Number(discountAmount) || 0);
  if (roundedDiscount > 0) {
    itemDetails.push({
      id: "PROMO-DISCOUNT",
      price: -roundedDiscount,
      quantity: 1,
      name: "TrueKicks Promo Discount",
    });
  }

  // Ensure exact item_details sum matches gross_amount required by Midtrans Snap
  const detailsSum = itemDetails.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0
  );
  const safeItemDetails = detailsSum === grossAmount ? itemDetails : undefined;

  const cleanFrontendUrl = (
    frontendUrl ||
    process.env.FRONTEND_URL ||
    "https://truekicks-production.vercel.app"
  ).replace(/\/+$/, "");

  const snapPayload = {
    transaction_details: {
      order_id: gatewayOrderId,
      gross_amount: grossAmount,
    },
    ...(safeItemDetails ? { item_details: safeItemDetails } : {}),
    customer_details: {
      first_name: String(order.full_name || "TrueKicks Customer").slice(0, 60),
      email: customerEmail || "customer@truekicks.id",
      phone: String(order.phone || ""),
      shipping_address: {
        first_name: String(order.full_name || "TrueKicks Customer").slice(0, 60),
        phone: String(order.phone || ""),
        address: String(order.address || "").slice(0, 200),
        city: String(order.city || "").slice(0, 50),
        postal_code: String(order.postal_code || "").slice(0, 20),
        country_code: "IDN",
      },
    },
    enabled_payments: [
      "other_qris",
      "gopay",
      "shopeepay",
      "bca_va",
      "bni_va",
      "bri_va",
      "echannel",
      "permata_va",
      "cimb_va",
      "credit_card",
    ],
    expiry: {
      unit: "hours",
      duration: 24,
    },
    callbacks: {
      finish: `${cleanFrontendUrl}/orders?payment=finish&order=${encodeURIComponent(
        String(order.id)
      )}`,
    },
  };

  const authHeader = `Basic ${Buffer.from(`${getMidtransServerKey()}:`).toString(
    "base64"
  )}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MIDTRANS_TIMEOUT_MS);

  try {
    const response = await fetch(`${getSnapBaseUrl()}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(snapPayload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.token) {
      const errDetail = Array.isArray(data?.error_messages)
        ? data.error_messages.join("; ")
        : data?.status_message || `HTTP ${response.status}`;
      throw new Error(`Midtrans Snap error: ${errDetail}`);
    }

    return {
      mode: isMidtransProduction() ? "production" : "sandbox",
      gateway: "midtrans",
      gateway_order_id: gatewayOrderId,
      token: data.token,
      redirect_url: data.redirect_url || null,
      client_key: getMidtransClientKey() || null,
      snap_script_url: getSnapScriptUrl(),
      expires_at: expiresAt,
      status: "pending",
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchMidtransTransactionStatus = async (gatewayOrderId) => {
  if (!isMidtransLiveConfigured() || !gatewayOrderId) return null;

  const authHeader = `Basic ${Buffer.from(`${getMidtransServerKey()}:`).toString(
    "base64"
  )}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MIDTRANS_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${getCoreApiBaseUrl()}/v2/${encodeURIComponent(gatewayOrderId)}/status`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: authHeader,
        },
        signal: controller.signal,
      }
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (!data || !data.transaction_status) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const findOrderByGatewayReference = async (gatewayOrderId, explicitOrderId = null) => {
  if (explicitOrderId) {
    const byId = await supabase
      .from("orders")
      .select("*")
      .eq("id", explicitOrderId)
      .maybeSingle();
    if (!byId.error && byId.data) return byId.data;
  }

  if (gatewayOrderId) {
    const byGateway = await supabase
      .from("orders")
      .select("*")
      .eq("payment_gateway_order_id", gatewayOrderId)
      .maybeSingle();

    if (!byGateway.error && byGateway.data) {
      return byGateway.data;
    }

    // Fallback: match direct order ID or UUID prefix encoded in TK-<8HEX>-<TS>
    const direct = await supabase
      .from("orders")
      .select("*")
      .eq("id", gatewayOrderId)
      .maybeSingle();
    if (!direct.error && direct.data) {
      return direct.data;
    }

    const prefixMatch = /^TK-([0-9A-F]{8})-/i.exec(String(gatewayOrderId));
    if (prefixMatch) {
      const lower = prefixMatch[1].toLowerCase();
      const range = await supabase
        .from("orders")
        .select("*")
        .gte("id", `${lower}-0000-0000-0000-000000000000`)
        .lte("id", `${lower}-ffff-ffff-ffff-ffffffffffff`)
        .limit(5);
      if (!range.error && Array.isArray(range.data) && range.data.length > 0) {
        return range.data[0];
      }
    }
  }

  return null;
};

const restoreOrderItemsStock = async (items) => {
  if (!Array.isArray(items) || items.length === 0) return { restored: false };
  const canonicalItems = await Promise.all(
    items.map(async (item) => {
      const target = await resolveCanonicalVariantTarget(
        item.productType || "sneakers",
        item.id,
        { name: item.name }
      );
      return {
        product_type: target.productType,
        product_id: target.productId,
        size: String(item.size || "").trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
      };
    })
  );
  return restoreStockAtomic(canonicalItems);
};

export const processPaymentNotification = async ({
  payload,
  requireSignature = true,
  explicitOrderId = null,
}) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 400, error: "Invalid webhook payload." };
  }

  if (requireSignature) {
    const sigCheck = verifyMidtransWebhookSignature(payload);
    if (!sigCheck.valid) {
      return {
        ok: false,
        status: 403,
        error: `Invalid payment webhook signature (${sigCheck.reason}).`,
      };
    }
  }

  const gatewayOrderId = String(payload.order_id || "").trim();
  if (!gatewayOrderId && !explicitOrderId) {
    return { ok: false, status: 400, error: "Missing order_id in notification." };
  }

  const order = await findOrderByGatewayReference(gatewayOrderId, explicitOrderId);
  if (!order) {
    return { ok: false, status: 404, error: "Order not found." };
  }

  // Gross amount tamper protection (tolerate Rp 1 rounding differences for .00 strings)
  if (payload.gross_amount != null) {
    const incomingAmount = Number(payload.gross_amount);
    const expectedAmount = Math.round(Number(order.total_price) || 0);
    if (
      !Number.isFinite(incomingAmount) ||
      Math.abs(incomingAmount - expectedAmount) > 1
    ) {
      return {
        ok: false,
        status: 400,
        error: "Webhook gross_amount does not match order total.",
      };
    }
  }

  const mapped = mapMidtransTransactionState(payload);
  const methodLabel =
    formatPaymentMethodLabel(payload) || order.payment_method || null;

  const prevStatusLower = String(order.status || "").toLowerCase();
  const prevPaymentStatusLower = String(order.payment_status || "").toLowerCase();
  const alreadyPaid =
    prevPaymentStatusLower === "paid" ||
    ["paid", "processing", "packed", "shipped", "delivered", "completed"].includes(
      prevStatusLower
    );

  // Strict idempotency: never downgrade a paid order or double-process duplicate settled notifications
  if (alreadyPaid && mapped.paymentStatus !== "refunded") {
    return {
      ok: true,
      idempotent: true,
      payment_status: "paid",
      status: order.status,
      stock_restored: false,
      order: enrichOrder(order),
    };
  }

  const alreadyTerminated =
    Boolean(order.stock_restored) ||
    ["expired", "cancelled", "failed", "refunded"].includes(prevPaymentStatusLower) ||
    ["expired", "cancelled"].includes(prevStatusLower);

  if (alreadyTerminated && mapped.shouldRestoreStock) {
    return {
      ok: true,
      idempotent: true,
      payment_status: order.payment_status || mapped.paymentStatus,
      status: order.status,
      stock_restored: false,
      order: enrichOrder(order),
    };
  }

  // Restore deducted variant stock AT MOST ONCE when payment expires/cancels/fails
  let stockRestoredNow = false;
  if (mapped.shouldRestoreStock && !alreadyTerminated) {
    const restoreRes = await restoreOrderItemsStock(order.items);
    stockRestoredNow = Boolean(restoreRes?.restored);
  }

  const extendedUpdate = {
    status: mapped.orderStatus,
    payment_status: mapped.paymentStatus,
    payment_method: methodLabel,
    ...(mapped.paymentStatus === "paid"
      ? { paid_at: order.paid_at || new Date().toISOString() }
      : {}),
    ...(mapped.shouldRestoreStock ? { stock_restored: true } : {}),
  };

  let updateRes = await supabase
    .from("orders")
    .update(extendedUpdate)
    .eq("id", order.id)
    .select();

  if (updateRes.error && isMissingPaymentColumnError(updateRes.error)) {
    updateRes = await supabase
      .from("orders")
      .update({ status: mapped.orderStatus })
      .eq("id", order.id)
      .select();
  }

  if (updateRes.error) {
    throw updateRes.error;
  }

  const updatedOrder = updateRes.data?.[0] || { ...order, ...extendedUpdate };

  return {
    ok: true,
    idempotent: false,
    payment_status: mapped.paymentStatus,
    status: updatedOrder.status,
    payment_method: methodLabel,
    stock_restored: stockRestoredNow,
    order: enrichOrder(updatedOrder),
  };
};

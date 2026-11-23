const formatIdr = (amount) => {
  const num = Math.round(Number(amount) || 0);
  return `Rp ${num.toLocaleString("id-ID")}`;
};

const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Sends a minimalist editorial order confirmation email via Resend REST API.
 * Zero extra npm dependency; degrades gracefully if RESEND_API_KEY is not configured.
 */
export const sendOrderConfirmationEmail = async ({
  to,
  order,
  pricing,
  frontendUrl,
}) => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !to) {
    return {
      sent: false,
      reason: !apiKey ? "RESEND_API_KEY not configured" : "Recipient email missing",
    };
  }

  const fromAddress =
    process.env.EMAIL_FROM?.trim() || "TrueKicks <onboarding@resend.dev>";
  const baseUrl = (
    frontendUrl ||
    process.env.FRONTEND_URL ||
    "https://truekicks-production.vercel.app"
  ).replace(/\/$/, "");
  const verifyUrl = `${baseUrl}/verify/${encodeURIComponent(order.authenticity_code || "")}`;

  const itemsRows = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <div style="font-weight:700;color:#0f172a;font-size:14px;">${escapeHtml(item.name)}</div>
          <div style="color:#64748b;font-size:12px;margin-top:2px;">Size ${escapeHtml(item.size)} &middot; Qty ${Number(item.quantity) || 1}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;color:#0f172a;font-size:14px;white-space:nowrap;">
          ${formatIdr((Number(item.price) || 0) * (Number(item.quantity) || 1))}
        </td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;padding:28px 32px;color:#ffffff;">
                <div style="font-size:22px;font-weight:900;font-style:italic;letter-spacing:-0.04em;">
                  TRUE<span style="color:#FF5500;">KICKS</span>
                </div>
                <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#94a3b8;margin-top:8px;">
                  Order Confirmation &middot; #${escapeHtml(order.id)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Thanks for your order, ${escapeHtml(order.full_name)}.</h1>
                <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
                  Your pair is now entering our multi-point authenticity check before dispatch.
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:24px;">
                  <tr>
                    <td style="font-size:12px;color:#64748b;padding:4px 0;">Tracking Number</td>
                    <td style="font-size:12px;font-weight:700;color:#0f172a;text-align:right;padding:4px 0;">${escapeHtml(order.tracking_number)} (${escapeHtml(order.courier)})</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#64748b;padding:4px 0;">Authenticity Tag</td>
                    <td style="font-size:12px;font-weight:700;color:#FF5500;text-align:right;padding:4px 0;">${escapeHtml(order.authenticity_code)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#64748b;padding:4px 0;">Shipping To</td>
                    <td style="font-size:12px;color:#0f172a;text-align:right;padding:4px 0;">${escapeHtml(order.address)}, ${escapeHtml(order.city)} ${escapeHtml(order.postal_code)}</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                  ${itemsRows}
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                  <tr>
                    <td style="font-size:13px;color:#64748b;padding:4px 0;">Subtotal</td>
                    <td style="font-size:13px;color:#0f172a;text-align:right;padding:4px 0;">${formatIdr(pricing?.subtotal ?? order.total_price)}</td>
                  </tr>
                  ${
                    pricing?.discount_amount > 0
                      ? `<tr>
                          <td style="font-size:13px;color:#16a34a;padding:4px 0;">Discount</td>
                          <td style="font-size:13px;color:#16a34a;text-align:right;padding:4px 0;">-${formatIdr(pricing.discount_amount)}</td>
                        </tr>`
                      : ""
                  }
                  <tr>
                    <td style="font-size:13px;color:#64748b;padding:4px 0;">Shipping</td>
                    <td style="font-size:13px;color:#16a34a;font-weight:700;text-align:right;padding:4px 0;">FREE</td>
                  </tr>
                  <tr>
                    <td style="font-size:16px;font-weight:900;color:#0f172a;padding-top:12px;border-top:1px dashed #cbd5e1;">Total Paid</td>
                    <td style="font-size:18px;font-weight:900;color:#FF5500;text-align:right;padding-top:12px;border-top:1px dashed #cbd5e1;">${formatIdr(order.total_price)}</td>
                  </tr>
                </table>

                <div style="text-align:center;">
                  <a href="${verifyUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:14px 28px;border-radius:999px;">
                    Verify Authenticity Certificate
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;color:#94a3b8;font-size:11px;text-align:center;">
                TrueKicks Studio &middot; 100% Authentic Guaranteed
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: `TrueKicks Order #${order.id} Confirmed — ${order.authenticity_code}`,
        html,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("Resend email delivery failed:", response.status, errText);
      return { sent: false, reason: `Resend HTTP ${response.status}` };
    }

    const result = await response.json();
    return { sent: true, id: result.id || null };
  } catch (error) {
    console.warn("Resend email error:", error.message);
    return { sent: false, reason: error.message };
  }
};

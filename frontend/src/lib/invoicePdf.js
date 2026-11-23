import { formatRupiah } from "./pricing";

/**
 * Generates and downloads a clean studio A4 PDF Invoice + Authenticity Record.
 * Dynamically imports jsPDF on click so initial storefront bundle stays lean.
 */
export const downloadOrderInvoicePdf = async (order) => {
  if (!order) return;

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // --- TOP STUDIO HEADER ---
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("TRUE", margin, 18);
  const trueWidth = doc.getTextWidth("TRUE");
  doc.setTextColor(255, 85, 0);
  doc.text("KICKS", margin + trueWidth, 18);

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("OFFICIAL INVOICE & DIGITAL AUTHENTICITY RECORD", margin, 26);

  // Invoice ID & Date on right of header (handles both UUID and integer IDs cleanly)
  const rawOrderId = String(order.id || "00000");
  const shortOrderId = rawOrderId.includes("-")
    ? rawOrderId.split("-")[0].toUpperCase()
    : rawOrderId.padStart(5, "0");
  const invoiceNo = `INV-${shortOrderId}`;
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(invoiceNo, pageWidth - margin, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Issued: ${orderDate}`, pageWidth - margin, 24, { align: "right" });
  doc.text(`Status: ${String(order.status || "Processing").toUpperCase()}`, pageWidth - margin, 30, {
    align: "right",
  });

  // --- SHIPPING & FULFILLMENT METADATA ---
  let y = 50;
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SHIPPED TO", margin, y);
  doc.text("FULFILLMENT & VERIFICATION", pageWidth / 2 + 4, y);

  y += 6;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(String(order.full_name || "Customer"), margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const addressLines = doc.splitTextToSize(
    [order.address, [order.city, order.postal_code].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || "-",
    contentWidth / 2 - 6
  );
  doc.text(addressLines, margin, y + 5.5);
  const leftEndY = y + 5.5 + addressLines.length * 4.5 + 3;
  if (order.phone) {
    doc.text(`Phone: ${order.phone}`, margin, leftEndY);
  }

  // Right column details
  const rightX = pageWidth / 2 + 4;
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.text(`Courier: ${order.courier || "TrueKicks Express"}`, rightX, y);
  doc.text(`Tracking: ${order.tracking_number || `TKX-${order.id}`}`, rightX, y + 5.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 85, 0);
  doc.text(
    `Auth Tag: ${order.authenticity_code || "Pending"}`,
    rightX,
    y + 11
  );

  // --- ITEMS TABLE ---
  y = Math.max(leftEndY + 12, y + 26);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y - 5, contentWidth, 9, 1.5, 1.5, "F");

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ITEM", margin + 3, y + 0.5);
  doc.text("SIZE", margin + 102, y + 0.5);
  doc.text("QTY", margin + 122, y + 0.5);
  doc.text("UNIT PRICE", margin + 148, y + 0.5, { align: "right" });
  doc.text("TOTAL", pageWidth - margin - 3, y + 0.5, { align: "right" });

  y += 10;
  let computedSubtotal = 0;

  (order.items || []).forEach((item) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.price) || 0;
    const lineTotal = qty * unitPrice;
    computedSubtotal += lineTotal;

    const nameLines = doc.splitTextToSize(String(item.name || "Product"), 94);
    const rowHeight = Math.max(10, nameLines.length * 4.8 + 4);

    if (y + rowHeight > 255) {
      doc.addPage();
      y = 24;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(nameLines, margin + 3, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(String(item.size || "-"), margin + 102, y);
    doc.text(String(qty), margin + 124, y);
    doc.text(formatRupiah(unitPrice), margin + 148, y, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupiah(lineTotal), pageWidth - margin - 3, y, {
      align: "right",
    });

    y += rowHeight;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y - 3, pageWidth - margin, y - 3);
  });

  // --- TOTALS SECTION ---
  y += 4;
  const totalPaid = Number(order.total_price) || computedSubtotal;
  const discountAmt =
    Number(order.discount_amount) > 0
      ? Number(order.discount_amount)
      : Math.max(0, computedSubtotal - totalPaid);

  const summaryLabelX = pageWidth - margin - 58;
  const summaryValX = pageWidth - margin - 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Subtotal", summaryLabelX, y);
  doc.setTextColor(15, 23, 42);
  doc.text(formatRupiah(computedSubtotal || totalPaid), summaryValX, y, {
    align: "right",
  });

  if (discountAmt > 0) {
    y += 6;
    doc.setTextColor(22, 163, 74);
    doc.text(
      order.coupon_code ? `Discount (${order.coupon_code})` : "Discount",
      summaryLabelX,
      y
    );
    doc.text(`-${formatRupiah(discountAmt)}`, summaryValX, y, {
      align: "right",
    });
  }

  y += 6;
  doc.setTextColor(100, 116, 139);
  doc.text("Shipping", summaryLabelX, y);
  doc.setTextColor(22, 163, 74);
  doc.setFont("helvetica", "bold");
  doc.text("FREE", summaryValX, y, { align: "right" });

  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryLabelX, y, pageWidth - margin, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("TOTAL PAID", summaryLabelX, y);
  doc.setTextColor(255, 85, 0);
  doc.setFontSize(13);
  doc.text(formatRupiah(totalPaid), summaryValX, y, { align: "right" });

  // --- DIGITAL AUTHENTICITY FOOTER BOX ---
  if (order.authenticity_code) {
    const boxY = Math.min(248, Math.max(y + 16, 226));
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, boxY, contentWidth, 24, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("TRUEKICKS DIGITAL AUTHENTICITY CERTIFICATE", margin + 5, boxY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Certificate ID: ${order.authenticity_code}`,
      margin + 5,
      boxY + 13
    );

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://truekicks-production.vercel.app";
    doc.text(
      `Verify online: ${origin}/verify/${order.authenticity_code}`,
      margin + 5,
      boxY + 18.5
    );
  }

  // Footer note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Thank you for shopping at TrueKicks. Every pair is inspected and verified authentic.",
    pageWidth / 2,
    285,
    { align: "center" }
  );

  doc.save(`TrueKicks-Invoice-${shortOrderId}.pdf`);
};

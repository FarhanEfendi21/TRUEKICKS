export const hasActiveDiscount = (item) => {
  if (!item || item.discount_price == null) return false;
  const price = Number(item.price);
  const discount = Number(item.discount_price);
  return (
    Number.isFinite(price) &&
    Number.isFinite(discount) &&
    discount > 0 &&
    discount < price
  );
};

export const getEffectivePrice = (item) =>
  hasActiveDiscount(item) ? Number(item.discount_price) : Number(item?.price || 0);

export const getDiscountPercentage = (item) => {
  if (!hasActiveDiscount(item)) return 0;
  if (item.discount_percentage) return Number(item.discount_percentage);
  return Math.round(
    ((Number(item.price) - Number(item.discount_price)) / Number(item.price)) * 100
  );
};

export const formatRupiah = (value) => {
  const num = Number(value);
  const safe = Number.isFinite(num) ? Math.round(num) : 0;
  return `Rp ${safe.toLocaleString("id-ID")}`;
};

export const formatRupiahShort = (value) => {
  const num = Number(value);
  const safe = Number.isFinite(num) ? Math.round(num / 1000) : 0;
  return `Rp ${safe.toLocaleString("id-ID")}K`;
};

export const formatRangeLabel = (value) => {
  const num = Number(value) || 0;
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}Jt`;
  }
  return `${(num / 1000).toFixed(0)}K`;
};

export const getOrderStatusBadge = (status) => {
  switch (status?.toLowerCase()) {
    case "completed":
    case "delivered":
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
    case "pending payment":
    case "pending":
      return "bg-orange-50 text-[#FF5500] border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30";
    case "processing":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30";
    case "shipped":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30";
    case "cancelled":
    case "expired":
    case "failed":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
};

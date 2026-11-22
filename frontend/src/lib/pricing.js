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

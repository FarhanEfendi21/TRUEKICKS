import { createContext, useState, useContext, useEffect, useRef, useCallback } from "react";
import api from "../lib/api";

const CartContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);

const getCurrentUserId = () => {
  try {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return null;
    const parsedUser = JSON.parse(storedUser);
    if (!parsedUser || !parsedUser.id) return null;
    if (parsedUser.email && parsedUser.email.includes("guest")) return null;
    return parsedUser.id;
  } catch {
    return null;
  }
};

const readLocalCart = (userId) => {
  if (!userId) return [];
  try {
    const saved = localStorage.getItem(`cartItems_${userId}`);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const normalizeProductType = (productType) => productType || "sneakers";

const isSameCartItem = (item, id, size, productType) =>
  String(item.id) === String(id) &&
  String(item.size) === String(size) &&
  normalizeProductType(item.productType) === normalizeProductType(productType);

const mergeServerStockMetadata = (localItems, serverItems) => {
  if (!Array.isArray(serverItems) || serverItems.length === 0) return localItems;
  return localItems.map((localItem) => {
    const match = serverItems.find((s) =>
      isSameCartItem(s, localItem.id, localItem.size, localItem.productType)
    );
    if (!match) return localItem;
    const availableStock =
      match.available_stock !== undefined ? match.available_stock : localItem.available_stock ?? null;
    return {
      ...localItem,
      available_stock: availableStock,
      low_stock_threshold: match.low_stock_threshold ?? localItem.low_stock_threshold ?? 3,
      stock_status: match.stock_status ?? localItem.stock_status ?? "untracked",
      stock_exceeded:
        availableStock != null ? Number(localItem.quantity) > Number(availableStock) : false,
      sku: match.sku ?? localItem.sku ?? null,
    };
  });
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => readLocalCart(getCurrentUserId()));
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [stockTracked, setStockTracked] = useState(false);
  const [discount, setDiscount] = useState({ type: null, value: 0, code: "" });

  const syncTimerRef = useRef(null);
  const activeUserIdRef = useRef(getCurrentUserId());

  const pushCartToCloud = useCallback((items) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.put(
          "/api/cart",
          { items },
          { skipAuthRedirect: true }
        );
        if (res.data?.synced) {
          setIsCloudSynced(true);
          setStockTracked(Boolean(res.data.stock_tracked));
          if (Array.isArray(res.data.items)) {
            setCartItems((prev) => mergeServerStockMetadata(prev, res.data.items));
          }
        }
      } catch {
        // Keep localStorage cache silently if offline or unauthenticated
      }
    }, 350);
  }, []);

  const hydrateFromCloud = useCallback(async () => {
    const userId = getCurrentUserId();
    activeUserIdRef.current = userId;

    if (!userId) {
      setCartItems([]);
      setIsCloudSynced(false);
      setStockTracked(false);
      return;
    }

    const localItems = readLocalCart(userId);
    setCartItems(localItems);

    try {
      const res = await api.get("/api/cart", { skipAuthRedirect: true });
      if (!res.data?.synced) {
        setIsCloudSynced(false);
        return;
      }

      const cloudItems = res.data.items || [];
      setIsCloudSynced(true);
      setStockTracked(Boolean(res.data.stock_tracked));

      if (cloudItems.length > 0) {
        setCartItems(cloudItems);
        localStorage.setItem(`cartItems_${userId}`, JSON.stringify(cloudItems));
      } else if (localItems.length > 0) {
        // First-time migration: push existing local cart up to Supabase
        pushCartToCloud(localItems);
      }
    } catch {
      // Fallback gracefully to localStorage when offline
    }
  }, [pushCartToCloud]);

  // Initial cloud sync on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      hydrateFromCloud();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [hydrateFromCloud]);

  // Keep localStorage cache always warm
  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId) {
      localStorage.setItem(`cartItems_${userId}`, JSON.stringify(cartItems));
    }
  }, [cartItems]);

  const refreshCart = useCallback(() => {
    hydrateFromCloud();
  }, [hydrateFromCloud]);

  const addToCart = (product) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    const normalizedProduct = {
      ...product,
      productType: normalizeProductType(product.productType),
    };

    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) =>
        isSameCartItem(
          item,
          normalizedProduct.id,
          normalizedProduct.size,
          normalizedProduct.productType
        )
      );

      const nextItems = existingItem
        ? prevItems.map((item) => {
            if (
              !isSameCartItem(
                item,
                normalizedProduct.id,
                normalizedProduct.size,
                normalizedProduct.productType
              )
            ) {
              return item;
            }
            const knownStock =
              normalizedProduct.available_stock ?? item.available_stock ?? null;
            const rawQty = item.quantity + normalizedProduct.quantity;
            const boundedQty =
              knownStock != null && knownStock > 0
                ? Math.min(rawQty, knownStock)
                : Math.min(100, rawQty);
            return {
              ...item,
              quantity: boundedQty,
              available_stock: knownStock,
              low_stock_threshold:
                normalizedProduct.low_stock_threshold ?? item.low_stock_threshold ?? 3,
              stock_status: normalizedProduct.stock_status ?? item.stock_status ?? "untracked",
              stock_exceeded: knownStock != null ? boundedQty > knownStock : false,
            };
          })
        : [
            ...prevItems,
            {
              ...normalizedProduct,
              quantity:
                normalizedProduct.available_stock != null && normalizedProduct.available_stock > 0
                  ? Math.min(normalizedProduct.quantity, normalizedProduct.available_stock)
                  : Math.min(100, normalizedProduct.quantity),
              stock_exceeded:
                normalizedProduct.available_stock != null
                  ? normalizedProduct.quantity > normalizedProduct.available_stock
                  : false,
            },
          ];

      pushCartToCloud(nextItems);
      return nextItems;
    });
  };

  const removeFromCart = (id, size, productType) => {
    setCartItems((prevItems) => {
      const nextItems = prevItems.filter((item) =>
        productType !== undefined
          ? !isSameCartItem(item, id, size, productType)
          : !(String(item.id) === String(id) && String(item.size) === String(size))
      );
      pushCartToCloud(nextItems);
      return nextItems;
    });
  };

  const updateQuantity = (id, size, newQuantity, productType) => {
    setCartItems((prevItems) => {
      const nextItems = prevItems.map((item) => {
        const matches =
          productType !== undefined
            ? isSameCartItem(item, id, size, productType)
            : String(item.id) === String(id) && String(item.size) === String(size);
        if (!matches) return item;
        const maxQty =
          item.available_stock != null && item.available_stock > 0
            ? item.available_stock
            : 100;
        const clampedQty = Math.max(1, Math.min(Number(newQuantity) || 1, maxQty));
        return {
          ...item,
          quantity: clampedQty,
          stock_exceeded:
            item.available_stock != null ? clampedQty > item.available_stock : false,
        };
      });
      pushCartToCloud(nextItems);
      return nextItems;
    });
  };

  const applyCoupon = (couponData) => {
    setDiscount({
      type: couponData.discount_type,
      value: couponData.discount_value,
      code: couponData.code,
    });
  };

  const removeCoupon = () => {
    setDiscount({ type: null, value: 0, code: "" });
  };

  const totalPrice = cartItems.reduce((total, item) => {
    const price = parseFloat(item.price) || 0;
    const quantity = parseFloat(item.quantity) || 0;
    return total + price * quantity;
  }, 0);

  const discountAmount =
    discount.type === "percent"
      ? (totalPrice * discount.value) / 100
      : discount.type === "fixed"
        ? discount.value
        : 0;

  const finalPrice = Math.max(0, totalPrice - discountAmount);

  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);

  const clearCart = () => {
    setCartItems([]);
    setDiscount({ type: null, value: 0, code: "" });
    const userId = getCurrentUserId();
    if (userId) {
      localStorage.removeItem(`cartItems_${userId}`);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      api.delete("/api/cart", { skipAuthRedirect: true }).catch(() => {});
    }
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        isCloudSynced,
        stockTracked,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshCart,
        totalPrice,
        totalItems,
        discount,
        applyCoupon,
        removeCoupon,
        finalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

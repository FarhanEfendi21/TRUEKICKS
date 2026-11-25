import { createContext, useState, useContext, useEffect, useRef, useCallback } from "react";
import api, { AUTH_CHANGE_EVENT } from "../lib/api";

const WishlistContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useWishlist = () => useContext(WishlistContext);

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

const readLocalWishlist = (userId) => {
  if (!userId) return [];
  try {
    const saved = localStorage.getItem(`wishlistItems_${userId}`);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const normalizeProductType = (productType) => productType || "sneakers";

const isSameWishlistItem = (item, id, productType) =>
  String(item.id) === String(id) &&
  normalizeProductType(item.productType) === normalizeProductType(productType);

export const WishlistProvider = ({ children }) => {
  const [wishlistItems, setWishlistItems] = useState(() =>
    readLocalWishlist(getCurrentUserId())
  );
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const syncTimerRef = useRef(null);
  const activeUserIdRef = useRef(getCurrentUserId());

  const pushWishlistToCloud = useCallback((items) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.put(
          "/api/wishlist",
          { items },
          { skipAuthRedirect: true }
        );
        if (res.data?.synced) {
          setIsCloudSynced(true);
        }
      } catch {
        // Keep local cache silently if offline
      }
    }, 350);
  }, []);

  const hydrateFromCloud = useCallback(async () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const userId = getCurrentUserId();
    activeUserIdRef.current = userId;

    if (!userId) {
      setWishlistItems([]);
      setIsCloudSynced(false);
      return;
    }

    const localItems = readLocalWishlist(userId);
    setWishlistItems(localItems);

    try {
      const res = await api.get("/api/wishlist", { skipAuthRedirect: true });
      if (activeUserIdRef.current !== userId) return;
      if (!res.data?.synced) {
        setIsCloudSynced(false);
        return;
      }

      const cloudItems = res.data.items || [];
      setIsCloudSynced(true);

      if (cloudItems.length > 0) {
        setWishlistItems(cloudItems);
        localStorage.setItem(`wishlistItems_${userId}`, JSON.stringify(cloudItems));
      } else if (localItems.length > 0) {
        pushWishlistToCloud(localItems);
      }
    } catch {
      // Fallback gracefully to localStorage
    }
  }, [pushWishlistToCloud]);

  useEffect(() => {
    const timer = setTimeout(() => {
      hydrateFromCloud();
    }, 0);
    const handleAuthChange = () => {
      const nextUserId = getCurrentUserId();
      if (nextUserId !== activeUserIdRef.current) {
        hydrateFromCloud();
      }
    };
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [hydrateFromCloud]);

  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId && activeUserIdRef.current === userId) {
      localStorage.setItem(
        `wishlistItems_${userId}`,
        JSON.stringify(wishlistItems)
      );
    }
  }, [wishlistItems]);

  const refreshWishlist = useCallback(() => {
    hydrateFromCloud();
  }, [hydrateFromCloud]);

  const addToWishlist = (product) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    const normalizedProduct = {
      ...product,
      productType: normalizeProductType(product.productType),
    };

    setWishlistItems((prev) => {
      if (
        prev.find((item) =>
          isSameWishlistItem(
            item,
            normalizedProduct.id,
            normalizedProduct.productType
          )
        )
      ) {
        return prev;
      }
      const next = [normalizedProduct, ...prev];
      pushWishlistToCloud(next);
      return next;
    });
  };

  const removeFromWishlist = (id, productType) => {
    setWishlistItems((prev) => {
      const next = prev.filter((item) =>
        productType !== undefined
          ? !isSameWishlistItem(item, id, productType)
          : String(item.id) !== String(id)
      );
      pushWishlistToCloud(next);
      return next;
    });
  };

  const isInWishlist = (id, productType) => {
    return wishlistItems.some((item) =>
      productType !== undefined
        ? isSameWishlistItem(item, id, productType)
        : String(item.id) === String(id)
    );
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        isCloudSynced,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

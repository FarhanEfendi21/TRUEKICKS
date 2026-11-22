import { createContext, useState, useContext, useEffect } from "react";

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

// Helper: Ambil ID User
const getCurrentUserId = () => {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) return null;

  const parsedUser = JSON.parse(storedUser);

  // === PERBAIKAN DI SINI ===
  if (parsedUser.email && parsedUser.email.includes("guest")) {
    return null;
  }

  return parsedUser.id;
};

export const WishlistProvider = ({ children }) => {
  // PERUBAHAN: Load data berdasarkan User ID
  const [wishlistItems, setWishlistItems] = useState(() => {
    const userId = getCurrentUserId();

    // Jika Guest, wishlist kosong
    if (!userId) return [];

    // Jika User, ambil wishlist_USERID
    const saved = localStorage.getItem(`wishlistItems_${userId}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Simpan data berdasarkan User ID
  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId) {
      localStorage.setItem(
        `wishlistItems_${userId}`,
        JSON.stringify(wishlistItems)
      );
    }
  }, [wishlistItems]);

  const refreshWishlist = () => {
    const userId = getCurrentUserId();
    if (userId) {
      const saved = localStorage.getItem(`wishlistItems_${userId}`);
      setWishlistItems(saved ? JSON.parse(saved) : []);
    } else {
      setWishlistItems([]); // Kosongkan jika guest
    }
  };

  const normalizeProductType = (productType) => productType || "sneakers";

  const isSameWishlistItem = (item, id, productType) =>
    String(item.id) === String(id) &&
    normalizeProductType(item.productType) === normalizeProductType(productType);

  const addToWishlist = (product) => {
    const userId = getCurrentUserId();
    if (!userId) return; // Guest tidak bisa menambah

    const normalizedProduct = {
      ...product,
      productType: normalizeProductType(product.productType),
    };

    if (
      !wishlistItems.find((item) =>
        isSameWishlistItem(item, normalizedProduct.id, normalizedProduct.productType)
      )
    ) {
      setWishlistItems([...wishlistItems, normalizedProduct]);
    }
  };

  const removeFromWishlist = (id, productType) => {
    setWishlistItems(
      wishlistItems.filter((item) =>
        productType !== undefined
          ? !isSameWishlistItem(item, id, productType)
          : String(item.id) !== String(id)
      )
    );
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

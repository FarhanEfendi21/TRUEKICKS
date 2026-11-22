import { createContext, useState, useContext, useEffect } from "react";

// 1. Buat Context
const CartContext = createContext();

// 2. Buat Custom Hook agar mudah dipanggil
export const useCart = () => {
  return useContext(CartContext);
};

const getCurrentUserId = () => {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) return null;

  const parsedUser = JSON.parse(storedUser);

  // === PERBAIKAN DI SINI ===
  // Jika emailnya mengandung kata 'guest', anggap user belum login (return null)
  if (parsedUser.email && parsedUser.email.includes("guest")) {
    return null;
  }

  return parsedUser.id;
};

// 3. Buat Provider (Penyedia Data)
export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const userId = getCurrentUserId();

    if (!userId) return [];

    const savedCart = localStorage.getItem(`cartItems_${userId}`);
    return savedCart ? JSON.parse(savedCart) : [];
  });

  // Simpan ke LocalStorage setiap kali keranjang berubah
  useEffect(() => {
    const userId = getCurrentUserId();

    // Hanya simpan jika ada User ID (Guest tidak disimpan ke localStorage permanen)
    if (userId) {
      localStorage.setItem(`cartItems_${userId}`, JSON.stringify(cartItems));
    }
  }, [cartItems]);

  const refreshCart = () => {
    const userId = getCurrentUserId();
    if (userId) {
      // Jika User Login, muat data dia
      const savedCart = localStorage.getItem(`cartItems_${userId}`);
      setCartItems(savedCart ? JSON.parse(savedCart) : []);
    } else {
      // Jika Guest, KOSONGKAN keranjang
      setCartItems([]);
    }
  };

  const normalizeProductType = (productType) => productType || "sneakers";

const isSameCartItem = (item, id, size, productType) =>
  String(item.id) === String(id) &&
  String(item.size) === String(size) &&
  normalizeProductType(item.productType) === normalizeProductType(productType);

// Fungsi: Tambah ke Keranjang
  const addToCart = (product) => {
    const userId = getCurrentUserId();

    // Proteksi Ganda: Jika Guest entah bagaimana bisa akses fungsi ini, tolak.
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

      if (existingItem) {
        return prevItems.map((item) =>
          isSameCartItem(
            item,
            normalizedProduct.id,
            normalizedProduct.size,
            normalizedProduct.productType
          )
            ? { ...item, quantity: item.quantity + normalizedProduct.quantity }
            : item
        );
      } else {
        return [...prevItems, normalizedProduct];
      }
    });
  };

  // Fungsi: Hapus dari Keranjang
  const removeFromCart = (id, size, productType) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) =>
        productType !== undefined
          ? !isSameCartItem(item, id, size, productType)
          : !(String(item.id) === String(id) && String(item.size) === String(size))
      )
    );
  };

  // Fungsi: Update Quantity
  const updateQuantity = (id, size, newQuantity, productType) => {
    setCartItems((prevItems) =>
      prevItems.map((item) => {
        const matches =
          productType !== undefined
            ? isSameCartItem(item, id, size, productType)
            : String(item.id) === String(id) && String(item.size) === String(size);
        return matches ? { ...item, quantity: newQuantity } : item;
      })
    );
  };

  // State Diskon
  const [discount, setDiscount] = useState({ type: null, value: 0, code: "" });

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

  // Hitung Total Harga & Total Item
  const totalPrice = cartItems.reduce((total, item) => {
    const price = parseFloat(item.price) || 0;
    const quantity = parseFloat(item.quantity) || 0;
    return total + price * quantity;
  }, 0);

  // Hitung Final Price setelah Diskon
  const discountAmount =
    discount.type === "percent"
      ? (totalPrice * discount.value) / 100
      : discount.type === "fixed"
        ? discount.value
        : 0;

  const finalPrice = Math.max(0, totalPrice - discountAmount);

  const totalItems = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  // Fungsi Clear Cart (Hapus data user saat ini saja)
  const clearCart = () => {
    setCartItems([]);
    setDiscount({ type: null, value: 0, code: "" }); // Reset diskon juga
    const userId = getCurrentUserId();
    if (userId) {
      localStorage.removeItem(`cartItems_${userId}`);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
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

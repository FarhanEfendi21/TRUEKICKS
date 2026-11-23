import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../Context/CartContext";
import { useWishlist } from "../Context/WishlistContext";
import { useLanguage } from "../Context/LanguageContext";

const SHOP_ROUTES = ["/sneakers", "/apparel", "/sale", "/wishlist", "/search", "/verify"];
const PROFILE_ROUTES = ["/profile", "/orders", "/login"];

function HomeIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 1.8 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[21px] h-[21px]"
    >
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.25 9.75V20a1 1 0 001 1h4.25v-5.5a1.5 1.5 0 013 0V21h4.25a1 1 0 001-1V9.75" />
    </svg>
  );
}

function ShopIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.1 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[21px] h-[21px]"
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function DropsIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 1.8 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[21px] h-[21px]"
    >
      <path d="M13 2L4.5 13.5H11.5L10.5 22L19.5 10.5H12.5L13 2Z" />
    </svg>
  );
}

function BagIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 1.8 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[21px] h-[21px]"
    >
      <path d="M6.5 8h11l1.1 11.2a1.5 1.5 0 01-1.49 1.65H6.89a1.5 1.5 0 01-1.49-1.65L6.5 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" fill="none" />
    </svg>
  );
}

function ProfileIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 1.8 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-[21px] h-[21px]"
    >
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20a7.25 7.25 0 0114.5 0" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-gray-300 dark:text-gray-600"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();
  const { wishlistItems } = useWishlist();
  const { t, pick } = useLanguage();

  const [shopOpen, setShopOpen] = useState(false);

  // Close shop sheet on Escape and lock body scroll while open
  useEffect(() => {
    if (!shopOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setShopOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shopOpen]);

  // Hide on Checkout & ProductDetail (replaced by sticky mobile CTA bar)
  if (
    location.pathname === "/checkout" ||
    location.pathname.startsWith("/product/")
  ) {
    return null;
  }

  const pathname = location.pathname;
  const isHomeActive = pathname === "/home";
  const isShopActive =
    shopOpen || SHOP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isDropsActive = pathname === "/drops";
  const isCartActive = pathname === "/cart";
  const isProfileActive = PROFILE_ROUTES.some((route) => pathname === route);

  const goTo = (path) => {
    setShopOpen(false);
    navigate(path);
  };

  const primaryCatalogLinks = [
    {
      path: "/sneakers",
      title: t("nav.sneakers"),
      subtitle: pick("Koleksi sepatu terbaru & klasik", "Latest & classic footwear"),
    },
    {
      path: "/apparel",
      title: t("nav.apparel"),
      subtitle: pick("Hoodie, kaus & streetwear", "Hoodies, tees & streetwear"),
    },
    {
      path: "/sale",
      title: t("nav.sale"),
      subtitle: pick("Potongan harga aktif pilihan", "Curated active markdowns"),
      accent: true,
    },
  ];

  const shopSheetPortal =
    typeof document !== "undefined" && shopOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[9990] lg:hidden flex flex-col justify-end font-poppins"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.catalog")}
          >
            {/* Backdrop */}
            <div
              onClick={() => setShopOpen(false)}
              className="absolute inset-0 bg-black/45 dark:bg-black/65 backdrop-blur-[2px] animate-fade-in"
            />

            {/* Bottom Sheet */}
            <div
              data-lenis-prevent
              className="relative z-10 bg-white dark:bg-gray-950 rounded-t-3xl border-t border-gray-200/80 dark:border-gray-800 px-5 pt-3 pb-8 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              {/* Drag Handle */}
              <div className="flex justify-center mb-4">
                <span className="w-9 h-1 rounded-full bg-gray-200 dark:bg-gray-800" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-900">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
                  {t("nav.catalog")}
                </span>
                <button
                  type="button"
                  onClick={() => setShopOpen(false)}
                  aria-label={t("common.close")}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 transition-colors"
                >
                  {t("common.close")}
                </button>
              </div>

              {/* Primary Catalog Rows */}
              <div className="divide-y divide-gray-100 dark:divide-gray-900">
                {primaryCatalogLinks.map((item) => {
                  const active = pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => goTo(item.path)}
                      className="w-full py-4 flex items-center justify-between text-left active:opacity-70 transition-opacity"
                    >
                      <div>
                        <p
                          className={`text-[15px] font-bold tracking-tight ${
                            item.accent
                              ? "text-[#FF5500]"
                              : active
                                ? "text-gray-950 dark:text-white"
                                : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                      <ChevronRightIcon />
                    </button>
                  );
                })}
              </div>

              {/* Secondary Utility Row */}
              <div className="grid grid-cols-2 gap-2.5 pt-4 mt-2 border-t border-gray-100 dark:border-gray-900">
                <button
                  type="button"
                  onClick={() => goTo("/wishlist")}
                  className={`px-4 py-3 rounded-xl border text-left transition-colors active:scale-[0.98] ${
                    pathname === "/wishlist"
                      ? "border-gray-950 dark:border-white bg-gray-50 dark:bg-gray-900"
                      : "border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {t("nav.wishlist")}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-gray-400">
                      {wishlistItems.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {pick("Produk tersimpan", "Saved items")}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => goTo("/verify")}
                  className={`px-4 py-3 rounded-xl border text-left transition-colors active:scale-[0.98] ${
                    pathname.startsWith("/verify")
                      ? "border-gray-950 dark:border-white bg-gray-50 dark:bg-gray-900"
                      : "border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
                  }`}
                >
                  <span className="text-xs font-bold text-gray-900 dark:text-white block">
                    {pick("Cek Keaslian", "Verify Tag")}
                  </span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {pick("Sertifikat digital", "Digital certificate")}
                  </p>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {shopSheetPortal}

      {/* Docked Full-Width Mobile Tab Bar */}
      <nav
        aria-label={pick("Navigasi utama mobile", "Mobile primary navigation")}
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-t border-gray-200/80 dark:border-gray-800/90 font-poppins"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-lg mx-auto h-16 grid grid-cols-5">
          <TabItem
            active={isHomeActive}
            label={t("nav.home")}
            onClick={() => goTo("/home")}
            icon={<HomeIcon active={isHomeActive} />}
          />

          <TabItem
            active={isShopActive}
            label={t("nav.shop")}
            ariaExpanded={shopOpen}
            onClick={() => setShopOpen((prev) => !prev)}
            icon={<ShopIcon active={isShopActive} />}
          />

          <TabItem
            active={isDropsActive}
            label={t("nav.drops")}
            onClick={() => goTo("/drops")}
            icon={<DropsIcon active={isDropsActive} />}
            hasDot={!isDropsActive}
          />

          <TabItem
            active={isCartActive}
            label={t("nav.bag")}
            onClick={() => goTo("/cart")}
            icon={<BagIcon active={isCartActive} />}
            badgeCount={totalItems}
          />

          <TabItem
            active={isProfileActive}
            label={t("nav.profile")}
            onClick={() => goTo("/profile")}
            icon={<ProfileIcon active={isProfileActive} />}
          />
        </div>
      </nav>
    </>
  );
}

function TabItem({
  active,
  label,
  icon,
  onClick,
  badgeCount = 0,
  hasDot = false,
  ariaExpanded,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-expanded={ariaExpanded}
      className={`relative flex flex-col items-center justify-center gap-1 h-full transition-colors active:opacity-70 ${
        active
          ? "text-gray-950 dark:text-white"
          : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      }`}
    >
      {/* Crisp top hairline active indicator */}
      <span
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-200 ${
          active
            ? "w-6 bg-gray-950 dark:bg-white opacity-100"
            : "w-0 bg-transparent opacity-0"
        }`}
      />

      <span className="relative flex items-center justify-center">
        {icon}
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF5500] text-white text-[9px] font-bold leading-none flex items-center justify-center tabular-nums">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
        {hasDot && badgeCount === 0 && (
          <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
        )}
      </span>

      <span
        className={`text-[10px] leading-none tracking-tight ${
          active ? "font-semibold" : "font-medium"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

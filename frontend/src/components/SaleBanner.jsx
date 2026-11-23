import { useLanguage } from "../Context/LanguageContext";
import speedCat2 from "../assets/speedCat-2.png";
import adizero from "../assets/adizero.png";

const SaleBanner = ({ maxDiscount = 30, onShopNow }) => {
    const { pick } = useLanguage();
    const handleShopNow = () => {
        if (onShopNow) {
            onShopNow();
        } else {
            window.scrollTo({ top: 600, behavior: "smooth" });
        }
    };

    return (
        <div className="relative bg-gray-900 rounded-2xl md:rounded-3xl p-6 md:p-10 mb-6 md:mb-10 overflow-hidden min-h-[180px] md:min-h-[220px]">
            {/* Noise/Texture Overlay */}
            <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]"></div>

            {/* Left Sale Sneaker with Starburst */}
            <div className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 w-[100px] md:w-[180px] lg:w-[220px]">
                <svg className="absolute inset-0 w-full h-full scale-125" viewBox="0 0 100 100" fill="white">
                    <polygon points="50,0 61,35 97,35 68,57 79,91 50,70 21,91 32,57 3,35 39,35" />
                </svg>
                <img
                    src={speedCat2}
                    alt="Sale Sneaker"
                    className="relative z-10 w-full object-contain rotate-[-15deg] drop-shadow-2xl"
                />
            </div>

            {/* Right Sale Sneaker with Starburst */}
            <div className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 w-[100px] md:w-[180px] lg:w-[220px]">
                <svg className="absolute inset-0 w-full h-full scale-125" viewBox="0 0 100 100" fill="white">
                    <polygon points="50,0 61,35 97,35 68,57 79,91 50,70 21,91 32,57 3,35 39,35" />
                </svg>
                <img
                    src={adizero}
                    alt="Adidas Adizero Evo SL"
                    className="relative z-10 w-full object-contain rotate-[15deg] drop-shadow-2xl scale-x-[-1]"
                />
            </div>

            {/* Center Content */}
            <div className="relative z-20 text-center flex flex-col items-center justify-center h-full py-4">
                <p className="text-white font-black text-sm md:text-lg tracking-[0.3em] uppercase mb-2 italic">
                    TrueKicks
                </p>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none mb-2 md:mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
                    {pick("PROMO", "SPECIAL")}{" "}
                    <span className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                        {pick("DISKON", "SALE")}
                    </span>
                </h1>
                <p className="text-gray-300 font-bold text-[11px] sm:text-xs md:text-sm tracking-[0.2em] uppercase mb-3 md:mb-4">
                    {pick(`Diskon Hingga ${maxDiscount}%`, `Discount Up To ${maxDiscount}% Off`)}
                </p>
                <button
                    type="button"
                    onClick={handleShopNow}
                    className="bg-white text-gray-900 font-black text-xs md:text-sm px-6 py-2 md:px-8 md:py-2.5 hover:bg-red-500 hover:text-white transition-all duration-300"
                >
                    {pick("BELANJA SEKARANG", "SHOP NOW")}
                </button>
            </div>
        </div>
    );
};

export default SaleBanner;

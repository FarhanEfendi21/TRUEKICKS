import { useEffect } from "react";
import { useLanguage } from "../Context/LanguageContext";

export default function SizeGuide({ isOpen, onClose, type }) {
    const { pick } = useLanguage();
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose?.();
        };

        if (isOpen) {
            document.body.style.overflow = "hidden";
            document.addEventListener("keydown", handleEsc);
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
            document.removeEventListener("keydown", handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div data-lenis-prevent className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div data-lenis-prevent className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl border border-gray-100 dark:border-gray-800 animate-fade-in-up">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-6 flex justify-between items-center z-20">
                    <h2 className="text-xl font-black uppercase tracking-wide">
                        {pick("Panduan Ukuran", "Size Guide")} - {type === "apparel" ? pick("Pakaian", "Apparel") : "Sneakers"}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={pick("Tutup panduan ukuran", "Close size guide")}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8">
                    {type === "apparel" ? (
                        <div className="space-y-8">
                            <div>
                                <h3 className="font-bold text-lg mb-4">{pick("Atasan Pria (Kaos, Hoodie, Jaket)", "Men's Tops (T-Shirts, Hoodies, Jackets)")}</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase font-bold text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="px-4 py-3 rounded-l-lg">{pick("Ukuran", "Size")}</th>
                                                <th className="px-4 py-3">{pick("Dada (cm)", "Chest (cm)")}</th>
                                                <th className="px-4 py-3">{pick("Pinggang (cm)", "Waist (cm)")}</th>
                                                <th className="px-4 py-3 rounded-r-lg">{pick("Pinggul (cm)", "Hips (cm)")}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            <tr>
                                                <td className="px-4 py-3 font-bold">XS</td>
                                                <td className="px-4 py-3">80 - 88</td>
                                                <td className="px-4 py-3">65 - 73</td>
                                                <td className="px-4 py-3">80 - 88</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">S</td>
                                                <td className="px-4 py-3">88 - 96</td>
                                                <td className="px-4 py-3">73 - 81</td>
                                                <td className="px-4 py-3">88 - 96</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">M</td>
                                                <td className="px-4 py-3">96 - 104</td>
                                                <td className="px-4 py-3">81 - 89</td>
                                                <td className="px-4 py-3">96 - 104</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">L</td>
                                                <td className="px-4 py-3">104 - 112</td>
                                                <td className="px-4 py-3">89 - 97</td>
                                                <td className="px-4 py-3">104 - 112</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">XL</td>
                                                <td className="px-4 py-3">112 - 124</td>
                                                <td className="px-4 py-3">97 - 109</td>
                                                <td className="px-4 py-3">112 - 120</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">XXL</td>
                                                <td className="px-4 py-3">124 - 136</td>
                                                <td className="px-4 py-3">109 - 121</td>
                                                <td className="px-4 py-3">120 - 128</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-lg mb-4">{pick("Cara Mengukur", "How to Measure")}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-800/70 p-6 rounded-2xl">
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-sm">{pick("1. Dada", "1. Chest")}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {pick(
                                                "Ukur lingkar bagian dada yang paling penuh dengan posisi meteran mendatar.",
                                                "Measure around the fullest part of your chest, keeping the tape measure horizontal."
                                            )}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-sm">{pick("2. Pinggang", "2. Waist")}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {pick(
                                                "Ukur lingkar bagian pinggang yang paling ramping dengan posisi meteran mendatar.",
                                                "Measure around the narrowest part (typically where your body bends side to side), keeping the tape horizontal."
                                            )}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-sm">{pick("3. Pinggul", "3. Hips")}</h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            {pick(
                                                "Ukur lingkar bagian pinggul yang paling penuh dengan posisi meteran mendatar.",
                                                "Measure around the fullest part of your hips, keeping the tape horizontal."
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div>
                                <h3 className="font-bold text-lg mb-4">{pick("Tabel Ukuran Sneakers", "Sneakers Size Chart")}</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-center">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase font-bold text-gray-500 dark:text-gray-400">
                                            <tr>
                                                <th className="px-4 py-3 rounded-l-lg">EU</th>
                                                <th className="px-4 py-3">{pick("US (Pria)", "US (Men)")}</th>
                                                <th className="px-4 py-3">{pick("US (Wanita)", "US (Women)")}</th>
                                                <th className="px-4 py-3">UK</th>
                                                <th className="px-4 py-3 rounded-r-lg">CM</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            <tr>
                                                <td className="px-4 py-3 font-bold">38</td>
                                                <td className="px-4 py-3">5.5</td>
                                                <td className="px-4 py-3">7</td>
                                                <td className="px-4 py-3">5</td>
                                                <td className="px-4 py-3">24</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">39</td>
                                                <td className="px-4 py-3">6.5</td>
                                                <td className="px-4 py-3">8</td>
                                                <td className="px-4 py-3">6</td>
                                                <td className="px-4 py-3">24.5</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">40</td>
                                                <td className="px-4 py-3">7</td>
                                                <td className="px-4 py-3">8.5</td>
                                                <td className="px-4 py-3">6</td>
                                                <td className="px-4 py-3">25</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">41</td>
                                                <td className="px-4 py-3">8</td>
                                                <td className="px-4 py-3">9.5</td>
                                                <td className="px-4 py-3">7</td>
                                                <td className="px-4 py-3">26</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">42</td>
                                                <td className="px-4 py-3">8.5</td>
                                                <td className="px-4 py-3">10</td>
                                                <td className="px-4 py-3">7.5</td>
                                                <td className="px-4 py-3">26.5</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">43</td>
                                                <td className="px-4 py-3">9.5</td>
                                                <td className="px-4 py-3">11</td>
                                                <td className="px-4 py-3">8.5</td>
                                                <td className="px-4 py-3">27.5</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">44</td>
                                                <td className="px-4 py-3">10</td>
                                                <td className="px-4 py-3">11.5</td>
                                                <td className="px-4 py-3">9</td>
                                                <td className="px-4 py-3">28</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">45</td>
                                                <td className="px-4 py-3">11</td>
                                                <td className="px-4 py-3">12.5</td>
                                                <td className="px-4 py-3">10</td>
                                                <td className="px-4 py-3">29</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-bold">46</td>
                                                <td className="px-4 py-3">12</td>
                                                <td className="px-4 py-3">13.5</td>
                                                <td className="px-4 py-3">11</td>
                                                <td className="px-4 py-3">30</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-xl border border-orange-100 dark:border-orange-500/20 flex gap-3 items-start">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-[#FF5500] flex-shrink-0 mt-0.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                                </svg>
                                <p className="text-xs text-orange-800 dark:text-orange-300 leading-relaxed">
                                    <strong>{pick("Tips:", "Pro Tip:")}</strong>{" "}
                                    {pick(
                                        "Jika ukuran kakimu berada di antara dua ukuran, kami sarankan naik 0,5 ukuran agar lebih nyaman, terutama untuk sepatu lari.",
                                        "If you are in between sizes, we recommend sizing up for a more comfortable fit, especially for running shoes."
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

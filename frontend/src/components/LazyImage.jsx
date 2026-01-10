import { useState, useRef, useEffect } from "react";

/**
 * LazyImage - Komponen gambar dengan lazy loading dan blur placeholder
 * 
 * @param {string} src - URL gambar
 * @param {string} alt - Alt text
 * @param {string} className - CSS classes
 * @param {string} placeholderColor - Warna background placeholder (default: gray)
 */
export default function LazyImage({
    src,
    alt = "",
    className = "",
    placeholderColor = "bg-gray-200",
    ...props
}) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef(null);

    // Intersection Observer untuk lazy loading
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            {
                rootMargin: "100px", // Load gambar 100px sebelum masuk viewport
                threshold: 0.01,
            }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const handleLoad = () => {
        setIsLoaded(true);
    };

    const handleError = () => {
        setHasError(true);
        setIsLoaded(true);
    };

    return (
        <div
            ref={imgRef}
            className={`relative overflow-hidden ${className}`}
            {...props}
        >
            {/* Placeholder dengan efek shimmer */}
            <div
                className={`absolute inset-0 ${placeholderColor} transition-opacity duration-500 ${isLoaded ? "opacity-0" : "opacity-100"
                    }`}
            >
                {/* Shimmer effect */}
                {!isLoaded && (
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                )}
            </div>

            {/* Gambar sebenarnya */}
            {isInView && !hasError && (
                <img
                    src={src}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={`w-full h-full object-cover transition-all duration-500 ${isLoaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-sm scale-105"
                        }`}
                />
            )}

            {/* Error state */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-8 h-8 text-gray-400"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                        />
                    </svg>
                </div>
            )}
        </div>
    );
}

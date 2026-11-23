import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../Context/LanguageContext";

const LOUPE_SIZE = 176;
const LOUPE_ZOOM = 2.6;

export default function ZoomLoupe({ src, alt, badge }) {
  const { pick } = useLanguage();
  const containerRef = useRef(null);
  const [loupeEnabled, setLoupeEnabled] = useState(true);
  const [hoverPos, setHoverPos] = useState(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

  // Fullscreen Studio Inspector Modal (ideal for mobile touch + desktop deep zoom)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorZoom, setInspectorZoom] = useState(2);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") setIsInspectorOpen(false);
    };
    if (isInspectorOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEsc);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isInspectorOpen]);

  const handleMouseMove = (e) => {
    if (!loupeEnabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setHoverPos(null);
      return;
    }
    setBoxSize({ width: rect.width, height: rect.height });
    setHoverPos({ x, y });
  };

  const openInspector = () => {
    setInspectorZoom(2);
    setPan({ x: 0, y: 0 });
    setIsInspectorOpen(true);
  };

  const handleInspectorPointerDown = (e) => {
    if (inspectorZoom <= 1) return;
    dragStartRef.current = {
      startX: e.clientX - pan.x,
      startY: e.clientY - pan.y,
    };
  };

  const handleInspectorPointerMove = (e) => {
    if (!dragStartRef.current) return;
    const maxOffset = (inspectorZoom - 1) * 180;
    const nextX = Math.max(
      -maxOffset,
      Math.min(maxOffset, e.clientX - dragStartRef.current.startX)
    );
    const nextY = Math.max(
      -maxOffset,
      Math.min(maxOffset, e.clientY - dragStartRef.current.startY)
    );
    setPan({ x: nextX, y: nextY });
  };

  const handleInspectorPointerUp = () => {
    dragStartRef.current = null;
  };

  return (
    <>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverPos(null)}
        onClick={openInspector}
        className={`relative bg-[#F8F8F8] dark:bg-gray-100 rounded-[2.5rem] aspect-square flex items-center justify-center p-10 overflow-hidden group border border-gray-100 dark:border-gray-800 shadow-sm ${
          loupeEnabled ? "md:cursor-crosshair cursor-zoom-in" : "cursor-zoom-in"
        }`}
      >
        {/* Top-left badge */}
        {badge && <div className="absolute top-6 left-6 md:top-8 md:left-8 z-20">{badge}</div>}

        {/* Product Image */}
        <img
          src={src}
          alt={alt}
          key={src}
          draggable={false}
          className="w-[85%] h-auto object-contain mix-blend-multiply z-10 drop-shadow-xl transition-transform duration-500 ease-out animate-fade-in select-none"
        />

        {/* Desktop Precision Circular Zoom Loupe */}
        {loupeEnabled && hoverPos && boxSize.width > 0 && (
          <div
            aria-hidden="true"
            className="hidden md:block pointer-events-none absolute z-30 rounded-full border-2 border-gray-900/90 shadow-2xl shadow-black/30 bg-[#F8F8F8] overflow-hidden ring-4 ring-white/80"
            style={{
              width: LOUPE_SIZE,
              height: LOUPE_SIZE,
              left: hoverPos.x - LOUPE_SIZE / 2,
              top: hoverPos.y - LOUPE_SIZE / 2,
            }}
          >
            <div
              className="p-10 flex items-center justify-center"
              style={{
                width: boxSize.width,
                height: boxSize.height,
                transform: `translate(${LOUPE_SIZE / 2 - hoverPos.x * LOUPE_ZOOM}px, ${
                  LOUPE_SIZE / 2 - hoverPos.y * LOUPE_ZOOM
                }px) scale(${LOUPE_ZOOM})`,
                transformOrigin: "0 0",
              }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                className="w-[85%] h-auto object-contain mix-blend-multiply"
              />
            </div>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gray-950/80 text-white text-[9px] font-bold tracking-wider">
              {LOUPE_ZOOM}x
            </span>
          </div>
        )}

        {/* Bottom-right Studio Controls */}
        <div
          className="absolute bottom-5 right-5 z-20 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setLoupeEnabled((prev) => !prev);
              setHoverPos(null);
            }}
            aria-label={
              loupeEnabled
                ? pick("Matikan kaca pembesar hover", "Disable hover zoom loupe")
                : pick("Aktifkan kaca pembesar hover", "Enable hover zoom loupe")
            }
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border backdrop-blur-md transition-colors ${
              loupeEnabled
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white/90 text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
              />
            </svg>
            <span>
              {pick("Loupe", "Loupe")}{" "}
              {loupeEnabled ? pick("Aktif", "On") : pick("Mati", "Off")}
            </span>
          </button>

          <button
            type="button"
            onClick={openInspector}
            aria-label={pick("Buka inspektor tekstur layar penuh", "Open fullscreen texture inspector")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-gray-800 border border-gray-200 hover:border-gray-900 text-[11px] font-bold backdrop-blur-md shadow-sm transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
              />
            </svg>
            <span>{pick("Inspeksi", "Inspect")}</span>
          </button>
        </div>
      </div>

      {/* Fullscreen Interactive Zoom Inspector Modal (Portaled to document.body to escape sticky stacking contexts) */}
      {isInspectorOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-lenis-prevent
            role="dialog"
            aria-modal="true"
            aria-label={`Texture inspector for ${alt}`}
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4"
            onClick={() => setIsInspectorOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl bg-[#F8F8F8] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
            >
              {/* Top Toolbar */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-200">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {pick("Inspektor Tekstur · Geser untuk Memeriksa", "Texture Inspector · Drag to Pan")}
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                    {alt}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        setInspectorZoom(level);
                        if (level === 1) setPan({ x: 0, y: 0 });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        inspectorZoom === level
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {level}x
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsInspectorOpen(false)}
                    aria-label={pick("Tutup inspektor tekstur", "Close texture inspector")}
                    className="ml-1 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.2}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Interactive Pan/Zoom Stage */}
              <div
                onPointerDown={handleInspectorPointerDown}
                onPointerMove={handleInspectorPointerMove}
                onPointerUp={handleInspectorPointerUp}
                onPointerCancel={handleInspectorPointerUp}
                onPointerLeave={handleInspectorPointerUp}
                className={`h-[62vh] sm:h-[70vh] flex items-center justify-center overflow-hidden select-none touch-none ${
                  inspectorZoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                }`}
              >
                <img
                  src={src}
                  alt={alt}
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${inspectorZoom})`,
                  }}
                  className="max-w-[82%] max-h-[82%] object-contain mix-blend-multiply transition-transform duration-150 ease-out"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

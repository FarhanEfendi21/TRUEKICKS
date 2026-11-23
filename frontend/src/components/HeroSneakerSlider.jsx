import { useState, useEffect, useRef } from "react";
import { motion as Motion, AnimatePresence } from "motion/react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import { getEffectivePrice, formatRupiah } from "../lib/pricing";
import { useLanguage } from "../Context/LanguageContext";

import p6000Silver from "../assets/p6000-silver.png";
import airJordan from "../assets/airjordan.png";
import adizero from "../assets/adizero.png";
import nb1906l from "../assets/newBalance1906.png";
import speedCat from "../assets/speedCat.png";

const SHOWCASE_SNEAKERS = [
  {
    id: "nike-p6000",
    brand: "NIKE",
    filterBrand: "Nike",
    name: "P-6000 Metallic Silver",
    price: "Rp 1.460.000",
    image: p6000Silver,
    matchKeyword: "p-6000",
  },
  {
    id: "jordan-1-low",
    brand: "JORDAN",
    filterBrand: "Jordan",
    name: "Air Jordan 1 Low Wolf Grey",
    price: "Rp 2.250.000",
    image: airJordan,
    matchKeyword: "jordan",
  },
  {
    id: "adidas-adizero",
    brand: "ADIDAS",
    filterBrand: "Adidas",
    name: "Adizero EVO SL Black White",
    price: "Rp 2.400.000",
    image: adizero,
    matchKeyword: "adizero",
  },
  {
    id: "nb-1906l",
    brand: "NEW BALANCE",
    filterBrand: "New Balance",
    name: "1906L Silver Shadow Grey",
    price: "Rp 2.899.000",
    image: nb1906l,
    matchKeyword: "1906l",
  },
  {
    id: "puma-speedcat",
    brand: "PUMA",
    filterBrand: "Puma",
    name: "Speedcat OG Black White",
    price: "Rp 1.899.000",
    image: speedCat,
    matchKeyword: "speedcat",
  },
];

const DRAG_THRESHOLD = 45;
const AUTO_PLAY_MS = 5500;

function getCircularDelta(index, activeIndex, total) {
  let delta = index - activeIndex;
  const half = Math.floor(total / 2);
  if (delta > half) delta -= total;
  if (delta < -half) delta += total;
  return delta;
}

export default function HeroSneakerSlider({ products = [], onExplore }) {
  const { pick } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const pointerStartX = useRef(null);
  const isDragging = useRef(false);

  const total = SHOWCASE_SNEAKERS.length;
  const activeSneaker = SHOWCASE_SNEAKERS[activeIndex];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % SHOWCASE_SNEAKERS.length);
  };

  const handlePrev = () => {
    setActiveIndex(
      (prev) => (prev - 1 + SHOWCASE_SNEAKERS.length) % SHOWCASE_SNEAKERS.length
    );
  };

  // Subtle auto-slide, paused on hover/focus/drag or reduced motion
  useEffect(() => {
    if (isPaused) return undefined;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % SHOWCASE_SNEAKERS.length);
    }, AUTO_PLAY_MS);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    pointerStartX.current = e.clientX;
    isDragging.current = true;
    setIsPaused(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current || pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    // Clamp live drag offset so movement feels weighty & controlled
    const clamped = Math.max(-140, Math.min(140, dx));
    setDragOffset(clamped);
  };

  const finishDrag = (e) => {
    if (!isDragging.current || pointerStartX.current === null) return;
    const dx = (e.clientX ?? pointerStartX.current) - pointerStartX.current;
    isDragging.current = false;
    pointerStartX.current = null;
    setDragOffset(0);
    setIsPaused(false);

    if (dx <= -DRAG_THRESHOLD) {
      handleNext();
    } else if (dx >= DRAG_THRESHOLD) {
      handlePrev();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      handleNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrev();
    }
  };

  const matchedActive = products.find((p) =>
    p.name?.toLowerCase().includes(activeSneaker.matchKeyword)
  );

  const displayPrice = matchedActive
    ? formatRupiah(getEffectivePrice(matchedActive))
    : activeSneaker.price;

  const handleSeeMore = () => {
    if (!onExplore) return;
    onExplore(activeSneaker, matchedActive);
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured Sneakers Showcase"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        if (isDragging.current) {
          isDragging.current = false;
          pointerStartX.current = null;
          setDragOffset(0);
        }
        setIsPaused(false);
      }}
      className="relative w-full max-w-6xl mx-auto flex flex-col items-center select-none focus:outline-none"
    >
      {/* Top Index Counter */}
      <div className="mb-2 md:mb-4 flex items-center gap-3 text-[11px] font-semibold tracking-[0.28em] uppercase text-gray-400 dark:text-gray-500">
        <span>{String(activeIndex + 1).padStart(2, "0")}</span>
        <span className="w-8 h-[1px] bg-gray-300 dark:bg-gray-700" />
        <span>{String(total).padStart(2, "0")}</span>
      </div>

      {/* Main 5-Sneaker Showcase Stage */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className="relative w-full h-[270px] sm:h-[340px] md:h-[410px] lg:h-[450px] flex items-center justify-center overflow-visible cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {/* Subtle studio radial glow behind center sneaker (enhances dark shoes in dark mode) */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] md:w-[460px] md:h-[460px] rounded-full bg-gradient-to-b from-gray-200/40 via-white/20 to-transparent dark:from-white/[0.08] dark:via-white/[0.03] dark:to-transparent blur-3xl" />

        {/* Ground contact shadow under active sneaker */}
        <div className="pointer-events-none absolute bottom-5 sm:bottom-7 md:bottom-8 left-1/2 -translate-x-1/2 w-[210px] sm:w-[290px] md:w-[360px] h-[28px] md:h-[34px] rounded-[100%] bg-black/15 dark:bg-black/60 blur-xl transition-opacity duration-500" />

        {/* 5 Sneakers positioned by circular offset */}
        {SHOWCASE_SNEAKERS.map((sneaker, index) => {
          const delta = getCircularDelta(index, activeIndex, total);
          const isCenter = delta === 0;
          const isAdjacent = Math.abs(delta) === 1;

          // Responsive horizontal offset using CSS percentage via motion x
          let baseX = "0%";
          let scale = 1;
          let opacity = 1;
          let blurPx = 0;
          let rotate = -11;
          let y = 0;
          let zIndex = 30;

          if (delta === -1) {
            baseX = "-82%";
            scale = 0.62;
            opacity = 0.45;
            blurPx = 9;
            rotate = -22;
            y = 14;
            zIndex = 20;
          } else if (delta === 1) {
            baseX = "82%";
            scale = 0.62;
            opacity = 0.45;
            blurPx = 9;
            rotate = 14;
            y = 14;
            zIndex = 20;
          } else if (delta <= -2) {
            baseX = "-145%";
            scale = 0.42;
            opacity = 0;
            blurPx = 16;
            rotate = -30;
            y = 28;
            zIndex = 5;
          } else if (delta >= 2) {
            baseX = "145%";
            scale = 0.42;
            opacity = 0;
            blurPx = 16;
            rotate = 24;
            y = 28;
            zIndex = 5;
          }

          return (
            <Motion.div
              key={sneaker.id}
              initial={false}
              animate={{
                x: dragOffset
                  ? `calc(${baseX} + ${dragOffset * (isCenter ? 0.55 : 0.35)}px)`
                  : baseX,
                y,
                scale,
                opacity,
                rotate,
                filter: `blur(${blurPx}px)`,
              }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 26,
                mass: 0.9,
              }}
              style={{ zIndex }}
              onClick={(e) => {
                if (Math.abs(dragOffset) > 10) return;
                if (delta === -1) {
                  e.stopPropagation();
                  handlePrev();
                } else if (delta === 1) {
                  e.stopPropagation();
                  handleNext();
                }
              }}
              className={`absolute flex items-center justify-center w-[250px] sm:w-[340px] md:w-[440px] lg:w-[500px] will-change-transform ${
                isAdjacent
                  ? "cursor-pointer hover:opacity-65"
                  : isCenter
                  ? "pointer-events-auto"
                  : "pointer-events-none"
              }`}
            >
              <img
                src={sneaker.image}
                alt={`${sneaker.brand} ${sneaker.name}`}
                draggable={false}
                className={`w-full h-auto object-contain pointer-events-none ${
                  isCenter
                    ? "drop-shadow-[0_28px_36px_rgba(0,0,0,0.22)] dark:drop-shadow-[0_32px_44px_rgba(0,0,0,0.75)]"
                    : "drop-shadow-[0_14px_20px_rgba(0,0,0,0.12)]"
                }`}
              />
            </Motion.div>
          );
        })}

        {/* Left / Right Minimalist Translucent Controls */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label={pick("Sneaker sebelumnya", "Previous sneaker")}
          className="absolute left-1 sm:left-3 md:left-6 z-40 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/70 dark:bg-gray-900/60 backdrop-blur-md border border-gray-200/80 dark:border-white/10 text-gray-800 dark:text-gray-200 flex items-center justify-center shadow-sm hover:bg-white dark:hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all"
        >
          <HiChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleNext}
          aria-label={pick("Sneaker berikutnya", "Next sneaker")}
          className="absolute right-1 sm:right-3 md:right-6 z-40 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/70 dark:bg-gray-900/60 backdrop-blur-md border border-gray-200/80 dark:border-white/10 text-gray-800 dark:text-gray-200 flex items-center justify-center shadow-sm hover:bg-white dark:hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all"
        >
          <HiChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Active Sneaker Editorial Typography & CTA (SSENSE-inspired) */}
      <div className="mt-2 md:mt-4 text-center flex flex-col items-center min-h-[146px] sm:min-h-[160px]">
        <AnimatePresence mode="wait">
          <Motion.div
            key={activeSneaker.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight uppercase text-gray-950 dark:text-white leading-none">
              {activeSneaker.brand}
            </h1>
            <p className="mt-2.5 text-xs sm:text-sm md:text-base font-medium text-gray-500 dark:text-gray-400 tracking-wide">
              <span>{activeSneaker.name}</span>
              <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
              <span className="text-gray-800 dark:text-gray-200 font-semibold">
                {displayPrice}
              </span>
            </p>
          </Motion.div>
        </AnimatePresence>

        <button
          type="button"
          onClick={handleSeeMore}
          className="mt-6 px-9 py-3 rounded-full bg-gray-900/10 hover:bg-gray-900 hover:text-white dark:bg-white/10 dark:hover:bg-white dark:hover:text-gray-950 text-gray-800 dark:text-gray-100 backdrop-blur-md border border-gray-900/10 dark:border-white/15 text-[11px] font-bold tracking-[0.2em] uppercase transition-all duration-300 active:scale-95"
        >
          {pick("Lihat Detail", "See More")}
        </button>
      </div>

      {/* 5 Minimalist Progress Indicators */}
      <div
        className="mt-6 flex items-center gap-2.5"
        role="tablist"
        aria-label="Choose sneaker"
      >
        {SHOWCASE_SNEAKERS.map((sneaker, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={sneaker.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Show ${sneaker.brand} ${sneaker.name}`}
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isActive
                  ? "w-8 bg-gray-900 dark:bg-white"
                  : "w-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-500 dark:hover:bg-gray-500"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

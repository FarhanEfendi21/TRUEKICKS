import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../Context/LanguageContext";

const SPLASH_SESSION_KEY = "tk_splash_seen";

export default function Splash() {
  const navigate = useNavigate();
  const { pick } = useLanguage();
  const [phase, setPhase] = useState(0); // 0: hidden, 1: logo in, 2: tagline in, 3: fade out

  const finishSplash = () => {
    sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    navigate("/home", { replace: true });
  };

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_SESSION_KEY)) {
      navigate("/home", { replace: true });
      return undefined;
    }

    // Crisp 1.6s intro (per-session only)
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 450);
    const t3 = setTimeout(() => setPhase(3), 1250);
    const t4 = setTimeout(() => {
      sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
      navigate("/home", { replace: true });
    }, 1600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [navigate]);

  return (
    <div
      onClick={finishSplash}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") finishSplash();
      }}
      aria-label={pick("Lewati intro", "Skip intro")}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-gray-950 transition-opacity duration-300 cursor-pointer ${
        phase >= 3 ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Subtle ambient glow */}
      <div
        className="absolute w-[min(80vw,400px)] aspect-square rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,85,0,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <div
        className={`relative transition-all duration-500 ease-out ${
          phase >= 1
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-95"
        }`}
      >
        <h1 className="text-[clamp(2.5rem,10vw,5rem)] font-black italic tracking-tighter text-gray-900 dark:text-white select-none leading-none">
          TRUE<span className="text-[#FF5500]">KICKS</span>
        </h1>
      </div>

      {/* Divider line */}
      <div
        className={`mt-4 mb-4 h-[1px] bg-gradient-to-r from-transparent via-[#FF5500]/40 to-transparent transition-all duration-500 ease-out ${
          phase >= 1 ? "w-24 opacity-100" : "w-0 opacity-0"
        }`}
      />

      {/* Tagline */}
      <p
        className={`text-[clamp(0.65rem,2.5vw,0.8rem)] font-medium tracking-[0.25em] uppercase text-gray-400 transition-all duration-500 ease-out ${
          phase >= 2
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2"
        }`}
      >
        {pick("Marketplace Sneakers Asli Pilihan", "Premium Sneaker Marketplace")}
      </p>

      {/* Minimal loading indicator */}
      <div
        className={`mt-10 flex items-center gap-[6px] transition-all duration-300 ${
          phase >= 2 ? "opacity-100" : "opacity-0"
        }`}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[5px] h-[5px] rounded-full bg-[#FF5500]"
            style={{
              animation: "dotPulse 1s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { resolveTranslation as initialResolveTranslation } from "../lib/translations";

const STORAGE_KEY = "truekicks_lang";
const LanguageContext = createContext(undefined);

let activeResolveTranslation = initialResolveTranslation;
const hmrListeners = new Set();

if (import.meta.hot) {
  import.meta.hot.accept("../lib/translations", (nextMod) => {
    if (nextMod?.resolveTranslation) {
      activeResolveTranslation = nextMod.resolveTranslation;
      hmrListeners.forEach((notify) => notify());
    }
  });
}

const readStoredLanguage = () => {
  if (typeof window === "undefined") return "id";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "id") return saved;
  return "id";
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);
  const [dictVersion, setDictVersion] = useState(0);

  useEffect(() => {
    if (!import.meta.hot) return undefined;
    const bump = () => setDictVersion((v) => v + 1);
    hmrListeners.add(bump);
    return () => {
      hmrListeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((next) => {
    if (next === "id" || next === "en") {
      setLanguageState(next);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === "id" ? "en" : "id"));
  }, []);

  const t = useCallback(
    (key, vars) => activeResolveTranslation(language, key, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, dictVersion]
  );

  const pick = useCallback(
    (idText, enText) => (language === "en" ? enText : idText),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      isIndonesian: language === "id",
      isEnglish: language === "en",
      locale: language === "en" ? "en-GB" : "id-ID",
      t,
      pick,
    }),
    [language, setLanguage, toggleLanguage, t, pick]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
};

export default LanguageContext;

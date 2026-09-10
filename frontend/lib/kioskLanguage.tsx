"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { t, Language, TranslationKey } from "./translations";

export type SupportedLanguage = Language;

export interface BaseLanguageOption {
  code: SupportedLanguage;
  nativeName: string;
  enName: string;
  region?: string;
  flag?: string;
}

export const BASE_LANGUAGE_OPTIONS: BaseLanguageOption[] = [
  { code: "en", nativeName: "English", enName: "English", region: "Universal / International" },
  { code: "hi", nativeName: "हिंदी", enName: "Hindi", region: "North & Central" },
  { code: "mr", nativeName: "मराठी", enName: "Marathi", region: "Maharashtra" },
  { code: "kn", nativeName: "ಕನ್ನಡ", enName: "Kannada", region: "Karnataka" },
  { code: "ta", nativeName: "தமிழ்", enName: "Tamil", region: "Tamil Nadu" },
  { code: "or", nativeName: "ଓଡ଼ିଆ", enName: "Odia", region: "Odisha" },
  { code: "ne", nativeName: "नेपाली", enName: "Nepali", region: "Nepal & Hill States" },
];

const STORAGE_KEY = "medikiosk_base_language";
const DEFAULT_BASE_LANG: SupportedLanguage = "mr";

export function getStoredBaseLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return DEFAULT_BASE_LANG;
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
    if (saved && ["en", "hi", "mr", "or", "ne", "kn", "ta"].includes(saved)) {
      return saved;
    }
  } catch (_) {}
  return DEFAULT_BASE_LANG;
}

export function setStoredBaseLanguage(lang: SupportedLanguage): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent("kiosk_base_language_changed", { detail: lang }));
  } catch (_) {}
}

interface KioskLanguageContextType {
  baseLanguage: SupportedLanguage;
  sessionLanguage: SupportedLanguage;
  setBaseLanguage: (lang: SupportedLanguage) => void;
  setSessionLanguage: (lang: SupportedLanguage) => void;
  resetSessionLanguage: () => void;
  translate: (key: TranslationKey) => string;
}

const KioskLanguageContext = createContext<KioskLanguageContextType>({
  baseLanguage: DEFAULT_BASE_LANG,
  sessionLanguage: DEFAULT_BASE_LANG,
  setBaseLanguage: () => {},
  setSessionLanguage: () => {},
  resetSessionLanguage: () => {},
  translate: (key) => t(key, DEFAULT_BASE_LANG),
});

export function KioskLanguageProvider({ children }: { children: ReactNode }) {
  const [baseLanguage, setBaseLangState] = useState<SupportedLanguage>(DEFAULT_BASE_LANG);
  const [sessionLanguage, setSessionLangState] = useState<SupportedLanguage>(DEFAULT_BASE_LANG);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = getStoredBaseLanguage();
    setBaseLangState(stored);
    setSessionLangState(stored);

    const handleStorage = () => {
      const newLang = getStoredBaseLanguage();
      setBaseLangState(newLang);
    };

    window.addEventListener("kiosk_base_language_changed" as any, handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("kiosk_base_language_changed" as any, handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setBaseLanguage = useCallback((lang: SupportedLanguage) => {
    setBaseLangState(lang);
    setStoredBaseLanguage(lang);
    // When base language is changed at kiosk admin/home level, also sync session
    setSessionLangState(lang);
  }, []);

  const setSessionLanguage = useCallback((lang: SupportedLanguage) => {
    setSessionLangState(lang);
  }, []);

  const resetSessionLanguage = useCallback(() => {
    const currentBase = getStoredBaseLanguage();
    setSessionLangState(currentBase);
  }, []);

  const translate = useCallback(
    (key: TranslationKey) => {
      return t(key, sessionLanguage);
    },
    [sessionLanguage]
  );

  return (
    <KioskLanguageContext.Provider
      value={{
        baseLanguage,
        sessionLanguage,
        setBaseLanguage,
        setSessionLanguage,
        resetSessionLanguage,
        translate,
      }}
    >
      {children}
    </KioskLanguageContext.Provider>
  );
}

export function useKioskLanguage() {
  return useContext(KioskLanguageContext);
}

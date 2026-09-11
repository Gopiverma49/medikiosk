"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
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

export type PortalType = "home" | "patient" | "doctor" | "nurse" | "tokens" | "admin";

export function getPortalFromPathname(pathname: string | null): PortalType {
  if (!pathname) return "home";
  if (pathname.startsWith("/patient")) return "patient";
  if (pathname.startsWith("/doctor")) return "doctor";
  if (pathname.startsWith("/nurse")) return "nurse";
  if (pathname.startsWith("/tokens")) return "tokens";
  if (pathname.startsWith("/admin")) return "admin";
  return "home";
}

const BASE_STORAGE_KEY = "medikiosk_base_language";
const DEFAULT_BASE_LANG: SupportedLanguage = "kn";

export function getStoredBaseLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return DEFAULT_BASE_LANG;
  try {
    const saved = localStorage.getItem(BASE_STORAGE_KEY) as SupportedLanguage | null;
    if (saved && ["en", "hi", "mr", "or", "ne", "kn", "ta"].includes(saved)) {
      return saved;
    }
  } catch (_) {}
  return DEFAULT_BASE_LANG;
}

export function setStoredBaseLanguage(lang: SupportedLanguage): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BASE_STORAGE_KEY, lang);
  } catch (_) {}
}

export function getStoredPortalLanguage(portal: PortalType, fallbackBase: SupportedLanguage): SupportedLanguage {
  if (typeof window === "undefined") {
    return portal === "doctor" || portal === "admin" || portal === "nurse" ? "en" : fallbackBase;
  }
  try {
    if (portal === "home") {
      return fallbackBase;
    }
    const key = `medikiosk_lang_${portal}`;
    const saved = localStorage.getItem(key) as SupportedLanguage | null;
    if (saved && ["en", "hi", "mr", "or", "ne", "kn", "ta"].includes(saved)) {
      return saved;
    }
  } catch (_) {}
  // Default doctor, nurse, and admin to English unless user explicitly chose otherwise
  if (portal === "doctor" || portal === "admin" || portal === "nurse") {
    return "en";
  }
  return fallbackBase;
}

export function setStoredPortalLanguage(portal: PortalType, lang: SupportedLanguage): void {
  if (typeof window === "undefined") return;
  try {
    if (portal === "home") {
      localStorage.setItem(BASE_STORAGE_KEY, lang);
    } else {
      localStorage.setItem(`medikiosk_lang_${portal}`, lang);
    }
  } catch (_) {}
}

interface KioskLanguageContextType {
  // Current active language for the page being viewed
  currentLanguage: SupportedLanguage;
  // Regional base language of the hospital kiosk system
  kioskBaseLanguage: SupportedLanguage;
  // For backwards compatibility: returns active portal language (or regional base on patient screen)
  baseLanguage: SupportedLanguage;
  // Patient session language
  sessionLanguage: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage, targetPortal?: PortalType) => void;
  setBaseLanguage: (lang: SupportedLanguage) => void;
  setSessionLanguage: (lang: SupportedLanguage) => void;
  resetSessionLanguage: () => void;
  translate: (key: TranslationKey) => string;
}

const KioskLanguageContext = createContext<KioskLanguageContextType>({
  currentLanguage: DEFAULT_BASE_LANG,
  kioskBaseLanguage: DEFAULT_BASE_LANG,
  baseLanguage: DEFAULT_BASE_LANG,
  sessionLanguage: DEFAULT_BASE_LANG,
  setLanguage: () => {},
  setBaseLanguage: () => {},
  setSessionLanguage: () => {},
  resetSessionLanguage: () => {},
  translate: (key) => t(key, DEFAULT_BASE_LANG),
});

export function KioskLanguageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const portal = getPortalFromPathname(pathname);

  // Hospital-wide regional base language (set on Home / Reception)
  const [kioskBaseLanguage, setKioskBaseLanguageState] = useState<SupportedLanguage>(DEFAULT_BASE_LANG);

  // Per-portal independent languages
  const [portalLanguages, setPortalLanguages] = useState<Record<PortalType, SupportedLanguage>>({
    home: DEFAULT_BASE_LANG,
    patient: DEFAULT_BASE_LANG,
    doctor: "en",
    nurse: "en",
    tokens: DEFAULT_BASE_LANG,
    admin: "en",
  });

  // Patient active session language (in-memory per session, does not overwrite other systems)
  const [sessionLanguage, setSessionLangState] = useState<SupportedLanguage>(DEFAULT_BASE_LANG);

  // Initialize from localStorage on initial render
  useEffect(() => {
    const base = getStoredBaseLanguage();
    setKioskBaseLanguageState(base);

    setPortalLanguages({
      home: base,
      patient: base,
      doctor: getStoredPortalLanguage("doctor", base),
      nurse: getStoredPortalLanguage("nurse", base),
      tokens: getStoredPortalLanguage("tokens", base),
      admin: getStoredPortalLanguage("admin", base),
    });

    setSessionLangState(base);
    // Note: Do NOT add a cross-tab 'storage' event listener here.
    // Each tab / portal operates independently so a doctor's language change
    // or home base language adjustment does not interrupt an ongoing patient intake session.
  }, []);

  const setLanguage = useCallback(
    (lang: SupportedLanguage, targetPortal?: PortalType) => {
      const p = targetPortal || portal;
      if (p === "home") {
        setKioskBaseLanguageState(lang);
        setStoredBaseLanguage(lang);
        setPortalLanguages((prev) => ({ ...prev, home: lang }));
      } else if (p === "patient") {
        setSessionLangState(lang);
      } else {
        setPortalLanguages((prev) => ({ ...prev, [p]: lang }));
        setStoredPortalLanguage(p, lang);
      }
    },
    [portal]
  );

  const setBaseLanguage = useCallback(
    (lang: SupportedLanguage) => {
      if (portal === "home") {
        setKioskBaseLanguageState(lang);
        setStoredBaseLanguage(lang);
        setPortalLanguages((prev) => ({ ...prev, home: lang }));
      } else if (portal === "patient") {
        setSessionLangState(lang);
      } else {
        setPortalLanguages((prev) => ({ ...prev, [portal]: lang }));
        setStoredPortalLanguage(portal, lang);
      }
    },
    [portal]
  );

  const setSessionLanguage = useCallback((lang: SupportedLanguage) => {
    setSessionLangState(lang);
  }, []);

  const resetSessionLanguage = useCallback(() => {
    const currentBase = getStoredBaseLanguage();
    setSessionLangState(currentBase);
  }, []);

  // Compute active language for the currently rendered portal
  const currentLanguage = useMemo<SupportedLanguage>(() => {
    if (portal === "patient") return sessionLanguage;
    if (portal === "home") return kioskBaseLanguage;
    return portalLanguages[portal] || kioskBaseLanguage;
  }, [portal, sessionLanguage, kioskBaseLanguage, portalLanguages]);

  // Backward compatibility: on patient page, baseLanguage gives kiosk regional base;
  // on other pages, baseLanguage gives that portal's selected language.
  const baseLanguage = portal === "patient" ? kioskBaseLanguage : currentLanguage;

  const translate = useCallback(
    (key: TranslationKey) => {
      return t(key, currentLanguage);
    },
    [currentLanguage]
  );

  return (
    <KioskLanguageContext.Provider
      value={{
        currentLanguage,
        kioskBaseLanguage,
        baseLanguage,
        sessionLanguage,
        setLanguage,
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

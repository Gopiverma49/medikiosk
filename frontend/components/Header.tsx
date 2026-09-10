"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useKioskLanguage,
  BASE_LANGUAGE_OPTIONS,
  SupportedLanguage,
} from "../lib/kioskLanguage";

import { t } from "../lib/translations";

export function Header() {
  const pathname = usePathname();
  const isPatient = pathname?.startsWith("/patient");
  const isDoctor = pathname?.startsWith("/doctor");
  const isNurse = pathname?.startsWith("/nurse");
  const isAdmin = pathname?.startsWith("/admin");
  const isTokens = pathname?.startsWith("/tokens");
  const isHome = pathname === "/";

  const {
    baseLanguage,
    sessionLanguage,
    setBaseLanguage,
    setSessionLanguage,
  } = useKioskLanguage();

  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
      setCurrentDate(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 md:px-10 py-3 flex items-center justify-between shadow-xs">
      {/* Brand / Logo section */}
      <div className="flex items-center gap-2 md:gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 md:gap-3 hover:opacity-95 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 6v12m6-6H6"
              />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
              MediKiosk
            </div>
            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
              {t("header_suite", baseLanguage)}
            </div>
          </div>
        </Link>

        {isPatient && (
          <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg ml-2 md:ml-3 hidden sm:inline-block">
            {t("badge_patient", baseLanguage)}
          </span>
        )}

        {isDoctor && (
          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg ml-3">
            {t("badge_doctor", baseLanguage)}
          </span>
        )}

        {isNurse && (
          <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg ml-3">
            {t("badge_nurse", baseLanguage)}
          </span>
        )}

        {isTokens && (
          <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg ml-3">
            {t("badge_tokens", baseLanguage)}
          </span>
        )}

        {isAdmin && (
          <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg ml-3">
            {t("badge_admin", baseLanguage)}
          </span>
        )}
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* On non-patient pages: Universal Kiosk Base Language Selector */}
        {!isPatient && (
          <div className="flex items-center gap-1.5 md:gap-2 bg-slate-50 border border-slate-300 rounded-2xl px-2.5 md:px-3 py-1.5 shadow-2xs">
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span>📍</span>
              <span className="uppercase tracking-wider">{t("kiosk_base_language_label", baseLanguage)}</span>
            </div>
            <select
              value={baseLanguage}
              onChange={(e) => setBaseLanguage(e.target.value as SupportedLanguage)}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs md:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
              title="Select the regional local language for this shared kiosk terminal"
            >
              {BASE_LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.code === "en" ? "English" : `${opt.nativeName} (${opt.enName})`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* On Patient Terminal: Prominent, Enlarged Quick Language Buttons */}
        {isPatient && (
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-300 shadow-sm">
            {/* Show Base Regional Language button if not en or hi */}
            {baseLanguage !== "en" && baseLanguage !== "hi" && (
              <button
                type="button"
                onClick={() => setSessionLanguage(baseLanguage)}
                className={`px-5 py-2.5 md:px-6 md:py-3 rounded-xl text-sm md:text-base font-black transition-all duration-200 cursor-pointer select-none active:scale-95 flex items-center gap-1.5 ${
                  sessionLanguage === baseLanguage
                    ? "bg-teal-600 text-white shadow-md ring-2 ring-teal-300 scale-105"
                    : "text-slate-700 bg-white/80 hover:bg-white hover:text-slate-900 border border-slate-200"
                }`}
              >
                <span>{BASE_LANGUAGE_OPTIONS.find((b) => b.code === baseLanguage)?.nativeName || baseLanguage}</span>
              </button>
            )}

            {/* Always visible: English (Enlarged) */}
            <button
              type="button"
              onClick={() => setSessionLanguage("en")}
              className={`px-5 py-2.5 md:px-7 md:py-3 rounded-xl text-sm md:text-base font-black transition-all duration-200 cursor-pointer select-none active:scale-95 flex items-center gap-1.5 ${
                sessionLanguage === "en"
                  ? "bg-teal-600 text-white shadow-md ring-2 ring-teal-300 scale-105"
                  : "text-slate-700 bg-white/80 hover:bg-white hover:text-slate-900 border border-slate-200"
              }`}
            >
              <span>English</span>
            </button>

            {/* Always visible: Hindi (Enlarged) */}
            <button
              type="button"
              onClick={() => setSessionLanguage("hi")}
              className={`px-5 py-2.5 md:px-7 md:py-3 rounded-xl text-sm md:text-base font-black transition-all duration-200 cursor-pointer select-none active:scale-95 flex items-center gap-1.5 ${
                sessionLanguage === "hi"
                  ? "bg-teal-600 text-white shadow-md ring-2 ring-teal-300 scale-105"
                  : "text-slate-700 bg-white/80 hover:bg-white hover:text-slate-900 border border-slate-200"
              }`}
            >
              <span>हिंदी</span>
            </button>
          </div>
        )}

        {/* Live Clock on Home */}
        {isHome && (
          <div className="hidden md:flex items-center gap-2 text-right">
            <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
              <span className="text-emerald-600 text-sm">🕒</span>
              <span>{currentTime || "11:19 AM"}</span>
            </div>
            <span className="text-xs text-slate-400 font-medium hidden lg:inline">•</span>
            <div className="text-xs text-slate-500 font-medium hidden lg:inline">
              {currentDate || "Sun, Aug 30, 2026"}
            </div>
          </div>
        )}

        {/* Navigation shortcut back to Home on Admin page only */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition text-slate-700 text-xs font-bold"
            >
              {t("btn_portals_home", baseLanguage)}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

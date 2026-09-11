"use client";
import Link from "next/link";
import { useKioskLanguage, BASE_LANGUAGE_OPTIONS } from "../lib/kioskLanguage";
import { t } from "../lib/translations";

export default function Home() {
  const { baseLanguage } = useKioskLanguage();
  const currentRegion = BASE_LANGUAGE_OPTIONS.find((b) => b.code === baseLanguage);

  return (
    <div className="space-y-10 py-4 max-w-6xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-xs relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-bold font-mono tracking-widest text-emerald-700 uppercase">
              {t("app_title", baseLanguage)}
            </span>
            {currentRegion && (
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                📍 {currentRegion.code === "en" ? "English" : `${currentRegion.nativeName} (${currentRegion.enName})`}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
            {t("welcome_heading", baseLanguage)}
          </h1>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
            {t("welcome_subheading", baseLanguage)} {t("welcome_hero_desc", baseLanguage)}
          </p>
        </div>

        {/* Right: Hospital Building Watermark Illustration */}
        <div className="hidden lg:flex items-center justify-center text-emerald-600/10 pointer-events-none pr-4">
          <svg
            className="w-48 h-48"
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4.5 21a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6v13.5a1.5 1.5 0 0 1-1.5 1.5h-15ZM10.5 7.5v3h-3v3h3v3h3v-3h3v-3h-3v-3h-3Z" />
          </svg>
        </div>
      </div>

      {/* 5 Main Portals */}
      <div>
        <div className="mb-6 px-1">
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-500">
            {t("select_main_portal", baseLanguage)}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* Portal 1: Patient Kiosk */}
          <Link
            href="/patient"
            className="group bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between ring-2 ring-emerald-500/20"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                🏥
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 font-black mb-1">
                {t("portal_1_tag", baseLanguage)}
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-emerald-800 transition-colors">
                {t("app_title", baseLanguage)}
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                {t("portal_1_desc", baseLanguage)}
              </p>
            </div>
          </Link>

          {/* Portal 2: Doctor Station */}
          <Link
            href="/doctor"
            className="group bg-white border-2 border-slate-200 hover:border-blue-500 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                👨‍⚕️
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-blue-700 font-black mb-1">
                {t("portal_2_tag", baseLanguage)}
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-blue-800 transition-colors">
                {t("portal_2_title", baseLanguage)}
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                {t("portal_2_desc", baseLanguage)}
              </p>
            </div>
          </Link>

          {/* Portal 3: Nurse Station */}
          <Link
            href="/nurse"
            className="group bg-white border-2 border-slate-200 hover:border-teal-500 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-teal-50 border-2 border-teal-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                👩‍⚕️
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-teal-700 font-black mb-1">
                {t("portal_3_tag", baseLanguage)}
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-teal-800 transition-colors">
                {t("portal_3_title", baseLanguage)}
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                {t("portal_3_desc", baseLanguage)}
              </p>
            </div>
          </Link>

          {/* Portal 4: Token Display */}
          <Link
            href="/tokens"
            className="group bg-white border-2 border-slate-200 hover:border-purple-500 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-purple-50 border-2 border-purple-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                📺
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-purple-700 font-black mb-1">
                {t("portal_4_tag", baseLanguage)}
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-purple-800 transition-colors">
                {t("portal_4_title", baseLanguage)}
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                {t("portal_4_desc", baseLanguage)}
              </p>
            </div>
          </Link>

          {/* Portal 5: Hospital Admin */}
          <Link
            href="/admin"
            className="group bg-white border-2 border-slate-200 hover:border-slate-800 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-3xl mb-4 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                ⚙️
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-black mb-1">
                {t("portal_5_tag", baseLanguage)}
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-slate-900 transition-colors">
                {t("portal_5_title", baseLanguage)}
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                {t("portal_5_desc", baseLanguage)}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

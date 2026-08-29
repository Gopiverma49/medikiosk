"use client";

import React from "react";
import { Language, t } from "@/lib/translations";

interface SafetyAlertProps {
  lang: Language;
  triggerReason: string;
  onAcknowledge: () => void;
}

export default function SafetyAlert({
  lang,
  triggerReason,
  onAcknowledge,
}: SafetyAlertProps) {
  return (
    <div className="bg-rose-50 border-4 border-rose-600 rounded-3xl p-6 md:p-8 shadow-2xl animate-bounce-subtle text-center space-y-6">
      <div className="w-16 h-16 bg-rose-600 text-white rounded-full flex items-center justify-center text-3xl font-black mx-auto shadow-lg">
        ⚠
      </div>

      <div>
        <span className="inline-block py-1 px-3 bg-rose-200 text-rose-900 rounded-full font-mono font-black text-xs uppercase tracking-wider mb-2">
          {lang === "hi" ? "प्राथमिकता संकेत" : "PRIORITY CLINICAL SIGNAL"}
        </span>
        <h3 className="text-2xl md:text-3xl font-black text-rose-950">
          {t("safety_alert_title", lang)}
        </h3>
        <p className="text-rose-800 text-base md:text-lg mt-2 max-w-lg mx-auto font-medium">
          {t("safety_alert_desc", lang)}
        </p>
      </div>

      <div className="bg-white border-2 border-rose-200 rounded-2xl p-4 text-left max-w-md mx-auto">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
          {lang === "hi" ? "चिह्नित कारण:" : "Identified Signal:"}
        </span>
        <p className="text-slate-800 font-bold text-sm">
          {triggerReason}
        </p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onAcknowledge}
          className="w-full sm:w-auto py-4 px-8 bg-rose-700 hover:bg-rose-800 text-white rounded-2xl font-black text-lg shadow-xl transition transform active:scale-95"
        >
          {t("safety_alert_btn", lang)} →
        </button>
      </div>
    </div>
  );
}

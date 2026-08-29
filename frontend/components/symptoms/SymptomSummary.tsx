"use client";

import React from "react";
import { Language, t } from "@/lib/translations";

export interface SymptomSummaryItem {
  category: string;
  categoryLabel: string;
  details: { label: string; value: string }[];
}

interface SymptomSummaryProps {
  lang: Language;
  items: SymptomSummaryItem[];
  onConfirm: () => void;
  onEdit: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export default function SymptomSummary({
  lang,
  items,
  onConfirm,
  onEdit,
  onBack,
  isLoading,
}: SymptomSummaryProps) {
  return (
    <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 animate-fadeIn">
      <div className="text-center">
        <div className="w-14 h-14 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-3">
          📋
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-1">
          {t("symptom_summary_title", lang)}
        </h2>
        <p className="text-slate-500 text-sm">
          {t("symptom_summary_desc", lang)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-500 text-sm">
            {lang === "hi"
              ? "कोई विशिष्ट लक्षण दर्ज नहीं किया गया (अज्ञात / छोड़ दिया गया)।"
              : "No specific symptoms recorded (Unknown / Skipped)."}
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-extrabold text-lg text-teal-900">
                  {item.categoryLabel}
                </span>
                <span className="text-xs font-mono font-bold bg-teal-100 text-teal-800 py-0.5 px-2 rounded-full">
                  #{idx + 1}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                {item.details.map((d, dIdx) => (
                  <div key={dIdx} className="flex justify-between items-start gap-4">
                    <span className="text-slate-500 font-semibold">{d.label}:</span>
                    <span className="font-bold text-slate-800 text-right">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 py-4 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition flex items-center justify-center gap-2"
          >
            ✏️ {t("edit_answers", lang)}
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-extrabold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2"
          >
            {isLoading ? "..." : `✓ ${t("confirm_and_continue", lang)}`}
          </button>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="w-full py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500 font-bold text-sm transition"
        >
          ← {t("back", lang)}
        </button>
      </div>
    </div>
  );
}

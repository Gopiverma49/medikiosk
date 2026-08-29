"use client";

import React, { useState } from "react";
import { Language, t } from "@/lib/translations";
import { SYMPTOM_CATEGORIES, SymptomCategory } from "@/lib/symptomFlows";

interface SymptomCategoryGridProps {
  lang: Language;
  selectedCategories: string[];
  onToggleCategory: (categoryId: string) => void;
  onContinue: () => void;
  onUnknown: () => void;
  onBack?: () => void;
}

export default function SymptomCategoryGrid({
  lang,
  selectedCategories,
  onToggleCategory,
  onContinue,
  onUnknown,
  onBack,
}: SymptomCategoryGridProps) {
  const hasSelection = selectedCategories.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
          {t("symptoms_category_prompt", lang)}
        </h2>
        <p className="text-slate-500 text-sm md:text-base">
          {t("symptoms_category_sub", lang)}
        </p>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {SYMPTOM_CATEGORIES.map((cat) => {
          const isSelected = selectedCategories.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggleCategory(cat.id)}
              className={`p-4 md:p-5 rounded-2xl border-2 text-left transition transform active:scale-95 flex items-center gap-4 ${
                isSelected
                  ? "bg-teal-50 border-teal-600 text-teal-950 shadow-md ring-2 ring-teal-500"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 shadow-sm"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                  isSelected ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-lg truncate">
                    {cat.label[lang] || cat.label.en}
                  </h3>
                  {isSelected && (
                    <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-black">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                  {cat.description[lang] || cat.description.en}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="space-y-3 pt-2">
        <div className="flex gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="py-4 px-6 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition"
            >
              ← {t("back", lang)}
            </button>
          )}

          <button
            type="button"
            disabled={!hasSelection}
            onClick={onContinue}
            className={`flex-1 py-4 rounded-2xl font-extrabold text-lg shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${
              hasSelection
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {hasSelection
              ? `${t("continue_btn", lang)} (${selectedCategories.length} selected) →`
              : t("continue_btn", lang)}
          </button>
        </div>

        {/* I DON'T KNOW Option */}
        <button
          type="button"
          onClick={onUnknown}
          className="w-full py-3.5 border-2 border-dashed border-slate-300 hover:bg-slate-100 rounded-2xl text-slate-600 font-bold text-base transition flex items-center justify-center gap-2"
        >
          <span>❓</span> {t("dont_know", lang)} ({lang === "hi" ? "मुझे ठीक से नहीं पता" : "I am not sure / skip"})
        </button>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Language } from "@/lib/translations";

interface PainScaleProps {
  lang: Language;
  onSelect: (severity: number) => void;
  onUnknown: () => void;
  defaultValue?: number;
}

export default function PainScale({
  lang,
  onSelect,
  onUnknown,
  defaultValue,
}: PainScaleProps) {
  const [selectedVal, setSelectedVal] = useState<number | null>(
    defaultValue !== undefined ? defaultValue : null
  );

  const getButtonColor = (score: number) => {
    if (score === 0) return "bg-emerald-500 hover:bg-emerald-600 text-white";
    if (score <= 3) return "bg-lime-500 hover:bg-lime-600 text-white";
    if (score <= 6) return "bg-amber-500 hover:bg-amber-600 text-white";
    return "bg-rose-600 hover:bg-rose-700 text-white";
  };

  const getLabelForScore = (score: number) => {
    if (score === 0) return lang === "hi" ? "दर्द नहीं" : "No Pain";
    if (score <= 3) return lang === "hi" ? "हल्का दर्द" : "Mild";
    if (score <= 6) return lang === "hi" ? "मध्यम दर्द" : "Moderate";
    if (score <= 9) return lang === "hi" ? "तेज दर्द" : "Severe";
    return lang === "hi" ? "असहनीय दर्द" : "Worst Pain";
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <p className="text-slate-500 text-sm">
          {lang === "hi"
            ? "0 का अर्थ है बिल्कुल दर्द नहीं, 10 का अर्थ है अत्यधिक असहनीय दर्द।"
            : "0 means No Pain at all, 10 means the Worst Possible Pain."}
        </p>
      </div>

      {/* Grid of 0-10 buttons */}
      <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
          const isSelected = selectedVal === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => {
                setSelectedVal(score);
                onSelect(score);
              }}
              className={`h-16 rounded-2xl font-black text-xl flex flex-col items-center justify-center transition transform active:scale-95 border-2 ${
                isSelected
                  ? `${getButtonColor(score)} ring-4 ring-offset-2 ring-teal-500 scale-105 shadow-lg border-transparent`
                  : "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200"
              }`}
            >
              <span>{score}</span>
            </button>
          );
        })}
      </div>

      {/* Severity Zone Labels */}
      <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs font-bold uppercase tracking-wider">
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
          <span className="block text-sm font-black">1 – 3</span>
          {lang === "hi" ? "हल्का (Mild)" : "Mild"}
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
          <span className="block text-sm font-black">4 – 6</span>
          {lang === "hi" ? "मध्यम (Moderate)" : "Moderate"}
        </div>
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
          <span className="block text-sm font-black">7 – 10</span>
          {lang === "hi" ? "अत्यधिक तीव्र (Severe)" : "Severe"}
        </div>
      </div>

      {selectedVal !== null && (
        <div className="bg-teal-50 border-2 border-teal-600 rounded-2xl p-4 text-center animate-fadeIn">
          <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
            {lang === "hi" ? "चुनी गई तीव्रता:" : "Selected Score:"}
          </span>
          <div className="text-3xl font-black text-teal-900 mt-1">
            {selectedVal} / 10 — {getLabelForScore(selectedVal)}
          </div>
        </div>
      )}
    </div>
  );
}

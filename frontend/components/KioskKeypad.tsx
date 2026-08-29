"use client";
import React, { useState } from "react";
import { t, Language } from "../lib/translations";

interface Props {
  lang: Language;
  onSubmit: (id: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function KioskKeypad({ lang, onSubmit, onCancel, isLoading }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleDigit = (d: string) => {
    setError(null);
    if (value.length < 10) {
      setValue((prev) => prev + d);
    }
  };

  const handleBackspace = () => {
    setError(null);
    setValue((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setValue("");
  };

  const handleSubmit = () => {
    if (value.length !== 10) {
      setError(t("keypad_invalid", lang));
      return;
    }
    onSubmit(value);
  };

  const setSampleId = (sample: string) => {
    setError(null);
    setValue(sample);
  };

  return (
    <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl">
      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 text-center mb-2">
        {t("keypad_title", lang)}
      </h2>
      <p className="text-slate-500 text-center text-sm md:text-base mb-6">
        {t("keypad_placeholder", lang)}
      </p>

      {/* ID Display Box */}
      <div className="bg-slate-900 border-4 border-slate-700 rounded-2xl p-4 text-center mb-4 shadow-inner">
        <div className="text-4xl md:text-5xl font-mono tracking-widest font-bold text-teal-400 min-h-[56px] flex items-center justify-center">
          {value ? (
            <span>{value}</span>
          ) : (
            <span className="text-slate-600 font-normal text-2xl md:text-3xl">
              _ _ _ _ _ _ _ _ _ _
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400 mt-2 font-mono">
          {value.length}/10 {lang === "hi" ? "अंक" : "Digits"}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-300 text-red-700 font-bold p-3 rounded-xl text-center mb-4 text-sm md:text-base">
          ⚠ {error}
        </div>
      )}

      {/* Keypad Grid (3x4) */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            className="h-16 md:h-20 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-slate-300 rounded-2xl text-2xl md:text-3xl font-black text-slate-800 transition transform active:scale-95 shadow"
          >
            {digit}
          </button>
        ))}

        {/* Backspace */}
        <button
          type="button"
          onClick={handleBackspace}
          className="h-16 md:h-20 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-2 border-amber-300 rounded-2xl text-xl md:text-2xl font-bold text-amber-900 transition transform active:scale-95 flex items-center justify-center shadow"
        >
          ⌫ {lang === "hi" ? "मिटाएं" : "Clear"}
        </button>

        {/* Zero */}
        <button
          type="button"
          onClick={() => handleDigit("0")}
          className="h-16 md:h-20 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-slate-300 rounded-2xl text-2xl md:text-3xl font-black text-slate-800 transition transform active:scale-95 shadow"
        >
          0
        </button>

        {/* Submit Checkmark */}
        <button
          type="button"
          disabled={value.length !== 10 || isLoading}
          onClick={handleSubmit}
          className={`h-16 md:h-20 rounded-2xl text-xl md:text-2xl font-black transition transform active:scale-95 flex items-center justify-center shadow-lg ${
            value.length === 10
              ? "bg-teal-600 hover:bg-teal-700 text-white border-2 border-teal-500"
              : "bg-slate-200 text-slate-400 border-2 border-slate-300 cursor-not-allowed"
          }`}
        >
          {isLoading ? "..." : `✓ ${lang === "hi" ? "पुष्टि" : "Enter"}`}
        </button>
      </div>

      {/* Quick Test Demo Presets for Testing */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
          {lang === "hi" ? "त्वरित परीक्षण नमूना आईडी:" : "Demo Test Patient IDs:"}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSampleId("1000000001")}
            className="p-2 bg-white border border-slate-300 rounded-lg hover:border-teal-600 font-mono text-center font-bold text-teal-800"
          >
            1000000001
            <span className="block text-[10px] text-slate-500 font-normal">
              {lang === "hi" ? "(पुराना इतिहास)" : "(With History)"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSampleId("1000000002")}
            className="p-2 bg-white border border-slate-300 rounded-lg hover:border-teal-600 font-mono text-center font-bold text-teal-800"
          >
            1000000002
            <span className="block text-[10px] text-slate-500 font-normal">
              {lang === "hi" ? "(बिना इतिहास)" : "(No History)"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSampleId("9999999999")}
            className="p-2 bg-white border border-slate-300 rounded-lg hover:border-teal-600 font-mono text-center font-bold text-amber-800"
          >
            9999999999
            <span className="block text-[10px] text-slate-500 font-normal">
              {lang === "hi" ? "(नया मरीज)" : "(New Patient)"}
            </span>
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="py-3 px-10 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl text-slate-700 font-extrabold text-base transition shadow-sm text-center flex items-center justify-center gap-2"
        >
          ← {t("back", lang)}
        </button>
      </div>
    </div>
  );
}

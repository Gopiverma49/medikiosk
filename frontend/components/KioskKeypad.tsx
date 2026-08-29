"use client";
import React, { useState, useRef, useEffect } from "react";
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
  const [keyboardMode, setKeyboardMode] = useState<"numbers" | "letters">("numbers");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input for physical keyboard support
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleChar = (char: string) => {
    setError(null);
    setValue((prev) => prev + char);
  };

  const handleBackspace = () => {
    setError(null);
    setValue((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(null);
    setValue("");
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanValue = value.trim();
    if (!cleanValue) {
      setError(t("keypad_invalid", lang));
      return;
    }
    onSubmit(cleanValue);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl">
      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 text-center mb-2">
        {t("keypad_title", lang)}
      </h2>
      <p className="text-slate-500 text-center text-sm md:text-base mb-6">
        {t("keypad_placeholder", lang)}
      </p>

      {/* ID Display / Direct Input Box */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative bg-slate-900 border-4 border-slate-700 rounded-2xl p-3 md:p-4 shadow-inner flex items-center justify-between">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setError(null);
              setValue(e.target.value.toUpperCase());
            }}
            placeholder={lang === "hi" ? "आईडी दर्ज करें..." : "ENTER ID..."}
            className="w-full bg-transparent text-teal-400 font-mono text-2xl md:text-4xl font-bold tracking-wider placeholder:text-slate-600 outline-none uppercase text-center"
            autoComplete="off"
            spellCheck="false"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-4 p-2 text-slate-400 hover:text-white rounded-lg transition text-sm font-bold"
              title="Clear"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border-2 border-red-300 text-red-700 font-bold p-3 rounded-xl text-center mb-6 text-sm md:text-base">
          ⚠ {error}
        </div>
      )}

      {/* Keyboard Mode Tabs for Touch Screen */}
      <div className="flex gap-2 mb-4 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => setKeyboardMode("numbers")}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm md:text-base transition ${
            keyboardMode === "numbers"
              ? "bg-white text-teal-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          🔢 123 ({lang === "hi" ? "संख्या" : "Numbers"})
        </button>
        <button
          type="button"
          onClick={() => setKeyboardMode("letters")}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm md:text-base transition ${
            keyboardMode === "letters"
              ? "bg-white text-teal-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          🔤 ABC ({lang === "hi" ? "अक्षर" : "Letters"})
        </button>
      </div>

      {/* Number Keypad View */}
      {keyboardMode === "numbers" && (
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleChar(digit)}
              className="h-16 md:h-18 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-slate-300 rounded-2xl text-2xl md:text-3xl font-black text-slate-800 transition transform active:scale-95 shadow"
            >
              {digit}
            </button>
          ))}

          {/* Dash / Hyphen */}
          <button
            type="button"
            onClick={() => handleChar("-")}
            className="h-16 md:h-18 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-slate-300 rounded-2xl text-2xl md:text-3xl font-black text-slate-700 transition transform active:scale-95 shadow"
          >
            -
          </button>

          {/* Zero */}
          <button
            type="button"
            onClick={() => handleChar("0")}
            className="h-16 md:h-18 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-slate-300 rounded-2xl text-2xl md:text-3xl font-black text-slate-800 transition transform active:scale-95 shadow"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-16 md:h-18 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-2 border-amber-300 rounded-2xl text-lg md:text-xl font-bold text-amber-900 transition transform active:scale-95 flex items-center justify-center shadow"
          >
            ⌫ {lang === "hi" ? "मिटाएं" : "Delete"}
          </button>
        </div>
      )}

      {/* Alphabet Keypad View (QWERTY layout) */}
      {keyboardMode === "letters" && (
        <div className="space-y-2 mb-6">
          {/* Row 1 */}
          <div className="grid grid-cols-10 gap-1 md:gap-2">
            {["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => handleChar(letter)}
                className="h-12 md:h-14 bg-slate-100 hover:bg-teal-50 active:bg-teal-100 border-2 border-slate-300 hover:border-teal-500 rounded-xl text-lg md:text-xl font-bold text-slate-800 transition transform active:scale-95 shadow-sm"
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-9 gap-1 md:gap-2 px-2 md:px-4">
            {["A", "S", "D", "F", "G", "H", "J", "K", "L"].map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => handleChar(letter)}
                className="h-12 md:h-14 bg-slate-100 hover:bg-teal-50 active:bg-teal-100 border-2 border-slate-300 hover:border-teal-500 rounded-xl text-lg md:text-xl font-bold text-slate-800 transition transform active:scale-95 shadow-sm"
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-9 gap-1 md:gap-2 px-1 md:px-2">
            <button
              type="button"
              onClick={() => handleChar("-")}
              className="h-12 md:h-14 bg-slate-200 hover:bg-slate-300 border-2 border-slate-300 rounded-xl text-lg md:text-xl font-bold text-slate-700 transition transform active:scale-95 shadow-sm"
            >
              -
            </button>
            {["Z", "X", "C", "V", "B", "N", "M"].map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => handleChar(letter)}
                className="h-12 md:h-14 bg-slate-100 hover:bg-teal-50 active:bg-teal-100 border-2 border-slate-300 hover:border-teal-500 rounded-xl text-lg md:text-xl font-bold text-slate-800 transition transform active:scale-95 shadow-sm"
              >
                {letter}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 md:h-14 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-2 border-amber-300 rounded-xl text-sm md:text-base font-bold text-amber-900 transition transform active:scale-95 shadow-sm flex items-center justify-center"
            >
              ⌫
            </button>
          </div>
        </div>
      )}

      {/* Action Controls: Submit & Back */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto py-3.5 px-8 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl text-slate-700 font-extrabold text-base transition shadow-sm text-center"
        >
          ← {t("back", lang)}
        </button>

        <button
          type="button"
          disabled={!value.trim() || isLoading}
          onClick={() => handleSubmit()}
          className={`w-full sm:flex-1 py-3.5 px-8 rounded-2xl text-lg md:text-xl font-black transition transform active:scale-95 flex items-center justify-center shadow-lg ${
            value.trim()
              ? "bg-teal-600 hover:bg-teal-700 text-white border-2 border-teal-500 cursor-pointer"
              : "bg-slate-200 text-slate-400 border-2 border-slate-300 cursor-not-allowed"
          }`}
        >
          {isLoading ? "..." : `✓ ${lang === "hi" ? "पुष्टि करें" : "Enter / Submit"}`}
        </button>
      </div>
    </div>
  );
}

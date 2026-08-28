"use client";
import React from "react";
import { t, Language } from "../lib/translations";

interface Props {
  lang: Language;
  isSpeaking: boolean;
  isListening: boolean;
  transcript?: string;
  error?: string | null;
  onRetry: () => void;
  onSwitchToTouch: () => void;
}

export function KioskVoiceIndicator({
  lang,
  isSpeaking,
  isListening,
  transcript,
  error,
  onRetry,
  onSwitchToTouch,
}: Props) {
  return (
    <div className="w-full bg-teal-950/90 border-2 border-teal-500/50 rounded-2xl p-4 mb-6 text-white shadow-lg backdrop-blur">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Animation & Label */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            {isListening && (
              <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-teal-400 opacity-75" />
            )}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold shadow-md ${
                isSpeaking
                  ? "bg-blue-600 text-white animate-pulse"
                  : isListening
                  ? "bg-teal-500 text-slate-950"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {isSpeaking ? "🔊" : isListening ? "🎙" : "🎤"}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase font-bold tracking-widest text-teal-300">
              {isSpeaking
                ? lang === "hi"
                  ? "निर्देश सुनाए जा रहे हैं..."
                  : "Voice Guidance Active..."
                : isListening
                ? t("voice_listening", lang)
                : lang === "hi"
                ? "वॉइस मोड सक्रिय"
                : "Voice Mode Active"}
            </div>
            {transcript && (
              <div className="text-sm font-semibold text-teal-100 font-mono mt-0.5">
                &ldquo;{transcript}&rdquo;
              </div>
            )}
          </div>
        </div>

        {/* Error / Timeout Actions */}
        {error ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-300 font-medium mr-2">
              {t("voice_error", lang)}
            </span>
            <button
              type="button"
              onClick={onRetry}
              className="py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition shadow"
            >
              {t("try_again", lang)}
            </button>
            <button
              type="button"
              onClick={onSwitchToTouch}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition border border-slate-700"
            >
              {t("use_touch", lang)}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSwitchToTouch}
            className="py-2 px-3 bg-slate-900/80 hover:bg-slate-800 text-teal-200 rounded-xl text-xs font-semibold border border-teal-500/30 transition"
          >
            👆 {t("use_touch", lang)}
          </button>
        )}
      </div>
    </div>
  );
}

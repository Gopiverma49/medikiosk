"use client";
import React from "react";
import { t, Language } from "../lib/translations";

interface Props {
  currentStep: number; // 1 to 5
  lang: Language;
}

export function KioskStepIndicator({ currentStep, lang }: Props) {
  const steps = [
    { num: 1, label: t("step_1_title", lang) },
    { num: 2, label: t("step_2_title", lang) },
    { num: 3, label: t("step_3_title", lang) },
    { num: 4, label: t("step_4_title", lang) },
    { num: 5, label: t("step_5_title", lang) },
  ];

  return (
    <div className="w-full bg-slate-900 text-white rounded-2xl p-4 mb-6 shadow-md border border-slate-800">
      <div className="grid grid-cols-5 gap-2 text-center">
        {steps.map((s) => {
          const isActive = s.num === currentStep;
          const isCompleted = s.num < currentStep;

          return (
            <div
              key={s.num}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${
                isActive
                  ? "bg-teal-600 text-white font-bold ring-2 ring-teal-300 shadow-lg scale-105"
                  : isCompleted
                  ? "bg-slate-800 text-teal-400 font-medium"
                  : "text-slate-400 opacity-60"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black mb-1 ${
                  isActive
                    ? "bg-white text-teal-800"
                    : isCompleted
                    ? "bg-teal-900 text-teal-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {isCompleted ? "✓" : s.num}
              </div>
              <span className="text-xs tracking-tight md:text-sm font-semibold">
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

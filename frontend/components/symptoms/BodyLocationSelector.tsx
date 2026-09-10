"use client";

import React, { useState } from "react";
import { Language } from "@/lib/translations";
import { BODY_LOCATIONS, BodyLocationItem, LocalizedString } from "@/lib/symptomFlows";

interface BodyLocationSelectorProps {
  lang: Language;
  onSelect: (locationData: {
    mainLocation: string;
    subLocation?: string;
    side?: "left" | "right" | "both" | "central";
    isChest?: boolean;
    displayLabel: string;
  }) => void;
  onUnknown: () => void;
}

export default function BodyLocationSelector({
  lang,
  onSelect,
  onUnknown: _onUnknown,
}: BodyLocationSelectorProps) {
  const [selectedMain, setSelectedMain] = useState<BodyLocationItem | null>(null);
  const [side, setSide] = useState<"left" | "right" | "both" | "central">("left");

  const handleMainClick = (item: BodyLocationItem) => {
    if (!item.subLocations || item.subLocations.length === 0) {
      onSelect({
        mainLocation: item.id,
        displayLabel: item.label[lang] || item.label.en,
        isChest: item.isChest,
      });
    } else {
      setSelectedMain(item);
    }
  };

  const handleSubSelect = (sub: { id: string; label: LocalizedString }) => {
    const isBilateral = selectedMain?.id === "arm" || selectedMain?.id === "leg";
    const sidePrefix = isBilateral
      ? side === "left"
        ? lang === "hi" ? "बाएं " : "Left "
        : side === "right"
          ? lang === "hi" ? "दाएं " : "Right "
          : lang === "hi" ? "दोनों " : "Both "
      : "";

    const display = `${sidePrefix}${sub.label[lang] || sub.label.en} (${selectedMain?.label[lang] || selectedMain?.label.en})`;
    onSelect({
      mainLocation: selectedMain!.id,
      subLocation: sub.id,
      side: isBilateral ? side : undefined,
      isChest: selectedMain?.isChest,
      displayLabel: display,
    });
  };

  const isBilateral = selectedMain?.id === "arm" || selectedMain?.id === "leg";

  return (
    <div className="space-y-6">
      {!selectedMain ? (
        <>
          <div className="text-center mb-2">
            <h3 className="text-xl font-bold text-slate-800">
              {lang === "hi" ? "शरीर का कौन सा भाग प्रभावित है?" : "Which part of your body is affected?"}
            </h3>
            <p className="text-slate-500 text-sm">
              {lang === "hi" ? "कृपया प्रभावित भाग को स्पर्श करें।" : "Tap the affected area to see specific locations."}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 gap-3.5">
            {BODY_LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => handleMainClick(loc)}
                className="p-5 bg-white hover:bg-teal-50 border-2 border-slate-200 hover:border-teal-600 rounded-2xl text-left font-bold text-slate-800 transition transform active:scale-95 shadow-sm flex items-center justify-between group"
              >
                <span className="text-lg group-hover:text-teal-900">
                  {loc.label[lang] || loc.label.en}
                </span>
                <span className="text-slate-400 group-hover:text-teal-600 font-black text-xl">
                  →
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
                {lang === "hi" ? "चुना गया मुख्य भाग" : "Selected Area"}
              </span>
              <h4 className="text-2xl font-black text-slate-900">
                {selectedMain.label[lang] || selectedMain.label.en}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMain(null)}
              className="py-2 px-4 border border-slate-300 hover:bg-slate-100 rounded-xl text-sm font-bold text-slate-600 transition"
            >
              🔄 {lang === "hi" ? "भाग बदलें" : "Change Area"}
            </button>
          </div>

          {/* If bilateral (Arm or Leg), show Left / Right / Both selector */}
          {isBilateral && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 text-center">
                {lang === "hi" ? "कौन सा पक्ष?" : "Which side?"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "left", label: lang === "hi" ? "बाएं (Left)" : "Left" },
                  { id: "right", label: lang === "hi" ? "दाएं (Right)" : "Right" },
                  { id: "both", label: lang === "hi" ? "दोनों (Both)" : "Both" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSide(s.id as any)}
                    className={`py-3 px-3 rounded-xl font-black text-sm border-2 transition ${
                      side === s.id
                        ? "bg-teal-600 text-white border-teal-600 shadow-md"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              {lang === "hi" ? "विशिष्ट स्थान चुनें:" : "Choose the specific spot:"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {selectedMain.subLocations?.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSubSelect(sub)}
                  className="p-4 bg-white hover:bg-teal-50 border-2 border-slate-200 hover:border-teal-600 rounded-xl text-left font-bold text-base text-slate-800 transition transform active:scale-95 shadow-sm"
                >
                  {sub.label[lang] || sub.label.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

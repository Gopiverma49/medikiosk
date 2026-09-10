"use client";

import React, { useState, useEffect } from "react";
import { Language, t } from "@/lib/translations";
import { VoiceService } from "@/lib/voice";
import {
  SYMPTOM_CATEGORIES,
  QUESTION_DEFINITIONS,
  AdaptiveQuestion,
  DURATION_OPTIONS,
} from "@/lib/symptomFlows";
import SymptomCategoryGrid from "./SymptomCategoryGrid";
import BodyLocationSelector from "./BodyLocationSelector";
import PainScale from "./PainScale";
import SafetyAlert from "./SafetyAlert";
import SymptomSummary, { SymptomSummaryItem } from "./SymptomSummary";

export interface SymptomAnswerRecord {
  questionId: string;
  concept: string;
  category?: string;
  value: any;
  certainty: "confirmed" | "unknown";
  displayLabel: string;
  inverse?: boolean;
}

interface AdaptiveSymptomEngineProps {
  lang: Language;
  interactionMode: "touch" | "voice";
  onComplete: (answers: SymptomAnswerRecord[]) => void;
  onBackToPreviousStage: () => void;
}

type EngineStage =
  | "category_select"
  | "questions"
  | "safety_alert"
  | "summary_review";

export default function AdaptiveSymptomEngine({
  lang,
  interactionMode,
  onComplete,
  onBackToPreviousStage,
}: AdaptiveSymptomEngineProps) {
  const [stage, setStage] = useState<EngineStage>("category_select");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [questionQueue, setQuestionQueue] = useState<string[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, SymptomAnswerRecord>>({});
  const [historyIndexes, setHistoryIndexes] = useState<number[]>([]);

  // Multi-choice temporary state for multi-select questions
  const [tempMultiSelection, setTempMultiSelection] = useState<string[]>([]);

  // Text/Voice custom description state
  const [customText, setCustomText] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Safety trigger reason if red flag fired
  const [safetyTriggerReason, setSafetyTriggerReason] = useState<string | null>(null);

  // Voice guidance TTS trigger
  const currentQId = questionQueue[currentQueueIndex];
  const currentQ: AdaptiveQuestion | undefined = currentQId
    ? QUESTION_DEFINITIONS[currentQId]
    : undefined;

  useEffect(() => {
    if (interactionMode === "voice") {
      if (stage === "category_select") {
        VoiceService.speak(t("voice_speak_prompt_category", lang), lang);
      } else if (stage === "questions" && currentQ) {
        const promptText = currentQ.prompt[lang] || currentQ.prompt.en;
        VoiceService.speak(promptText, lang);
      } else if (stage === "safety_alert") {
        const alertPrompt = `${t("safety_alert_title", lang)}. ${t("safety_alert_desc", lang)}`;
        VoiceService.speak(alertPrompt, lang);
      } else if (stage === "summary_review") {
        const sumPrompt = `${t("symptom_summary_title", lang)}. ${t("symptom_summary_desc", lang)}`;
        VoiceService.speak(sumPrompt, lang);
      }
    }
  }, [stage, currentQueueIndex, interactionMode, lang]);

  // Toggle categories on first screen
  const handleToggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // Build the dynamic question queue based on selected categories
  const handleStartQuestions = () => {
    if (selectedCategories.length === 0) return;

    const queue: string[] = [];
    const addedQuestions = new Set<string>();

    selectedCategories.forEach((catId) => {
      const cat = SYMPTOM_CATEGORIES.find((c) => c.id === catId);
      if (cat) {
        cat.questionIds.forEach((qId) => {
          if (!addedQuestions.has(qId)) {
            queue.push(qId);
            addedQuestions.add(qId);
          }
        });
      }
    });

    // Add universal closing medicine and allergy questions if not present
    if (!addedQuestions.has("general_meds")) queue.push("general_meds");
    if (!addedQuestions.has("general_allergies")) queue.push("general_allergies");

    // Formally record chief complaint
    const selectedLabels = selectedCategories.map((catId) => {
      const cat = SYMPTOM_CATEGORIES.find((c) => c.id === catId);
      return cat ? (cat.label[lang] || cat.label.en) : catId;
    });

    const ccRecord: SymptomAnswerRecord = {
      questionId: "chief_complaint",
      concept: "chief_complaint",
      category: "chief_complaint",
      value: selectedCategories,
      certainty: "confirmed",
      displayLabel: selectedLabels.join(", "),
    };

    setAnswers((prev) => ({ ...prev, chief_complaint: ccRecord }));
    setQuestionQueue(queue);
    setCurrentQueueIndex(0);
    setHistoryIndexes([]);
    setStage("questions");
  };

  // Handle "I DON'T KNOW" on category select
  const handleUnknownCategories = () => {
    setSelectedCategories(["unknown_complaint"]);
    const ccRecord: SymptomAnswerRecord = {
      questionId: "chief_complaint",
      concept: "chief_complaint",
      category: "chief_complaint",
      value: null,
      certainty: "unknown",
      displayLabel: lang === "hi" ? "अज्ञात / सामान्य जांच" : "General Evaluation",
    };
    setAnswers((prev) => ({ ...prev, chief_complaint: ccRecord }));
    setQuestionQueue(["general_meds", "general_allergies"]);
    setCurrentQueueIndex(0);
    setHistoryIndexes([]);
    setStage("questions");
  };

  // Check safety conditions after each answer
  const evaluateSafety = (newAnswers: Record<string, SymptomAnswerRecord>) => {
    // 1. Animal bite with broken skin -> High priority Rabies PEP triage
    if (
      newAnswers["animal_skin_broken"]?.value === true ||
      newAnswers["animal_skin_broken"]?.value === "yes"
    ) {
      return lang === "hi"
        ? "जानवर द्वारा काटने/खरोंचने से त्वचा कटी है। रेबीज बचाव (PEP) हेतु तत्काल घाव की सफाई और चिकित्सक परामर्श आवश्यक है।"
        : "Animal exposure with broken skin reported. Immediate wound washing and rabies PEP clinical evaluation required.";
    }

    // 2. Chest pain with radiation or shortness of breath
    if (
      newAnswers["chest_radiation"]?.value === true ||
      newAnswers["chest_radiation"]?.value === "yes" ||
      (newAnswers["pain_location"]?.value?.isChest &&
        (newAnswers["chest_dyspnea"]?.value === true ||
          newAnswers["chest_dyspnea"]?.value === "yes" ||
          newAnswers["chest_sweating"]?.value === true ||
          newAnswers["chest_sweating"]?.value === "yes"))
    ) {
      return lang === "hi"
        ? "सीने के दर्द के साथ सांस फूलना या दर्द का फैलना। आपातकालीन हृदय मूल्यांकन आवश्यक है।"
        : "Chest pain with associated high-risk symptoms (radiation/breathlessness/sweating). Emergency evaluation recommended.";
    }

    // 3. Severe respiratory distress
    if (
      newAnswers["breathing_severity"]?.value === true ||
      newAnswers["breathing_severity"]?.value === "yes"
    ) {
      return lang === "hi"
        ? "अत्यधिक सांस लेने में कठिनाई। तुरंत आपातकालीन ऑक्सीजन/चिकित्सक सहायता लें।"
        : "Severe acute shortness of breath reported. Immediate respiratory triage required.";
    }

    // 4. Active heavy bleeding from injury
    if (
      newAnswers["injury_bleeding"]?.value === true ||
      newAnswers["injury_bleeding"]?.value === "yes"
    ) {
      return lang === "hi"
        ? "चोट से निरंतर रक्तस्राव हो रहा है। तुरंत ड्रेसिंग व घाव प्रबंधन आवश्यक है।"
        : "Active continuous bleeding from injury. Immediate wound compression and triage required.";
    }

    // 5. Thunderclap sudden severe headache
    if (
      newAnswers["headache_sudden"]?.value === true ||
      newAnswers["headache_sudden"]?.value === "yes"
    ) {
      return lang === "hi"
        ? "अचानक बहुत तेज सिरदर्द (Thunderclap headache)। तत्काल न्यूरोलॉजिकल मूल्यांकन आवश्यक है।"
        : "Sudden thunderclap-type severe headache reported. Immediate neurological triage advised.";
    }

    return null;
  };

  // Record an answer and advance queue
  const recordAnswer = (record: SymptomAnswerRecord, extraQuestionsToAdd?: string[]) => {
    const updatedAnswers = { ...answers, [record.questionId]: record };
    setAnswers(updatedAnswers);

    // If follow-up questions need to be dynamically inserted (e.g. Chest pain questions)
    let updatedQueue = [...questionQueue];
    if (extraQuestionsToAdd && extraQuestionsToAdd.length > 0) {
      const remainingQueue = updatedQueue.slice(currentQueueIndex + 1);
      const toInsert = extraQuestionsToAdd.filter((id) => !updatedQueue.includes(id));
      updatedQueue = [
        ...updatedQueue.slice(0, currentQueueIndex + 1),
        ...toInsert,
        ...remainingQueue,
      ];
      setQuestionQueue(updatedQueue);
    }

    // Safety check
    const safetySignal = evaluateSafety(updatedAnswers);
    if (safetySignal && !safetyTriggerReason) {
      setSafetyTriggerReason(safetySignal);
      // If we are at the end of the queue or it's a critical emergency, show safety alert
    }

    // Advance to next question or summary
    if (currentQueueIndex + 1 < updatedQueue.length) {
      setHistoryIndexes((prev) => [...prev, currentQueueIndex]);
      setCurrentQueueIndex((prev) => prev + 1);
      setTempMultiSelection([]);
      setCustomText("");
    } else {
      // Completed all questions in queue
      if (safetySignal) {
        setStage("safety_alert");
      } else {
        setStage("summary_review");
      }
    }
  };

  // Handle Unknown on any individual question
  const handleAnswerUnknown = () => {
    if (!currentQ) return;
    recordAnswer({
      questionId: currentQ.id,
      concept: currentQ.concept,
      category: currentQ.category || "symptom",
      value: null,
      certainty: "unknown",
      displayLabel: lang === "hi" ? "अज्ञात / पता नहीं" : "Unknown / Not sure",
      inverse: currentQ.inverse,
    });
  };

  // Step back
  const handleGoBack = () => {
    if (stage === "questions") {
      if (historyIndexes.length > 0) {
        const prevIdx = historyIndexes[historyIndexes.length - 1];
        setHistoryIndexes((prev) => prev.slice(0, -1));
        setCurrentQueueIndex(prevIdx);
        setTempMultiSelection([]);
      } else {
        setStage("category_select");
      }
    } else if (stage === "safety_alert") {
      setStage("questions");
    } else if (stage === "summary_review") {
      setStage("questions");
    } else if (stage === "category_select") {
      onBackToPreviousStage();
    }
  };

  // Build summary items from collected answers
  const buildSummaryItems = (): SymptomSummaryItem[] => {
    const items: SymptomSummaryItem[] = [];

    // 1. First Row / Step: Selected Symptoms (Chief Complaints)
    const selectedLabels = selectedCategories.map((catId) => {
      const cat = SYMPTOM_CATEGORIES.find((c) => c.id === catId);
      return cat ? (cat.label[lang] || cat.label.en) : catId;
    });

    if (selectedLabels.length > 0) {
      items.push({
        category: "chief_complaint",
        categoryLabel: lang === "hi" ? "चयनित मुख्य लक्षण" : "Selected Symptoms",
        details: [
          {
            label: lang === "hi" ? "मुख्य लक्षण" : "Reported Complaints",
            value: selectedLabels.join(", "),
          },
        ],
      });
    }

    // 2. Question responses by category
    selectedCategories.forEach((catId) => {
      const cat = SYMPTOM_CATEGORIES.find((c) => c.id === catId);
      if (!cat) return;

      const details: { label: string; value: string }[] = [];
      cat.questionIds.forEach((qId) => {
        const ans = answers[qId];
        const qDef = QUESTION_DEFINITIONS[qId];
        if (ans && qDef) {
          details.push({
            label: qDef.prompt[lang] || qDef.prompt.en,
            value: ans.displayLabel,
          });
        }
      });

      // Special check for chest follow-ups
      if (catId === "pain" && answers["pain_location"]?.value?.isChest) {
        ["chest_radiation", "chest_dyspnea", "chest_sweating"].forEach((cqId) => {
          const ans = answers[cqId];
          const qDef = QUESTION_DEFINITIONS[cqId];
          if (ans && qDef) {
            details.push({
              label: qDef.prompt[lang] || qDef.prompt.en,
              value: ans.displayLabel,
            });
          }
        });
      }

      if (details.length > 0) {
        items.push({
          category: cat.id,
          categoryLabel: cat.label[lang] || cat.label.en,
          details,
        });
      }
    });

    // 3. Medications & Allergies summary
    const medAns = answers["general_meds"];
    const allAns = answers["general_allergies"];
    if (medAns || allAns) {
      const details: { label: string; value: string }[] = [];
      if (medAns) {
        details.push({
          label: QUESTION_DEFINITIONS["general_meds"].prompt[lang] || "Daily Medications",
          value: medAns.displayLabel,
        });
      }
      if (allAns) {
        details.push({
          label: QUESTION_DEFINITIONS["general_allergies"].prompt[lang] || "Drug Allergies",
          value: allAns.displayLabel,
        });
      }
      items.push({
        category: "routine",
        categoryLabel: lang === "hi" ? "दवा व एलर्जी विवरण" : "Medications & Allergies",
        details,
      });
    }

    return items;
  };

  // Voice speech listening for "Other" problem description
  const handleStartListening = () => {
    setIsListening(true);
    setVoiceError(null);
    VoiceService.listen(
      lang,
      (text) => {
        setCustomText(text);
        setIsListening(false);
      },
      (err) => {
        setVoiceError(err);
        setIsListening(false);
      }
    );
  };

  // --- STAGE 1: CATEGORY SELECTION ---
  if (stage === "category_select") {
    return (
      <SymptomCategoryGrid
        lang={lang}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
        onContinue={handleStartQuestions}
        onUnknown={handleUnknownCategories}
        onBack={onBackToPreviousStage}
      />
    );
  }

  // --- STAGE: SAFETY ALERT POPUP ---
  if (stage === "safety_alert") {
    return (
      <SafetyAlert
        lang={lang}
        triggerReason={safetyTriggerReason || ""}
        onAcknowledge={() => setStage("summary_review")}
      />
    );
  }

  // --- STAGE: SUMMARY REVIEW ---
  if (stage === "summary_review") {
    return (
      <SymptomSummary
        lang={lang}
        items={buildSummaryItems()}
        onConfirm={() => onComplete(Object.values(answers))}
        onEdit={() => {
          setStage("category_select");
        }}
        onBack={handleGoBack}
      />
    );
  }

  // --- STAGE 2: DYNAMIC QUESTION RENDERER ---
  if (!currentQ) {
    return null;
  }

  return (
    <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 animate-fadeIn">
      {/* Progress & Dynamic Question Title */}
      <div>
        <div className="flex justify-between items-center text-xs font-mono font-bold text-teal-700 uppercase tracking-wider mb-1">
          <span>{t("let_understand_problem", lang)}</span>
          <span>
            {t("question_label", lang)} {currentQueueIndex + 1}
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
          {currentQ.prompt[lang] || currentQ.prompt.en}
        </h2>
      </div>

      {/* QUESTION BODY BY TYPE */}

      {/* 1. BODY LOCATION */}
      {currentQ.type === "body_location" && (
        <BodyLocationSelector
          lang={lang}
          onSelect={(locData) => {
            const extraFollowUps: string[] = [];
            if (locData.isChest) {
              extraFollowUps.push("chest_radiation", "chest_dyspnea", "chest_sweating");
            }
            recordAnswer(
              {
                questionId: currentQ.id,
                concept: currentQ.concept,
                category: "location",
                value: locData,
                certainty: "confirmed",
                displayLabel: locData.displayLabel,
              },
              extraFollowUps
            );
          }}
          onUnknown={handleAnswerUnknown}
        />
      )}

      {/* 2. PAIN SCALE (0–10) */}
      {currentQ.type === "pain_scale" && (
        <PainScale
          lang={lang}
          onSelect={(score) => {
            recordAnswer({
              questionId: currentQ.id,
              concept: currentQ.concept,
              category: "severity",
              value: score,
              certainty: "confirmed",
              displayLabel: `${score} / 10`,
            });
          }}
          onUnknown={handleAnswerUnknown}
        />
      )}

      {/* 3. DURATION SELECTOR */}
      {currentQ.type === "duration" && (
        <div className="grid grid-cols-1 gap-3">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                recordAnswer({
                  questionId: currentQ.id,
                  concept: currentQ.concept,
                  category: "onset",
                  value: opt.value,
                  certainty: "confirmed",
                  displayLabel: opt.label[lang] || opt.label.en,
                });
              }}
              className="p-5 bg-white hover:bg-teal-50 border-2 border-slate-200 hover:border-teal-600 rounded-2xl text-left font-bold text-lg text-slate-800 transition transform active:scale-95 shadow-sm flex items-center justify-between"
            >
              <span>{opt.label[lang] || opt.label.en}</span>
              <span className="text-slate-400 font-black text-xl">→</span>
            </button>
          ))}
        </div>
      )}

      {/* 4. SINGLE CHOICE */}
      {currentQ.type === "single_choice" && currentQ.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentQ.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                recordAnswer(
                  {
                    questionId: currentQ.id,
                    concept: currentQ.concept,
                    category: "symptom",
                    value: opt.id,
                    certainty: "confirmed",
                    displayLabel: opt.label[lang] || opt.label.en,
                  },
                  opt.triggers_followup
                );
              }}
              className="p-5 bg-white hover:bg-teal-50 border-2 border-slate-200 hover:border-teal-600 rounded-2xl text-left font-bold text-lg text-slate-800 transition transform active:scale-95 shadow-sm"
            >
              {opt.label[lang] || opt.label.en}
            </button>
          ))}
        </div>
      )}

      {/* 5. MULTI CHOICE */}
      {currentQ.type === "multi_choice" && currentQ.options && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.options.map((opt) => {
              const isChecked = tempMultiSelection.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === "none") {
                      setTempMultiSelection(["none"]);
                    } else {
                      setTempMultiSelection((prev) =>
                        prev.includes(opt.id)
                          ? prev.filter((id) => id !== opt.id)
                          : [...prev.filter((id) => id !== "none"), opt.id]
                      );
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 text-left font-bold text-base transition transform active:scale-95 flex items-center justify-between ${
                    isChecked
                      ? "bg-teal-50 border-teal-600 text-teal-950 shadow-md ring-2 ring-teal-500"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-sm"
                  }`}
                >
                  <span>{opt.label[lang] || opt.label.en}</span>
                  <span
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-black ${
                      isChecked
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "border-slate-300 bg-slate-50"
                    }`}
                  >
                    {isChecked ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={tempMultiSelection.length === 0}
            onClick={() => {
              const labels = tempMultiSelection
                .map((id) => {
                  const opt = currentQ.options?.find((o) => o.id === id);
                  return opt ? opt.label[lang] || opt.label.en : id;
                })
                .join(", ");

              recordAnswer({
                questionId: currentQ.id,
                concept: currentQ.concept,
                category: "symptom",
                value: tempMultiSelection,
                certainty: "confirmed",
                displayLabel: labels || "None",
              });
            }}
            className={`w-full py-4 rounded-2xl font-extrabold text-lg shadow-lg transition transform active:scale-95 ${
              tempMultiSelection.length > 0
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {t("continue_btn", lang)} ({tempMultiSelection.length} selected) →
          </button>
        </div>
      )}

      {/* 6. YES / NO QUESTION */}
      {currentQ.type === "yes_no" && (
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              recordAnswer({
                questionId: currentQ.id,
                concept: currentQ.concept,
                category: currentQ.category || "symptom",
                value: currentQ.inverse ? false : true,
                certainty: "confirmed",
                displayLabel: lang === "hi" ? "हाँ (Yes)" : "Yes",
                inverse: currentQ.inverse,
              });
            }}
            className="p-6 bg-white hover:bg-teal-50 border-2 border-slate-300 hover:border-teal-600 rounded-2xl font-black text-2xl text-teal-800 shadow-md transition transform active:scale-95 text-center"
          >
            ✓ {lang === "hi" ? "हाँ" : "Yes"}
          </button>

          <button
            type="button"
            onClick={() => {
              recordAnswer({
                questionId: currentQ.id,
                concept: currentQ.concept,
                category: currentQ.category || "symptom",
                value: currentQ.inverse ? true : false,
                certainty: "confirmed",
                displayLabel: lang === "hi" ? "नहीं (No)" : "No",
                inverse: currentQ.inverse,
              });
            }}
            className="p-6 bg-white hover:bg-slate-100 border-2 border-slate-300 rounded-2xl font-black text-2xl text-slate-700 shadow-md transition transform active:scale-95 text-center"
          >
            ✕ {lang === "hi" ? "नहीं" : "No"}
          </button>
        </div>
      )}

      {/* 7. TEXT OR VOICE DESCRIPTION */}
      {currentQ.type === "text_or_voice" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleStartListening}
              className={`flex-1 py-4 rounded-2xl font-black text-lg transition flex items-center justify-center gap-2 shadow-md ${
                isListening
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              }`}
            >
              <span>🎙</span>
              {isListening
                ? lang === "hi" ? "आवाज़ सुनी जा रही है..." : "Listening..."
                : t("speak_button", lang)}
            </button>
          </div>

          {voiceError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
              ⚠ {voiceError}
            </div>
          )}

          <textarea
            rows={3}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={
              lang === "hi"
                ? "अपनी तकलीफ यहां लिखें (उदा. दो दिन से बाएं पैर में दर्द है)..."
                : "Type your problem here (e.g. My left foot has been hurting for 2 days)..."
            }
            className="w-full p-4 border-2 border-slate-300 rounded-2xl text-base font-semibold text-slate-800 focus:border-teal-600 outline-none"
          />

          <button
            type="button"
            disabled={!customText.trim()}
            onClick={() => {
              recordAnswer({
                questionId: currentQ.id,
                concept: currentQ.concept,
                category: "chief_complaint",
                value: customText.trim(),
                certainty: "confirmed",
                displayLabel: customText.trim(),
              });
            }}
            className={`w-full py-4 rounded-2xl font-extrabold text-lg shadow-lg transition transform active:scale-95 ${
              customText.trim()
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {t("continue_btn", lang)} →
          </button>
        </div>
      )}

      {/* FOOTER: BACK & I DON'T KNOW */}
      <div className="flex gap-4 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleGoBack}
          className="py-3 px-6 border-2 border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-700 text-base transition flex items-center gap-1"
        >
          ← {t("back", lang)}
        </button>

        {currentQ.allowUnknown && currentQ.type !== "body_location" && (
          <button
            type="button"
            onClick={handleAnswerUnknown}
            className="flex-1 py-3 px-4 border-2 border-dashed border-slate-300 hover:bg-slate-100 rounded-xl text-slate-500 font-bold text-sm transition flex items-center justify-center gap-2"
          >
            <span>❓</span> {t("dont_know", lang)}
          </button>
        )}
      </div>
    </div>
  );
}

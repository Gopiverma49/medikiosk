"use client";
import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import { t, Language } from "../../lib/translations";
import { VoiceService } from "../../lib/voice";
import { KioskStepIndicator } from "../../components/KioskStepIndicator";
import { KioskKeypad } from "../../components/KioskKeypad";
import { KioskScanner } from "../../components/KioskScanner";
import { KioskVoiceIndicator } from "../../components/KioskVoiceIndicator";
import AdaptiveSymptomEngine, { SymptomAnswerRecord } from "../../components/symptoms/AdaptiveSymptomEngine";
import type { Patient, TreatmentRecord, TokenItem } from "../../lib/types";

type FlowStep =
  | "lang_mode" // Step 1: Language & Interaction Mode
  | "id_method" // Step 2: Choose Scan vs Keypad
  | "scan_id" // Step 2: Camera Viewfinder
  | "keypad_id" // Step 2: 10-digit Numeric Keypad
  | "patient_confirm" // Step 3: Existing Patient Confirmation
  | "patient_register" // Step 3: New Patient Form
  | "patient_register_confirm" // Step 3: New Patient Confirmation
  | "history_check" // Step 4: Same vs New Illness
  | "history_details" // Step 4: Previous Illness Summary
  | "history_auto_skip" // Step 4: No history auto message
  | "symptoms_adaptive" // Step 5: Adaptive Question Engine
  | "documents_upload" // Step 5: Optional Document Scan
  | "completed"; // Final Done Screen

function cleanSymptomText(str: string): string {
  if (!str) return "";
  return str
    .replace(/\{.*?['"]displayLabel['"]:\s*['"](.*?)['"].*?\}/g, "$1")
    .replace(/\[\s*['"](.*?)['"]\s*\]/g, "$1")
    .replace(/\(\s*\[.*?\]\s*\)/g, "")
    .replace(/\(\s*['"](.*?)['"]\s*\)/g, "($1)")
    .replace(/_/g, " ")
    .replace(/\b(true|false|none|null|undefined)\b/gi, "")
    .replace(/,\s*,/g, ",")
    .replace(/^\s*,\s*|\s*,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function PatientPage() {
  // Session State
  const [lang, setLang] = useState<Language>("en");
  const [interactionMode, setInteractionMode] = useState<"touch" | "voice">("touch");
  const [step, setStep] = useState<FlowStep>("lang_mode");
  const [historyStack, setHistoryStack] = useState<FlowStep[]>([]);

  // Patient & Medical State
  const [patientIdInput, setPatientIdInput] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([]);
  const [selectedIllnessId, setSelectedIllnessId] = useState<string | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<TokenItem | null>(null);

  // New Patient Form State
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    age: "",
    gender: "Male",
  });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  // Loading & Document Status
  const [isLoading, setIsLoading] = useState(false);
  const [docStatus, setDocStatus] = useState<Record<string, string>>({});

  // Voice Guidance State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Auto-Reset 7-second Timer State (Completion screen)
  const [autoResetSeconds, setAutoResetSeconds] = useState<number>(7);

  // Map step to numerical indicator (1 to 5)
  const getStepNumber = (s: FlowStep): number => {
    switch (s) {
      case "lang_mode":
        return 1;
      case "id_method":
      case "scan_id":
      case "keypad_id":
        return 2;
      case "patient_confirm":
      case "patient_register":
      case "patient_register_confirm":
        return 3;
      case "history_check":
      case "history_details":
      case "history_auto_skip":
        return 4;
      case "symptoms_adaptive":
      case "documents_upload":
      case "completed":
        return 5;
    }
  };

  const resetSession = () => {
    VoiceService.stopSpeaking();
    VoiceService.stopListening();
    setPatient(null);
    setTreatments([]);
    setPatientIdInput("");
    setSelectedIllnessId(null);
    setEncounterId(null);
    setGeneratedToken(null);
    setDocStatus({});
    setHistoryStack([]);
    setStep("lang_mode");
  };

  // Safe navigation with history stack
  const goTo = (nextStep: FlowStep) => {
    setHistoryStack((prev) => [...prev, step]);
    setStep(nextStep);
  };

  const goBack = () => {
    if (historyStack.length === 0) {
      if (step === "patient_register" || step === "patient_confirm") {
        setStep("id_method");
      } else if (step === "patient_register_confirm") {
        setStep("patient_register");
      } else if (step === "scan_id" || step === "keypad_id") {
        setStep("id_method");
      } else if (step === "id_method") {
        setStep("lang_mode");
      }
      return;
    }
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    setStep(prev);
  };

  const goBackToIdEntry = () => {
    // Return to previous ID step (keypad_id or scan_id or id_method)
    const prevIdStep = [...historyStack].reverse().find(
      (s) => s === "keypad_id" || s === "scan_id" || s === "id_method"
    );
    if (prevIdStep) {
      const idx = historyStack.lastIndexOf(prevIdStep);
      setHistoryStack(historyStack.slice(0, idx));
      setStep(prevIdStep);
    } else {
      setStep("id_method");
    }
  };

  const cancelSession = () => {
    const prompt = lang === "hi" ? "क्या आप इस सत्र को रद्द करना चाहते हैं?" : "Are you sure you want to cancel this session?";
    if (window.confirm(prompt)) {
      resetSession();
    }
  };

  // Trigger voice prompt for a given step if in voice mode
  const playVoicePrompt = useCallback((promptKey: any) => {
    if (interactionMode === "voice") {
      const text = t(promptKey, lang);
      setIsSpeaking(true);
      setVoiceError(null);
      VoiceService.speak(text, lang, () => {
        setIsSpeaking(false);
      });
    }
  }, [interactionMode, lang]);

  // Handle continuous voice prompts per step change
  useEffect(() => {
    if (interactionMode === "voice") {
      switch (step) {
        case "lang_mode":
          playVoicePrompt("voice_speak_prompt_lang");
          break;
        case "id_method":
          playVoicePrompt("voice_speak_prompt_id");
          break;
        case "scan_id":
          playVoicePrompt("voice_speak_prompt_scan");
          break;
        case "keypad_id":
          playVoicePrompt("voice_speak_prompt_keypad");
          break;
        case "patient_confirm":
          playVoicePrompt("voice_speak_prompt_confirm");
          break;
        case "patient_register":
          playVoicePrompt("voice_speak_prompt_register");
          break;
        case "patient_register_confirm":
          playVoicePrompt("voice_speak_prompt_reg_confirm");
          break;
        case "history_check":
          playVoicePrompt("voice_speak_prompt_history");
          break;
        case "history_details":
          playVoicePrompt("voice_speak_prompt_history_details");
          break;
        case "history_auto_skip":
          playVoicePrompt("voice_speak_prompt_history_auto_skip");
          break;
        case "documents_upload":
          playVoicePrompt("voice_speak_prompt_docs");
          break;
        case "completed":
          playVoicePrompt("voice_speak_prompt_completed");
          break;
      }
    }
  }, [step, interactionMode, playVoicePrompt]);

  // Completion screen: 7-second countdown auto-reset
  useEffect(() => {
    if (step === "completed") {
      setAutoResetSeconds(7);
      const interval = setInterval(() => {
        setAutoResetSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            resetSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step]);

  // Global 30-second inactivity timeout: resets to start page if abandoned anywhere in patient flow
  useEffect(() => {
    if (step === "lang_mode" || step === "completed") return;

    let timeoutId: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resetSession();
      }, 30000); // 30 seconds
    };

    const activityEvents = ["touchstart", "touchend", "click", "keydown", "mousemove", "scroll"];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetInactivityTimer, { passive: true }));

    // Start initial timer
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [step]);

  // 1. Handle Patient Lookup
  const handleLookup = async (id: string) => {
    setIsLoading(true);
    setPatientIdInput(id);
    try {
      const result = await api.lookupPatient(id);
      setIsLoading(false);

      if (result.found && result.patient) {
        setPatient(result.patient);
        goTo("patient_confirm");
      } else {
        setPatient(null);
        setRegForm({ name: "", phone: "", age: "", gender: "Male" });
        goTo("patient_register");
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setIsLoading(false);
      goTo("patient_register");
    }
  };

  // 2. Handle Existing Patient Confirmation
  const confirmExistingPatient = async () => {
    if (!patient) return;
    setIsLoading(true);
    try {
      const pastTreatments = await api.getPatientTreatments(patient.patient_id || patient.id);
      setTreatments(pastTreatments);
      setIsLoading(false);

      if (pastTreatments.length > 0) {
        goTo("history_check");
      } else {
        await startEncounterFlow(null, patient);
      }
    } catch (err) {
      console.error("Error fetching treatments:", err);
      setIsLoading(false);
      await startEncounterFlow(null, patient);
    }
  };

  // 3. Handle New Patient Registration
  const validateRegForm = () => {
    const errors: Record<string, string> = {};
    if (!regForm.name.trim()) {
      errors.name = lang === "hi" ? "कृपया पूरा नाम दर्ज करें।" : "Full name is required.";
    }
    const phoneClean = regForm.phone.replace(/\D/g, "");
    if (!phoneClean || phoneClean.length < 10) {
      errors.phone = lang === "hi" ? "कृपया 10-अंकों का वैध मोबाइल नंबर दर्ज करें।" : "Valid 10-digit phone number is required.";
    }
    const ageNum = parseInt(regForm.age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      errors.age = lang === "hi" ? "कृपया सही उम्र (1-120) दर्ज करें।" : "Please enter a valid age (1-120).";
    }
    setRegErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitNewPatientForm = () => {
    if (!validateRegForm()) return;
    goTo("patient_register_confirm");
  };

  const saveNewPatientToDB = async () => {
    setIsLoading(true);
    try {
      const pid = patientIdInput?.trim() ? patientIdInput.trim() : undefined;
      const created = await api.createPatient({
        patient_id: pid,
        name: regForm.name.trim(),
        phone: regForm.phone.trim() || undefined,
        age: parseInt(regForm.age, 10),
        gender: regForm.gender,
        preferred_language: lang,
        department: "General Medicine",
      });
      setPatient(created);
      setTreatments([]);
      await startEncounterFlow(null, created);
    } catch (err: any) {
      console.error("Error creating patient:", err);
      setIsLoading(false);
      alert(err.message || "Failed to save patient. Please retry.");
    }
  };

  // 4. Handle Treatment History Branching
  const startEncounterFlow = async (
    prevIllnessId: string | null = null,
    currentPatient?: Patient | null,
    skipSymptoms: boolean = false
  ) => {
    const targetPatient = currentPatient || patient;
    if (!targetPatient) return;
    setIsLoading(true);
    try {
      setSelectedIllnessId(prevIllnessId);
      const enc = await api.createEncounter(targetPatient.id, "general", prevIllnessId || undefined);
      setEncounterId(enc.id);
      await api.recordConsent(enc.id, true);

      if (skipSymptoms && prevIllnessId) {
        // Auto-generate clinical summary from chosen continuing illness
        try {
          await api.generateSummary(enc.id);
        } catch (e) {
          console.warn("Auto-summary error:", e);
        }
        setIsLoading(false);
        // Jump directly to documents upload (or token generation)
        goTo("documents_upload");
      } else {
        setIsLoading(false);
        goTo("symptoms_adaptive");
      }
    } catch (err) {
      console.error("Error creating encounter:", err);
      setIsLoading(false);
      goTo(skipSymptoms ? "documents_upload" : "symptoms_adaptive");
    }
  };

  // 5. Dynamic Adaptive Symptom Intake Completion
  const handleCompleteAdaptiveSymptoms = async (answers: SymptomAnswerRecord[]) => {
    if (!encounterId) {
      goTo("documents_upload");
      return;
    }
    setIsLoading(true);
    try {
      for (const ans of answers) {
        await api.submitAnswer({
          encounter_id: encounterId,
          question_concept: ans.concept,
          raw_answer: ans.certainty === "unknown" ? null : ans.value,
          certainty: ans.certainty,
          source_language: lang,
        });
      }
      await api.evaluateTriage(encounterId);
      await api.detectContradictions(encounterId);
    } catch (e) {
      console.warn("Failed saving symptom facts:", e);
    } finally {
      setIsLoading(false);
      goTo("documents_upload");
    }
  };

  const uploadAndProcessDoc = async (docType: string, filename: string) => {
    if (!encounterId) return;
    setDocStatus((s) => ({ ...s, [docType]: "processing" }));
    try {
      const doc: any = await api.uploadDocument(encounterId, docType, filename);
      const result: any = await api.processDocument(doc.id);
      setDocStatus((s) => ({ ...s, [docType]: result.ok ? "processed" : "failed" }));
      if (result.ok) {
        await api.detectContradictions(encounterId);
        await api.evaluateTriage(encounterId);
      }
    } catch (e) {
      setDocStatus((s) => ({ ...s, [docType]: "failed" }));
    }
  };

  const finishKioskIntake = async () => {
    setIsLoading(true);
    if (encounterId) {
      try {
        await api.generateSummary(encounterId);
      } catch (e) {
        console.warn("Summary generation error:", e);
      }
    }

    if (patient) {
      try {
        const tok = await api.generateToken(patient.id, encounterId || undefined, patient.department || "General Medicine");
        setGeneratedToken(tok);
        if (interactionMode === "voice") {
          const tokenDigits = tok.token_number.split("").join(" ");
          const prompt = lang === "hi"
            ? `आपका टोकन नंबर है ${tok.token_number}। कृपया प्रतीक्षा कक्ष में बैठें।`
            : `Your consultation token number is ${tokenDigits}. Please proceed to the waiting area.`;
          VoiceService.speak(prompt, lang);
        }
      } catch (err) {
        console.error("Error generating token:", err);
      }
    }
    setIsLoading(false);
    goTo("completed");
  };

  return (
    <div className="min-h-[85vh] bg-slate-100 flex flex-col justify-between p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm">
      {/* Top Header Bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-300">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetSession}
            className="w-10 h-10 rounded-xl bg-teal-700 hover:bg-teal-800 flex items-center justify-center text-white font-black text-xl shadow transition"
            title={lang === "hi" ? "सत्र रीसेट करें" : "Reset Kiosk Session"}
          >
            +
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              MediKiosk
            </h1>
            <p className="text-xs text-slate-500 font-semibold">
              {t("app_title", lang)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step !== "lang_mode" && (
            <button
              type="button"
              onClick={cancelSession}
              className="py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-sm font-bold transition shadow-sm"
            >
              ✕ {t("cancel_session", lang)}
            </button>
          )}
        </div>
      </header>

      {/* Main Kiosk Container */}
      <main className="max-w-4xl w-full mx-auto my-auto py-4">
        {/* Step Indicator */}
        <KioskStepIndicator currentStep={getStepNumber(step)} lang={lang} />

        {/* Voice Mode Feedback Banner */}
        {interactionMode === "voice" && step !== "lang_mode" && step !== "completed" && (
          <KioskVoiceIndicator
            lang={lang}
            isSpeaking={isSpeaking}
            isListening={isListening}
            transcript={voiceTranscript}
            error={voiceError}
            onRetry={() => playVoicePrompt("voice_speak_prompt_symptoms")}
            onSwitchToTouch={() => {
              VoiceService.stopSpeaking();
              VoiceService.stopListening();
              setInteractionMode("touch");
            }}
          />
        )}

        {/* STEP 1: Language & Interaction Selection */}
        {step === "lang_mode" && (
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl text-center">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
              {t("welcome_heading", lang)}
            </h2>
            <p className="text-slate-500 text-base md:text-lg mb-8">
              {t("welcome_subheading", lang)}
            </p>

            <div className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                {t("choose_language", lang)}
              </h3>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  className={`py-5 px-6 rounded-2xl border-4 text-2xl font-black transition transform active:scale-95 shadow-md ${lang === "en"
                    ? "border-teal-600 bg-teal-50 text-teal-900 ring-4 ring-teal-200"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLang("hi")}
                  className={`py-5 px-6 rounded-2xl border-4 text-2xl font-black transition transform active:scale-95 shadow-md ${lang === "hi"
                    ? "border-teal-600 bg-teal-50 text-teal-900 ring-4 ring-teal-200"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                >
                  हिंदी
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                {t("choose_interaction_mode", lang)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    setInteractionMode("touch");
                    goTo("id_method");
                  }}
                  className="p-6 md:p-8 bg-slate-50 hover:bg-teal-50 border-4 border-slate-300 hover:border-teal-600 rounded-3xl text-left transition transform hover:-translate-y-1 active:scale-95 shadow-lg group"
                >
                  <div className="text-4xl mb-3">👆</div>
                  <div className="text-2xl font-black text-slate-900 group-hover:text-teal-900 mb-1">
                    {t("mode_touch", lang)}
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    {t("mode_touch_desc", lang)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInteractionMode("voice");
                    goTo("id_method");
                  }}
                  className="p-6 md:p-8 bg-slate-50 hover:bg-teal-50 border-4 border-slate-300 hover:border-teal-600 rounded-3xl text-left transition transform hover:-translate-y-1 active:scale-95 shadow-lg group"
                >
                  <div className="text-4xl mb-3">🎤</div>
                  <div className="text-2xl font-black text-slate-900 group-hover:text-teal-900 mb-1">
                    {t("mode_voice", lang)}
                  </div>
                  <div className="text-sm text-slate-500 font-medium">
                    {t("mode_voice_desc", lang)}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Choose ID Method */}
        {step === "id_method" && (
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl text-center">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-8">
              {t("id_method_title", lang)}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
              <button
                type="button"
                onClick={() => goTo("scan_id")}
                className="p-8 bg-slate-50 hover:bg-teal-50 border-4 border-slate-300 hover:border-teal-600 rounded-3xl text-center transition transform hover:-translate-y-1 active:scale-95 shadow-lg"
              >
                <div className="text-5xl mb-4">📷</div>
                <div className="text-2xl font-black text-slate-900 mb-2">
                  {t("scan_id", lang)}
                </div>
                <div className="text-sm text-slate-500 font-semibold">
                  {t("scan_id_desc", lang)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => goTo("keypad_id")}
                className="p-8 bg-slate-50 hover:bg-teal-50 border-4 border-slate-300 hover:border-teal-600 rounded-3xl text-center transition transform hover:-translate-y-1 active:scale-95 shadow-lg"
              >
                <div className="text-5xl mb-4">🔢</div>
                <div className="text-2xl font-black text-slate-900 mb-2">
                  {t("enter_id", lang)}
                </div>
                <div className="text-sm text-slate-500 font-semibold">
                  {t("enter_id_desc", lang)}
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={goBack}
              className="py-3 px-8 border-2 border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-600"
            >
              ← {t("back", lang)}
            </button>
          </div>
        )}

        {/* STEP 2A: Scanner View */}
        {step === "scan_id" && (
          <KioskScanner
            lang={lang}
            onDetected={handleLookup}
            onCancel={goBack}
            onSwitchToManual={() => goTo("keypad_id")}
          />
        )}

        {/* STEP 2B: Keypad */}
        {step === "keypad_id" && (
          <KioskKeypad
            lang={lang}
            onSubmit={handleLookup}
            onCancel={goBack}
            isLoading={isLoading}
          />
        )}

        {/* STEP 3A: Existing Patient Confirmation */}
        {step === "patient_confirm" && patient && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl text-center">
            <div className="w-16 h-16 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4">
              ✓
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-1">
              {t("patient_found_title", lang)}
            </h2>
            <p className="text-slate-500 mb-6 text-sm md:text-base">
              {t("is_this_you", lang)}
            </p>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 text-left mb-8 shadow-inner space-y-3 font-sans">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500 font-bold text-sm">
                  {t("patient_id_label", lang)}
                </span>
                <span className="font-mono font-black text-teal-800 text-base">
                  {patient.patient_id || patient.id}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500 font-bold text-sm">
                  {t("name_label", lang)}
                </span>
                <span className="font-black text-slate-900 text-lg">
                  {patient.name}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500 font-bold text-sm">
                  {t("age_label", lang)}
                </span>
                <span className="font-semibold text-slate-800">
                  {patient.age} {lang === "hi" ? "वर्ष" : "Years"}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500 font-bold text-sm">
                  {t("gender_label", lang)}
                </span>
                <span className="font-semibold text-slate-800">
                  {patient.gender}
                </span>
              </div>
              {patient.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold text-sm">
                    {t("phone_label", lang)}
                  </span>
                  <span className="font-mono font-semibold text-slate-700">
                    XXXXXX{patient.phone.slice(-4)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button
                type="button"
                disabled={isLoading}
                onClick={confirmExistingPatient}
                className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xl shadow-lg transition transform active:scale-95"
              >
                {isLoading ? t("checking_records", lang) : t("yes_continue", lang)}
              </button>
              <button
                type="button"
                onClick={goBackToIdEntry}
                className="w-full py-4 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-base transition"
              >
                {t("no_different_id", lang)}
              </button>
              <button
                type="button"
                onClick={goBackToIdEntry}
                className="w-full py-3 border-2 border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-slate-600 text-sm transition"
              >
                ← {t("back", lang)}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3B: Registration Form */}
        {step === "patient_register" && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-2">
                +
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">
                {t("not_found_title", lang)}
              </h2>
              <p className="text-slate-500 text-sm md:text-base">
                {t("not_found_desc", lang)}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t("full_name", lang)} *
                </label>
                <input
                  type="text"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  placeholder={t("full_name_placeholder", lang)}
                  className="w-full p-4 border-2 border-slate-300 rounded-xl text-lg font-semibold focus:border-teal-600 outline-none"
                />
                {regErrors.name && (
                  <p className="text-xs text-red-600 font-bold mt-1">
                    ⚠ {regErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t("phone_number", lang)} *
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value.replace(/\D/g, "") })}
                  placeholder={t("phone_placeholder", lang)}
                  className="w-full p-4 border-2 border-slate-300 rounded-xl text-lg font-mono font-semibold focus:border-teal-600 outline-none"
                />
                {regErrors.phone && (
                  <p className="text-xs text-red-600 font-bold mt-1">
                    ⚠ {regErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {t("age", lang)} *
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={regForm.age}
                  onChange={(e) => setRegForm({ ...regForm, age: e.target.value })}
                  placeholder={t("age_placeholder", lang)}
                  className="w-full p-4 border-2 border-slate-300 rounded-xl text-lg font-semibold focus:border-teal-600 outline-none"
                />
                {regErrors.age && (
                  <p className="text-xs text-red-600 font-bold mt-1">
                    ⚠ {regErrors.age}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  {t("gender", lang)} *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {["Male", "Female", "Other"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setRegForm({ ...regForm, gender: g })}
                      className={`py-3 px-4 rounded-xl border-2 font-bold text-base transition ${regForm.gender === g
                        ? "border-teal-600 bg-teal-50 text-teal-900 shadow-sm"
                        : "border-slate-300 bg-white text-slate-700"
                        }`}
                    >
                      {g === "Male"
                        ? t("male", lang)
                        : g === "Female"
                          ? t("female", lang)
                          : t("other", lang)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={goBackToIdEntry}
                className="flex-1 py-4 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition flex items-center justify-center gap-2"
              >
                ← {t("back", lang)}
              </button>
              <button
                type="button"
                onClick={submitNewPatientForm}
                className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-extrabold text-lg shadow-lg"
              >
                {t("continue_btn", lang)}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3C: Registration Confirmation */}
        {step === "patient_register_confirm" && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl text-center">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
              {t("confirm_info_title", lang)}
            </h2>
            <p className="text-slate-500 mb-6 text-sm">
              {lang === "hi"
                ? "कृपया नीचे दी गई जानकारी की पुष्टि करें।"
                : "Please review your registration details."}
            </p>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 text-left mb-8 shadow-inner space-y-3 font-sans">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500 font-bold text-sm">
                  {t("name_label", lang)}
                </span>
                <span className="font-black text-slate-900 text-lg">
                  {regForm.name}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500 font-bold text-sm">
                  {t("phone_label", lang)}
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {regForm.phone}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500 font-bold text-sm">
                  {t("age_label", lang)}
                </span>
                <span className="font-semibold text-slate-800">
                  {regForm.age} {lang === "hi" ? "वर्ष" : "Years"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold text-sm">
                  {t("gender_label", lang)}
                </span>
                <span className="font-semibold text-slate-800">
                  {regForm.gender}
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep("patient_register")}
                className="flex-1 py-4 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition flex items-center justify-center gap-2"
              >
                ← {t("back", lang)}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={saveNewPatientToDB}
                className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-extrabold text-lg shadow-lg transition transform active:scale-95"
              >
                {isLoading ? t("saving_patient", lang) : t("confirm", lang)}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4A: Past Treatment Records Choice */}
        {step === "history_check" && treatments.length > 0 && (
          <div className="max-w-2xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl text-center">
            <div className="w-16 h-16 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4">
              📋
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
              {lang === "hi" ? "आपके पुराने रिकॉर्ड उपलब्ध हैं" : "Previous Medical Records Found"}
            </h2>
            <p className="text-slate-500 text-base md:text-lg mb-8">
              {lang === "hi"
                ? "क्या आप अपनी पुरानी बीमारी के लिए आए हैं या कोई नई समस्या है?"
                : "Are you visiting for a previous illness or a new problem?"}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <button
                type="button"
                onClick={() => goTo("history_details")}
                className="p-8 bg-teal-50 hover:bg-teal-100 border-4 border-teal-500 rounded-3xl text-left transition transform hover:-translate-y-1 active:scale-95 shadow-lg group"
              >
                <div className="text-4xl mb-3">🔄</div>
                <div className="text-2xl font-black text-teal-950 mb-1">
                  {lang === "hi" ? "वही पुरानी बीमारी" : "Continuing Past Illness"}
                </div>
                <div className="text-xs text-teal-800 font-bold mt-1">
                  {treatments.length} {lang === "hi" ? "रिकॉर्ड उपलब्ध" : "past record(s) available"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => startEncounterFlow(null, patient, false)}
                className="p-8 bg-slate-50 hover:bg-slate-100 border-4 border-slate-300 hover:border-slate-500 rounded-3xl text-left transition transform hover:-translate-y-1 active:scale-95 shadow-lg group"
              >
                <div className="text-4xl mb-3">✨</div>
                <div className="text-2xl font-black text-slate-900 mb-1">
                  {lang === "hi" ? "नई बीमारी / समस्या" : "New Problem"}
                </div>
                <div className="text-xs text-slate-500 font-semibold mt-1">
                  {lang === "hi" ? "नए लक्षण बताएं" : "Start fresh intake for new symptoms"}
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={goBack}
              className="py-3 px-8 border-2 border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-600"
            >
              ← {t("back", lang)}
            </button>
          </div>
        )}

        {/* STEP 4B: Select from Past Illnesses (Keywords + Date) */}
        {step === "history_details" && treatments.length > 0 && (
          <div className="max-w-2xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-10 shadow-xl">
            <div className="text-center mb-6">
              <span className="text-xs font-bold uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 inline-block mb-2">
                {lang === "hi" ? "पिछली बीमारी चुनें" : "SELECT PREVIOUS ILLNESS"}
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
                {lang === "hi" ? "अपनी पिछली बीमारी चुनें" : "Choose Your Continuing Illness"}
              </h2>
              <p className="text-slate-500 text-sm">
                {lang === "hi"
                  ? "नीचे दिए गए रिकॉर्ड में से चुनें (लक्षण पूछे बिना डॉक्टर को भेजा जाएगा):"
                  : "Tap your past condition to continue (symptoms step will be skipped):"}
              </p>
            </div>

            {/* List of past records in simple keywords: Symptoms first, Duration/Days second, Info third, Date last */}
            <div className="space-y-3.5 mb-8 max-h-[380px] overflow-y-auto pr-1">
              {treatments.map((tr, idx) => {
                const cleanName = cleanSymptomText(tr.illness_name || "");
                const cleanSym = cleanSymptomText(tr.symptoms || "");
                const displaySymptoms = cleanSym && cleanSym !== "None reported" && cleanSym !== cleanName
                  ? `${cleanName} • ${cleanSym}`
                  : cleanName || "General Symptoms";
                const cleanDiag = cleanSymptomText(tr.diagnosis || "");
                const durationLabel = cleanDiag.includes("Duration:")
                  ? cleanDiag.replace("Duration:", "").trim()
                  : "1–3 days";
                const shortInfo = cleanSymptomText(tr.treatment || "OPD Consultation");

                return (
                  <button
                    key={tr.id || idx}
                    type="button"
                    disabled={isLoading}
                    onClick={() => startEncounterFlow(tr.illness_id, patient, true)}
                    className="w-full text-left p-5 rounded-2xl border-2 border-slate-200 hover:border-teal-600 bg-white hover:bg-teal-50/50 transition transform active:scale-[0.99] shadow-xs hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div className="space-y-2 flex-1">
                      {/* 1. SYMPTOMS FIRST (Bold, prominent) */}
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                          {lang === "hi" ? "लक्षण" : "Symptoms"}
                        </span>
                        <div className="text-lg font-black text-slate-900 group-hover:text-teal-950 leading-snug">
                          🩺 {displaySymptoms}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {/* 2. DAYS / DURATION SECOND */}
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                          ⏱️ {durationLabel}
                        </span>

                        {/* 3. REST INFORMATION OR PRESCRIBED MEDICINES */}
                        {tr.prescribed_medicines && tr.prescribed_medicines.length > 0 ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                            💊 Rx: {tr.prescribed_medicines.map((m) => m.name).join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                            💊 {shortInfo}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4. DATE LAST (Crisp badge on the right/bottom) */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 flex-shrink-0">
                      <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs">
                        📅 {tr.visit_date || "Past Visit"}
                      </span>
                      <span className="text-xs font-extrabold text-teal-700 group-hover:underline flex items-center gap-1">
                        {lang === "hi" ? "चुनें" : "Select"} ›
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => goTo("history_check")}
                className="flex-1 py-3.5 border-2 border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-700 text-sm transition"
              >
                ← {t("back", lang)}
              </button>
              <button
                type="button"
                onClick={() => startEncounterFlow(null, patient, false)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm transition"
              >
                {lang === "hi" ? "नई समस्या के लिए देखें" : "Visiting for a New Problem"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4C: Auto Skip */}
        {step === "history_auto_skip" && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4">
              ℹ️
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
              {t("no_records_found", lang)}
            </h2>
            <p className="text-slate-500 text-base md:text-lg mb-8">
              {t("starting_symptoms_auto", lang)}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                type="button"
                onClick={goBack}
                className="w-full sm:w-auto py-4 px-8 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition"
              >
                ← {t("back", lang)}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => startEncounterFlow(null)}
                className="w-full sm:w-auto py-5 px-10 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xl shadow-lg transition transform active:scale-95"
              >
                {isLoading ? "..." : t("continue_btn", lang)} →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Dynamic Adaptive Symptom Intake Engine */}
        {step === "symptoms_adaptive" && (
          <AdaptiveSymptomEngine
            lang={lang}
            interactionMode={interactionMode}
            onComplete={handleCompleteAdaptiveSymptoms}
            onBackToPreviousStage={goBack}
          />
        )}

        {/* STEP 5C: Document Scan */}
        {step === "documents_upload" && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl text-center">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
              {lang === "hi" ? "रिपोर्ट अपलोड / स्कैन करें" : "Upload / Scan Reports"}
            </h2>
            <p className="text-slate-500 mb-6 text-sm">
              {lang === "hi"
                ? "यदि आपके पास कोई पुराना पर्चा, लैब रिपोर्ट या मेडिकल रिपोर्ट है, तो स्कैन या अपलोड करें (वैकल्पिक)।"
                : "Upload or scan previous medical records, prescriptions, or lab reports (optional)."}
            </p>

            <div className="max-w-md mx-auto mb-8">
              <div className="border-2 border-slate-200 hover:border-teal-500 rounded-3xl p-6 text-center bg-slate-50 transition shadow-sm">
                <div className="text-4xl mb-3">📄</div>
                <div className="text-lg font-black text-slate-900 mb-1">
                  {lang === "hi" ? "दस्तावेज / रिपोर्ट अपलोड करें" : "Upload / Scan Reports"}
                </div>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  {lang === "hi" ? "पर्चा, लैब रिपोर्ट या डिस्चार्ज समरी" : "Prescriptions, Lab Reports, or Discharge Summary"}
                </p>

                {docStatus["prescription"] || docStatus["report"] ? (
                  <div className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold">
                    <span>✓</span>
                    <span>{docStatus["prescription"] ? docStatus["prescription"].toUpperCase() : "PROCESSED"}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => uploadAndProcessDoc("prescription", "sample_prescription.png")}
                    className="py-3 px-6 bg-teal-700 hover:bg-teal-800 active:scale-98 text-white rounded-2xl text-sm font-extrabold shadow-md transition flex items-center justify-center gap-2 mx-auto"
                  >
                    <span>📎</span> {lang === "hi" ? "रिपोर्ट अपलोड / स्कैन करें" : "Upload / Scan Reports"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={goBack}
                className="flex-1 py-4 px-6 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition text-center"
              >
                ← {t("back", lang)}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={finishKioskIntake}
                className="flex-1 py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xl shadow-lg transition transform active:scale-95 text-center"
              >
                {isLoading ? "..." : t("continue_btn", lang)} →
              </button>
            </div>
          </div>
        )}

        {/* COMPLETED SCREEN WITH TOKEN NUMBER */}
        {step === "completed" && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl text-center">
            <div className="w-16 h-16 bg-teal-100 text-teal-800 rounded-2xl flex items-center justify-center text-3xl font-black mx-auto mb-3 shadow-inner">
              ✓
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-1">
              {t("all_done_title", lang)}
            </h2>
            <p className="text-slate-500 mb-4 text-sm">
              {t("all_done_desc", lang)}
            </p>

            {/* Prominent Consultation Token Badge */}
            {generatedToken ? (
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border-3 border-teal-500 rounded-3xl p-6 my-6 shadow-md relative overflow-hidden">
                <div className="text-xs font-mono uppercase font-black tracking-widest text-teal-800 bg-teal-200/80 px-3 py-1 rounded-full inline-block mb-2">
                  {lang === "hi" ? "आपका टोकन नंबर" : "YOUR CONSULTATION TOKEN"}
                </div>
                <div className="text-6xl sm:text-7xl font-black font-mono tracking-wider text-teal-950 my-1 drop-shadow-sm">
                  {generatedToken.token_number}
                </div>
                {patient?.name && (
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {patient.name}
                  </div>
                )}
                <div className="text-xs font-semibold text-teal-800 mt-2 bg-white/80 border border-teal-200 rounded-xl py-2 px-3">
                  {lang === "hi"
                    ? "कृपया प्रतीक्षा क्षेत्र में बैठें और मुख्य डिस्प्ले स्क्रीन देखें।"
                    : "Please take a seat in the waiting area and watch the main Token Display."}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 my-4 text-xs font-semibold text-slate-600">
                {lang === "hi" ? "पंजीकरण सफल रहा। कृपया प्रतीक्षा क्षेत्र में बैठें।" : "Intake registration completed successfully. Please take a seat in the waiting area."}
              </div>
            )}

            {/* Auto-Refresh Countdown Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-300 rounded-full text-xs font-bold text-slate-600 mb-6 shadow-inner">
              <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-ping" />
              <span>
                {lang === "hi"
                  ? `अगले मरीज के लिए स्वतः रीसेट: ${autoResetSeconds} सेकंड...`
                  : `Auto-refreshing for next patient in ${autoResetSeconds}s...`}
              </span>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={resetSession}
                className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xl shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2"
              >
                ↻ {lang === "hi" ? "नया मरीज शुरू करें" : "Start Next Patient"}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-2">
        MediKiosk • Hospital Outpatient Department Intake System
      </footer>
    </div>
  );
}

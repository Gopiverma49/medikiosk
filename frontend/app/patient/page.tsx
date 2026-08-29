"use client";
import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import { t, Language } from "../../lib/translations";
import { VoiceService } from "../../lib/voice";
import { KioskStepIndicator } from "../../components/KioskStepIndicator";
import { KioskKeypad } from "../../components/KioskKeypad";
import { KioskScanner } from "../../components/KioskScanner";
import { KioskVoiceIndicator } from "../../components/KioskVoiceIndicator";
import type { Patient, TreatmentRecord } from "../../lib/types";

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
  | "symptoms_intro" // Step 5: Start Symptom Intake
  | "symptoms_adaptive" // Step 5: Adaptive SOCRATES Questions
  | "documents_upload" // Step 5: Optional Document Scan
  | "completed"; // Final Done Screen

type QuestionConfig = {
  concept: string;
  prompt: { en: string; hi: string };
  options: { en: string[]; hi: string[] };
  inverse?: boolean;
};

const ADAPTIVE_QUESTIONS: QuestionConfig[] = [
  {
    concept: "symptom_onset",
    prompt: { en: "When did the symptoms begin?", hi: "तकलीफ कब शुरू हुई थी?" },
    options: { en: ["Today", "Yesterday", "2–7 days ago", "More than a week"], hi: ["आज", "कल", "2–7 दिन पहले", "एक सप्ताह से अधिक"] },
  },
  {
    concept: "location",
    prompt: { en: "Where is the discomfort located?", hi: "तकलीफ शरीर के किस हिस्से में है?" },
    options: { en: ["Left chest", "Centre of chest", "Right chest", "Abdomen / Stomach"], hi: ["सीने के बाईं तरफ", "सीने के बीच में", "सीने के दाईं तरफ", "पेट में"] },
  },
  {
    concept: "character",
    prompt: { en: "How would you describe the sensation?", hi: "यह दर्द या तकलीफ किस प्रकार की है?" },
    options: { en: ["Pressure / tightness", "Sharp / stabbing", "Burning / Acidity", "Dull ache"], hi: ["दबाव या भारीपन", "तेज़ चुभन", "जलन या एसिडिटी", "हल्का मीठा दर्द"] },
  },
  {
    concept: "severity",
    prompt: { en: "How severe is the discomfort (1–10)?", hi: "तकलीफ की तीव्रता कितनी है (1–10)?" },
    options: { en: ["Mild (1–3)", "Moderate (4–6)", "Severe (7–10)"], hi: ["हल्की (1–3)", "मध्यम (4–6)", "अत्यधिक तीव्र (7–10)"] },
  },
  {
    concept: "radiation_to_arm",
    prompt: { en: "Does it spread to your arm, jaw, or back?", hi: "क्या दर्द हाथ, जबड़े या पीठ की तरफ फैलता है?" },
    options: { en: ["Yes", "No"], hi: ["हाँ", "नहीं"] },
  },
  {
    concept: "dyspnea",
    prompt: { en: "Do you feel breathless or short of breath?", hi: "क्या सांस लेने में कठिनाई हो रही है?" },
    options: { en: ["Yes", "No"], hi: ["हाँ", "नहीं"] },
  },
  {
    concept: "sweating",
    prompt: { en: "Have you been sweating more than usual?", hi: "क्या सामान्य से अधिक पसीना आ रहा है?" },
    options: { en: ["Yes", "No"], hi: ["हाँ", "नहीं"] },
  },
  {
    concept: "medication_reported_none",
    prompt: { en: "Are you currently taking any daily medicines?", hi: "क्या आप वर्तमान में कोई नियमित दवा ले रहे हैं?" },
    options: { en: ["Yes", "No"], hi: ["हाँ", "नहीं"] },
    inverse: true,
  },
  {
    concept: "allergy_reported_none",
    prompt: { en: "Do you have any known drug allergies?", hi: "क्या आपको किसी दवा से कोई एलर्जी है?" },
    options: { en: ["Yes", "No"], hi: ["हाँ", "नहीं"] },
    inverse: true,
  },
];

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

  // New Patient Form State
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    age: "",
    gender: "Male",
  });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  // Symptom Questionnaire State
  const [qIndex, setQIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [docStatus, setDocStatus] = useState<Record<string, string>>({});

  // Voice Guidance State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

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
      case "symptoms_intro":
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
    setQIndex(0);
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

  // Handle voice prompts per step change
  useEffect(() => {
    if (interactionMode === "voice") {
      switch (step) {
        case "lang_mode":
          playVoicePrompt("voice_speak_prompt_lang");
          break;
        case "id_method":
          playVoicePrompt("voice_speak_prompt_id");
          break;
        case "patient_confirm":
          playVoicePrompt("voice_speak_prompt_confirm");
          break;
        case "history_check":
          playVoicePrompt("voice_speak_prompt_history");
          break;
        case "symptoms_intro":
        case "symptoms_adaptive":
          playVoicePrompt("voice_speak_prompt_symptoms");
          break;
      }
    }
  }, [step, interactionMode, playVoicePrompt]);

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
        goTo("history_auto_skip");
      }
    } catch (err) {
      console.error("Error fetching treatments:", err);
      setIsLoading(false);
      goTo("history_auto_skip");
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
      const created = await api.createPatient({
        patient_id: patientIdInput || `P${Date.now().toString().slice(-9)}`,
        name: regForm.name.trim(),
        phone: regForm.phone.trim(),
        age: parseInt(regForm.age, 10),
        gender: regForm.gender,
        preferred_language: lang,
        department: "General Medicine",
      });
      setPatient(created);
      setTreatments([]);
      setIsLoading(false);
      goTo("history_auto_skip");
    } catch (err) {
      console.error("Error creating patient:", err);
      setIsLoading(false);
      alert("Failed to save patient. Please retry.");
    }
  };

  // 4. Handle Treatment History Branching
  const startEncounterFlow = async (prevIllnessId: string | null = null) => {
    if (!patient) return;
    setIsLoading(true);
    try {
      setSelectedIllnessId(prevIllnessId);
      const enc = await api.createEncounter(patient.id, "general", prevIllnessId || undefined);
      setEncounterId(enc.id);
      await api.recordConsent(enc.id, true);
      setIsLoading(false);
      goTo("symptoms_intro");
    } catch (err) {
      console.error("Error creating encounter:", err);
      setIsLoading(false);
      goTo("symptoms_intro");
    }
  };

  // 5. Adaptive Symptom Questions
  const answerAdaptive = async (concept: string, value: any, certainty: "confirmed" | "unknown", inverse?: boolean) => {
    if (!encounterId) return;
    const finalValue = certainty === "unknown" ? null : inverse ? value === (lang === "hi" ? "नहीं" : "No") : value;

    try {
      await api.submitAnswer({
        encounter_id: encounterId,
        question_concept: concept,
        raw_answer: certainty === "unknown" ? null : finalValue,
        certainty,
        source_language: lang,
      });
    } catch (e) {
      console.warn("Failed to submit answer:", e);
    }

    if (qIndex + 1 >= ADAPTIVE_QUESTIONS.length) {
      goTo("documents_upload");
    } else {
      setQIndex((prev) => prev + 1);
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
    if (encounterId) {
      setIsLoading(true);
      try {
        await api.generateSummary(encounterId);
      } catch (e) {
        console.warn("Summary generation error:", e);
      }
      setIsLoading(false);
    }
    goTo("completed");
  };

  return (
    <div className="min-h-[85vh] bg-slate-100 flex flex-col justify-between p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm">
      {/* Top Header Bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-300">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="w-10 h-10 rounded-xl bg-teal-700 hover:bg-teal-800 flex items-center justify-center text-white font-black text-xl shadow transition"
            title={lang === "hi" ? "मुख्य पृष्ठ" : "Back to Home"}
          >
            +
          </a>
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
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
              {t("id_method_title", lang)}
            </h2>
            <p className="text-slate-500 mb-8 text-base md:text-lg">
              {lang === "hi"
                ? "कृपया आईडी स्कैन करें या स्क्रीन पर 10 अंकों का नंबर दर्ज करें।"
                : "Choose whether to scan your card or enter your 10-digit ID number."}
            </p>

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
              {t("previous_records_found", lang)}
            </h2>
            <p className="text-slate-500 text-base md:text-lg mb-8">
              {t("continue_illness_prompt", lang)}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <button
                type="button"
                onClick={() => goTo("history_details")}
                className="p-8 bg-teal-50 hover:bg-teal-100 border-4 border-teal-500 rounded-3xl text-left transition transform hover:-translate-y-1 active:scale-95 shadow-lg group"
              >
                <div className="text-4xl mb-3">🔄</div>
                <div className="text-2xl font-black text-teal-950 mb-1">
                  {t("same_illness", lang)}
                </div>
                <div className="text-xs text-teal-800 font-semibold">
                  {treatments[0].illness_name} ({treatments[0].visit_date || "Past Visit"})
                </div>
              </button>

              <button
                type="button"
                onClick={() => startEncounterFlow(null)}
                className="p-8 bg-slate-50 hover:bg-slate-100 border-4 border-slate-300 hover:border-slate-500 rounded-3xl text-left transition transform hover:-translate-y-1 active:scale-95 shadow-lg group"
              >
                <div className="text-4xl mb-3">✨</div>
                <div className="text-2xl font-black text-slate-900 mb-1">
                  {t("new_illness", lang)}
                </div>
                <div className="text-xs text-slate-500 font-semibold">
                  {lang === "hi" ? "नई समस्या या लक्षण" : "Start fresh consultation"}
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

        {/* STEP 4B: Previous Illness Summary */}
        {step === "history_details" && treatments.length > 0 && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 text-center mb-2">
              {t("prev_illness_title", lang)}
            </h2>
            <p className="text-slate-500 text-center mb-6 text-sm">
              {t("continue_with_this_illness_q", lang)}
            </p>

            <div className="bg-slate-50 border-2 border-teal-200 rounded-2xl p-6 text-left mb-8 shadow-inner space-y-3 font-sans">
              <div>
                <span className="text-xs font-bold uppercase text-slate-400 block">
                  {t("illness_label", lang)}
                </span>
                <span className="text-lg font-black text-teal-900">
                  {treatments[0].illness_name}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-slate-400 block">
                  {t("prev_visit_label", lang)}
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {treatments[0].visit_date || "Recent"}
                </span>
              </div>
              {treatments[0].symptoms && (
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 block">
                    {t("prev_symptoms_label", lang)}
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {treatments[0].symptoms}
                  </span>
                </div>
              )}
              {treatments[0].treatment && (
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 block">
                    {t("prev_treatment_label", lang)}
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {treatments[0].treatment}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => startEncounterFlow(treatments[0].illness_id)}
                className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xl shadow-lg transition transform active:scale-95"
              >
                {isLoading ? t("checking_records", lang) : t("yes_continue", lang)}
              </button>
              <button
                type="button"
                onClick={() => startEncounterFlow(null)}
                className="w-full py-4 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-base transition"
              >
                {t("new_illness", lang)}
              </button>
              <button
                type="button"
                onClick={goBack}
                className="w-full py-3 border-2 border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-slate-600 text-sm transition"
              >
                ← {t("back", lang)}
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

        {/* STEP 5A: Symptoms Intro */}
        {step === "symptoms_intro" && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl text-center">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
              {t("symptoms_title", lang)}
            </h2>
            <p className="text-slate-500 mb-8 text-sm md:text-base">
              {selectedIllnessId
                ? lang === "hi"
                  ? "अपनी पूर्व बीमारी के वर्तमान लक्षणों का वर्णन करें।"
                  : "Describing symptoms for previous condition update."
                : lang === "hi"
                  ? "कृपया अपनी मुख्य तकलीफ बोलकर या छूकर बताएं।"
                  : "Describe your chief complaint using voice or tap options."}
            </p>

            <div className="space-y-4 mb-8">
              <button
                type="button"
                onClick={() => {
                  if (interactionMode === "voice") {
                    setIsListening(true);
                    VoiceService.listen(
                      lang,
                      (res) => {
                        setVoiceTranscript(res);
                        setIsListening(false);
                        goTo("symptoms_adaptive");
                      },
                      (err) => {
                        setVoiceError(err);
                        setIsListening(false);
                      }
                    );
                  } else {
                    goTo("symptoms_adaptive");
                  }
                }}
                className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xl shadow-lg transition transform active:scale-95 flex items-center justify-center gap-3"
              >
                <span>🎙</span> {t("speak_button", lang)}
              </button>

              <button
                type="button"
                onClick={() => goTo("symptoms_adaptive")}
                className="w-full py-4 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition"
              >
                {t("type_button", lang)}
              </button>

              <button
                type="button"
                onClick={goBack}
                className="w-full py-3 border-2 border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-slate-600 text-base transition"
              >
                ← {t("back", lang)}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5B: Adaptive SOCRATES Questions */}
        {step === "symptoms_adaptive" && ADAPTIVE_QUESTIONS[qIndex] && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl">
            <div className="text-xs font-mono font-bold text-teal-700 mb-2">
              {lang === "hi" ? "प्रश्न" : "QUESTION"} {qIndex + 1} / {ADAPTIVE_QUESTIONS.length}
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">
              {ADAPTIVE_QUESTIONS[qIndex].prompt[lang] || ADAPTIVE_QUESTIONS[qIndex].prompt.en}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {(ADAPTIVE_QUESTIONS[qIndex].options[lang] || ADAPTIVE_QUESTIONS[qIndex].options.en).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    answerAdaptive(
                      ADAPTIVE_QUESTIONS[qIndex].concept,
                      opt,
                      "confirmed",
                      ADAPTIVE_QUESTIONS[qIndex].inverse
                    )
                  }
                  className="p-5 border-2 border-slate-300 hover:border-teal-600 hover:bg-teal-50 rounded-2xl text-left font-bold text-lg text-slate-800 transition transform active:scale-95 shadow-sm"
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  if (qIndex > 0) {
                    setQIndex((prev) => prev - 1);
                  } else {
                    goBack();
                  }
                }}
                className="py-3 px-6 border-2 border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-600 text-base transition"
              >
                ← {t("back", lang)}
              </button>

              <button
                type="button"
                onClick={() =>
                  answerAdaptive(ADAPTIVE_QUESTIONS[qIndex].concept, null, "unknown")
                }
                className="flex-1 p-3 border-2 border-dashed border-slate-300 hover:bg-slate-50 rounded-xl text-slate-500 font-semibold text-center transition"
              >
                ❓ {t("dont_know", lang)}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5C: Document Scan */}
        {step === "documents_upload" && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl text-center">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
              {lang === "hi" ? "पुराने दस्तावेज स्कैन करें" : "Scan Prior Documents"}
            </h2>
            <p className="text-slate-500 mb-6 text-sm">
              {lang === "hi"
                ? "यदि आपके पास कोई पुराना पर्चा या लैब रिपोर्ट है, तो स्कैन करें।"
                : "Upload or scan previous prescriptions, lab reports, or discharge slips (optional)."}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { type: "prescription", label: lang === "hi" ? "पर्चा" : "Prescription", file: "sample_prescription.png" },
                { type: "lab", label: lang === "hi" ? "लैब रिपोर्ट" : "Lab Report", file: "sample_lab_report.png" },
                { type: "discharge", label: lang === "hi" ? "डिस्चार्ज कार्ड" : "Discharge Slip", file: "sample_discharge_summary.png" },
              ].map((d) => (
                <div key={d.type} className="border-2 border-slate-200 rounded-2xl p-4 text-center bg-slate-50">
                  <div className="text-sm font-bold text-slate-800 mb-2">{d.label}</div>
                  {docStatus[d.type] ? (
                    <span className="inline-block py-1 px-2 rounded bg-teal-100 text-teal-800 text-xs font-mono font-bold">
                      {docStatus[d.type].toUpperCase()}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => uploadAndProcessDoc(d.type, d.file)}
                      className="py-2 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold w-full transition shadow"
                    >
                      📎 {lang === "hi" ? "स्कैन करें" : "Scan / Add"}
                    </button>
                  )}
                </div>
              ))}
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

        {/* COMPLETED SCREEN */}
        {step === "completed" && (
          <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl text-center">
            <div className="w-20 h-20 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center text-4xl font-black mx-auto mb-4">
              ✓
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">
              {t("all_done_title", lang)}
            </h2>
            <p className="text-slate-500 mb-8 text-base">
              {t("all_done_desc", lang)}
            </p>

            <div className="space-y-4">
              <a
                href="/doctor"
                className="block w-full py-5 bg-clinical-blue hover:bg-clinical-blue-deep text-white rounded-2xl font-black text-xl shadow-lg transition text-center"
              >
                {t("view_doctor_dashboard", lang)}
              </a>

              <button
                type="button"
                onClick={resetSession}
                className="w-full py-4 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 rounded-2xl font-bold text-base transition"
              >
                ↻ {lang === "hi" ? "नया मरीज शुरू करें" : "Start Next Patient"}
              </button>

              <a
                href="/"
                className="block w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-sm transition text-center"
              >
                ← {lang === "hi" ? "मुख्य पृष्ठ पर जाएं" : "Back to Portals Home"}
              </a>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-2">
        MediKiosk v0.1.0 • AI-Assisted Multimodal Clinical Intake Platform • Synthetic Demo
      </footer>
    </div>
  );
}

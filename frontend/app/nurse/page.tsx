"use client";
import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useKioskLanguage } from "../../lib/kioskLanguage";
import { t } from "../../lib/translations";
import { PriorityPill } from "../../components/ClinicalComponents";
import { KioskScanner } from "../../components/KioskScanner";
import { PasswordInput } from "../../components/PasswordInput";
import type {
  TokenQueueItem,
  Patient,
  TreatmentRecord,
  PrescribedMedicine,
} from "../../lib/types";
import { cleanSymptomText, formatShortIllnessName, getPastAssociatedSymptoms, maskPatientId } from "../../lib/clinicalUtils";

type NurseTab = "queue" | "history";

export default function NursePage() {
  const { baseLanguage } = useKioskLanguage();
  // --- Nurse Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; full_name?: string } | null>(null);

  // --- Main Tabs ---
  const [activeTab, setActiveTab] = useState<NurseTab>("queue");

  // --- Token Queue State ---
  const [tokenQueue, setTokenQueue] = useState<TokenQueueItem[]>([]);
  const [queueFilter, setQueueFilter] = useState<"ALL" | "WAITING" | "IN_CONSULTATION" | "COMPLETED">("ALL");
  const [queueSearch, setQueueSearch] = useState("");

  // --- Patient History Lookup State ---
  const [patientIdInput, setPatientIdInput] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [pastTreatments, setPastTreatments] = useState<TreatmentRecord[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // --- Check Saved Nurse Auth on Load ---
  useEffect(() => {
    const savedToken = sessionStorage.getItem("medikiosk_nurse_token");
    const savedUser = sessionStorage.getItem("medikiosk_nurse_user");
    if (savedToken && savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
        setIsAuthenticated(true);
      } catch {
        sessionStorage.removeItem("medikiosk_nurse_token");
        sessionStorage.removeItem("medikiosk_nurse_user");
      }
    }
    setAuthLoading(false);
  }, []);

  // --- Real-time Token Queue Synchronization ---
  const loadTokenQueue = useCallback(async () => {
    try {
      const q = await api.getTokenQueue();
      setTokenQueue(q);
    } catch (e) {
      console.warn("Nurse queue load error:", e);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    loadTokenQueue();

    let ws: WebSocket | null = null;
    let pollInterval: any = null;

    const startFallbackPolling = (intervalMs = 5000) => {
      if (!pollInterval) {
        pollInterval = setInterval(() => {
          loadTokenQueue();
        }, intervalMs);
      }
    };

    const stopFallbackPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = `${window.location.hostname}:8000`;
      ws = new WebSocket(`${protocol}//${wsHost}/api/ws/tokens`);

      ws.onopen = () => {
        stopFallbackPolling();
      };

      ws.onmessage = () => {
        loadTokenQueue();
      };

      ws.onerror = () => {
        startFallbackPolling();
      };

      ws.onclose = () => {
        startFallbackPolling();
      };
    } catch {
      startFallbackPolling();
    }

    startFallbackPolling();

    return () => {
      if (ws) ws.close();
      stopFallbackPolling();
    };
  }, [isAuthenticated, loadTokenQueue]);

  // --- Nurse Login Handler ---
  async function handleNurseLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError("Please enter both username and password.");
      return;
    }
    try {
      const res = await api.login({ username: usernameInput.trim(), password: passwordInput.trim() });
      if (res.role !== "NURSE" && res.role !== "ADMIN") {
        setAuthError("Access denied. Nurse credentials required.");
        return;
      }
      const userObj = {
        username: res.username || usernameInput.trim(),
        full_name: res.full_name || `Nurse ${usernameInput.trim()}`,
      };
      sessionStorage.setItem("medikiosk_nurse_token", res.access_token);
      sessionStorage.setItem("medikiosk_nurse_user", JSON.stringify(userObj));
      setCurrentUser(userObj);
      setIsAuthenticated(true);
    } catch (err: any) {
      setAuthError(err.message || "Invalid username or password.");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("medikiosk_nurse_token");
    sessionStorage.removeItem("medikiosk_nurse_user");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsernameInput("");
    setPasswordInput("");
  }

  // --- Patient History Lookup Handler ---
  async function handleLookupPatient(idToLookup?: string) {
    const rawId = (idToLookup || patientIdInput).trim();
    if (!rawId) {
      setHistoryError("Please enter a 10-digit Patient ID or scan ID card.");
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    setSelectedPatient(null);
    setPastTreatments([]);

    try {
      const res = await api.lookupPatient(rawId);
      if (!res.found || !res.patient) {
        setHistoryError(`No patient found with ID "${rawId}". Please check the ID number or scan again.`);
        setHistoryLoading(false);
        return;
      }

      setSelectedPatient(res.patient);

      // Fetch full past treatment records
      const treats = await api.getPatientTreatments(res.patient.patient_id || res.patient.id);
      setPastTreatments(treats);
      setPatientIdInput(res.patient.patient_id || rawId);
    } catch (err: any) {
      setHistoryError(err.message || "Failed to retrieve patient medical records.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleScannerDetected(scannedId: string) {
    setIsScannerOpen(false);
    setPatientIdInput(scannedId);
    handleLookupPatient(scannedId);
  }

  // --- Filtered Queue List ---
  const filteredQueue = tokenQueue.filter((tok) => {
    if (queueFilter === "WAITING" && tok.status !== "WAITING") return false;
    if (queueFilter === "IN_CONSULTATION" && tok.status !== "IN_CONSULTATION" && tok.status !== "CALLED") return false;
    if (queueFilter === "COMPLETED" && tok.status !== "COMPLETED") return false;

    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase();
      const numMatch = tok.token_number.toLowerCase().includes(q);
      const nameMatch = (tok.patient_name || "").toLowerCase().includes(q);
      const symMatch = (tok.symptoms_preview || "").toLowerCase().includes(q);
      return numMatch || nameMatch || symMatch;
    }
    return true;
  });

  const waitingCount = tokenQueue.filter((t) => t.status === "WAITING").length;
  const inConsultCount = tokenQueue.filter((t) => t.status === "IN_CONSULTATION" || t.status === "CALLED").length;
  const completedCount = tokenQueue.filter((t) => t.status === "COMPLETED").length;

  if (authLoading) {
    return (
      <div className="text-center py-24 text-slate-400 font-bold">
        Checking Nurse Portal Authentication…
      </div>
    );
  }

  // --- 1. Nurse Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl">
        <div className="w-16 h-16 bg-teal-100 text-teal-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
          👩‍⚕️
        </div>
        <h1 className="text-2xl font-black text-slate-900 text-center mb-1">
          {t("nurse_portal_title", baseLanguage)}
        </h1>
        <p className="text-slate-500 text-xs text-center mb-6">
          {t("nurse_portal_desc", baseLanguage)}
        </p>

        {authError && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 text-xs font-bold p-3 rounded-xl mb-4 text-center">
            ⚠ {authError}
          </div>
        )}

        <form onSubmit={handleNurseLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              {t("login_username", baseLanguage)}
            </label>
            <input
              type="text"
              required
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. nurse"
              className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              {t("login_password", baseLanguage)}
            </label>
            <PasswordInput
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              accentColor="teal"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 active:scale-98 text-white font-black text-sm rounded-xl shadow-lg transition"
          >
            {t("login_btn_nurse", baseLanguage)} →
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Accounts are created and managed by hospital admin.
            <br />
            Demo login: <span className="font-mono font-bold text-slate-600">nurse</span> / <span className="font-mono font-bold text-slate-600">nurse123</span>
          </p>
        </div>
      </div>
    );
  }

  // --- 2. Authenticated Nurse Workspace ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Top Nurse Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Nurse Profile */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center text-lg text-teal-800 font-bold flex-shrink-0 shadow-xs">
            👩‍⚕️
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-900 leading-tight">
              {currentUser?.full_name || currentUser?.username}
            </div>
            <span className="text-[11px] text-teal-700 font-bold uppercase tracking-wider block">
              Nurse Station Desk • Live OPD Monitoring
            </span>
          </div>
        </div>

        {/* Live OPD Stats & Sign Out */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600">
            <span>⏳ Waiting: <strong className="text-amber-600">{waitingCount}</strong></span>
            <span className="text-slate-300">|</span>
            <span>👨‍⚕️ In Consultation: <strong className="text-blue-600">{inConsultCount}</strong></span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="py-1.5 px-3.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 transition flex items-center gap-1"
            title="Sign out of nurse portal"
          >
            Sign Out ⎋
          </button>
        </div>
      </div>

      {/* Main Tabs Switcher */}
      <div className="flex gap-2 bg-slate-200/70 p-1.5 rounded-2xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
            activeTab === "queue"
              ? "bg-white text-slate-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>📋</span>
          <span>Live Token Queue</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800">
            {tokenQueue.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
            activeTab === "history"
              ? "bg-white text-slate-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>📜</span>
          <span>Patient Medical History</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE TOKEN QUEUE (READ-ONLY) */}
      {/* ========================================================================= */}
      {activeTab === "queue" && (
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          {/* Header with Search and Filter Pills */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <h2 className="text-xl font-black text-slate-900">
                  Hospital Patient Queue
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                  Read-Only View
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Live queue of patients who checked in at the kiosk. Auto-refreshes every 3 seconds.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl flex-wrap">
              {(["ALL", "WAITING", "IN_CONSULTATION", "COMPLETED"] as const).map((filterVal) => {
                let label = "All";
                let count = tokenQueue.length;
                if (filterVal === "WAITING") {
                  label = "Waiting";
                  count = waitingCount;
                } else if (filterVal === "IN_CONSULTATION") {
                  label = "In Consultation";
                  count = inConsultCount;
                } else if (filterVal === "COMPLETED") {
                  label = "Completed";
                  count = completedCount;
                }

                return (
                  <button
                    key={filterVal}
                    type="button"
                    onClick={() => setQueueFilter(filterVal)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      queueFilter === filterVal
                        ? "bg-white text-teal-950 shadow-xs border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 font-black">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              placeholder="Search by token number, patient name, or symptoms..."
              className="w-full max-w-md p-3 bg-slate-50 border-2 border-slate-200 focus:border-teal-600 rounded-xl text-xs font-semibold text-slate-800 outline-none"
            />
          </div>

          {/* Queue Grid (Identical to Doctor Queue Cards, Read-Only) */}
          {filteredQueue.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <div className="text-3xl mb-2">🌿</div>
              <p className="text-sm font-bold text-slate-700">No patients found in this filter</p>
              <p className="text-xs text-slate-400 mt-1">
                Patients who check in at kiosk or wait for doctor will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQueue.map((tok) => {
                const isWaiting = tok.status === "WAITING";
                const isInConsult = tok.status === "IN_CONSULTATION" || tok.status === "CALLED";
                const isCompleted = tok.status === "COMPLETED";

                return (
                  <div
                    key={tok.id}
                    className={`bg-white border-2 rounded-2xl p-5 transition shadow-xs flex flex-col justify-between ${
                      isInConsult
                        ? "border-blue-400 bg-blue-50/15"
                        : isCompleted
                        ? "border-slate-200 opacity-75 bg-slate-50/50"
                        : "border-slate-200 hover:border-teal-400"
                    }`}
                  >
                    <div>
                      {/* Header: Token # & Priority Pill */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-2xl font-black font-mono tracking-wide text-slate-900 bg-slate-100 border border-slate-300 px-3 py-1 rounded-xl shadow-inner">
                          {tok.token_number}
                        </span>
                        {tok.triage_priority && (
                          <PriorityPill priority={tok.triage_priority as any} />
                        )}
                      </div>

                      {/* Patient Name & Age/Gender */}
                      <div className="mb-3">
                        <h3 className="text-base font-extrabold text-slate-900">
                          {tok.patient_name || "Patient"}
                        </h3>
                        <div className="text-xs text-slate-500 font-semibold mt-0.5">
                          {tok.patient_age ? `${tok.patient_age} yrs` : ""}
                          {tok.patient_gender ? ` • ${tok.patient_gender}` : ""}
                          {tok.department ? ` • ${tok.department}` : ""}
                        </div>
                      </div>

                      {/* Symptoms Preview */}
                      {tok.symptoms_preview && (
                        <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-3 text-slate-700">
                          <span className="font-bold text-slate-500 block text-[10px] uppercase">
                            Symptoms Preview:
                          </span>
                          <span className="font-medium">{tok.symptoms_preview}</span>
                        </div>
                      )}
                    </div>

                    {/* Status Display Footer (Strictly Read-Only as requested) */}
                    <div className="pt-3 border-t border-slate-200/80 mt-2">
                      {isWaiting && (
                        <div className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="animate-pulse">⏳</span>
                            <span>Waiting for Doctor Call</span>
                          </span>
                          <span className="font-mono text-[10px] text-amber-700">In OPD Queue</span>
                        </div>
                      )}

                      {isInConsult && (
                        <div className="text-xs py-2 px-3 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <span>👨‍⚕️</span>
                              <span>In Consultation</span>
                            </span>
                            <span className="font-mono text-[11px] bg-blue-600 text-white px-2 py-0.2 rounded font-black">
                              {tok.room_number || "Room A"}
                            </span>
                          </div>
                          {tok.doctor_name && (
                            <div className="text-[11px] text-blue-700 font-medium">
                              Doctor: {tok.doctor_name}
                            </div>
                          )}
                        </div>
                      )}

                      {isCompleted && (
                        <div className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold">
                          <span className="flex items-center gap-1.5">
                            <span>✓</span>
                            <span>Consultation Completed</span>
                          </span>
                          <span className="text-[10px] text-emerald-700">Done</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PATIENT MEDICAL HISTORY (SCAN ID OR ENTER ID NUMBER) */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Lookup Card: ID Input + Scan ID Button */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="max-w-2xl">
              <span className="text-xs font-mono uppercase tracking-wider text-teal-700 font-bold block mb-1">
                PATIENT VERIFICATION & HISTORY
              </span>
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Look Up Patient Past Medical History
              </h2>
              <p className="text-slate-600 text-xs md:text-sm leading-relaxed mb-6">
                When a patient approaches the nurse desk, scan their ID card barcode/QR or enter their 10-digit Patient ID to inspect past illnesses, prescribed medicines, and doctor clinical notes.
              </p>

              {/* ID Input Form + Scan ID Button */}
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={patientIdInput}
                    onChange={(e) => setPatientIdInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLookupPatient();
                    }}
                    placeholder="Enter 10-digit Patient ID (e.g. 1000000001)..."
                    className="w-full p-3.5 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none pr-10"
                  />
                  {patientIdInput && (
                    <button
                      type="button"
                      onClick={() => setPatientIdInput("")}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 text-sm font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={historyLoading}
                  onClick={() => handleLookupPatient()}
                  className="py-3.5 px-6 bg-teal-700 hover:bg-teal-800 active:scale-98 text-white rounded-xl font-bold text-sm shadow transition flex items-center justify-center gap-2 flex-shrink-0"
                >
                  <span>🔍</span>
                  <span>{historyLoading ? "Searching..." : "Search History"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="py-3.5 px-6 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow transition flex items-center justify-center gap-2 flex-shrink-0"
                  title="Scan Patient Barcode or QR using Camera"
                >
                  <span>📷</span>
                  <span>Scan ID Card</span>
                </button>
              </div>

              {/* Quick Demo Shortcuts */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400">Quick Test ID:</span>
                <button
                  type="button"
                  onClick={() => {
                    setPatientIdInput("1000000001");
                    handleLookupPatient("1000000001");
                  }}
                  className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 border border-slate-200 transition"
                >
                  1000000001 (Rahul Kumar)
                </button>
              </div>

              {historyError && (
                <div className="mt-4 bg-red-50 border-2 border-red-300 text-red-700 text-xs font-bold p-3.5 rounded-xl">
                  ⚠ {historyError}
                </div>
              )}
            </div>
          </div>

          {/* Camera Scanner Viewfinder Modal */}
          {isScannerOpen && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>📷</span>
                    <span>Scan Patient ID Card</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                <KioskScanner
                  lang="en"
                  onDetected={handleScannerDetected}
                  onCancel={() => setIsScannerOpen(false)}
                  onSwitchToManual={() => setIsScannerOpen(false)}
                />
              </div>
            </div>
          )}

          {/* Patient Details & Past Medicinal History Record */}
          {selectedPatient && (
            <div className="space-y-6 animate-fade-in">
              {/* Patient Banner */}
              <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-teal-700/40">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-teal-600/30 border border-teal-400/40 text-teal-300 flex items-center justify-center text-3xl font-black flex-shrink-0">
                      👤
                    </div>
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider text-teal-300 font-bold">
                        VERIFIED PATIENT RECORD
                      </div>
                      <h3 className="text-2xl md:text-3xl font-black text-white">
                        {selectedPatient.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-teal-100/90 font-medium mt-1 flex-wrap">
                        <span className="font-mono bg-teal-800/60 px-2 py-0.5 rounded border border-teal-600/40" title={selectedPatient.patient_id || selectedPatient.id}>
                          ID: {maskPatientId(selectedPatient.patient_id || selectedPatient.id)}
                        </span>
                        {selectedPatient.age && <span>Age: {selectedPatient.age} yrs</span>}
                        {selectedPatient.gender && <span>Gender: {selectedPatient.gender}</span>}
                        {selectedPatient.phone && <span>Phone: {selectedPatient.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-auto">
                    <div className="text-right">
                      <span className="text-[10px] text-teal-300 uppercase font-black block">Total Records</span>
                      <span className="text-2xl font-black font-mono">{pastTreatments.length} Visits</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Past Medicinal History Cards (Matching Doctor Station View) */}
              <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center text-xl font-black">
                      📜
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900">
                        Past Medicinal History & Prescriptions
                      </h4>
                      <p className="text-xs text-slate-500">
                        Complete historical consultation records, doctor advice, and prescribed medications.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono px-3 py-1 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
                    {pastTreatments.length} Record(s)
                  </span>
                </div>

                {pastTreatments.length === 0 ? (
                  <div className="text-center py-12 px-6 bg-slate-50/50 border border-dashed border-slate-300 rounded-2xl">
                    <div className="text-3xl mb-2">📜</div>
                    <div className="text-sm font-bold text-slate-700 mb-1">
                      No Past Medical Records
                    </div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      This is the first recorded hospital consultation for this patient. Future visits will show complete historical records here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {pastTreatments.map((rec, idx) => {
                      const shortIllness = formatShortIllnessName(rec);
                      const assocSymptoms = getPastAssociatedSymptoms(rec);
                      const isFollowUp = !!(rec.is_followup || (rec.illness_name && rec.illness_name.toLowerCase().includes("follow")));
                      const rawPrimary = rec.primary_reason || (rec.symptoms ? rec.symptoms.split(",")[0].trim() : rec.illness_name);
                      const primaryReason = cleanSymptomText(rawPrimary);
                      const hasMedicines = !!(rec.prescribed_medicines && rec.prescribed_medicines.length > 0);
                      const hasTreatmentText = !!(rec.treatment && rec.treatment !== "OPD Consultation" && rec.treatment !== "Prescribed Treatment & Medical Advice");

                      return (
                        <div
                          key={rec.id || idx}
                          className={`bg-white border-2 rounded-2xl p-5 shadow-xs space-y-4 transition ${
                            isFollowUp
                              ? "border-purple-300 hover:border-purple-500 bg-purple-50/15"
                              : "border-slate-200 hover:border-teal-400"
                          }`}
                        >
                          {/* 1. Header: Past illness with Follow-up and Primary Reason */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span
                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 shadow-xs ${
                                  isFollowUp
                                    ? "bg-purple-100 border border-purple-200 text-purple-800"
                                    : "bg-teal-50 border border-teal-200 text-teal-700"
                                }`}
                              >
                                🩺
                              </span>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-base font-black text-slate-900 leading-tight">
                                    {shortIllness}
                                  </h5>
                                  {isFollowUp && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 shadow-2xs">
                                      <span>🔄</span>
                                      <span>Follow-up</span>
                                    </span>
                                  )}
                                  {isFollowUp && primaryReason && primaryReason !== "None reported" && (
                                    <span className="text-xs font-bold text-purple-950 bg-purple-100/80 border border-purple-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                                      <span className="text-purple-600 font-semibold">Primary Reason:</span>
                                      <span>{primaryReason}</span>
                                    </span>
                                  )}
                                </div>
                                {rec.doctor_name && (
                                  <span className="text-[11px] text-teal-800 font-bold block mt-0.5">
                                    👨‍⚕️ Prescribed by {rec.doctor_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold font-mono px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl self-start sm:self-auto">
                              📅 {rec.visit_date || "Past Visit"}
                            </span>
                          </div>

                          {/* 2. Subsection: Associated Symptoms */}
                          {assocSymptoms && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                                Associated Symptoms:
                              </span>
                              <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                {assocSymptoms}
                              </span>
                            </div>
                          )}

                          {/* 3. Prescribed Medicines Table */}
                          {hasMedicines ? (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                  <span>💊</span> Prescribed Medicines
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 font-mono">
                                  {rec.prescribed_medicines?.length} item(s)
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                      <th className="py-2 px-3">#</th>
                                      <th className="py-2 px-3">Medicine Name</th>
                                      <th className="py-2 px-3">Dosage</th>
                                      <th className="py-2 px-3">Frequency</th>
                                      <th className="py-2 px-3">Duration</th>
                                      <th className="py-2 px-3">Instructions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                    {rec.prescribed_medicines?.map((med: PrescribedMedicine, mIdx: number) => (
                                      <tr key={mIdx} className="hover:bg-slate-50/70">
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                                          {mIdx + 1}
                                        </td>
                                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                                          {med.name}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold text-[11px]">
                                            {med.dosage || "As advised"}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold text-[11px]">
                                            {med.frequency || "1-0-1"}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-slate-600">
                                          {med.duration || "—"}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">
                                          {med.instructions || "After meals"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                              No digital medicines prescribed during this consultation.
                            </div>
                          )}

                          {/* 4. Doctor Review Notes, Dietary Advice, Follow-up Advice */}
                          {(rec.doctor_notes || hasTreatmentText) && (
                            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                <span>📝</span> Doctor Notes & Advice:
                              </span>
                              <p className="font-semibold leading-relaxed">
                                {rec.doctor_notes || rec.treatment}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

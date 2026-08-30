"use client";
import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import {
  PriorityPill,
  VerificationBadge,
} from "../../components/ClinicalComponents";
import type { Summary, Patient, TokenQueueItem, TokenItem } from "../../lib/types";

const TABS = ["summary", "documents"] as const;
type Tab = (typeof TABS)[number];

export default function DoctorPage() {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; full_name?: string } | null>(null);
  const [assignedRoom, setAssignedRoom] = useState<string>("Room 1");

  // --- Clinical Workspace State ---
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [priority, setPriority] = useState("ROUTINE");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Token Management State ---
  const [tokenQueue, setTokenQueue] = useState<TokenQueueItem[]>([]);
  const [activeToken, setActiveToken] = useState<TokenItem | null>(null);
  const [tokenActionLoading, setTokenActionLoading] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    // Check existing session
    const savedToken = sessionStorage.getItem("medikiosk_doctor_token");
    const savedUser = sessionStorage.getItem("medikiosk_doctor_user");
    const savedRoom = sessionStorage.getItem("medikiosk_doctor_room");
    if (savedRoom) setAssignedRoom(savedRoom);

    if (savedToken && savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
        setIsAuthenticated(true);
        if (userObj.username === "doctor2" || (userObj.full_name && userObj.full_name.includes("Priya"))) {
          setAssignedRoom("Room 2");
        }
        loadDoctorDashboard(userObj);
      } catch {
        sessionStorage.removeItem("medikiosk_doctor_token");
        sessionStorage.removeItem("medikiosk_doctor_user");
      }
    }
    setAuthLoading(false);
  }, []);

  const loadTokenQueue = useCallback(async (currentDoctorName?: string) => {
    try {
      const q = await api.getTokenQueue("ALL");
      setTokenQueue(q);

      // Check if current doctor has an active called / in-consultation token
      const docName = currentDoctorName || currentUser?.full_name || currentUser?.username || "Dr. Rahul";
      const activeForDoc = q.find(
        (t) => (t.status === "CALLED" || t.status === "IN_CONSULTATION") &&
               (t.doctor_name === docName || (currentUser?.username && t.doctor_id === currentUser.username))
      );
      if (activeForDoc) {
        setActiveToken(activeForDoc);
      } else {
        setActiveToken(null);
      }
    } catch (e) {
      console.warn("Queue load error:", e);
    }
  }, [currentUser]);

  // Real-time synchronization for doctor queue
  useEffect(() => {
    if (!isAuthenticated) return;

    loadTokenQueue();

    let ws: WebSocket | null = null;
    let pollInterval: any = null;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
      ws = new WebSocket(`${protocol}//${host}/api/ws/tokens`);

      ws.onmessage = () => {
        loadTokenQueue();
      };
    } catch {
      // WS failover to polling
    }

    pollInterval = setInterval(() => {
      loadTokenQueue();
    }, 3000);

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isAuthenticated, loadTokenQueue]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError("Please enter both username and password.");
      return;
    }
    try {
      const res = await api.login({ username: usernameInput.trim(), password: passwordInput.trim() });
      if (res.role !== "DOCTOR" && res.role !== "ADMIN") {
        setAuthError("Access denied. Doctor credentials required.");
        return;
      }
      const userObj = { username: res.username || usernameInput.trim(), full_name: res.full_name || usernameInput.trim() };
      const room = (userObj.username === "doctor2" || (userObj.full_name && userObj.full_name.includes("Priya"))) ? "Room 2" : "Room 1";
      
      sessionStorage.setItem("medikiosk_doctor_token", res.access_token);
      sessionStorage.setItem("medikiosk_doctor_user", JSON.stringify(userObj));
      sessionStorage.setItem("medikiosk_doctor_room", room);
      
      setAssignedRoom(room);
      setCurrentUser(userObj);
      setIsAuthenticated(true);
      await loadDoctorDashboard(userObj);
    } catch (err: any) {
      setAuthError("Invalid doctor username or password. Please check with your administrator.");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("medikiosk_doctor_token");
    sessionStorage.removeItem("medikiosk_doctor_user");
    sessionStorage.removeItem("medikiosk_doctor_room");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsernameInput("");
    setPasswordInput("");
    setActiveToken(null);
    setTokenQueue([]);
  }

  async function loadDoctorDashboard(userContext?: { username: string; full_name?: string }) {
    setLoading(true);
    try {
      const [pList] = await Promise.all([
        api.listPatients(),
        loadTokenQueue(userContext?.full_name),
      ]);
      setPatients(pList);
      if (pList.length > 0) {
        await selectPatient(pList[0].id, pList);
      }
    } catch (err) {
      console.error("Failed to load doctor dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEncounterData(encId: string) {
    try {
      const [triage, docs] = await Promise.all([
        api.getTriageStatus(encId) as Promise<any>,
        api.listDocuments(encId) as Promise<any[]>,
      ]);
      setPriority(triage.priority || "ROUTINE");
      setDocuments(docs);
      try {
        const s = await api.getSummary(encId);
        setSummary(s);
      } catch {
        setSummary(null);
      }
    } catch (e) {
      console.warn("Error loading encounter:", e);
    }
  }

  async function selectPatient(pId: string, listOverride?: Patient[]) {
    setSelectedPatientId(pId);
    const sourceList = listOverride || patients;
    const p = sourceList.find((x) => x.id === pId || x.patient_id === pId);
    if (!p) return;
    setPatient(p);
    try {
      const encounters = await api.listPatientEncounters(p.id);
      if (encounters.length > 0) {
        setEncounterId(encounters[0].id);
        await loadEncounterData(encounters[0].id);
      } else {
        setEncounterId(null);
        setDocuments([]);
        setSummary(null);
      }
    } catch (e) {
      console.warn("Error loading encounters:", e);
    }
  }

  // --- Token Actions ---
  async function handleCallToken(tokenItem: TokenQueueItem) {
    setTokenActionLoading(tokenItem.id);
    setStatusNotice(null);
    try {
      const doctorName = currentUser?.full_name || currentUser?.username || "Dr. Rahul";
      const updated = await api.callToken(tokenItem.id, {
        doctor_id: currentUser?.username,
        doctor_name: doctorName,
        room_number: assignedRoom,
      });
      setActiveToken(updated);
      await loadTokenQueue();
      await selectPatient(tokenItem.patient_id);
      setStatusNotice(`Called Token ${tokenItem.token_number} (${tokenItem.patient_name}) to ${assignedRoom}`);
    } catch (err: any) {
      alert(err.message || "Failed to call patient token.");
    } finally {
      setTokenActionLoading(null);
    }
  }

  async function handleRecallToken() {
    if (!activeToken) return;
    setTokenActionLoading("recall");
    try {
      await api.recallToken(activeToken.id);
      setStatusNotice(`Token ${activeToken.token_number} re-announced on waiting room display.`);
    } catch (err: any) {
      alert("Failed to recall token: " + err.message);
    } finally {
      setTokenActionLoading(null);
    }
  }

  async function handleStartConsultation() {
    if (!activeToken) return;
    setTokenActionLoading("start");
    try {
      const updated = await api.startConsultation(activeToken.id);
      setActiveToken(updated);
      await loadTokenQueue();
      setStatusNotice(`Consultation started for Token ${activeToken.token_number}.`);
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    } finally {
      setTokenActionLoading(null);
    }
  }

  async function handleCompleteConsultation() {
    if (!activeToken) return;
    setTokenActionLoading("complete");
    try {
      await api.completeToken(activeToken.id);
      setStatusNotice(`Consultation completed for Token ${activeToken.token_number}. Display updated.`);
      setActiveToken(null);
      await loadTokenQueue();
    } catch (err: any) {
      alert("Failed to complete token: " + err.message);
    } finally {
      setTokenActionLoading(null);
    }
  }

  async function handleGenerateSummary() {
    if (!encounterId) return;
    const s = await api.generateSummary(encounterId);
    setSummary(s);
  }

  async function handleConfirmSummary() {
    if (!summary) return;
    const s = await api.confirmSummary(summary.id);
    setSummary(s);
  }

  async function handleRejectSummary() {
    if (!summary) return;
    const s = await api.rejectSummary(summary.id);
    setSummary(s);
  }

  if (authLoading) {
    return <div className="text-center py-20 text-slate-400 font-bold">Loading Doctor Workspace…</div>;
  }

  // --- Doctor Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl">
        <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
          👨‍⚕️
        </div>
        <h1 className="text-2xl font-black text-slate-900 text-center mb-1">
          Doctor Station Login
        </h1>
        <p className="text-slate-500 text-xs text-center mb-6">
          Sign in with your hospital-assigned physician credentials.
        </p>

        {authError && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 text-xs font-bold p-3 rounded-xl mb-4 text-center">
            ⚠ {authError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Username / Doctor ID
            </label>
            <input
              type="text"
              required
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. doctor (Dr. Rahul) or doctor2 (Dr. Priya)"
              className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 active:scale-98 text-white font-black text-base rounded-xl shadow-lg transition"
          >
            Sign In to Consultation Portal →
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            Demo Logins: <span className="font-mono font-bold text-slate-700">doctor / doctor123</span> (Dr. Rahul) or <span className="font-mono font-bold text-slate-700">doctor2 / doctor123</span> (Dr. Priya)
          </p>
        </div>
      </div>
    );
  }

  const waitingPatients = tokenQueue.filter((t) => t.status === "WAITING");
  const doctorDisplayName = currentUser?.full_name || currentUser?.username || "Dr. Rahul";

  // --- Authenticated Doctor Workspace ---
  return (
    <div className="space-y-6">
      {/* Top Doctor Bar: Doctor Name, Assigned Room, and Sign Out */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex items-center justify-between gap-4">
        {/* Doctor Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-base text-blue-700 font-bold flex-shrink-0">
            👨‍⚕️
          </div>
          <div className="text-base font-extrabold text-slate-900 tracking-tight">
            {doctorDisplayName}
          </div>
        </div>

        {/* Assigned Room & Sign Out */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Assigned Room:
            </span>
            <select
              value={assignedRoom}
              onChange={(e) => {
                setAssignedRoom(e.target.value);
                sessionStorage.setItem("medikiosk_doctor_room", e.target.value);
              }}
              className="bg-transparent text-xs font-black text-blue-700 outline-none cursor-pointer"
            >
              <option value="Room 1">Room 1</option>
              <option value="Room 2">Room 2</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="py-1.5 px-3.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 transition flex items-center gap-1"
            title="Sign out of doctor portal"
          >
            Sign Out ⎋
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {statusNotice && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 p-4 rounded-2xl text-sm font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">📢</span>
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-black"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. UPCOMING PATIENTS & TOKEN QUEUE SECTION */}
      {/* ========================================================================= */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-black">
              📋
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Upcoming Patients Queue
              </h2>
              <p className="text-xs text-slate-500">
                Patients who completed intake kiosk and are waiting for consultation call.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-mono font-bold">
              {waitingPatients.length} Waiting
            </span>
            <button
              type="button"
              onClick={() => loadTokenQueue()}
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
            >
              ↻ Refresh Queue
            </button>
          </div>
        </div>

        {/* Queue Cards Grid */}
        {tokenQueue.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm font-bold text-slate-700">No patients waiting in queue</p>
            <p className="text-xs text-slate-400 mt-1">New kiosk intake submissions will appear here automatically in real-time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokenQueue.map((tok) => {
              const isWaiting = tok.status === "WAITING";
              const isCalledByMe = (tok.status === "CALLED" || tok.status === "IN_CONSULTATION") &&
                (tok.doctor_name === doctorDisplayName || (currentUser?.username && tok.doctor_id === currentUser.username));
              const isCalledByOther = (tok.status === "CALLED" || tok.status === "IN_CONSULTATION") && !isCalledByMe;

              return (
                <div
                  key={tok.id}
                  className={`rounded-2xl p-5 border-2 transition shadow-sm flex flex-col justify-between ${
                    isCalledByMe
                      ? "bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-400/30"
                      : isCalledByOther
                      ? "bg-slate-100/80 border-slate-300 opacity-75"
                      : "bg-white border-slate-200 hover:border-blue-400"
                  }`}
                >
                  <div>
                    {/* Token & Priority Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-2xl font-black font-mono tracking-wide text-slate-900 bg-slate-100 border border-slate-300 px-3 py-1 rounded-xl shadow-inner">
                        {tok.token_number}
                      </span>
                      {tok.triage_priority && <PriorityPill priority={tok.triage_priority as any} />}
                    </div>

                    {/* Patient Name & Details */}
                    <div className="mb-3">
                      <h3 className="text-base font-extrabold text-slate-900">
                        {tok.patient_name || "Patient"}
                      </h3>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">
                        {tok.patient_age ? `${tok.patient_age} yrs` : ""} {tok.patient_gender ? `• ${tok.patient_gender}` : ""}
                        {tok.patient_identifier ? ` • ID: ${tok.patient_identifier}` : ""}
                      </div>
                    </div>

                    {/* Chief Complaint / Symptoms Preview */}
                    {tok.symptoms_preview && (
                      <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-3 text-slate-700">
                        <span className="font-bold text-slate-500 block text-[10px] uppercase">Symptoms Preview:</span>
                        <span className="font-medium">{tok.symptoms_preview}</span>
                      </div>
                    )}
                  </div>

                  {/* Status & Call Action */}
                  <div className="pt-3 border-t border-slate-200/80 mt-2">
                    {isWaiting ? (
                      <button
                        type="button"
                        disabled={tokenActionLoading === tok.id}
                        onClick={() => handleCallToken(tok)}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                      >
                        <span>📢</span>
                        <span>{tokenActionLoading === tok.id ? "Calling…" : "Call Patient to Room"}</span>
                      </button>
                    ) : isCalledByMe ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg">
                          ✓ {tok.status === "CALLED" ? "Called (Waiting Entrance)" : "In Consultation"}
                        </span>
                        <button
                          type="button"
                          onClick={() => selectPatient(tok.patient_id)}
                          className="text-xs font-bold text-blue-800 hover:underline"
                        >
                          View Record →
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-500 bg-slate-200 px-2.5 py-1.5 rounded-lg text-center font-mono">
                        🔒 Called by {tok.doctor_name || "Other Doctor"} ({tok.room_number || "Room"})
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. ACTIVE CONSULTATION CONTROL BANNER */}
      {/* ========================================================================= */}
      {activeToken && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-3 border-blue-400">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-white text-blue-950 flex flex-col items-center justify-center font-mono shadow-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TOKEN</span>
                <span className="text-3xl font-black">{activeToken.token_number}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-extrabold uppercase bg-blue-500/30 text-blue-200 px-3 py-0.5 rounded-full border border-blue-400/30">
                    ACTIVE IN {assignedRoom}
                  </span>
                  <span className="text-xs text-blue-300 font-semibold font-mono">
                    Status: {activeToken.status}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">
                  {patient ? patient.name : "Active Patient"}
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  Age: {patient?.age} • Gender: {patient?.gender} • Dept: {activeToken.department || "General Medicine"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
              <button
                type="button"
                disabled={tokenActionLoading === "recall"}
                onClick={handleRecallToken}
                className="py-3 px-4 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-black shadow transition flex items-center gap-1.5 border border-blue-400/50"
                title="Play chime on Waiting Room TV screen again"
              >
                <span>🔔</span>
                <span>{tokenActionLoading === "recall" ? "Calling…" : "Recall (Chime TV)"}</span>
              </button>

              {activeToken.status === "CALLED" && (
                <button
                  type="button"
                  disabled={tokenActionLoading === "start"}
                  onClick={handleStartConsultation}
                  className="py-3 px-5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-black shadow-lg transition flex items-center gap-1.5"
                >
                  <span>▶</span>
                  <span>{tokenActionLoading === "start" ? "Starting…" : "Start Consultation"}</span>
                </button>
              )}

              <button
                type="button"
                disabled={tokenActionLoading === "complete"}
                onClick={handleCompleteConsultation}
                className="py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-1.5"
              >
                <span>✓</span>
                <span>{tokenActionLoading === "complete" ? "Completing…" : "Complete Consultation"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CLINICAL SUMMARY & DOCUMENT INSPECTION WORKSPACE */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        {/* Patient Switcher & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-6">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold block mb-1">
              Clinical Record
            </span>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900">
                {patient ? patient.name : "Select Patient"}
              </h2>
              {patient && (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-mono">
                  ID: {patient.patient_id || patient.id.slice(0, 8)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Patient:
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => selectPatient(e.target.value)}
              className="p-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 w-full sm:w-64"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.patient_id || p.id.slice(0, 6)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 font-bold">Refreshing consultation record…</div>
        ) : !encounterId ? (
          <div className="border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center bg-slate-50">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Intake Encounter Found</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              This patient has not completed their kiosk intake session yet. The consultation data will automatically appear here once submitted.
            </p>
          </div>
        ) : (
          <>
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <StatCard
                label="Clinical Summary"
                value={summary?.status === "PHYSICIAN_VERIFIED" ? "Verified" : summary ? "Draft Ready" : "Pending Generation"}
                sub={summary?.facts_needing_verification != null ? `${summary.facts_needing_verification} fact(s) to verify` : "Intake completed"}
              />
              <StatCard
                label="Documents"
                value={`${documents.length}`}
                sub={`${documents.filter((d) => d.status === "processed").length} processed`}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200 mb-6 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-3 text-sm font-bold capitalize transition border-b-2 ${
                    tab === t
                      ? "text-blue-700 border-blue-700 font-extrabold"
                      : "text-slate-400 border-transparent hover:text-slate-600"
                  }`}
                >
                  {t === "summary" ? "Summary" : "Documents"}
                  {t === "documents" && documents.length ? ` (${documents.length})` : ""}
                </button>
              ))}
            </div>

            {/* Tab: Summary */}
            {tab === "summary" && (
              <div className="space-y-4">
                {!summary ? (
                  <button
                    onClick={handleGenerateSummary}
                    className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow transition"
                  >
                    Generate AI Summary Draft
                  </button>
                ) : (
                  <div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                      <div className="font-bold text-amber-800 text-xs mb-1">
                        AI-GENERATED CLINICAL DRAFT
                      </div>
                      <div className="text-xs text-amber-900">
                        Sources: {summary.sources?.join(", ") || "Patient Kiosk Interview"} • Needs verification: {summary.facts_needing_verification} fact(s)
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm border border-slate-200 rounded-2xl p-5 mb-4 font-mono bg-slate-50 text-slate-900 leading-relaxed">
                      {summary.text}
                    </pre>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={handleConfirmSummary}
                        className="py-3 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow transition"
                      >
                        ✓ Confirm Summary (Verify)
                      </button>
                      <button
                        onClick={handleRejectSummary}
                        className="py-3 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow transition"
                      >
                        ✕ Reject
                      </button>
                      <button
                        onClick={handleGenerateSummary}
                        className="py-3 px-5 border-2 border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-bold transition"
                      >
                        ↻ Regenerate
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-3">
                      Status: <b>{summary.status === "PHYSICIAN_VERIFIED" ? "PHYSICIAN VERIFIED" : "PHYSICIAN REVIEW REQUIRED"}</b>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Documents */}
            {tab === "documents" && (
              <div className="space-y-3">
                {documents.map((d: any) => (
                  <div key={d.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-slate-900">{d.filename}</span>
                      <VerificationBadge status={d.status.toUpperCase()} />
                    </div>
                    {d.ocr_text && (
                      <pre className="text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-700 font-mono overflow-auto">
                        {d.ocr_text}
                      </pre>
                    )}
                  </div>
                ))}
                {!documents.length && (
                  <p className="text-slate-400 text-sm">No previous documents uploaded.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="text-xs font-mono uppercase tracking-wider text-blue-700 font-bold mb-1">
        {label}
      </div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

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

// Crisp audio chime feedback for doctor station
function playDoctorChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {
    console.warn("Audio chime error:", e);
  }
}

export default function DoctorPage() {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; full_name?: string } | null>(null);
  const [assignedRoom, setAssignedRoom] = useState<string>("Room A");
  const [allRooms, setAllRooms] = useState<string[]>(["Room A", "Room B"]);
  const [occupiedRooms, setOccupiedRooms] = useState<Record<string, string>>({});

  // --- Clinical Workspace State (Fresh on every login/session) ---
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

  const doctorDisplayName = currentUser?.full_name || currentUser?.username || "";

  // Check existing session
  useEffect(() => {
    const savedToken = sessionStorage.getItem("medikiosk_doctor_token");
    const savedUser = sessionStorage.getItem("medikiosk_doctor_user");
    const savedRoom = sessionStorage.getItem("medikiosk_doctor_room");

    if (savedToken && savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
        setIsAuthenticated(true);
        if (savedRoom) {
          setAssignedRoom(savedRoom);
        }
        loadDoctorDashboard(userObj);
      } catch {
        sessionStorage.removeItem("medikiosk_doctor_token");
        sessionStorage.removeItem("medikiosk_doctor_user");
        sessionStorage.removeItem("medikiosk_doctor_room");
      }
    }
    setAuthLoading(false);
  }, []);

  // Release room when tab/browser closes or user navigates away
  useEffect(() => {
    if (!isAuthenticated || !doctorDisplayName) return;

    const releasePresence = () => {
      const url = `/api/tokens/rooms/release`;
      const payload = JSON.stringify({ doctor_name: doctorDisplayName });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: "POST",
          body: payload,
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", releasePresence);
    window.addEventListener("pagehide", releasePresence);
    return () => {
      window.removeEventListener("beforeunload", releasePresence);
      window.removeEventListener("pagehide", releasePresence);
    };
  }, [isAuthenticated, doctorDisplayName]);

  // Load token queue & active room occupancy
  const loadTokenQueue = useCallback(async (currentDoctorName?: string) => {
    try {
      const [q, roomInfo] = await Promise.all([
        api.getTokenQueue("ALL"),
        api.getRoomAvailability(),
      ]);
      setTokenQueue(q);

      const docName = currentDoctorName || currentUser?.full_name || currentUser?.username || "";
      const occupied = roomInfo.occupied || {};
      const roomList = roomInfo.all_rooms || ["Room A", "Room B"];
      setAllRooms(roomList);
      setOccupiedRooms(occupied);

      // Auto-switch room if current room is occupied by another doctor
      setAssignedRoom((prevRoom) => {
        if (occupied[prevRoom] && occupied[prevRoom] !== docName) {
          const firstAvailable = roomList.find((r) => !occupied[r] || occupied[r] === docName) || roomList[0] || "Room A";
          sessionStorage.setItem("medikiosk_doctor_room", firstAvailable);
          if (docName) {
            api.claimRoom(docName, firstAvailable).catch(() => {});
          }
          return firstAvailable;
        }
        return prevRoom;
      });

      // Check if current doctor has an active called / in-consultation token
      if (docName) {
        const activeForDoc = q.find(
          (t) => (t.status === "CALLED" || t.status === "IN_CONSULTATION") &&
                 (t.doctor_name === docName || (currentUser?.username && t.doctor_id === currentUser.username))
        );
        if (activeForDoc) {
          setActiveToken(activeForDoc);
        } else {
          setActiveToken(null);
        }
      }
    } catch (e) {
      console.warn("Queue load error:", e);
    }
  }, [currentUser]);

  // Real-time synchronization for doctor queue & rooms
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
      const docName = userObj.full_name || userObj.username;

      // Find first available room dynamically (no hardcoded pre-assignment)
      const roomInfo = await api.getRoomAvailability();
      const occupied = roomInfo.occupied || {};
      const roomList = roomInfo.all_rooms || ["Room A", "Room B"];
      setAllRooms(roomList);
      const available = roomList.filter((r) => !occupied[r] || occupied[r] === docName);
      const chosenRoom = available.length > 0 ? available[0] : roomList[0] || "Room A";

      sessionStorage.setItem("medikiosk_doctor_token", res.access_token);
      sessionStorage.setItem("medikiosk_doctor_user", JSON.stringify(userObj));
      sessionStorage.setItem("medikiosk_doctor_room", chosenRoom);

      setAssignedRoom(chosenRoom);
      setCurrentUser(userObj);
      setIsAuthenticated(true);

      // Claim the room
      await api.claimRoom(docName, chosenRoom).catch(() => {});
      await loadDoctorDashboard(userObj);
    } catch (err: any) {
      setAuthError(err.message || "Invalid doctor credentials.");
    }
  }

  async function handleRoomChange(newRoom: string) {
    setAssignedRoom(newRoom);
    sessionStorage.setItem("medikiosk_doctor_room", newRoom);
    if (doctorDisplayName) {
      await api.claimRoom(doctorDisplayName, newRoom).catch(() => {});
      await loadTokenQueue();
    }
  }

  async function handleLogout() {
    if (doctorDisplayName) {
      api.releaseRoom(doctorDisplayName).catch(() => {});
    }
    sessionStorage.removeItem("medikiosk_doctor_token");
    sessionStorage.removeItem("medikiosk_doctor_user");
    sessionStorage.removeItem("medikiosk_doctor_room");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsernameInput("");
    setPasswordInput("");
    setActiveToken(null);
    setTokenQueue([]);
    // Fresh workspace purge
    setPatient(null);
    setEncounterId(null);
    setSummary(null);
    setDocuments([]);
  }

  async function loadDoctorDashboard(userContext?: { username: string; full_name?: string }) {
    setLoading(true);
    try {
      // Start with clean, fresh workspace (no past patient retained)
      setPatient(null);
      setEncounterId(null);
      setSummary(null);
      setDocuments([]);
      setActiveToken(null);

      const [pList] = await Promise.all([
        api.listPatients(),
        loadTokenQueue(userContext?.full_name),
      ]);
      setPatients(pList);
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
        let s = await api.getSummary(encId);
        if (!s) {
          s = await api.generateSummary(encId);
        }
        setSummary(s);
      } catch {
        try {
          const s = await api.generateSummary(encId);
          setSummary(s);
        } catch {
          setSummary(null);
        }
      }
    } catch (e) {
      console.warn("Error loading encounter:", e);
    }
  }

  async function selectPatient(pId: string, encIdOverride?: string | null) {
    setSelectedPatientId(pId);
    try {
      let p = patients.find((x) => x.id === pId || x.patient_id === pId);
      if (!p) {
        p = await api.getPatient(pId);
      }
      setPatient(p);
      let targetEncId = encIdOverride;
      if (!targetEncId) {
        const encounters = await api.listPatientEncounters(p.id);
        if (encounters.length > 0) {
          targetEncId = encounters[0].id;
        }
      }
      if (targetEncId) {
        setEncounterId(targetEncId);
        await loadEncounterData(targetEncId);
      } else {
        setEncounterId(null);
        setDocuments([]);
        setSummary(null);
      }
    } catch (e) {
      console.warn("Error loading patient record:", e);
    }
  }

  // --- Token Actions ---
  async function handleCallToken(tokenItem: TokenQueueItem) {
    setTokenActionLoading(tokenItem.id);
    playDoctorChime();
    try {
      const docName = currentUser?.full_name || currentUser?.username || "Doctor";
      const updated = await api.callToken(tokenItem.id, {
        doctor_id: currentUser?.username,
        doctor_name: docName,
        room_number: assignedRoom,
      });
      setActiveToken(updated);
      await loadTokenQueue();
      await selectPatient(tokenItem.patient_id, tokenItem.encounter_id);
    } catch (err: any) {
      // If claimed by another doctor simultaneously, refresh queue gracefully
      await loadTokenQueue();
      console.warn("Token claim note:", err.message);
    } finally {
      setTokenActionLoading(null);
    }
  }

  async function handleRecallToken() {
    if (!activeToken) return;
    setTokenActionLoading("recall");
    playDoctorChime();
    try {
      await api.recallToken(activeToken.id);
    } catch (err: any) {
      console.warn("Failed to recall token: " + err.message);
    } finally {
      setTokenActionLoading(null);
    }
  }

  async function handleCompleteConsultation() {
    if (!activeToken) return;
    setTokenActionLoading("complete");
    try {
      await api.completeToken(activeToken.id);
      setActiveToken(null);
      // Clean workspace after completion
      setPatient(null);
      setEncounterId(null);
      setSummary(null);
      setDocuments([]);
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
            Authorized Hospital Staff: <span className="font-mono font-bold text-slate-700">doctor / doctor123</span> (Dr. Rahul) • <span className="font-mono font-bold text-slate-700">doctor2 / doctor123</span> (Dr. Priya)
          </p>
        </div>
      </div>
    );
  }

  // Only truly waiting patients appear in upcoming queue
  const waitingPatients = tokenQueue.filter((t) => t.status === "WAITING");

  // Dynamic available rooms: Show current assigned room PLUS any free rooms
  const availableRooms = allRooms.filter(
    (r) => !occupiedRooms[r] || occupiedRooms[r] === doctorDisplayName || r === assignedRoom
  );

  // --- Authenticated Doctor Workspace ---
  return (
    <div className="space-y-6">
      {/* Top Doctor Bar: Doctor Name, Available Room Selector, and Sign Out */}
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

        {/* Assigned Room (Only Available Rooms) & Sign Out */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Assigned Room:
            </span>
            <select
              value={assignedRoom}
              onChange={(e) => handleRoomChange(e.target.value)}
              className="bg-transparent text-xs font-black text-blue-700 outline-none cursor-pointer"
            >
              {availableRooms.length > 0 ? (
                availableRooms.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))
              ) : (
                <option value={assignedRoom}>{assignedRoom}</option>
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="py-1.5 px-3.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 transition flex items-center gap-1"
            title="Sign out of doctor portal and release room"
          >
            Sign Out ⎋
          </button>
        </div>
      </div>

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

        {/* Queue Cards Grid: Only Display Unassigned Waiting Patients */}
        {waitingPatients.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm font-bold text-slate-700">No patients waiting in queue</p>
            <p className="text-xs text-slate-400 mt-1">New kiosk intake submissions will appear here automatically in real-time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waitingPatients.map((tok) => (
              <div
                key={tok.id}
                className="bg-white border-2 border-slate-200 hover:border-blue-400 rounded-2xl p-5 transition shadow-sm flex flex-col justify-between"
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

                {/* Call Action */}
                <div className="pt-3 border-t border-slate-200/80 mt-2">
                  <button
                    type="button"
                    disabled={tokenActionLoading === tok.id}
                    onClick={() => handleCallToken(tok)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                  >
                    <span>📢</span>
                    <span>{tokenActionLoading === tok.id ? "Calling…" : "Call Patient to Room"}</span>
                  </button>
                </div>
              </div>
            ))}
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
      {/* 3. CLINICAL SUMMARY & DOCUMENT INSPECTION WORKSPACE (Fresh Start) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        {/* Patient Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-6">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold block mb-1">
              Clinical Record
            </span>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900">
                {patient ? patient.name : "No Active Patient"}
              </h2>
              {patient && (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-mono">
                  ID: {patient.patient_id || patient.id.slice(0, 8)}
                </span>
              )}
            </div>
          </div>

          {patient ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Consultation Record
              </span>
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-medium">
              Accept a patient token from the queue above to load their summary.
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 font-bold">Refreshing consultation record…</div>
        ) : !encounterId ? (
          <div className="border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center bg-slate-50">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Patient In Consultation</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Select and call a patient token from the upcoming queue above to load their clinical record, encounter documents, and AI summary.
            </p>
          </div>
        ) : (
          <>
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">
                  Clinical Summary
                </div>
                <div className="text-xl font-black text-slate-900">
                  {summary ? "Draft Ready" : "Pending Generation"}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">
                  {summary?.facts?.length || 0} fact(s) to verify
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">
                  Documents
                </div>
                <div className="text-xl font-black text-slate-900">
                  {documents.length}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">
                  {documents.filter((d) => d.ocr_status === "COMPLETED").length} processed
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 mb-6 gap-6">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-3 text-sm font-black capitalize transition border-b-2 ${
                    tab === t
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab 1: AI Clinical Summary & Fact Verification */}
            {tab === "summary" && (
              <div className="space-y-6">
                {!summary ? (
                  <div className="text-center py-8">
                    <button
                      type="button"
                      onClick={handleGenerateSummary}
                      className="py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow transition"
                    >
                      ⚡ Generate Clinical Summary Draft
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Status & Verification Bar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-3">
                        <VerificationBadge status={(summary.verification_status || summary.status || "UNVERIFIED") as any} />
                        <span className="text-xs text-slate-500 font-semibold">
                          Version {summary.version || 1} • Generated via {(summary.sources || []).join(", ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {(summary.verification_status === "UNVERIFIED" || summary.status === "DRAFT" || summary.status === "UNVERIFIED") && (
                          <>
                            <button
                              type="button"
                              onClick={handleConfirmSummary}
                              className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1"
                            >
                              <span>✓</span> Confirm Draft
                            </button>
                            <button
                              type="button"
                              onClick={handleRejectSummary}
                              className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={handleGenerateSummary}
                          className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
                        >
                          ↻ Regenerate
                        </button>
                      </div>
                    </div>

                    {/* AI Raw Draft Display */}
                    <div className="p-6 bg-amber-50/50 border border-amber-200 rounded-2xl font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-2">
                        AI-Generated Clinical Draft
                      </div>
                      {summary.draft_text || summary.text}
                    </div>

                    {/* Extracted Clinical Facts Verification List */}
                    {summary.facts && summary.facts.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Structured Clinical Facts ({summary.facts.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {summary.facts.map((fact: any) => (
                            <div
                              key={fact.id}
                              className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-3 shadow-2xs"
                            >
                              <div>
                                <span className="text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded mr-2">
                                  {fact.category}
                                </span>
                                <span className="text-xs font-bold text-slate-800">
                                  {fact.label || fact.concept}
                                </span>
                                {fact.value && typeof fact.value !== "boolean" && (
                                  <span className="text-xs text-slate-600 ml-1">
                                    : {String(fact.value)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                                Conf: {Math.round((fact.confidence || 1) * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Uploaded Clinical Documents */}
            {tab === "documents" && (
              <div>
                {documents.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-semibold text-xs border border-dashed rounded-2xl">
                    No documents uploaded for this encounter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 uppercase font-mono">
                            {doc.doc_type || "Prescription / Lab"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            {doc.ocr_status}
                          </span>
                        </div>
                        {doc.extracted_text && (
                          <div className="text-xs text-slate-600 font-mono bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {doc.extracted_text}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

"use client";
import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import {
  PriorityPill,
  VerificationBadge,
} from "../../components/ClinicalComponents";
import type { Summary, Patient, TokenQueueItem, TokenItem, TreatmentRecord, PrescribedMedicine } from "../../lib/types";

const TABS = ["summary", "prescription", "past_records", "documents"] as const;
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

interface ParsedClinicalSummary {
  chiefComplaint: string;
  duration: string;
  keySymptoms: string;
  medications: string;
  allergies: string;
  pmh: string;
  previousTreatment: string;
  investigations: string;
}

function cleanSymptomText(str: string): string {
  if (!str) return "None reported";
  return str
    .replace(/\[\s*['"](.*?)['"]\s*\]/g, "$1")
    .replace(/\(\s*\[.*?\]\s*\)/g, "")
    .replace(/\(\s*['"](.*?)['"]\s*\)/g, "($1)")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStructuredSummary(rawText: string): ParsedClinicalSummary {
  const text = (rawText || "").trim();

  const extractSection = (heading: string, nextHeadings: string[]): string => {
    const pattern = new RegExp(
      `(?:##\\s*|###\\s*|^|\\n)\\s*${heading}[:\\s]*\\n+([\\s\\S]*?)(?=(?:\\n+\\s*(?:##\\s*|###\\s*)?(?:${nextHeadings.join("|")})[:\\s]*\\n)|$)`,
      "i"
    );
    const match = text.match(pattern);
    return match && match[1] ? match[1].trim() : "";
  };

  const keySymptoms = extractSection("Key Symptoms", ["Duration", "Chief Complaint", "History of Present Illness", "MEDICATIONS", "ALLERGIES", "PAST MEDICAL HISTORY", "PREVIOUS TREATMENT", "INVESTIGATIONS"]);
  const duration = extractSection("Duration", ["Chief Complaint", "Key Symptoms", "History of Present Illness", "MEDICATIONS", "ALLERGIES"]);
  const chief = extractSection("Chief Complaint", ["Duration", "Key Symptoms", "History of Present Illness", "MEDICATIONS", "ALLERGIES"]);
  const hpi = extractSection("History of Present Illness", ["Exposure", "MEDICATIONS", "ALLERGIES"]);
  const medications = extractSection("MEDICATIONS", ["ALLERGIES", "PAST MEDICAL HISTORY", "PREVIOUS TREATMENT", "INVESTIGATIONS"]);
  const allergies = extractSection("ALLERGIES", ["PAST MEDICAL HISTORY", "PREVIOUS TREATMENT", "INVESTIGATIONS"]);
  const pmh = extractSection("PAST MEDICAL HISTORY", ["PREVIOUS TREATMENT", "INVESTIGATIONS"]);
  const treatment = extractSection("PREVIOUS TREATMENT", ["INVESTIGATIONS"]);
  const investigations = extractSection("INVESTIGATIONS", []);

  return {
    chiefComplaint: chief || (text.includes("Chief Complaint") ? "General medical evaluation" : text.split("\n")[0] || "General medical evaluation"),
    duration: duration || "Not recorded",
    keySymptoms: cleanSymptomText(keySymptoms || hpi || "None reported"),
    medications: cleanSymptomText(medications || "None reported"),
    allergies: cleanSymptomText(allergies || "No known allergies reported"),
    pmh: cleanSymptomText(pmh || "None reported"),
    previousTreatment: cleanSymptomText(treatment || "None reported"),
    investigations: cleanSymptomText(investigations || "No reports available"),
  };
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

  // --- Prescription & Past Medical Records State ---
  const [prescribedMedicines, setPrescribedMedicines] = useState<PrescribedMedicine[]>([]);
  const [doctorNotes, setDoctorNotes] = useState<string>("");
  const [diagnosisInput, setDiagnosisInput] = useState<string>("");
  const [pastTreatments, setPastTreatments] = useState<TreatmentRecord[]>([]);
  const [prescriptionSavedStatus, setPrescriptionSavedStatus] = useState<string | null>(null);
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);

  // New Medicine Input Form State
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("500 mg");
  const [newMedFrequency, setNewMedFrequency] = useState("1-0-1 (Twice daily)");
  const [newMedDuration, setNewMedDuration] = useState("5 days");
  const [newMedInstructions, setNewMedInstructions] = useState("After meals");

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
        }).catch(() => { });
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
            api.claimRoom(docName, firstAvailable).catch(() => { });
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
      const wsHost = `${window.location.hostname}:8000`;
      ws = new WebSocket(`${protocol}//${wsHost}/api/ws/tokens`);

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
      await api.claimRoom(docName, chosenRoom).catch(() => { });
      await loadDoctorDashboard(userObj);
    } catch (err: any) {
      if (err.status === 401 || (err.message && err.message.toLowerCase().includes("invalid"))) {
        setAuthError("Invalid username or password.");
      } else {
        setAuthError(err.message || "Invalid username or password.");
      }
    }
  }

  async function handleRoomChange(newRoom: string) {
    setAssignedRoom(newRoom);
    sessionStorage.setItem("medikiosk_doctor_room", newRoom);
    if (doctorDisplayName) {
      await api.claimRoom(doctorDisplayName, newRoom).catch(() => { });
      await loadTokenQueue();
    }
  }

  async function handleLogout() {
    if (doctorDisplayName) {
      api.releaseRoom(doctorDisplayName).catch(() => { });
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
      setPrescribedMedicines([]);
      setDoctorNotes("");
      setDiagnosisInput("");
      setPastTreatments([]);

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

      if (p) {
        const past = await api.getPatientTreatments(p.id).catch(() => []);
        setPastTreatments(past);
      }

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
        const existingRx = await api.getEncounterPrescription(targetEncId).catch(() => null);
        if (existingRx) {
          setPrescribedMedicines(existingRx.prescribed_medicines || []);
          setDoctorNotes(existingRx.doctor_notes || "");
          setDiagnosisInput(existingRx.diagnosis || "");
        } else {
          setPrescribedMedicines([]);
          setDoctorNotes("");
          setDiagnosisInput("");
        }
      } else {
        setEncounterId(null);
        setDocuments([]);
        setSummary(null);
        setPrescribedMedicines([]);
        setDoctorNotes("");
        setDiagnosisInput("");
      }
    } catch (e) {
      console.warn("Error loading patient record:", e);
    }
  }

  // --- Prescription Helpers ---
  function handleAddMedicine() {
    if (!newMedName.trim()) return;
    const med: PrescribedMedicine = {
      name: newMedName.trim(),
      dosage: newMedDosage.trim() || undefined,
      frequency: newMedFrequency.trim() || undefined,
      duration: newMedDuration.trim() || undefined,
      instructions: newMedInstructions.trim() || undefined,
    };
    setPrescribedMedicines((prev) => [...prev, med]);
    setNewMedName("");
    setPrescriptionSavedStatus(null);
  }

  function handleRemoveMedicine(index: number) {
    setPrescribedMedicines((prev) => prev.filter((_, i) => i !== index));
    setPrescriptionSavedStatus(null);
  }

  function handleQuickAddMedicine(name: string, dose: string, freq: string, dur: string, inst: string) {
    setNewMedName(name);
    setNewMedDosage(dose);
    setNewMedFrequency(freq);
    setNewMedDuration(dur);
    setNewMedInstructions(inst);
  }

  async function handleSavePrescription() {
    if (!patient) return;
    setIsSavingPrescription(true);
    try {
      await api.savePrescription(patient.id, {
        encounter_id: encounterId || undefined,
        diagnosis: diagnosisInput.trim() || undefined,
        doctor_notes: doctorNotes.trim() || undefined,
        doctor_name: doctorDisplayName || "Doctor",
        prescribed_medicines: prescribedMedicines,
      });
      setPrescriptionSavedStatus("✓ Prescription saved to patient medical record!");
      const updatedPast = await api.getPatientTreatments(patient.id).catch(() => []);
      setPastTreatments(updatedPast);
      setTimeout(() => setPrescriptionSavedStatus(null), 4000);
    } catch (err: any) {
      alert("Failed to save prescription: " + err.message);
    } finally {
      setIsSavingPrescription(false);
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
      // Auto-save prescription if medicines or notes are entered
      if (patient && (prescribedMedicines.length > 0 || doctorNotes.trim() || diagnosisInput.trim())) {
        await api.savePrescription(patient.id, {
          encounter_id: encounterId || undefined,
          diagnosis: diagnosisInput.trim() || undefined,
          doctor_notes: doctorNotes.trim() || undefined,
          doctor_name: doctorDisplayName || "Doctor",
          prescribed_medicines: prescribedMedicines,
        }).catch((e) => console.warn("Auto-save Rx note:", e));
      }

      await api.completeToken(activeToken.id);
      setActiveToken(null);
      // Clean workspace after completion
      setPatient(null);
      setEncounterId(null);
      setSummary(null);
      setDocuments([]);
      setPrescribedMedicines([]);
      setDoctorNotes("");
      setDiagnosisInput("");
      setPastTreatments([]);
      setPrescriptionSavedStatus(null);
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
              placeholder="Enter physician username / login ID"
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
        <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-blue-400/40">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white text-blue-950 flex flex-col items-center justify-center font-mono shadow-xl flex-shrink-0">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">TOKEN</span>
                <span className="text-3xl sm:text-4xl font-black">{activeToken.token_number}</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {patient ? patient.name : "Active Patient"}
                </h3>
                <div className="flex flex-wrap items-center gap-2.5">
                  {patient?.age && (
                    <span className="bg-white/15 backdrop-blur-md text-white px-3.5 py-1 rounded-xl text-sm sm:text-base font-bold border border-white/20">
                      Age: {patient.age} yrs
                    </span>
                  )}
                  {patient?.gender && (
                    <span className="bg-white/15 backdrop-blur-md text-white px-3.5 py-1 rounded-xl text-sm sm:text-base font-bold border border-white/20">
                      Gender: {patient.gender}
                    </span>
                  )}
                  <span className="bg-white/15 backdrop-blur-md text-white px-3.5 py-1 rounded-xl text-sm sm:text-base font-bold border border-white/20">
                    Dept: {activeToken.department || "General Medicine"}
                  </span>
                  <span className="bg-emerald-500/30 text-emerald-200 px-3.5 py-1 rounded-xl text-sm sm:text-base font-bold border border-emerald-400/40">
                    ● In Consultation
                  </span>
                </div>
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
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              {patient ? patient.name : "No Active Patient"}
            </h2>
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
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 mb-6 gap-2 sm:gap-6 overflow-x-auto">
              {TABS.map((t) => {
                let label = "Summary";
                let icon = "📋";
                let badge: React.ReactNode = null;

                if (t === "summary") {
                  label = "AI Summary";
                  icon = "📋";
                } else if (t === "prescription") {
                  label = "Prescription & Medicines";
                  icon = "💊";
                  if (prescribedMedicines.length > 0) {
                    badge = (
                      <span className="ml-1.5 px-2 py-0.5 text-[10px] font-black rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        {prescribedMedicines.length}
                      </span>
                    );
                  }
                } else if (t === "past_records") {
                  label = "Past Medical History";
                  icon = "📜";
                  if (pastTreatments.length > 0) {
                    badge = (
                      <span className="ml-1.5 px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                        {pastTreatments.length}
                      </span>
                    );
                  }
                } else if (t === "documents") {
                  label = "Documents";
                  icon = "📄";
                  if (documents.length > 0) {
                    badge = (
                      <span className="ml-1.5 px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                        {documents.length}
                      </span>
                    );
                  }
                }

                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`pb-3.5 text-xs sm:text-sm font-black capitalize transition border-b-2 flex items-center gap-1.5 whitespace-nowrap px-1 ${
                      tab === t
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                    {badge}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: AI Clinical Summary */}
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
                    {/* Structured Clinical Summary Box */}
                    {(() => {
                      const parsed = parseStructuredSummary(summary.draft_text || summary.text);
                      return (
                        <div className="space-y-5">
                          {/* Top Main Box: CLINICAL SUMMARY */}
                          <div className="bg-white border-2 border-slate-700 rounded-2xl p-5 md:p-6 shadow-sm space-y-4 font-sans">
                            <div className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-2.5 flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span>📋</span>
                                <span>CLINICAL SUMMARY</span>
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                AI INTAKE DRAFT
                              </span>
                            </div>

                            {/* 1. Key Symptoms (FIRST) */}
                            <div>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Key Symptoms
                              </div>
                              <div className="text-base font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-4 leading-relaxed">
                                {parsed.keySymptoms}
                              </div>
                            </div>

                            {/* 2. Duration (SECOND) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                              <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                  Duration
                                </div>
                                <div className="text-base font-bold text-slate-800">
                                  {parsed.duration}
                                </div>
                              </div>

                              {parsed.chiefComplaint && parsed.chiefComplaint !== "General medical evaluation" && (
                                <div>
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Chief Complaint
                                  </div>
                                  <div className="text-base font-bold text-slate-800">
                                    {parsed.chiefComplaint}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Secondary Clinical Categories Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* MEDICATIONS */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                                <span>💊</span>
                                <span>CURRENT MEDICATIONS</span>
                              </div>
                              <div className="text-sm font-bold text-slate-800">
                                {parsed.medications}
                              </div>
                            </div>

                            {/* ALLERGIES */}
                            <div className={`border rounded-2xl p-4 shadow-2xs ${
                              parsed.allergies.toLowerCase().includes("none") || parsed.allergies.toLowerCase().includes("no known")
                                ? "bg-white border-slate-200"
                                : "bg-red-50 border-red-200"
                            }`}>
                              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                                <span>⚠️</span>
                                <span className={!parsed.allergies.toLowerCase().includes("none") && !parsed.allergies.toLowerCase().includes("no known") ? "text-red-700" : ""}>
                                  ALLERGIES
                                </span>
                              </div>
                              <div className={`text-sm font-bold ${
                                !parsed.allergies.toLowerCase().includes("none") && !parsed.allergies.toLowerCase().includes("no known")
                                ? "text-red-900"
                                : "text-slate-800"
                              }`}>
                                {parsed.allergies}
                              </div>
                            </div>

                            {/* PAST MEDICAL HISTORY */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                                <span>📋</span>
                                <span>PAST MEDICAL HISTORY</span>
                              </div>
                              <div className="text-sm font-bold text-slate-800">
                                {parsed.pmh}
                              </div>
                            </div>

                            {/* PREVIOUS TREATMENT */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                                <span>🩺</span>
                                <span>PREVIOUS TREATMENT</span>
                              </div>
                              <div className="text-sm font-bold text-slate-800">
                                {parsed.previousTreatment}
                              </div>
                            </div>

                            {/* INVESTIGATIONS */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs md:col-span-2">
                              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                                <span>🔬</span>
                                <span>INVESTIGATIONS</span>
                              </div>
                              <div className="text-sm font-bold text-slate-800">
                                {parsed.investigations}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

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

            {/* Tab 2: Prescribe Medicines & Doctor Review */}
            {tab === "prescription" && (
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-md font-serif font-black">
                      ℞
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Doctor Consultation & Prescription Pad
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Prescribe medications, dosage, frequency, and clinical reviews. Saved automatically upon completion.
                      </p>
                    </div>
                  </div>
                  {prescriptionSavedStatus && (
                    <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 px-3.5 py-1.5 rounded-xl text-xs font-bold animate-fade-in flex items-center gap-1.5 shadow-sm">
                      <span>✓</span>
                      <span>{prescriptionSavedStatus}</span>
                    </div>
                  )}
                </div>

                {/* 1. Diagnosis / Clinical Impression */}
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-3 shadow-2xs">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
                    🩺 Diagnosis / Clinical Impression
                  </label>
                  <input
                    type="text"
                    value={diagnosisInput}
                    onChange={(e) => setDiagnosisInput(e.target.value)}
                    placeholder="e.g. Acute Viral Syndrome, Gastroenteritis, Upper Respiratory Infection"
                    className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  />
                  {/* Quick Suggested Diagnosis Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">Quick Select:</span>
                    {[
                      "Viral Fever",
                      "Acute Bronchitis & Cough",
                      "Gastritis & Acidity",
                      "Hypertension Review",
                      "Gastroenteritis",
                      "Allergic Rhinitis",
                      "Migraine & Headache",
                      "General Body Ache",
                    ].map((diag) => (
                      <button
                        key={diag}
                        type="button"
                        onClick={() => setDiagnosisInput(diag)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 transition"
                      >
                        + {diag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Active Prescribed Medicines List */}
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">💊</span>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                        Prescribed Medicines ({prescribedMedicines.length})
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">
                      {prescribedMedicines.length === 0 ? "No medicines added yet" : "Ready for patient record"}
                    </span>
                  </div>

                  {prescribedMedicines.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
                      <div className="text-3xl mb-1.5">💊</div>
                      <div className="text-sm font-bold text-slate-700">No Medicines Added Yet</div>
                      <p className="text-xs text-slate-400 mt-0.5">Use the medicine builder below to add prescribed medications.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-black uppercase text-[10px]">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Medicine Name</th>
                            <th className="py-2.5 px-3">Dosage</th>
                            <th className="py-2.5 px-3">Frequency (Times / Day)</th>
                            <th className="py-2.5 px-3">Duration</th>
                            <th className="py-2.5 px-3">Instructions</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                          {prescribedMedicines.map((med, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-3 font-extrabold text-slate-900 text-sm">{med.name}</td>
                              <td className="py-3 px-3">
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold">
                                  {med.dosage || "As advised"}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold">
                                  {med.frequency || "1-0-1 (Twice daily)"}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-600">{med.duration || "5 days"}</td>
                              <td className="py-3 px-3 text-slate-600">{med.instructions || "After food"}</td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMedicine(idx)}
                                  className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition"
                                  title="Remove medicine"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. Add Medicine Builder Form */}
                <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>➕</span>
                      <span>Add Medicine to Prescription</span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">Specify drug, dose, and daily schedule</span>
                  </div>

                  {/* Common Medicine Quick Fill Suggestions */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block mb-1.5">Common Medicines (Click to quick-fill):</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { name: "Paracetamol (Dolo 650)", dose: "650 mg", freq: "1-0-1 (Twice daily)", dur: "3 days", inst: "After meals" },
                        { name: "Amoxicillin + Clavulanate", dose: "625 mg", freq: "1-0-1 (Twice daily)", dur: "5 days", inst: "After food" },
                        { name: "Cetirizine Hydrochloride", dose: "10 mg", freq: "0-0-1 (Once at night)", dur: "5 days", inst: "Before sleep" },
                        { name: "Pantoprazole (Pan 40)", dose: "40 mg", freq: "1-0-0 (Once in morning)", dur: "7 days", inst: "Before breakfast (Empty stomach)" },
                        { name: "Azithromycin 500mg", dose: "500 mg", freq: "1-0-0 (Once daily)", dur: "3 days", inst: "1 hour before meal" },
                        { name: "Ibuprofen 400mg", dose: "400 mg", freq: "1-0-1 (Twice daily / SOS)", dur: "3 days", inst: "After food" },
                        { name: "ORS Hydration Sachet", dose: "1 sachet in 1L", freq: "Throughout the day", dur: "2 days", inst: "Sip by sip" },
                        { name: "Cough Syrup (Ascoril D)", dose: "10 ml", freq: "1-1-1 (Thrice daily)", dur: "5 days", inst: "After meals" },
                      ].map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => handleQuickAddMedicine(item.name, item.dose, item.freq, item.dur, item.inst)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200 shadow-2xs transition"
                        >
                          + {item.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Medicine Name */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Medicine / Syrup Name *
                      </label>
                      <input
                        type="text"
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        placeholder="e.g. Paracetamol 650mg, Amoxicillin 500mg, Cough Syrup"
                        className="w-full p-2.5 bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>

                    {/* Dosage */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Dosage (e.g. 500 mg, 10 ml)
                      </label>
                      <input
                        type="text"
                        value={newMedDosage}
                        onChange={(e) => setNewMedDosage(e.target.value)}
                        placeholder="500 mg"
                        className="w-full p-2.5 bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                      {/* Dosage Quick Chips */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["250 mg", "500 mg", "650 mg", "1 tab", "5 ml", "10 ml"].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setNewMedDosage(d)}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-blue-100 hover:text-blue-800"
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Frequency (Times a day) */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Frequency (Times a Day)
                      </label>
                      <select
                        value={newMedFrequency}
                        onChange={(e) => setNewMedFrequency(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="1-0-1 (Twice daily)">1-0-1 (Twice daily - Morning & Night)</option>
                        <option value="1-1-1 (Thrice daily)">1-1-1 (Thrice daily - Morning, Noon & Night)</option>
                        <option value="1-0-0 (Once daily - Morning)">1-0-0 (Once in Morning)</option>
                        <option value="0-0-1 (Once daily - Night)">0-0-1 (Once at Night / Bedtime)</option>
                        <option value="SOS (As and when needed)">SOS (As and when needed / Pain)</option>
                        <option value="Every 6 hours">Every 6 hours (4 times daily)</option>
                        <option value="Once weekly">Once weekly</option>
                      </select>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Duration (Days / Weeks)
                      </label>
                      <input
                        type="text"
                        value={newMedDuration}
                        onChange={(e) => setNewMedDuration(e.target.value)}
                        placeholder="5 days"
                        className="w-full p-2.5 bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                      {/* Duration Quick Chips */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["3 days", "5 days", "7 days", "10 days", "14 days", "1 month"].map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setNewMedDuration(dur)}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-blue-100 hover:text-blue-800"
                          >
                            {dur}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Instructions */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Timing / Food Instructions
                      </label>
                      <input
                        type="text"
                        value={newMedInstructions}
                        onChange={(e) => setNewMedInstructions(e.target.value)}
                        placeholder="After food"
                        className="w-full p-2.5 bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-xs font-bold text-slate-800 outline-none"
                      />
                      {/* Instructions Quick Chips */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {["After food", "Before food (Empty stomach)", "With warm water", "At bedtime"].map((inst) => (
                          <button
                            key={inst}
                            type="button"
                            onClick={() => setNewMedInstructions(inst)}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-blue-100 hover:text-blue-800"
                          >
                            {inst}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    disabled={!newMedName.trim()}
                    className="py-2.5 px-5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition flex items-center gap-1.5"
                  >
                    <span>➕</span>
                    <span>Add Medicine to Prescription</span>
                  </button>
                </div>

                {/* 4. Doctor Review Notes & Clinical Advice */}
                <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-2.5 shadow-2xs">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
                    📝 Doctor Review, Dietary Advice & Follow-up Notes
                  </label>
                  <textarea
                    rows={3}
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Enter doctor clinical review, dietary instructions, precautions, and follow-up timeline (e.g. Advised plenty of fluids, rest for 3 days. Review if fever exceeds 102°F or persists after 5 days)..."
                    className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-xs font-semibold text-slate-800 outline-none leading-relaxed"
                  />
                </div>

                {/* 5. Prescription Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isSavingPrescription}
                      onClick={handleSavePrescription}
                      className="py-3 px-6 bg-blue-700 hover:bg-blue-800 active:scale-98 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2"
                    >
                      <span>💾</span>
                      <span>{isSavingPrescription ? "Saving Record…" : "Save Prescription"}</span>
                    </button>

                    <button
                      type="button"
                      disabled={tokenActionLoading === "complete"}
                      onClick={handleCompleteConsultation}
                      className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2"
                    >
                      <span>✓</span>
                      <span>Complete Consultation & Save</span>
                    </button>
                  </div>

                  <span className="text-xs text-slate-400 font-semibold">
                    Saved medicines will be stored in the patient's record for all future visits.
                  </span>
                </div>
              </div>
            )}

            {/* Tab 3: Past Medical Records & Historical Prescriptions */}
            {tab === "past_records" && (
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Past Consultations & Prescriptions for {patient?.name} ({pastTreatments.length})
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">
                    Historical patient records
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
                  <div className="space-y-4">
                    {pastTreatments.map((rec, idx) => (
                      <div
                        key={rec.id || idx}
                        className="bg-white border-2 border-slate-200 hover:border-blue-400 rounded-2xl p-5 shadow-2xs space-y-3.5 transition"
                      >
                        {/* Visit Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">🩺</span>
                            <div>
                              <h4 className="text-base font-black text-slate-900 leading-tight">
                                {rec.illness_name || rec.diagnosis || "Medical Consultation"}
                              </h4>
                              {rec.doctor_name && (
                                <span className="text-xs text-blue-700 font-bold">
                                  👨‍⚕️ {rec.doctor_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-bold font-mono px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl self-start sm:self-auto">
                            📅 {rec.visit_date || "Past Visit"}
                          </span>
                        </div>

                        {/* Symptoms & Diagnosis */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {rec.symptoms && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Reported Symptoms
                              </span>
                              <span className="font-bold text-slate-800">{rec.symptoms}</span>
                            </div>
                          )}

                          {rec.diagnosis && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Diagnosis / Summary
                              </span>
                              <span className="font-bold text-slate-800">{rec.diagnosis}</span>
                            </div>
                          )}
                        </div>

                        {/* Prescribed Medicines Section */}
                        {rec.prescribed_medicines && rec.prescribed_medicines.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                              <span>💊</span>
                              <span>Prescribed Medicines ({rec.prescribed_medicines.length}):</span>
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {rec.prescribed_medicines.map((med, mIdx) => (
                                <div
                                  key={mIdx}
                                  className="bg-blue-50/50 border border-blue-200 rounded-xl p-3 space-y-1"
                                >
                                  <div className="font-black text-slate-900 text-xs">{med.name}</div>
                                  <div className="text-[11px] text-blue-800 font-bold">
                                    {med.dosage ? `Dose: ${med.dosage}` : ""}
                                    {med.frequency ? ` • ${med.frequency}` : ""}
                                  </div>
                                  {med.duration && (
                                    <div className="text-[10px] font-mono text-slate-500">
                                      Duration: {med.duration}
                                    </div>
                                  )}
                                  {med.instructions && (
                                    <div className="text-[10px] text-slate-600 italic">
                                      {med.instructions}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : rec.treatment && rec.treatment !== "OPD Consultation" ? (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                            <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">
                              Treatment / Medication Summary
                            </span>
                            <span className="font-semibold text-slate-700">{rec.treatment}</span>
                          </div>
                        ) : null}

                        {/* Doctor Notes / Clinical Review */}
                        {rec.doctor_notes && (
                          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-xs">
                            <span className="text-[10px] font-black uppercase text-amber-800 block mb-0.5">
                              Doctor Clinical Notes & Review
                            </span>
                            <span className="text-slate-800 font-medium">{rec.doctor_notes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Uploaded Clinical Documents */}
            {tab === "documents" && (
              <div className="space-y-6 min-h-[320px]">
                {/* Header matching Summary tab height and layout */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Encounter Documents ({documents.length})
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">
                    {documents.filter((d) => d.status === "processed" || d.ocr_status === "COMPLETED").length} Processed
                  </span>
                </div>

                {documents.length === 0 ? (
                  <div className="text-center py-12 px-6 bg-slate-50/50 border border-dashed border-slate-300 rounded-2xl">
                    <div className="text-3xl mb-2">📄</div>
                    <div className="text-sm font-bold text-slate-700 mb-1">
                      No Documents Uploaded
                    </div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      No prescription or lab report documents were scanned during this patient's kiosk intake.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 uppercase font-mono">
                            {doc.doc_type || doc.filename || "Prescription / Lab"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            {doc.status || doc.ocr_status || "Uploaded"}
                          </span>
                        </div>
                        {(doc.ocr_text || doc.extracted_text) && (
                          <div className="text-xs text-slate-600 font-mono bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {doc.ocr_text || doc.extracted_text}
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

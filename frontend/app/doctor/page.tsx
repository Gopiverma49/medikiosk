"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import {
  PriorityPill,
  VerificationBadge,
} from "../../components/ClinicalComponents";
import type { Summary, Patient } from "../../lib/types";

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

  useEffect(() => {
    // Check existing session
    const savedToken = sessionStorage.getItem("medikiosk_doctor_token");
    const savedUser = sessionStorage.getItem("medikiosk_doctor_user");
    if (savedToken && savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
        setIsAuthenticated(true);
        loadDoctorDashboard();
      } catch {
        sessionStorage.removeItem("medikiosk_doctor_token");
        sessionStorage.removeItem("medikiosk_doctor_user");
      }
    }
    setAuthLoading(false);
  }, []);

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
      sessionStorage.setItem("medikiosk_doctor_token", res.access_token);
      sessionStorage.setItem("medikiosk_doctor_user", JSON.stringify(userObj));
      setCurrentUser(userObj);
      setIsAuthenticated(true);
      await loadDoctorDashboard();
    } catch (err: any) {
      setAuthError("Invalid doctor username or password. Please check with your administrator.");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("medikiosk_doctor_token");
    sessionStorage.removeItem("medikiosk_doctor_user");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsernameInput("");
    setPasswordInput("");
  }

  async function loadDoctorDashboard() {
    setLoading(true);
    try {
      const pList = await api.listPatients();
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
        <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
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
              placeholder="e.g. doctor"
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
          <p className="text-[11px] text-slate-400">
            Account credentials are created and managed by the Hospital Administrator.
          </p>
        </div>
      </div>
    );
  }

  // --- Authenticated Doctor Workspace ---
  return (
    <div className="space-y-6">
      {/* Top Patient Selector & Physician Status Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-700 font-bold">
              Doctor Consultation Workspace
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-600">
              {currentUser?.full_name || currentUser?.username}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {patient ? patient.name : "Select Patient"}
            </h1>
            {patient && (
              <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-mono">
                ID: {patient.patient_id || patient.id.slice(0, 8)}
              </span>
            )}
          </div>
          {patient && (
            <p className="text-xs text-slate-500 mt-1">
              Age: {patient.age} • Gender: {patient.gender} • Dept: {patient.department || "General Medicine"}
            </p>
          )}
        </div>

        {/* Patient Switcher & Doctor Session Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Queue:
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => selectPatient(e.target.value)}
              className="p-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 w-full md:w-56"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.patient_id || p.id.slice(0, 6)})
                </option>
              ))}
            </select>
          </div>
          {priority && <PriorityPill priority={priority as any} />}
          <button
            type="button"
            onClick={handleLogout}
            className="py-2 px-3 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 transition"
            title="Sign out of doctor portal"
          >
            Sign Out ⎋
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-bold">Refreshing consultation record…</div>
      ) : !encounterId ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Intake Encounter Found</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            This patient has not completed their kiosk intake session yet. The consultation data will automatically appear here once submitted.
          </p>
        </div>
      ) : (
        <>
          {/* Quick Metrics Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Main Clinical Data Workspace */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
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
                    className="py-3 px-6 bg-clinical-blue text-white rounded-xl font-bold text-sm shadow"
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
                    <pre className="whitespace-pre-wrap text-sm border border-slate-200 rounded-2xl p-5 mb-4 font-mono bg-slate-50 text-slate-900">
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
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="text-xs font-mono uppercase tracking-wider text-blue-700 font-bold mb-1">
        {label}
      </div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [priority, setPriority] = useState("ROUTINE");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

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

  if (loading) return <div className="text-center py-20 text-slate-400 font-bold">Loading Doctor Portal…</div>;

  return (
    <div className="space-y-6">
      {/* Top Patient Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <div className="text-xs font-mono uppercase tracking-wider text-blue-700 font-bold mb-1">
            Doctor Consultation Workspace
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

        {/* Patient Switcher Dropdown */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Patient Queue:
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => selectPatient(e.target.value)}
            className="p-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 w-full md:w-64"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.patient_id || p.id.slice(0, 6)})
              </option>
            ))}
          </select>
          {priority && <PriorityPill priority={priority as any} />}
        </div>
      </div>

      {!encounterId ? (
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
                      ? "text-teal-700 border-teal-700 font-extrabold"
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
      <div className="text-xs font-mono uppercase tracking-wider text-teal-700 font-bold mb-1">
        {label}
      </div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

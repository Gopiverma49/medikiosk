"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import {
  FactCard,
  ContradictionCard,
  RedFlagBanner,
  PriorityPill,
  VerificationBadge,
} from "../../components/ClinicalComponents";
import type { ClinicalFact, Contradiction, Summary, Patient } from "../../lib/types";

const TABS = ["overview", "facts", "contradictions", "documents", "summary", "fhir"] as const;
type Tab = (typeof TABS)[number];

export default function DoctorPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [facts, setFacts] = useState<ClinicalFact[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [redFlags, setRedFlags] = useState<any[]>([]);
  const [priority, setPriority] = useState("ROUTINE");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [fhirBundle, setFhirBundle] = useState<any>(null);
  const [selectedFact, setSelectedFact] = useState<ClinicalFact | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadEncounterData(encId: string) {
    try {
      const [f, c, triage, docs] = await Promise.all([
        api.listFacts(encId),
        api.listContradictions(encId),
        api.getTriageStatus(encId) as Promise<any>,
        api.listDocuments(encId) as Promise<any[]>,
      ]);
      setFacts(f);
      setContradictions(c);
      setRedFlags(triage.red_flags || []);
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

  async function selectPatient(pId: string) {
    setSelectedPatientId(pId);
    const p = patients.find((x) => x.id === pId || x.patient_id === pId);
    if (!p) return;
    setPatient(p);
    try {
      const encounters: any[] = await fetch(`/api/patients/${p.id}/encounters`).then((r) => r.json());
      if (encounters.length > 0) {
        setEncounterId(encounters[0].id);
        await loadEncounterData(encounters[0].id);
      } else {
        setEncounterId(null);
        setFacts([]);
        setContradictions([]);
        setRedFlags([]);
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
        const pList: Patient[] = await fetch("/api/patients").then((r) => r.json());
        setPatients(pList);
        if (pList.length > 0) {
          const first = pList[0];
          setPatient(first);
          setSelectedPatientId(first.id);
          const encounters: any[] = await fetch(`/api/patients/${first.id}/encounters`).then((r) => r.json());
          if (encounters.length > 0) {
            setEncounterId(encounters[0].id);
            await loadEncounterData(encounters[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load doctor dashboard:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function refresh() {
    if (encounterId) await loadEncounterData(encounterId);
  }

  async function handleVerify(f: ClinicalFact) {
    await api.verifyFact(f.id);
    setSelectedFact(null);
    refresh();
  }

  async function handleReject(f: ClinicalFact) {
    await api.rejectFact(f.id);
    setSelectedFact(null);
    refresh();
  }

  async function handleCorrect(f: ClinicalFact) {
    const v = prompt("Corrected value:", String(f.label ?? ""));
    if (v) {
      await api.correctFact(f.id, v, v);
      setSelectedFact(null);
      refresh();
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

  async function handleResolve(c: Contradiction) {
    const choice = prompt(
      `Resolve "${c.type}"\n1) Accept: ${c.description_b}\n2) Accept: ${c.description_a}\n3) Needs clarification\n\nType 1, 2, or 3:`
    );
    if (!choice) return;
    const decision =
      choice === "1"
        ? `Confirmed: ${c.description_b}`
        : choice === "2"
        ? `Confirmed: ${c.description_a}`
        : "Needs further clarification with patient";
    await api.resolveContradiction(c.id, decision);
    refresh();
  }

  async function handleExportFHIR() {
    if (!encounterId) return;
    const result: any = await api.fhirExport(encounterId);
    setFhirBundle(result.bundle);
  }

  if (loading) return <div className="text-center py-20 text-slate-400 font-bold">Loading Doctor Portal…</div>;

  const unverified = facts.filter((f) => f.verification_status === "UNVERIFIED");
  const unknown = facts.filter((f) => f.certainty === "unknown");
  const openContradictions = contradictions.filter((c) => c.status === "UNRESOLVED");

  return (
    <div className="space-y-6">
      {/* Top Patient Selector Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <div className="text-xs font-mono uppercase tracking-wider text-teal-700 font-bold mb-1">
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
            className="p-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-teal-600 w-full md:w-64"
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
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            This patient has not completed their kiosk intake yet. You can launch the Patient Portal to start intake.
          </p>
          <a
            href="/patient"
            className="inline-block py-3 px-6 bg-clinical-blue hover:bg-clinical-blue-deep text-white font-bold rounded-xl shadow transition"
          >
            Open Patient Intake Kiosk →
          </a>
        </div>
      ) : (
        <>
          {/* Quick Metrics Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Contradictions"
              value={`${openContradictions.length}`}
              sub={`open of ${contradictions.length} total`}
            />
            <StatCard
              label="Unknown fields"
              value={`${unknown.length}`}
              sub="preserved, never coerced to 'No'"
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
                  {t}
                  {t === "contradictions" && openContradictions.length
                    ? ` (${openContradictions.length})`
                    : ""}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview */}
            {tab === "overview" && (
              <div className="space-y-4">
                {redFlags.length ? (
                  redFlags.map((e: any) => (
                    <RedFlagBanner
                      key={e.rule_id}
                      name={e.name}
                      priority={e.priority}
                      ruleId={e.rule_id}
                    />
                  ))
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold">
                    ✓ No emergency red flags triggered for this patient.
                  </div>
                )}

                <h3 className="font-bold text-sm text-slate-800 mt-6 mb-2">
                  Clinical Facts Requiring Review
                </h3>
                <div className="space-y-2">
                  {unverified.slice(0, 6).map((f) => (
                    <FactCard key={f.id} fact={f} onOpen={setSelectedFact} />
                  ))}
                  {!unverified.length && (
                    <p className="text-slate-400 text-sm">All facts have been verified.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Facts */}
            {tab === "facts" && (
              <div className="space-y-2">
                {facts.map((f) => (
                  <FactCard key={f.id} fact={f} onOpen={setSelectedFact} />
                ))}
                {!facts.length && <p className="text-slate-400 text-sm">No facts recorded yet.</p>}
              </div>
            )}

            {/* Tab 3: Contradictions */}
            {tab === "contradictions" && (
              <div className="space-y-3">
                {contradictions.map((c) => (
                  <ContradictionCard
                    key={c.id}
                    type={c.type}
                    a={c.description_a}
                    b={c.description_b}
                    status={c.status}
                    onResolve={() => handleResolve(c)}
                  />
                ))}
                {!contradictions.length && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-sm">
                    No discrepancies detected between patient answers and records.
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Documents */}
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

            {/* Tab 5: Summary */}
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

            {/* Tab 6: FHIR / ABDM */}
            {tab === "fhir" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <StatCard label="FHIR" value="READY" />
                  <StatCard label="ABDM" value="MOCK/SANDBOX" />
                  <StatCard label="HIS" value="MOCK CONNECTED" />
                </div>
                <button
                  onClick={handleExportFHIR}
                  className="py-3 px-6 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-bold shadow"
                >
                  Export to FHIR R4 Bundle
                </button>
                {fhirBundle && (
                  <pre className="text-xs bg-slate-900 text-teal-300 border border-slate-800 rounded-2xl p-5 overflow-auto max-h-96 font-mono">
                    {JSON.stringify(fhirBundle, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Fact Detail Modal */}
      {selectedFact && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-5 z-50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setSelectedFact(null)}
        >
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-auto shadow-2xl border border-slate-200">
            <div className="text-xs font-mono uppercase text-teal-700 font-bold mb-1">
              Clinical Fact • Provenance & Verification
            </div>
            <h2 className="text-xl font-bold capitalize mb-4 text-slate-900">
              {selectedFact.concept.replace(/_/g, " ")}
            </h2>
            <dl className="text-sm grid grid-cols-[140px_1fr] gap-y-3 font-sans">
              <dt className="text-slate-400 font-mono text-xs">Value</dt>
              <dd className="font-semibold text-slate-800">
                {selectedFact.certainty === "unknown" ? "Unknown (Preserved)" : String(selectedFact.label)}
              </dd>
              <dt className="text-slate-400 font-mono text-xs">Source</dt>
              <dd className="text-slate-700">{selectedFact.source}</dd>
              {selectedFact.original_text && (
                <>
                  <dt className="text-slate-400 font-mono text-xs">Original text</dt>
                  <dd className="font-mono text-xs text-slate-600">&quot;{selectedFact.original_text}&quot;</dd>
                </>
              )}
              <dt className="text-slate-400 font-mono text-xs">Extraction Conf.</dt>
              <dd className="font-bold text-teal-800">
                {selectedFact.confidence != null ? `${Math.round(selectedFact.confidence * 100)}%` : "n/a"}
              </dd>
              <dt className="text-slate-400 font-mono text-xs">Status</dt>
              <dd>
                <VerificationBadge status={selectedFact.verification_status} />
              </dd>
            </dl>
            <div className="flex gap-2 mt-6 flex-wrap">
              <button
                onClick={() => handleVerify(selectedFact)}
                className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow"
              >
                Verify
              </button>
              <button
                onClick={() => handleCorrect(selectedFact)}
                className="py-2 px-4 border-2 border-teal-600 text-teal-700 hover:bg-teal-50 rounded-xl text-sm font-bold"
              >
                Edit / Correct
              </button>
              <button
                onClick={() => handleReject(selectedFact)}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold"
              >
                Reject
              </button>
              <button
                onClick={() => setSelectedFact(null)}
                className="py-2 px-4 text-slate-400 hover:text-slate-600 text-sm font-bold ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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

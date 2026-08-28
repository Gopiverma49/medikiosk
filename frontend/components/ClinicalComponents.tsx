"use client";
import type { ClinicalFact } from "../lib/types";

export function ConfidenceBadge({ confidence, certainty }: { confidence?: number | null; certainty: string }) {
  if (certainty === "unknown" || confidence == null) {
    return <span className="badge bg-slate-100 text-slate-500">UNKNOWN</span>;
  }
  const band = confidence >= 0.9 ? "high" : confidence >= 0.7 ? "medium" : "low";
  const cls =
    band === "high" ? "text-emerald-700" : band === "medium" ? "text-amber-700" : "text-red-700";
  return <span className={`font-mono font-bold text-sm ${cls}`}>{Math.round(confidence * 100)}%</span>;
}

export function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    UNVERIFIED: "bg-slate-100 text-slate-600",
    PATIENT_CONFIRMED: "bg-emerald-50 text-emerald-700",
    PHYSICIAN_VERIFIED: "bg-emerald-100 text-emerald-800",
    PHYSICIAN_CORRECTED: "bg-blue-50 text-blue-700",
    REJECTED: "bg-red-50 text-red-700",
    CONFLICTED: "bg-red-50 text-red-700",
    UNKNOWN: "bg-slate-100 text-slate-500",
  };
  return <span className={`badge ${map[status] || map.UNVERIFIED}`}>{status.replace(/_/g, " ")}</span>;
}

export function FactCard({
  fact,
  onOpen,
}: {
  fact: ClinicalFact;
  onOpen?: (f: ClinicalFact) => void;
}) {
  return (
    <div
      onClick={() => onOpen?.(fact)}
      className="flex justify-between items-center gap-3 p-3 border border-slate-200 rounded-lg mb-2 bg-white hover:border-clinical-blue cursor-pointer transition"
    >
      <div>
        <div className="font-bold text-sm text-ink capitalize">{fact.label || fact.concept}</div>
        <div className="text-xs text-slate-500 font-mono">
          source: {fact.source}
          {fact.source_language ? ` · lang: ${fact.source_language}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ConfidenceBadge confidence={fact.confidence} certainty={fact.certainty} />
        <VerificationBadge status={fact.verification_status} />
      </div>
    </div>
  );
}

export function RedFlagBanner({ name, priority, ruleId }: { name: string; priority: string; ruleId: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
      <div className="font-bold text-red-700 text-sm mb-1">🚩 RED FLAG: {name}</div>
      <div className="text-xs text-slate-500 font-mono">
        Rule {ruleId} · Priority {priority}
      </div>
    </div>
  );
}

export function ContradictionCard({
  type,
  a,
  b,
  status,
  onResolve,
}: {
  type: string;
  a?: string | null;
  b?: string | null;
  status: string;
  onResolve?: () => void;
}) {
  return (
    <div className={`rounded-lg p-4 mb-3 border ${status === "UNRESOLVED" ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
      <div className="font-bold text-sm mb-2">
        ⚠ {type.replace(/_/g, " ")} <span className="badge bg-white ml-2">{status}</span>
      </div>
      <div className="text-sm grid grid-cols-[100px_1fr] gap-y-1">
        <div className="text-slate-500 font-mono text-xs">Source 1</div>
        <div>{a}</div>
        <div className="text-slate-500 font-mono text-xs">Source 2</div>
        <div>{b}</div>
      </div>
      {status === "UNRESOLVED" && onResolve && (
        <button onClick={onResolve} className="mt-3 px-4 py-2 bg-clinical-blue text-white rounded-md text-sm font-semibold">
          Resolve
        </button>
      )}
    </div>
  );
}

export function PriorityPill({ priority }: { priority: "HIGH" | "MEDIUM" | "LOW" | "ROUTINE" }) {
  const cls =
    priority === "HIGH"
      ? "bg-red-50 text-red-700"
      : priority === "MEDIUM"
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-500";
  return <span className={`badge ${cls}`} style={{ fontSize: 13, padding: "6px 14px" }}>PRIORITY: {priority}</span>;
}

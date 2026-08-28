"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { RedFlagRule } from "../../lib/types";

const TABS = ["rules", "test", "evaluation", "audit"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<RedFlagRule[]>([]);
  const [evalResults, setEvalResults] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [testInputs, setTestInputs] = useState<Record<string, boolean>>({
    chest_pain: true, dyspnea: true, radiation_to_arm: true, sweating: true,
  });
  const [testResult, setTestResult] = useState<any>(null);

  async function loadRules() {
    setRules(await api.listRules());
  }
  async function loadEval() {
    setEvalResults(await api.getEvaluationResults());
  }
  async function loadAudit() {
    setAuditLog((await api.getAuditLog()) as any[]);
  }

  useEffect(() => {
    loadRules();
  }, []);
  useEffect(() => {
    if (tab === "evaluation") loadEval();
    if (tab === "audit") loadAudit();
  }, [tab]);

  async function toggleRule(rule: RedFlagRule) {
    await api.disableRule(rule.rule_id); // demo: disable endpoint; re-enable handled server-side via edit if needed
    loadRules();
  }

  async function runTest() {
    const result = await api.testRule("RF_CHEST_001", testInputs);
    setTestResult(result);
  }

  async function runEvaluation() {
    setEvalResults(await api.runEvaluation());
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="text-xs font-mono uppercase tracking-wide text-clinical-teal font-bold mb-1">Admin</div>
      <h1 className="text-2xl font-bold mb-4">System Configuration</h1>

      <div className="flex gap-4 border-b border-slate-200 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 text-sm font-semibold capitalize ${tab === t ? "text-clinical-blue border-b-2 border-clinical-blue" : "text-slate-400"}`}>
            {t === "rules" ? "Red-Flag Rules" : t === "test" ? "Test Rule" : t === "evaluation" ? "Evaluation" : "Audit Log"}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <div>
          <p className="text-slate-500 text-sm mb-4">Rules are versioned, configurable data — never hard-coded into UI code.</p>
          {rules.map((r) => (
            <div key={r.id} className="border border-slate-200 rounded-lg p-4 mb-3">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-sm">
                    {r.name} <span className="font-mono text-xs text-slate-400">{r.rule_id} · v{r.version}</span>
                  </h3>
                  <span className={`badge mr-2 ${r.priority === "HIGH" ? "bg-red-50 text-red-700" : r.priority === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {r.priority}
                  </span>
                  <span className={`badge ${r.enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {r.enabled ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
                <button onClick={() => toggleRule(r)} className="text-xs px-3 py-1.5 border-2 border-slate-200 rounded-lg font-semibold">
                  {r.enabled ? "Disable" : "Enable"}
                </button>
              </div>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 mt-3 overflow-auto">{JSON.stringify(r.conditions, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}

      {tab === "test" && (
        <div>
          <h3 className="font-bold text-sm mb-1">Test Red-Flag Rule: RF_CHEST_001</h3>
          <p className="text-slate-500 text-sm mb-4">Calls the same engine used in production evaluation.</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {Object.keys(testInputs).map((k) => (
              <div key={k}>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">{k.replace(/_/g, " ")}</label>
                <select className="w-full border-2 border-slate-200 rounded-lg p-2 text-sm"
                  value={testInputs[k] ? "true" : "false"}
                  onChange={(e) => setTestInputs({ ...testInputs, [k]: e.target.value === "true" })}>
                  <option value="true">YES</option>
                  <option value="false">NO</option>
                </select>
              </div>
            ))}
          </div>
          <button onClick={runTest} className="px-4 py-2 bg-clinical-blue text-white rounded-lg text-sm font-semibold">RUN TEST</button>
          {testResult && (
            <div className={`mt-4 rounded-lg p-4 border ${testResult.fires ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="font-bold text-sm">{testResult.fires ? "HIGH PRIORITY — RULE FIRES" : "No red flag"}</div>
              <pre className="text-xs font-mono text-slate-400 mt-1">{JSON.stringify(testInputs)}</pre>
            </div>
          )}
        </div>
      )}

      {tab === "evaluation" && (
        <div>
          <p className="text-slate-500 text-sm mb-4">Computed from synthetic ground-truth datasets in /evaluation. Never fabricated.</p>
          <button onClick={runEvaluation} className="px-4 py-2 bg-clinical-blue text-white rounded-lg text-sm font-semibold mb-4">Run Evaluation</button>
          {!evalResults || evalResults.status === "NOT_YET_EVALUATED" ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 font-bold text-amber-700 text-sm">NOT YET EVALUATED</div>
          ) : (
            <div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-200">
                    <th className="py-2">Metric</th><th>Precision</th><th>Recall</th><th>F1</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(evalResults.metrics || {})
                    .filter(([, m]: any) => m.f1 !== undefined)
                    .map(([name, m]: any) => (
                      <tr key={name} className="border-b border-slate-100">
                        <td className="py-2 capitalize">{name.replace(/_/g, " ")}</td>
                        <td className="font-mono">{Math.round(m.precision * 100)}%</td>
                        <td className="font-mono">{Math.round(m.recall * 100)}%</td>
                        <td className="font-mono font-bold">{Math.round(m.f1 * 100)}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {evalResults.metrics?.red_flag_engine && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <StatCard label="Red-flag sensitivity" value={`${Math.round(evalResults.metrics.red_flag_engine.sensitivity * 100)}%`} />
                  <StatCard label="Red-flag specificity" value={`${Math.round(evalResults.metrics.red_flag_engine.specificity * 100)}%`} />
                  <StatCard label="False negative rate" value={`${Math.round(evalResults.metrics.red_flag_engine.false_negative_rate * 100)}%`} />
                </div>
              )}
              <p className="text-xs text-slate-400 mt-3">Computed at {evalResults.computed_at}.</p>
            </div>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div>
          <p className="text-slate-500 text-sm mb-4">{auditLog.length} events recorded.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-200">
                <th className="py-2">Time</th><th>Event</th><th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((l: any) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2 font-mono text-xs whitespace-nowrap">{l.timestamp}</td>
                  <td>{l.event}</td>
                  <td className="text-slate-400">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="text-xs font-mono uppercase tracking-wide text-clinical-teal font-bold mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

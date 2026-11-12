import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRawFetch } from '../../lib/api.js';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Play,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Layers,
  Activity,
  FileCheck2,
} from 'lucide-react';
import { ModeTruthBanner } from '../../components/ui/ModeTruthBanner.js';

interface ProofCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'unverified';
  evidence: string;
  checkedAt: string;
}

interface ReconciliationRow {
  id: string;
  label: string;
  ledgerValue: string;
  paypalValue: string;
  status: 'match' | 'mismatch' | 'unverified';
  ledgerRef?: string;
  paypalRef?: string;
}

interface ExternalCallItem {
  id: string;
  at: string;
  service: string;
  method: string;
  endpointTemplate: string;
  status: number | null;
  durationMs: number;
  requestId: string | null;
  providerDebugId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  ok: boolean;
  errorCode: string | null;
  meta: Record<string, unknown> | null;
}

interface WebhookLogItem {
  id: string;
  paypalEventId: string;
  type: string;
  receivedAt: string;
  verified: boolean;
  processedAt: string | null;
  error: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
}

interface ProofResponse {
  projectId: string;
  checkedAt: string;
  checks: ProofCheck[];
  reconciliation: {
    ledger: {
      totalCents: number;
      fundedCents: number;
      paidCents: number;
      heldCents: number;
      refundedCents: number;
    };
    paypalTruth: {
      captures: any[];
      batches: any[];
      capturedTotalCents: number;
    };
    matches: boolean;
    rows: ReconciliationRow[];
  };
  externalCalls: ExternalCallItem[];
  webhookTape: WebhookLogItem[];
}

export const ProofPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get('projectId');
  const [projectId, setProjectId] = useState<string>(queryProjectId || '');
  const [proofData, setProofData] = useState<ProofResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selfTestLoading, setSelfTestLoading] = useState(false);
  const [selfTestResults, setSelfTestResults] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchProof = (targetProjectId: string) => {
    if (!targetProjectId) {
      // Find latest demo project or first project
      fetch('/api/projects')
        .then((r) => (r.ok ? r.json() : []))
        .then((projects: any[]) => {
          if (projects && projects.length > 0) {
            const firstId = projects[0].id;
            setProjectId(firstId);
            fetchProof(firstId);
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
      return;
    }

    setLoading(true);
    fetch(`/api/proof/projects/${targetProjectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) {
          setProofData(json);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchProof(queryProjectId || projectId);
  }, [queryProjectId]);

  const runSelfTest = () => {
    setSelfTestLoading(true);
    apiRawFetch('/api/proof/self-test', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        setSelfTestResults(data);
        setSelfTestLoading(false);
      })
      .catch(() => setSelfTestLoading(false));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#252922] font-sans pb-16">
      <ModeTruthBanner />

      <header className="bg-white border-b border-[#E2DDD2] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#337D70] bg-[#E3EFEC] px-2 py-0.5 rounded">
                Live Verification Truth
              </span>
              <span className="text-xs text-[#5F645C] font-mono">
                Project: {projectId || 'Scanning...'}
              </span>
            </div>
            <h1 className="font-serif text-3xl font-bold text-[#202722] mt-1">
              Proof & Reconciliation Dashboard
            </h1>
            <p className="text-sm text-[#5F645C] mt-1">
              Auditing local ledger against PayPal Sandbox API endpoints and LLM review execution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runSelfTest}
              disabled={selfTestLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded bg-[#202722] text-white hover:bg-[#2F3732] shadow-sm transition-colors"
            >
              <Play className={`w-3.5 h-3.5 text-amber-300 ${selfTestLoading ? 'animate-spin' : ''}`} />
              Run Live Self-Test
            </button>
            <button
              type="button"
              onClick={() => fetchProof(projectId)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded bg-white border border-[#D5CFBE] text-[#252922] hover:bg-[#EAE5D9] shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#337D70]' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Self-Test Notification Card */}
        {selfTestResults && (
          <section
            aria-label="Self-test results"
            className="p-4 rounded-lg bg-white border border-[#337D70] shadow-sm"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DDD2]">
              <div className="flex items-center gap-2 font-semibold text-sm text-[#202722]">
                <ShieldCheck className="w-4 h-4 text-[#337D70]" />
                Live Self-Test Execution Results
              </div>
              <span className="text-xs font-mono text-[#5F645C]">
                {new Date(selfTestResults.testedAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {selfTestResults.results.map((r: any, idx: number) => (
                <div key={idx} className="p-2.5 rounded bg-[#F8F6F0] border border-[#E2DDD2] text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#202722]">{r.step}</span>
                    <span className="text-[#337D70] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5F645C] font-mono leading-relaxed">{r.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Split: Reconciliation Table & Environment Checks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Section 1: Reconciliation Table (2 cols on lg) */}
          <section className="lg:col-span-2 bg-white rounded-lg border border-[#E2DDD2] shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#E2DDD2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#337D70]" />
                <h2 className="font-serif text-lg font-bold text-[#202722]">
                  Ledger vs. PayPal Sandbox Reconciliation
                </h2>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded inline-flex items-center gap-1 ${
                  proofData?.reconciliation.matches
                    ? 'bg-[#E3EFEC] text-[#1E4D40] border border-[#C3DCD5]'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {proofData?.reconciliation.matches ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Reconciled
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" /> Discrepancy Detected
                  </>
                )}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F3] border-b border-[#E2DDD2] text-[#5F645C] font-medium">
                    <th className="py-2.5 px-4">Entity</th>
                    <th className="py-2.5 px-4">Our Ledger Truth</th>
                    <th className="py-2.5 px-4">PayPal Sandbox Truth</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD2]">
                  {proofData?.reconciliation.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAF8F3]/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-[#202722]">
                        {row.label}
                        {row.ledgerRef && (
                          <div className="text-[11px] font-mono text-[#5F645C] mt-0.5 flex items-center gap-1">
                            Ref: {row.ledgerRef.substring(0, 14)}...
                            <button
                              type="button"
                              onClick={() => copyToClipboard(row.ledgerRef!, `led_${row.id}`)}
                              className="text-[#337D70] hover:text-[#202722]"
                              aria-label="Copy reference"
                            >
                              {copiedId === `led_${row.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#202722]">
                        {row.ledgerValue}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-semibold text-[#202722]">{row.paypalValue}</span>
                        {row.paypalRef && (
                          <div className="text-[11px] text-[#5F645C] mt-0.5 flex items-center gap-1">
                            Batch: {row.paypalRef.substring(0, 14)}...
                            <button
                              type="button"
                              onClick={() => copyToClipboard(row.paypalRef!, `pay_${row.id}`)}
                              className="text-[#337D70] hover:text-[#202722]"
                              aria-label="Copy batch id"
                            >
                              {copiedId === `pay_${row.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.status === 'match' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#E3EFEC] text-[#1E4D40]">
                            <CheckCircle2 className="w-3 h-3 text-[#337D70]" /> Match
                          </span>
                        ) : row.status === 'mismatch' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 text-red-600" /> Mismatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Unverified
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!proofData?.reconciliation.rows || proofData.reconciliation.rows.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#5F645C] italic">
                        No ledger or milestone data recorded yet for this workspace.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[#FAF8F3] border-t border-[#E2DDD2] mt-auto flex items-center justify-between text-xs text-[#5F645C]">
              <span>Last reconciled: {proofData ? new Date(proofData.checkedAt).toLocaleTimeString() : 'N/A'}</span>
              <a
                href="https://sandbox.paypal.com"
                target="_blank"
                rel="noreferrer"
                className="text-[#337D70] hover:underline flex items-center gap-1 font-medium"
              >
                Inspect in Sandbox Portal <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </section>

          {/* Section 2: Environment & System Checks (1 col on lg) */}
          <section className="bg-white rounded-lg border border-[#E2DDD2] shadow-sm p-5 flex flex-col">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E2DDD2]">
              <Layers className="w-5 h-5 text-[#337D70]" />
              <h2 className="font-serif text-lg font-bold text-[#202722]">
                Environment Verification
              </h2>
            </div>

            <div className="divide-y divide-[#E2DDD2] mt-2 flex-1">
              {proofData?.checks.map((check) => (
                <div key={check.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#202722]">{check.label}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        check.status === 'pass'
                          ? 'bg-[#E3EFEC] text-[#1E4D40]'
                          : check.status === 'fail'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5F645C] mt-1 font-mono leading-relaxed">
                    {check.evidence}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Section 3: Call Tape (External Calls Log) */}
        <section className="bg-white rounded-lg border border-[#E2DDD2] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E2DDD2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#337D70]" />
              <div>
                <h2 className="font-serif text-lg font-bold text-[#202722]">
                  External Call Tape (Last 25 Outbound Requests)
                </h2>
                <p className="text-xs text-[#5F645C]">
                  Live telemetry: zero secrets or request bodies logged per §3.1.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#5F645C]">
              {proofData?.externalCalls.length || 0} calls recorded
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF8F3] border-b border-[#E2DDD2] text-[#5F645C] font-medium z-10">
                <tr>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Service</th>
                  <th className="py-2.5 px-4">Endpoint Template</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Duration</th>
                  <th className="py-2.5 px-4">Provider Debug ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD2] font-mono text-[11px]">
                {proofData?.externalCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-[#FAF8F3]/60 transition-colors">
                    <td className="py-2.5 px-4 text-[#5F645C]">
                      {new Date(call.at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          call.service === 'paypal'
                            ? 'bg-blue-100 text-blue-800'
                            : call.service === 'llm'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {call.service}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#202722]">
                      <span className="font-bold text-[#337D70] mr-1.5">{call.method}</span>
                      {call.endpointTemplate}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-semibold ${
                          call.ok ? 'text-[#337D70]' : 'text-red-600'
                        }`}
                      >
                        {call.status || (call.ok ? 200 : 500)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#5F645C]">{call.durationMs}ms</td>
                    <td className="py-2.5 px-4 text-[#5F645C]">
                      {call.providerDebugId ? (
                        <span className="flex items-center gap-1">
                          {call.providerDebugId.substring(0, 16)}...
                          <button
                            type="button"
                            onClick={() => copyToClipboard(call.providerDebugId!, `call_${call.id}`)}
                            className="text-[#337D70] hover:text-[#202722]"
                            aria-label="Copy debug ID"
                          >
                            {copiedId === `call_${call.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
                {(!proofData?.externalCalls || proofData.externalCalls.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#5F645C] italic font-sans">
                      No external calls recorded yet. Execute a funding or planning action to see live telemetry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Webhook Tape */}
        <section className="bg-white rounded-lg border border-[#E2DDD2] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E2DDD2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#337D70]" />
              <h2 className="font-serif text-lg font-bold text-[#202722]">
                Webhook Tape (Ingested PayPal Events)
              </h2>
            </div>
            <span className="text-xs font-mono text-[#5F645C]">
              {proofData?.webhookTape.length || 0} events
            </span>
          </div>

          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF8F3] border-b border-[#E2DDD2] text-[#5F645C] font-medium z-10">
                <tr>
                  <th className="py-2.5 px-4">Received</th>
                  <th className="py-2.5 px-4">Event Type</th>
                  <th className="py-2.5 px-4">Event ID</th>
                  <th className="py-2.5 px-4">Signature</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD2] font-mono text-[11px]">
                {proofData?.webhookTape.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#FAF8F3]/60 transition-colors">
                    <td className="py-2.5 px-4 text-[#5F645C]">
                      {new Date(ev.receivedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#202722]">{ev.type}</td>
                    <td className="py-2.5 px-4 text-[#5F645C]">{ev.paypalEventId}</td>
                    <td className="py-2.5 px-4">
                      {ev.verified ? (
                        <span className="text-[#337D70] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Unverified</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-[#5F645C]">
                      {ev.processedAt ? 'Processed' : ev.error || 'Received'}
                    </td>
                  </tr>
                ))}
                {(!proofData?.webhookTape || proofData.webhookTape.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#5F645C] italic font-sans">
                      No webhook notifications received yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getRunState, approveRun, RunState } from "@/lib/api";
import DiffViewer from "@/components/DiffViewer";

const WorkflowGraph = dynamic(() => import("@/components/WorkflowGraph"), { ssr: false });

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  running:           { label: "Running…",             color: "text-blue-400" },
  awaiting_approval: { label: "Awaiting your approval", color: "text-amber-400" },
  completed:         { label: "Completed",              color: "text-emerald-400" },
  rejected:          { label: "Rejected",               color: "text-slate-500" },
  failed:            { label: "Failed",                 color: "text-red-400" },
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [state, setState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getRunState(id);
      setState(s);
      setActiveNode(s.next_node[0] ?? null);
    } catch {
      setError("Failed to load run state.");
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleDecision(decision: "approved" | "rejected" | "revised") {
    setActionLoading(true);
    try {
      await approveRun(id, decision, instructions);
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading run…
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[state.status] ?? { label: state.status, color: "text-slate-400" };
  const awaitingApproval = state.status === "awaiting_approval";

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Top nav */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          All runs
        </button>
        <span className="text-white/15">·</span>
        <span className="text-sm text-slate-300 truncate">{state.issue_title || id}</span>
        <div className="ml-auto flex items-center gap-4">
          {state.run_cost_usd > 0 && (
            <span className="text-xs font-mono text-slate-500">${state.run_cost_usd.toFixed(4)}</span>
          )}
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Left sidebar — workflow */}
        <aside className="w-64 shrink-0 border-r border-white/8 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Workflow</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <WorkflowGraph activeNode={activeNode} runStatus={state.status} />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

          {/* PR opened banner */}
          {state.pr_url && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-400">Pull Request Opened</p>
                <p className="text-xs text-emerald-600 mt-0.5">The agent successfully created a PR on GitHub.</p>
              </div>
              <a
                href={state.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition whitespace-nowrap"
              >
                View PR →
              </a>
            </div>
          )}

          {/* Approval panel — pinned at top when waiting */}
          {awaitingApproval && (
            <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/8 px-5 py-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="w-2 h-2 mt-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-300">Your approval is needed</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Review the plan and changes below, then decide.
                  </p>
                </div>
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Optional: instructions for revision (required if clicking Revise)"
                className="w-full rounded-lg border border-white/8 bg-[#0d1117] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 mb-4 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                rows={2}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleDecision("approved")}
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-5 py-2 text-sm font-semibold text-white transition"
                >
                  {actionLoading ? "Processing…" : "Approve & Open PR"}
                </button>
                <button
                  onClick={() => handleDecision("revised")}
                  disabled={actionLoading || !instructions.trim()}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-5 py-2 text-sm font-semibold text-white transition"
                >
                  Revise
                </button>
                <button
                  onClick={() => handleDecision("rejected")}
                  disabled={actionLoading}
                  className="rounded-lg bg-white/6 hover:bg-white/10 disabled:opacity-40 px-5 py-2 text-sm font-semibold text-slate-300 transition"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Plan */}
          {state.plan && (
            <SectionCard title="Plan">
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{state.plan}</p>
              {state.files_to_modify && state.files_to_modify.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {state.files_to_modify.map((f) => (
                    <span key={f} className="text-xs font-mono bg-white/6 rounded-md px-2 py-1 text-slate-400 border border-white/8">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Review */}
          {state.review_verdict && (
            <SectionCard title="Review">
              {state.review_verdict.approved ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  Approved by reviewer agent
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-red-400 mb-3">Issues found — coder will retry</p>
                  <ul className="space-y-1.5">
                    {state.review_verdict.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                        <span className="text-red-500 shrink-0 mt-0.5">×</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          )}

          {/* Diffs */}
          {state.file_diffs && state.file_diffs.length > 0 && (
            <SectionCard title={`Proposed Changes · ${state.file_diffs.length} file${state.file_diffs.length > 1 ? "s" : ""}`}>
              <DiffViewer diffs={state.file_diffs} />
            </SectionCard>
          )}
        </main>
      </div>
    </div>
  );
}

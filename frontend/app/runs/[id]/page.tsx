"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getRunState, approveRun, RunState } from "@/lib/api";
import DiffViewer from "@/components/DiffViewer";
import CostBadge from "@/components/CostBadge";

// ReactFlow must be client-only (no SSR)
const WorkflowGraph = dynamic(() => import("@/components/WorkflowGraph"), { ssr: false });

const STATUS_LABEL: Record<string, string> = {
  running: "Running…",
  awaiting_approval: "Awaiting your approval",
  completed: "Completed",
  rejected: "Rejected",
  failed: "Failed",
};

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
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-red-600 text-sm">{error}</div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </main>
    );
  }

  const awaitingApproval = state.status === "awaiting_approval";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push("/")} className="text-sm text-slate-400 hover:text-slate-600 mb-1">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-slate-900">{state.issue_title || "Run"}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{STATUS_LABEL[state.status] ?? state.status}</p>
          </div>
          <CostBadge costUsd={state.run_cost_usd} />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: workflow graph */}
          <div className="col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-700">
                Workflow
              </div>
              <WorkflowGraph activeNode={activeNode} runStatus={state.status} />
            </div>
          </div>

          {/* Right: details */}
          <div className="col-span-2 space-y-6">
            {/* Plan */}
            {state.plan && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
                <h2 className="font-semibold text-slate-800 mb-3">Plan</h2>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{state.plan}</pre>
                {state.files_to_modify && state.files_to_modify.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {state.files_to_modify.map((f) => (
                      <span key={f} className="text-xs font-mono bg-slate-100 rounded px-2 py-0.5 text-slate-600">{f}</span>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Review verdict */}
            {state.review_verdict && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
                <h2 className="font-semibold text-slate-800 mb-3">Review</h2>
                {state.review_verdict.approved ? (
                  <p className="text-sm text-emerald-600 font-medium">✓ Approved by reviewer agent</p>
                ) : (
                  <div>
                    <p className="text-sm text-red-600 font-medium mb-2">✗ Issues found</p>
                    <ul className="list-disc list-inside space-y-1">
                      {state.review_verdict.issues.map((issue, i) => (
                        <li key={i} className="text-sm text-slate-700">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Diffs */}
            {state.file_diffs && state.file_diffs.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
                <h2 className="font-semibold text-slate-800 mb-3">Proposed Changes</h2>
                <DiffViewer diffs={state.file_diffs} />
              </section>
            )}

            {/* Human approval panel */}
            {awaitingApproval && (
              <section className="rounded-xl border-2 border-amber-300 bg-amber-50 shadow-sm p-5">
                <h2 className="font-semibold text-amber-800 mb-1">Your approval is needed</h2>
                <p className="text-sm text-amber-700 mb-4">
                  Review the plan and proposed changes above, then approve to open the PR or reject to stop.
                </p>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Optional: add instructions for revision (only used if you click Revise)"
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDecision("approved")}
                    disabled={actionLoading}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    Approve & Open PR
                  </button>
                  <button
                    onClick={() => handleDecision("revised")}
                    disabled={actionLoading || !instructions.trim()}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    Revise
                  </button>
                  <button
                    onClick={() => handleDecision("rejected")}
                    disabled={actionLoading}
                    className="rounded-lg bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-50 transition"
                  >
                    Reject
                  </button>
                </div>
              </section>
            )}

            {/* PR opened */}
            {state.pr_url && (
              <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <h2 className="font-semibold text-emerald-800 mb-2">Pull Request Opened</h2>
                <a
                  href={state.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline break-all"
                >
                  {state.pr_url}
                </a>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

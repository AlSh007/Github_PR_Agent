"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRun, getRuns, Run } from "@/lib/api";
import CostBadge from "@/components/CostBadge";

const STATUS_COLORS: Record<string, string> = {
  running: "bg-blue-100 text-blue-700",
  awaiting_approval: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-slate-100 text-slate-600",
  failed: "bg-red-100 text-red-700",
};

export default function Home() {
  const router = useRouter();
  const [issueUrl, setIssueUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    getRuns().then(setRuns).catch(() => {});
    const interval = setInterval(() => getRuns().then(setRuns).catch(() => {}), 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { run_id } = await createRun(issueUrl);
      router.push(`/runs/${run_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">GitHub Issue → PR Agent</h1>
          <p className="mt-2 text-slate-500">
            Paste a GitHub issue URL. The agent will plan, code, review, and open a pull request.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="url"
            placeholder="https://github.com/owner/repo/issues/123"
            value={issueUrl}
            onChange={(e) => setIssueUrl(e.target.value)}
            required
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "Starting…" : "Run Agent"}
          </button>
        </form>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {runs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Runs</h2>
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => router.push(`/runs/${run.id}`)}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm cursor-pointer hover:border-blue-300 transition"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{run.issue_title || run.issue_url}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{run.repo}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <CostBadge costUsd={run.cost_usd ?? 0} />
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[run.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {run.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRun, getRuns, Run } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  running:           { label: "Running",           dot: "bg-blue-400 animate-pulse", text: "text-blue-400" },
  awaiting_approval: { label: "Needs review",      dot: "bg-amber-400 animate-pulse", text: "text-amber-400" },
  completed:         { label: "Completed",          dot: "bg-emerald-400", text: "text-emerald-400" },
  rejected:          { label: "Rejected",           dot: "bg-slate-500", text: "text-slate-500" },
  failed:            { label: "Failed",             dot: "bg-red-500", text: "text-red-400" },
};

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.failed;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
      <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function Home() {
  const router = useRouter();
  const [issueUrl, setIssueUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    getRuns().then(setRuns).catch(() => {});
    const id = setInterval(() => getRuns().then(setRuns).catch(() => {}), 5000);
    return () => clearInterval(id);
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
    <div className="min-h-screen bg-[#0d1117]">
      {/* Top nav */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </div>
        <span className="font-semibold text-white text-sm">PR Agent</span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Powered by LangGraph + Groq
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            GitHub Issue → Pull Request
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Paste an issue URL. Agents will plan, write code, review it, then open a real PR — with your approval.
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
          <input
            type="url"
            placeholder="https://github.com/owner/repo/issues/123"
            value={issueUrl}
            onChange={(e) => setIssueUrl(e.target.value)}
            required
            className="flex-1 rounded-xl bg-white/6 border border-white/10 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-6 py-3 text-sm font-semibold text-white transition flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Starting…
              </>
            ) : "Run Agent →"}
          </button>
        </form>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 mb-8">
            {error}
          </div>
        )}

        {/* Run history */}
        {runs.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Recent Runs</h2>
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => router.push(`/runs/${run.id}`)}
                  className="group flex items-center justify-between rounded-xl border border-white/6 bg-white/4 hover:bg-white/8 hover:border-white/12 px-5 py-4 cursor-pointer transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate text-sm">{run.issue_title || run.issue_url}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{run.repo} · {timeAgo(run.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-4 shrink-0">
                    {run.cost_usd > 0 && (
                      <span className="text-xs font-mono text-slate-400">${run.cost_usd.toFixed(4)}</span>
                    )}
                    <StatusDot status={run.status} />
                    <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {runs.length === 0 && !loading && (
          <p className="text-center text-slate-600 text-sm mt-12">No runs yet. Paste an issue URL above to get started.</p>
        )}
      </div>
    </div>
  );
}

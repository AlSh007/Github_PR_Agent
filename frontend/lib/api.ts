const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Run {
  id: string;
  issue_url: string;
  issue_title: string;
  repo: string;
  status: "running" | "awaiting_approval" | "completed" | "rejected" | "failed";
  pr_url: string | null;
  cost_usd: number;
  created_at: string;
}

export interface RunState {
  run_id: string;
  status: string;
  issue_title: string | null;
  plan: string | null;
  files_to_modify: string[] | null;
  file_diffs: { path: string; content: string }[] | null;
  review_verdict: { approved: boolean; issues: string[] } | null;
  run_cost_usd: number;
  pr_url: string | null;
  next_node: string[];
}

export async function createRun(issueUrl: string): Promise<{ run_id: string; status: string }> {
  const res = await fetch(`${API}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_url: issueUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Failed to create run");
  }
  return res.json();
}

export async function getRuns(): Promise<Run[]> {
  const res = await fetch(`${API}/runs`);
  if (!res.ok) throw new Error("Failed to fetch runs");
  return res.json();
}

export async function getRunState(runId: string): Promise<RunState> {
  const res = await fetch(`${API}/runs/${runId}/state`);
  if (!res.ok) throw new Error("Run not found");
  return res.json();
}

export async function approveRun(
  runId: string,
  decision: "approved" | "rejected" | "revised",
  extraInstructions = ""
): Promise<{ run_id: string; status: string; pr_url: string | null; run_cost_usd: number }> {
  const res = await fetch(`${API}/runs/${runId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, extra_instructions: extraInstructions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Approval failed");
  }
  return res.json();
}

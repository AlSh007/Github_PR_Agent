"use client";

import ReactFlow, { Node, Edge, Background, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

const NODES_ORDER = ["repo_explorer", "planner", "file_fetcher", "coder", "reviewer", "human_approval", "pr_writer"];
const LABELS: Record<string, string> = {
  repo_explorer:  "Repo Explorer",
  planner:        "Planner",
  file_fetcher:   "File Fetcher",
  coder:          "Coder",
  reviewer:       "Reviewer",
  human_approval: "Human Approval",
  pr_writer:      "PR Writer",
};

type NodeStatus = "pending" | "active" | "done" | "final";

function getNodeStatus(name: string, activeNode: string | null, runStatus: string): NodeStatus {
  const idx = NODES_ORDER.indexOf(name);
  const activeIdx = NODES_ORDER.indexOf(activeNode ?? "");

  if (runStatus === "completed") return name === "pr_writer" ? "final" : "done";
  if (activeNode === name) return "active";
  if (activeIdx > idx) return "done";
  return "pending";
}

const NODE_STYLES: Record<NodeStatus, React.CSSProperties> = {
  pending: { background: "#1c2333", border: "1px solid #30363d", color: "#8b949e" },
  active:  { background: "#1f3a5f", border: "1px solid #388bfd", color: "#79c0ff", fontWeight: 600 },
  done:    { background: "#132b1e", border: "1px solid #238636", color: "#3fb950" },
  final:   { background: "#1a4731", border: "2px solid #3fb950", color: "#56d364", fontWeight: 700 },
};

interface Props {
  activeNode: string | null;
  runStatus: string;
}

export default function WorkflowGraph({ activeNode, runStatus }: Props) {
  const nodes: Node[] = NODES_ORDER.map((id, i) => {
    const status = getNodeStatus(id, activeNode, runStatus);
    return {
      id,
      position: { x: 60, y: i * 82 },
      data: {
        label: (
          <div className="flex items-center gap-2">
            {status === "active" && (
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
            )}
            {status === "done" && (
              <span className="text-emerald-400 shrink-0">✓</span>
            )}
            {status === "final" && (
              <span className="text-emerald-400 shrink-0">✓</span>
            )}
            {status === "pending" && (
              <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
            )}
            <span>{LABELS[id]}</span>
          </div>
        ),
      },
      style: {
        ...NODE_STYLES[status],
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 12,
        minWidth: 148,
        textAlign: "left" as const,
      },
    };
  });

  const edges: Edge[] = NODES_ORDER.slice(0, -1).map((src, i) => ({
    id: `e-${i}`,
    source: src,
    target: NODES_ORDER[i + 1],
    markerEnd: { type: MarkerType.ArrowClosed, color: "#30363d" },
    style: { stroke: "#30363d", strokeWidth: 1.5 },
  }));

  return (
    <div style={{ height: 680, width: "100%", background: "#0d1117" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
      >
        <Background color="#21262d" gap={20} />
      </ReactFlow>
    </div>
  );
}

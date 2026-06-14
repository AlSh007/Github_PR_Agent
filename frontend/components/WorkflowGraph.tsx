"use client";

import ReactFlow, { Node, Edge, Background, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

const NODES_ORDER = ["planner", "file_fetcher", "coder", "reviewer", "human_approval", "pr_writer"];
const LABELS: Record<string, string> = {
  planner: "Planner",
  file_fetcher: "File Fetcher",
  coder: "Coder",
  reviewer: "Reviewer",
  human_approval: "Human Approval",
  pr_writer: "PR Writer",
};

function statusColor(nodeName: string, activeNode: string | null, runStatus: string): string {
  const idx = NODES_ORDER.indexOf(nodeName);
  const activeIdx = NODES_ORDER.indexOf(activeNode ?? "");

  if (runStatus === "completed" || (activeIdx === -1 && runStatus !== "running")) {
    return nodeName === "pr_writer" && runStatus === "completed" ? "#22c55e" : "#94a3b8";
  }
  if (activeNode === nodeName) return "#f59e0b";
  if (activeIdx > idx) return "#22c55e";
  return "#cbd5e1";
}

interface Props {
  activeNode: string | null;
  runStatus: string;
}

export default function WorkflowGraph({ activeNode, runStatus }: Props) {
  const nodes: Node[] = NODES_ORDER.map((id, i) => ({
    id,
    position: { x: 250, y: i * 100 },
    data: { label: LABELS[id] },
    style: {
      background: statusColor(id, activeNode, runStatus),
      border: activeNode === id ? "2px solid #f59e0b" : "1px solid #e2e8f0",
      borderRadius: 8,
      padding: "8px 16px",
      fontWeight: activeNode === id ? 700 : 400,
      color: activeNode === id ? "#fff" : "#1e293b",
      minWidth: 140,
      textAlign: "center" as const,
    },
  }));

  const edges: Edge[] = NODES_ORDER.slice(0, -1).map((src, i) => ({
    id: `e-${i}`,
    source: src,
    target: NODES_ORDER[i + 1],
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#94a3b8" },
  }));

  return (
    <div style={{ height: 640, width: "100%" }}>
      <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

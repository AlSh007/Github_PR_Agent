"use client";

import { useState } from "react";

interface FileDiff {
  path: string;
  content: string;
}

export default function DiffViewer({ diffs }: { diffs: FileDiff[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!diffs || diffs.length === 0)
    return <p className="text-slate-500 text-sm">No changes produced yet.</p>;

  return (
    <div className="space-y-3">
      {diffs.map((d) => {
        const isOpen = expanded[d.path] !== false; // default open
        return (
          <div key={d.path} className="rounded-lg border border-white/8 overflow-hidden">
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [d.path]: !isOpen }))}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white/4 hover:bg-white/6 transition text-left"
            >
              <span className="text-xs font-mono text-slate-300">{d.path}</span>
              <svg
                className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <pre className="px-4 py-3 text-xs font-mono overflow-x-auto text-slate-300 bg-[#0d1117] max-h-80 leading-relaxed">
                {d.content}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

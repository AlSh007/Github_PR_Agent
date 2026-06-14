"use client";

interface FileDiff {
  path: string;
  content: string;
}

interface Props {
  diffs: FileDiff[];
}

export default function DiffViewer({ diffs }: Props) {
  if (!diffs || diffs.length === 0) return <p className="text-slate-400 text-sm">No changes produced yet.</p>;

  return (
    <div className="space-y-4">
      {diffs.map((d) => (
        <div key={d.path} className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 text-sm font-mono font-semibold text-slate-700 border-b border-slate-200">
            {d.path}
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto bg-white text-slate-800 max-h-72">
            {d.content}
          </pre>
        </div>
      ))}
    </div>
  );
}

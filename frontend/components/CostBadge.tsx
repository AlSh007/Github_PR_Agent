interface Props {
  costUsd: number;
}

export default function CostBadge({ costUsd }: Props) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
      ${costUsd.toFixed(4)}
    </span>
  );
}

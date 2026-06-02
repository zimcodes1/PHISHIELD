import { useState } from "react";

interface LayerResult {
  name: string;
  score: number;
  reasons: string[];
  weight: number;
}

interface Props {
  layers: LayerResult[];
}

export default function LayerBreakdown({ layers }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  if (!layers.length) return null;

  return (
    <div className="space-y-2">
      {layers.map((layer) => {
        const pct = Math.round(layer.score * 100);
        const barColor = pct >= 70 ? "bg-danger" : pct >= 40 ? "bg-caution" : "bg-safe";
        const isOpen = open === layer.name;

        return (
          <div key={layer.name} className="border border-outline rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : layer.name)}
              className="w-full flex items-center gap-4 px-4 py-3 bg-canvas hover:bg-subtle transition cursor-pointer"
            >
              <span className="text-sm font-medium text-ink w-28 text-left">{layer.name}</span>
              {/* Score bar */}
              <div className="flex-1 h-2 bg-outline rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-ink w-10 text-right">{pct}%</span>
              <i className={`bx ${isOpen ? "bx-chevron-up" : "bx-chevron-down"} text-ink-muted text-lg`} />
            </button>

            {isOpen && layer.reasons.length > 0 && (
              <ul className="px-4 pb-3 pt-1 space-y-1 border-t border-outline bg-subtle">
                {layer.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-muted">
                    <i className="bx bx-right-arrow-alt text-brand-400 mt-0.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

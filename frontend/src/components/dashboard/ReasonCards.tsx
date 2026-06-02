interface Props {
  reasons: string[];
}

const layerTag = (reason: string) => {
  if (reason.toLowerCase().includes("spf") || reason.toLowerCase().includes("dkim") || reason.toLowerCase().includes("dmarc") || reason.toLowerCase().includes("header"))
    return { label: "Headers", color: "bg-brand-100 text-brand-700" };
  if (reason.toLowerCase().includes("url") || reason.toLowerCase().includes("domain") || reason.toLowerCase().includes("whois") || reason.toLowerCase().includes("ip"))
    return { label: "URL", color: "bg-caution/15 text-caution" };
  return { label: "AI", color: "bg-safe/15 text-safe" };
};

export default function ReasonCards({ reasons }: Props) {
  if (!reasons.length) return null;

  return (
    <div className="space-y-2">
      {reasons.map((reason, i) => {
        const tag = layerTag(reason);
        return (
          <div key={i} className="flex items-start gap-3 bg-subtle border border-outline rounded-xl px-4 py-3">
            <i className="bx bx-error-circle text-caution text-lg mt-0.5 shrink-0" />
            <p className="text-sm text-ink flex-1">{reason}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${tag.color}`}>
              {tag.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

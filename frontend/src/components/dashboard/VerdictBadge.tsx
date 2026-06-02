type Verdict = "clean" | "suspicious" | "phishing";

interface Props {
  verdict: Verdict;
  size?: "sm" | "md";
}

const config: Record<Verdict, { icon: string; label: string; classes: string }> = {
  clean:      { icon: "bx-shield-check",  label: "Clean",      classes: "bg-safe/15 text-safe border-safe/30" },
  suspicious: { icon: "bx-error",         label: "Suspicious", classes: "bg-caution/15 text-caution border-caution/30" },
  phishing:   { icon: "bx-shield-x",      label: "Phishing",   classes: "bg-danger/15 text-danger border-danger/30" },
};

export default function VerdictBadge({ verdict, size = "md" }: Props) {
  const { icon, label, classes } = config[verdict];
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full font-semibold ${classes} ${size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}>
      <i className={`bx ${icon} ${size === "md" ? "text-base" : "text-sm"}`} />
      {label}
    </span>
  );
}

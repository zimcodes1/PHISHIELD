interface Props {
  score: number; // 0–100
}

export default function ScoreGauge({ score }: Props) {
  const radius = 54;
  const stroke = 10;
  const cx = 70;
  const cy = 70;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 70 ? "#ef4444" :
    score >= 40 ? "#f59e0b" :
    "#22c55e";

  const label =
    score >= 70 ? "Phishing" :
    score >= 40 ? "Suspicious" :
    "Clean";

  const labelColor =
    score >= 70 ? "text-danger" :
    score >= 40 ? "text-caution" :
    "text-safe";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
        />
        {/* Score text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="26" fontWeight="700" fill={color}>
          {score}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#64748b">
          out of 100
        </text>
      </svg>
      <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
    </div>
  );
}

/**
 * Animated verdict gauge - displays risk score 0-100 as a colored arc
 */

interface VerdictGaugeProps {
  score: number // 0-100
  verdict: 'Clean' | 'Suspicious' | 'Phishing'
}

export function VerdictGauge({ score, verdict }: VerdictGaugeProps) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const percentage = Math.min(Math.max(score, 0), 100) / 100
  const strokeDashoffset = circumference * (1 - percentage)

  // Color based on verdict
  const colorMap = {
    Clean: '#4CAF50',
    Suspicious: '#FFC107',
    Phishing: '#F44336'
  }

  const gaugeColor = colorMap[verdict]

  // Determine badge color (separate from gauge)
  const badgeColor = {
    Clean: 'bg-green-500',
    Suspicious: 'bg-yellow-500',
    Phishing: 'bg-red-500'
  }[verdict]

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4">
      {/* SVG Gauge */}
      <div className="relative w-32 h-32">
        <svg width="128" height="128" viewBox="0 0 128 128" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="#E5E5E5"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold">{score}</div>
          <div className="text-xs text-gray-500">%</div>
        </div>
      </div>

      {/* Verdict badge */}
      <div
        className={`${badgeColor} text-white px-4 py-2 rounded-full font-semibold text-sm uppercase tracking-wide`}
      >
        {verdict}
      </div>
    </div>
  )
}

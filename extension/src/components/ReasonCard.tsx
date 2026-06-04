/**
 * Individual reason card displayed under the verdict
 */

interface ReasonCardProps {
  reason: string
  source?: string // e.g., "Model A", "NLP", "Reputation"
}

export function ReasonCard({ reason, source }: ReasonCardProps) {
  const sourceColorMap: Record<string, string> = {
    'Model A': 'bg-blue-100 text-blue-700',
    'NLP': 'bg-purple-100 text-purple-700',
    'Reputation': 'bg-orange-100 text-orange-700',
    'Headers': 'bg-cyan-100 text-cyan-700',
    'Visual': 'bg-pink-100 text-pink-700'
  }

  const badgeClass = source ? sourceColorMap[source] : 'bg-gray-100 text-gray-700'

  return (
    <div className="flex gap-2 items-start py-2">
      <span className="text-red-500 text-lg leading-none mt-0.5">•</span>
      <div className="flex-1">
        <p className="text-sm text-gray-700">{reason}</p>
        {source && (
          <span className={`inline-block text-xs font-medium px-2 py-1 rounded mt-1 ${badgeClass}`}>
            {source}
          </span>
        )}
      </div>
    </div>
  )
}

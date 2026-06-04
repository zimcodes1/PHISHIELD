/**
 * Results display panel - shows verdict, score, and reasons
 */

import { VerdictGauge } from './VerdictGauge'
import { ReasonCard } from './ReasonCard'
import type { AnalysisResult } from '../types/messages'

interface ResultsPanelProps {
  result: AnalysisResult
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Gauge */}
      <VerdictGauge score={result.score} verdict={result.verdict} />

      {/* Reasons */}
      {result.reasons.length > 0 && (
        <div className="w-full bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Top Reasons
          </p>
          <div className="space-y-1">
            {result.reasons.map((reason, idx) => (
              <ReasonCard
                key={idx}
                reason={reason}
                source={idx === 0 ? 'Model A' : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Visual analysis pending indicator */}
      {result.phase2Pending && (
        <div className="w-full bg-blue-50 rounded-lg p-2 text-center">
          <p className="text-xs text-blue-700 flex items-center justify-center gap-1">
            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Analyzing visual similarity
          </p>
        </div>
      )}

      {/* Footer - timestamp */}
      <p className="text-xs text-gray-400 mt-1">
        {new Date(result.timestamp).toLocaleTimeString()}
      </p>
    </div>
  )
}

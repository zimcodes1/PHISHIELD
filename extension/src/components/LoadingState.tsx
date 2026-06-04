/**
 * Loading state display
 */

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      {/* Spinner */}
      <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />

      {/* Text */}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">Analyzing site</p>
        <p className="text-xs text-gray-500 mt-1">This takes a few seconds</p>
      </div>
    </div>
  )
}

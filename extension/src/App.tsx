/**
 * PhishShield Extension Popup UI
 * Minimal design: displays verdict gauge and reasons
 * Automatically updates as service worker analyzes current tab
 */

import { useEffect, useState } from 'react'
import { LoadingState } from './components/LoadingState'
import { ResultsPanel } from './components/ResultsPanel'
import type { AnalysisResult, AnalysisUpdateNotification } from './types/messages'

type PopupState = 'idle' | 'loading' | 'results'

function App() {
  const [state, setState] = useState<PopupState>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)

  // ── Initialize: Get current tab and check for existing analysis ────────

  useEffect(() => {
    const initializePopup = async () => {
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tabId = tabs[0]?.id

      if (!tabId) {
        setState('idle')
        return
      }

      setCurrentTabId(tabId)

      // Request stored analysis result from service worker
      chrome.runtime.sendMessage(
        { type: 'getAnalysisResult', tabId },
        (response) => {
          if (response?.result) {
            setResult(response.result)
            setState('results')
          } else {
            setState('idle')
          }
        }
      )
    }

    initializePopup()
  }, [])

  // ── Listen for updates from service worker ────────────────────────────

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'analysisUpdate') {
        const update: AnalysisUpdateNotification = message
        setResult(update.result)
        setState('results')
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  // ── Trigger analysis on mount if no result yet ─────────────────────────

  useEffect(() => {
    if (state === 'idle' && currentTabId) {
      const triggerAnalysis = async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        const tab = tabs[0]

        if (tab?.url?.startsWith('http')) {
          setState('loading')
          // Service worker will trigger analysis via onUpdated listener
          // Reload tab to trigger onUpdated, or wait for user to navigate
        }
      }

      triggerAnalysis()
    }
  }, [state, currentTabId])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-140 w-75 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-gray-900">PhishShield</div>
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">BETA</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {state === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-4xl">🛡️</div>
            <p className="text-center text-sm text-gray-600">
              PhishShield is ready
            </p>
            <p className="text-center text-xs text-gray-500">
              Visit a website to check if it's phishing
            </p>
          </div>
        )}

        {state === 'loading' && <LoadingState />}

        {state === 'results' && result && <ResultsPanel result={result} />}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 text-center text-xs text-gray-500">
        <p>Protecting you from phishing • v1.0.0</p>
      </div>
    </div>
  )
}

export default App

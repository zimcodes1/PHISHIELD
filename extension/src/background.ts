/**
 * PhishShield Service Worker (background script)
 * Handles tab monitoring, feature extraction, model inference, and orchestration
 */

import { extractTier1Features, extractTier2Features, mergeFeatures, getNeutralDomInfo } from './utils/featureExtractors'
import type { DomInfo } from './utils/featureExtractors'
import { loadOnnxModel, runInference, isModelLoaded } from './utils/onnxInference'
import { analyzeUrl } from './utils/apiClient'
import { getAnalysisResult, setAnalysisResult, clearAnalysisResult } from './utils/storage'
import { setBadge, clearBadge } from './utils/badge'
import type { AnalysisResult, ExtractDomFeaturesRequest, InjectBannerRequest } from './types/messages'

// ── Global State ──────────────────────────────────────────────────────────

const tabsInProgress = new Set<number>() // Prevent duplicate analysis for same tab

// ── Initialization ────────────────────────────────────────────────────────

// Load ONNX model on extension startup
loadOnnxModel()
  .then(() => {
    console.log('[PhishShield] Service worker initialized — Model A ready')
  })
  .catch((error) => {
    console.error('[PhishShield] Failed to initialize service worker:', error)
  })

// ── Event Listeners ──────────────────────────────────────────────────────

/**
 * Fired when a tab's URL changes or loading completes
 * We analyze on 'complete' to allow DOM to be ready for Tier 2 feature extraction
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return

  // Skip non-http(s) URLs and chrome:// URLs
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    clearBadge(tabId)
    return
  }

  // Skip if already analyzing
  if (tabsInProgress.has(tabId)) return

  analyzeTab(tabId, tab.url)
})

/**
 * Listen for messages from content script (DOM features) and popup (result requests)
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'domFeaturesReply') {
    // Reply from content script — handled by waiting promise
    sendResponse()
  } else if (message.type === 'getAnalysisResult') {
    // Request from popup for cached result
    getAnalysisResult(message.tabId)
      .then((result) => {
        sendResponse({ type: 'analysisResultReply', result })
      })
      .catch((error) => {
        console.error('Failed to get analysis result:', error)
        sendResponse({ type: 'analysisResultReply' })
      })
    return true // Async response
  }
})

/**
 * Clean up stored results when tab is closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  clearAnalysisResult(tabId)
  tabsInProgress.delete(tabId)
})

// ── Main Analysis Pipeline ──────────────────────────────────────────────────

async function analyzeTab(tabId: number, url: string): Promise<void> {
  tabsInProgress.add(tabId)

  try {
    const startTime = Date.now()
    console.log(`[PhishShield] Starting analysis for tab ${tabId}: ${url}`)

    // ── Phase 1A: Extract Tier 1 features (instant, no network) ───────────

    const tier1 = extractTier1Features(url)
    console.log(`[PhishShield] Tier 1 features extracted (${Date.now() - startTime}ms)`)

    // ── Phase 1B: Request Tier 2 features from content script ─────────────

    const tier2Promise = requestDomFeatures(tabId).catch((error) => {
      console.warn(`[PhishShield] DOM feature extraction failed: ${error.message}`)
      return getNeutralDomInfo()
    })

    // ── Phase 1C: Parallel — Call backend for Layers 2+ ──────────────────

    const backendPromise = analyzeUrl(url)

    // ── Phase 1D: Merge features and run local ONNX model ────────────────

    const tier2 = await tier2Promise as DomInfo
    const tier2Features = extractTier2Features(tier2)
    const mergedFeatures = mergeFeatures(tier1, tier2Features)

    let modelAScore = 0.5 // Default neutral if model unavailable
    let modelALatency = 0

    if (isModelLoaded()) {
      const modelStart = Date.now()
      try {
        const modelProb = await runInference(mergedFeatures)
        modelAScore = modelProb
        modelALatency = Date.now() - modelStart
        console.log(
          `[PhishShield] Model A inference: ${(modelProb * 100).toFixed(1)}% phishing (${modelALatency}ms)`
        )
      } catch (error) {
        console.error('[PhishShield] Model A inference failed:', error)
        modelAScore = 0.5 // Default to neutral
      }
    } else {
      console.warn('[PhishShield] Model A not ready yet')
    }

    // ── Phase 1E: Await backend results ──────────────────────────────────

    const backendResult = await backendPromise
    console.log(
      `[PhishShield] Backend analysis: ${backendResult.risk_score}% (${backendResult.verdict})`
    )

    // ── Phase 1F: Merge and create final result ──────────────────────────

    const finalResult = mergePhase1Results(tabId, url, modelAScore, backendResult)

    // ── Persist and update UI ────────────────────────────────────────────

    await setAnalysisResult(tabId, finalResult)
    await setBadge(tabId, finalResult.verdict, finalResult.score)

    console.log(
      `[PhishShield] Analysis complete (${Date.now() - startTime}ms): ${finalResult.verdict} (${finalResult.score}%)`
    )

    // ── Inject warning banner if needed ──────────────────────────────────

    if (finalResult.verdict === 'Phishing' || finalResult.verdict === 'Suspicious') {
      await injectWarningBanner(tabId, finalResult)
    }

    // ── Notify popup (if open) ───────────────────────────────────────────

    notifyPopupUpdate(finalResult)

    // ── Phase 2: Visual analysis (async, doesn't block) ──────────────────

    // TODO: Phase 2 visual analysis after initial verdict
    // This runs in background after popup is shown
  } catch (error) {
    console.error(`[PhishShield] Analysis failed for tab ${tabId}:`, error)
    clearBadge(tabId)
  } finally {
    tabsInProgress.delete(tabId)
  }
}

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Request Tier 2 DOM features from content script
 * Timeout: 2 seconds (DOM should extract quickly)
 */
async function requestDomFeatures(tabId: number) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Content script timeout (DOM features)'))
    }, 2000)

    const listener = (message: any, sender: chrome.runtime.MessageSender) => {
      if (message.type === 'domFeaturesReply' && sender.tab?.id === tabId) {
        clearTimeout(timeout)
        chrome.runtime.onMessage.removeListener(listener)

        if (message.success) {
          resolve(message.features)
        } else {
          reject(new Error(message.error || 'Unknown error'))
        }
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    // Send request to content script
    const request: ExtractDomFeaturesRequest = { type: 'extractDomFeatures' }
    chrome.tabs
      .sendMessage(tabId, request)
      .catch(() => {
        // Content script not ready — will resolve with timeout
      })
  })
}

/**
 * Merge Model A local score with backend score into final verdict
 * Model A weight: 30% (local, privacy-preserving)
 * Backend layers (NLP + Reputation) weight: 70%
 */
function mergePhase1Results(
  tabId: number,
  url: string,
  modelAScore: number,
  backendResult: any
): AnalysisResult {
  // Combine scores: Model A (30%) + Backend (70%)
  const combinedScore = modelAScore * 0.3 + (backendResult.risk_score / 100) * 0.7

  // Determine verdict from combined score
  let verdict: AnalysisResult['verdict']
  if (combinedScore >= 0.7) verdict = 'Phishing'
  else if (combinedScore >= 0.4) verdict = 'Suspicious'
  else verdict = 'Clean'

  // Merge reasons: Model A + backend top reasons
  const reasons = [
    `Local analysis: ${(modelAScore * 100).toFixed(0)}%`,
    ...backendResult.top_reasons.slice(0, 2) // Top 2 backend reasons
  ].slice(0, 3) // Limit to 3 total

  return {
    tabId,
    url,
    score: Math.round(combinedScore * 100),
    verdict,
    reasons,
    timestamp: Date.now(),
    phase2Pending: false
  }
}

/**
 * Inject warning banner into the tab
 */
async function injectWarningBanner(tabId: number, result: AnalysisResult): Promise<void> {
  try {
    const request: InjectBannerRequest = {
      type: 'injectBanner',
      result
    }
    await chrome.tabs.sendMessage(tabId, request).catch(() => {
      // Content script not ready or injection failed
    })
  } catch (error) {
    console.error('[PhishShield] Failed to inject banner:', error)
  }
}

/**
 * Send analysis update to popup (if it's open)
 */
function notifyPopupUpdate(result: AnalysisResult): void {
  chrome.runtime.sendMessage({
    type: 'analysisUpdate',
    result
  }).catch(() => {
    // Popup not open — that's ok
  })
}

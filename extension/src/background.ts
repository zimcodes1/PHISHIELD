/**
 * PhishShield Service Worker (background script)
 * Handles tab monitoring, feature extraction, model inference, and orchestration
 */

import { extractTier1Features, extractTier2Features, mergeFeatures, getNeutralDomInfo } from './utils/featureExtractors'
import type { DomInfo } from './utils/featureExtractors'
import { loadOnnxModel, runInference, isModelLoaded } from './utils/onnxInference'
import { analyzeUrl } from './utils/apiClient'
import type { BackendAnalysisResponse, LayerResult } from './utils/apiClient'
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
  backendResult: BackendAnalysisResponse
): AnalysisResult {
  const adjustedRf = applyUrlAccuracyAdjustments(url, modelAScore)
  const reputationLayer = backendResult.layers_list.find((layer) =>
    layer.name.toLowerCase().includes('url')
  )
  const nlpLayer = backendResult.layers_list.find((layer) =>
    layer.name.toLowerCase() === 'nlp'
  )

  const urlLayerScore = combineUrlLayerScore(adjustedRf.score, reputationLayer)
  const nlpScore = nlpLayer?.score ?? null
  const layers: Array<{ score: number; weight: number }> = [
    { score: urlLayerScore, weight: 0.40 },
  ]
  if (nlpScore !== null) layers.push({ score: nlpScore, weight: 0.30 })
  const combinedScore = ensembleScore(layers)

  // Determine verdict from combined score
  let verdict: AnalysisResult['verdict']
  if (combinedScore >= 0.6) verdict = 'Phishing'
  else if (combinedScore >= 0.35) verdict = 'Suspicious'
  else verdict = 'Clean'

  const reputationReasons = reputationLayer?.sub_checks
    ?.flatMap((check) => check.score >= 0.3 ? check.reasons : [])
    ?? []

  const reasons = [
    ...(adjustedRf.score >= 0.5
      ? [`Local RF analysis: ${(adjustedRf.score * 100).toFixed(0)}% phishing likelihood`]
      : []),
    ...adjustedRf.reasons,
    ...reputationReasons,
    ...backendResult.top_reasons
  ].filter((reason, index, allReasons) => reason && allReasons.indexOf(reason) === index)
    .slice(0, 3)

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

function combineUrlLayerScore(rfScore: number, reputationLayer?: LayerResult): number {
  const subChecks = reputationLayer?.sub_checks ?? []
  const confirmedThreat = subChecks.some((check) =>
    (check.name === 'google_safe_browsing' || check.name === 'url_haus_lookup') &&
    check.score >= 1.0
  )

  if (confirmedThreat) return 1.0

  const activeChecks = subChecks.filter((check) => check.score > 0)
  if (activeChecks.length === 0) return clamp01(rfScore)

  const totalWeight = activeChecks.reduce((sum, check) => sum + check.weight, 0)
  const reputationScore = totalWeight > 0
    ? activeChecks.reduce((sum, check) => sum + check.score * check.weight, 0) / totalWeight
    : 0

  return clamp01(Math.max(reputationScore, rfScore))
}

function ensembleScore(layers: Array<{ score: number; weight: number }>): number {
  // All layers are active — score of 0 is a valid clean signal, do not filter
  if (layers.length === 0) return 0
  const totalWeight = layers.reduce((sum, layer) => sum + layer.weight, 0)
  return clamp01(
    layers.reduce((sum, layer) => sum + layer.score * (layer.weight / totalWeight), 0)
  )
}

function applyUrlAccuracyAdjustments(url: string, modelScore: number): { score: number; reasons: string[] } {
  const heuristic = scoreUrlHeuristics(url)
  return {
    score: clamp01(Math.max(modelScore, heuristic.score)),
    reasons: heuristic.reasons
  }
}

function scoreUrlHeuristics(urlString: string): { score: number; reasons: string[] } {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    url = new URL(`https://${urlString}`)
  }

  const host = url.hostname.toLowerCase()
  const domain = registeredDomain(host)
  const tld = domain.includes('.') ? domain.split('.').pop() ?? '' : ''
  const text = decodeURIComponent(`${host} ${url.pathname} ${url.search}`).toLowerCase()

  if (HIGH_TRAFFIC_DOMAINS.has(domain)) return { score: 0, reasons: [] }

  let score = 0
  const reasons: string[] = []
  const suspiciousTld = SUSPICIOUS_TLDS.has(tld)
  const isShortener = SHORTENER_DOMAINS.some((shortener) =>
    host === shortener || host.endsWith(`.${shortener}`)
  )
  const lureHits = LURE_TOKENS.filter((token) => text.includes(token)).sort()
  const brandHits = BRAND_TOKENS.filter((token) => text.includes(token)).sort()

  if (isShortener) {
    score += 0.30
    reasons.push('URL uses known shortener service')
  }
  if (suspiciousTld) {
    score += 0.25
    reasons.push(`suspicious .${tld} top-level domain`)
  }
  if (lureHits.length > 0) {
    score += Math.min(0.35, 0.12 * lureHits.length)
    reasons.push(`phishing lure terms in URL: ${lureHits.slice(0, 3).join(', ')}`)
  }
  if (brandHits.length > 0 && !brandHits.some((token) => domain.includes(token))) {
    score += 0.25
    reasons.push(`brand lure outside registered domain: ${brandHits.slice(0, 2).join(', ')}`)
  }

  if (isShortener && lureHits.length > 0) score = Math.max(score, 0.75)
  if (suspiciousTld && lureHits.length > 0) score = Math.max(score, 0.78)
  if (brandHits.length > 0 && lureHits.length > 0 && !HIGH_TRAFFIC_DOMAINS.has(domain)) {
    score = Math.max(score, 0.72)
  }

  return { score: clamp01(score), reasons: reasons.slice(0, 3) }
}

function registeredDomain(hostname: string): string {
  const parts = hostname.replace(/\.$/, '').split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')
  return parts.slice(-2).join('.')
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'icu', 'cyou', 'click', 'rest', 'cam', 'buzz',
  'monster', 'quest', 'tk', 'ml', 'ga', 'cf', 'gq'
])

const LURE_TOKENS = [
  'free', 'gift', 'bonus', 'promo', 'reward', 'airdrop', 'claim',
  'giveaway', 'data', 'bundle', 'verify', 'verification', 'login',
  'signin', 'account', 'password', 'secure', 'security', 'update',
  'wallet', 'auth'
]

const BRAND_TOKENS = [
  'mtn', 'airtel', 'glo', 'paypal', 'google', 'facebook', 'instagram',
  'whatsapp', 'microsoft', 'apple', 'netflix', 'binance', 'opay',
  'gtbank', 'gtb', 'zenith', 'accessbank'
]

const SHORTENER_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly',
  'short.link', 'rb.gy', 'is.gd', 'cutt.ly', 'cut-ly.com', 'v.gd',
  'short.cm', 'adf.ly', 'link.ax', 'ping.fm', 'u.to', 'lnk.in',
  'go.gl', 'tr.im', 'shorte.st', 'snip.li', 'trim.by', 'url.st', 'dwz.cn'
]

const HIGH_TRAFFIC_DOMAINS = new Set([
  'google.com', 'youtube.com', 'facebook.com', 'instagram.com',
  'whatsapp.com', 'microsoft.com', 'apple.com', 'netflix.com',
  'paypal.com', 'amazon.com', 'x.com', 'twitter.com', 'github.com'
])

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

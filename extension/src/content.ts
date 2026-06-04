/**
 * PhishShield Content Script
 * Runs on every page and handles:
 * 1. Tier 2 DOM feature extraction
 * 2. Warning banner injection
 */

import { extractTier2Features, getNeutralDomInfo, type DomInfo } from './utils/featureExtractors'
import { injectBanner } from './utils/bannerInjector'
import type { ExtractDomFeaturesReply } from './types/messages'

// ── Message Listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'extractDomFeatures') {
    // Extract and reply with DOM features
    const domInfo = extractDomInfo()
    const features = extractTier2Features(domInfo)

    const reply: ExtractDomFeaturesReply = {
      type: 'domFeaturesReply',
      features,
      success: true
    }

    sendResponse(reply)
  } else if (message.type === 'injectBanner') {
    // Inject warning banner
    injectBanner(message.result)
    sendResponse({
      type: 'bannerInjected',
      tabId: sender.tab?.id
    })
  }
})

// ── DOM Feature Extraction ──────────────────────────────────────────────────

/**
 * Extract Tier 2 DOM features from the current page
 * These features require reading HTML structure
 */
function extractDomInfo(): DomInfo {
  try {
    // Check if page uses HTTPS
    const usesHttps = window.location.protocol === 'https:'

    // Extract link and script features
    const { safeLinkRatio, scriptInternalRatio, requestInternalRatio } =
      extractLinkAndResourceFeatures()

    // Extract form features
    const formHandlerScore = extractFormFeatures()

    return {
      usesHttps,
      safeLinkRatio,
      scriptInternalRatio,
      requestInternalRatio,
      formHandlerScore
    }
  } catch (error) {
    console.warn('[PhishShield] DOM extraction error:', error)
    return getNeutralDomInfo()
  }
}

/**
 * Extract anchor, script, and resource loading features
 * Returns ratios of external vs internal resources
 */
function extractLinkAndResourceFeatures(): {
  safeLinkRatio: number
  scriptInternalRatio: number
  requestInternalRatio: number
} {
  const currentDomain = getDomainFromUrl(window.location.href)

  // ── Anchor Links ──────────────────────────────────────────────────────

  const anchors = document.querySelectorAll('a')
  let safeAnchors = 0
  let totalAnchors = 0

  anchors.forEach((a) => {
    const href = a.getAttribute('href') || ''
    totalAnchors++

    // Check if link is safe (internal or valid external)
    if (
      href === '' ||
      href === '#' ||
      href.startsWith('javascript:') ||
      href === 'javascript:void(0)'
    ) {
      // Blank, internal anchor, or javascript — suspicious
    } else {
      const linkDomain = getDomainFromUrl(href)
      if (linkDomain === currentDomain) {
        safeAnchors++
      }
    }
  })

  const safeLinkRatio = totalAnchors > 0 ? safeAnchors / totalAnchors : 0.5

  // ── Script and Link Tags ──────────────────────────────────────────────

  const scripts = document.querySelectorAll('script')
  const links = document.querySelectorAll('link')
  const allScriptLinks = [...scripts, ...links]

  let internalScriptLinks = 0
  let totalScriptLinks = 0

  allScriptLinks.forEach((el) => {
    const src = el.getAttribute('src') || el.getAttribute('href') || ''
    if (src) {
      totalScriptLinks++
      const srcDomain = getDomainFromUrl(src)
      if (srcDomain === currentDomain || srcDomain === '') {
        internalScriptLinks++
      }
    }
  })

  const scriptInternalRatio =
    totalScriptLinks > 0 ? internalScriptLinks / totalScriptLinks : 0.5

  // ── Embedded Objects (img, iframe, etc.) ──────────────────────────────

  const images = document.querySelectorAll('img')
  const iframes = document.querySelectorAll('iframe')
  const allObjects = [...images, ...iframes]

  let internalObjects = 0
  let totalObjects = 0

  allObjects.forEach((el) => {
    const src = el.getAttribute('src') || ''
    if (src) {
      totalObjects++
      const srcDomain = getDomainFromUrl(src)
      if (srcDomain === currentDomain) {
        internalObjects++
      }
    }
  })

  const requestInternalRatio = totalObjects > 0 ? internalObjects / totalObjects : 0.5

  return {
    safeLinkRatio,
    scriptInternalRatio,
    requestInternalRatio
  }
}

/**
 * Extract form handler features
 * Checks if forms submit to suspicious locations
 */
function extractFormFeatures(): number {
  const forms = document.querySelectorAll('form')

  if (forms.length === 0) {
    return 0 // Neutral — no forms on page
  }

  const currentDomain = getDomainFromUrl(window.location.href)
  let externalForms = 0
  let suspiciousForms = 0
  let totalForms = 0

  forms.forEach((form) => {
    const action = form.getAttribute('action') || ''
    totalForms++

    if (action === '' || action === '#' || action === 'about:blank') {
      // Blank form handler — very suspicious
      suspiciousForms++
    } else {
      const actionDomain = getDomainFromUrl(action)
      if (actionDomain && actionDomain !== currentDomain && actionDomain !== '') {
        // External form handler
        externalForms++
      }
    }
  })

  // Score: 1 = safe (internal forms), 0 = suspicious (some external), -1 = dangerous (mostly external)
  const externalRatio = externalForms / totalForms
  const suspiciousRatio = suspiciousForms / totalForms

  if (suspiciousRatio > 0.33) return -1 // Dangerous
  if (externalRatio > 0.5) return -1 // Mostly external
  if (externalRatio > 0.2) return 0 // Some external
  return 1 // Mostly internal
}

// ── Utility Functions ────────────────────────────────────────────────────────

/**
 * Extract domain from URL (hostname only)
 * Handles relative URLs, data: URLs, etc.
 */
function getDomainFromUrl(urlString: string): string {
  if (!urlString) return ''

  try {
    // Try to parse as absolute URL
    const url = new URL(urlString, window.location.href)
    return url.hostname
  } catch {
    // If parsing fails, return empty (relative or malformed URL)
    return ''
  }
}

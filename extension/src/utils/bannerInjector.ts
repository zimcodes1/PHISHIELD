/**
 * Warning banner injection into page DOM
 * Converts analysis result to HTML and injects into current tab
 */

import type { AnalysisResult } from '../types/messages'

const BANNER_ID = 'phishshield-warning-banner'
const BANNER_Z_INDEX = '2147483647'

/**
 * Create warning banner HTML from analysis result
 */
export function createBannerHTML(result: AnalysisResult): string {
  const verdict = result.verdict
  const score = Math.round(result.score)
  const topReason = result.reasons[0] || 'Suspicious activity detected'

  const bgColor = verdict === 'Phishing' ? '#F44336' : '#FFC107'
  const textColor = verdict === 'Phishing' ? '#FFFFFF' : '#000000'

  return `
    <div id="${BANNER_ID}" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      background-color: ${bgColor};
      color: ${textColor};
      padding: 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: ${BANNER_Z_INDEX};
      box-sizing: border-box;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    ">
      <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
        <span style="font-weight: 700; font-size: 16px;">⚠️</span>
        <div>
          <div style="font-weight: 600; margin-bottom: 2px;">
            PhishShield: This site appears to be <strong>${verdict.toUpperCase()}</strong> (${score}%)
          </div>
          <div style="font-size: 12px; opacity: 0.9;">
            ${escapeHTML(topReason)}
          </div>
        </div>
      </div>
      <button id="${BANNER_ID}-close" style="
        background: none;
        border: none;
        color: ${textColor};
        cursor: pointer;
        font-size: 18px;
        padding: 4px 8px;
        margin-left: 12px;
        opacity: 0.7;
        transition: opacity 0.2s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
        ✕
      </button>
    </div>
  `
}

/**
 * Inject warning banner into page
 * Handles duplicate prevention and DOM cleanup
 */
export function injectBanner(result: AnalysisResult): boolean {
  // Check if banner already exists
  const existing = document.getElementById(BANNER_ID)
  if (existing) {
    existing.remove()
  }

  try {
    // Create container
    const container = document.createElement('div')
    container.innerHTML = createBannerHTML(result)

    // Insert at top of document
    const banner = container.firstElementChild as HTMLElement
    if (!banner) return false

    document.documentElement.insertBefore(banner, document.documentElement.firstChild)

    // Add close button listener
    const closeBtn = document.getElementById(`${BANNER_ID}-close`)
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        banner.remove()
      })
    }

    return true
  } catch (error) {
    console.error('[PhishShield] Failed to inject banner:', error)
    return false
  }
}

/**
 * Remove banner from page
 */
export function removeBanner(): void {
  const banner = document.getElementById(BANNER_ID)
  if (banner) {
    banner.remove()
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

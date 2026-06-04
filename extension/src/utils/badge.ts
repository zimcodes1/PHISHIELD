/**
 * Chrome action badge management
 * Sets badge text and color based on verdict
 */

export type Verdict = 'Clean' | 'Suspicious' | 'Phishing'

/**
 * Set extension action badge for a tab
 * Shows score and colors by verdict
 */
export async function setBadge(
  tabId: number,
  verdict: Verdict,
  score: number
): Promise<void> {
  const badgeText = Math.round(score).toString()
  const badgeColor = getBadgeColor(verdict)

  try {
    await chrome.action.setBadgeText({ text: badgeText, tabId })
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId })
  } catch (error) {
    console.error('[PhishShield] Failed to set badge:', error)
  }
}

/**
 * Clear badge for a tab
 */
export async function clearBadge(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: '', tabId })
  } catch (error) {
    console.error('[PhishShield] Failed to clear badge:', error)
  }
}

// ── Utility Functions ────────────────────────────────────────────────────────

function getBadgeColor(verdict: Verdict): string {
  switch (verdict) {
    case 'Clean':
      return '#4CAF50' // Green
    case 'Suspicious':
      return '#FFC107' // Yellow/Amber
    case 'Phishing':
      return '#F44336' // Red
  }
}

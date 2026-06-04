/**
 * Chrome storage helpers for persisting analysis results
 * Uses chrome.storage.local for fast access
 */

import type { AnalysisResult } from '../types/messages'

const STORAGE_KEY_PREFIX = 'phishshield_result_'
const STORAGE_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Get cached analysis result for a tab
 * Returns null if not found or expired
 */
export async function getAnalysisResult(tabId: number): Promise<AnalysisResult | null> {
  return new Promise((resolve) => {
    const key = `${STORAGE_KEY_PREFIX}${tabId}`
    chrome.storage.local.get([key], (result) => {
      const stored = result[key] as AnalysisResult | undefined

      if (!stored) {
        resolve(null)
        return
      }

      // Check if expired
      if (Date.now() - stored.timestamp > STORAGE_EXPIRY_MS) {
        // Clean up expired entry
        chrome.storage.local.remove([key])
        resolve(null)
        return
      }

      resolve(stored)
    })
  })
}

/**
 * Save analysis result for a tab
 */
export async function setAnalysisResult(
  tabId: number,
  result: AnalysisResult
): Promise<void> {
  return new Promise((resolve) => {
    const key = `${STORAGE_KEY_PREFIX}${tabId}`
    const resultWithTimestamp: AnalysisResult = {
      ...result,
      timestamp: Date.now()
    }
    chrome.storage.local.set({ [key]: resultWithTimestamp }, resolve)
  })
}

/**
 * Update analysis result (merge with existing)
 * Used for Phase 2 visual analysis merge
 */
export async function updateAnalysisResult(
  tabId: number,
  updates: Partial<AnalysisResult>
): Promise<AnalysisResult | null> {
  const current = await getAnalysisResult(tabId)
  if (!current) return null

  const merged: AnalysisResult = {
    ...current,
    ...updates,
    timestamp: Date.now() // Update timestamp on modification
  }

  await setAnalysisResult(tabId, merged)
  return merged
}

/**
 * Clear result for a tab (e.g., when tab is closed or navigated)
 */
export async function clearAnalysisResult(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const key = `${STORAGE_KEY_PREFIX}${tabId}`
    chrome.storage.local.remove([key], resolve)
  })
}

/**
 * Get all stored results (for debugging)
 */
export async function getAllResults(): Promise<Record<number, AnalysisResult>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const results: Record<number, AnalysisResult> = {}

      Object.entries(items).forEach(([key, value]) => {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          const tabId = parseInt(key.replace(STORAGE_KEY_PREFIX, ''), 10)
          results[tabId] = value as AnalysisResult
        }
      })

      resolve(results)
    })
  })
}

/**
 * API client for backend communication
 * Extension runs anonymously (no JWT required)
 * Timeout: 10 seconds
 */

const API_BASE = 'https://phishield-backend.vercel.app/api/v1'
const TIMEOUT_MS = 10000

export interface BackendAnalysisResponse {
  scan_id: string
  risk_score: number // 0-100
  verdict: 'Clean' | 'Suspicious' | 'Phishing'
  top_reasons: string[]
  layers_list: LayerResult[]
  timestamp: string
}

export interface LayerResult {
  name: string
  score: number // 0-1
  reasons: string[]
  weight: number
  sub_checks?: LayerResult[]
}

/**
 * Analyze URL via backend (Layer 2+: NLP, reputation checks)
 * Returns combined risk_score from all non-RF layers
 */
export async function analyzeUrl(url: string): Promise<BackendAnalysisResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE}/analyze/extension/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header — runs anonymously
      },
      body: JSON.stringify({ url }),
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(
        `Backend returned ${response.status}: ${response.statusText}`
      )
    }

    const data = (await response.json()) as BackendAnalysisResponse
    return data
  } catch (error) {
    // Fail open: return neutral response so extension still works
    console.warn('[PhishShield] Backend analysis failed:', error)
    return {
      scan_id: 'offline-' + Date.now(),
      risk_score: 30, // Neutral score
      verdict: 'Suspicious', // Default to cautious
      top_reasons: ['Backend unavailable — score may be incomplete'],
      layers_list: [],
      timestamp: new Date().toISOString()
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Post visual analysis to backend (Phase 2, async)
 * Screenshot base64 + URL for GPT-4o Vision analysis
 */
export async function analyzeVisual(
  url: string,
  screenshotBase64: string
): Promise<LayerResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE}/analyze/visual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        screenshot: screenshotBase64
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(
        `Visual analysis returned ${response.status}: ${response.statusText}`
      )
    }

    const result = (await response.json()) as LayerResult
    return result
  } catch (error) {
    console.warn('[PhishShield] Visual analysis failed:', error)
    // Return empty result — visual is optional
    return {
      name: 'Visual Analysis',
      score: 0,
      reasons: ['Visual analysis unavailable'],
      weight: 0.15
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

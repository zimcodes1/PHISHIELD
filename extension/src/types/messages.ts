/**
 * Message protocol for communication between:
 * - Service Worker (background.ts)
 * - Content Script (content.ts)
 * - Popup (App.tsx)
 */

export interface AnalysisResult {
  tabId: number
  url: string
  score: number // 0–100
  verdict: 'Clean' | 'Suspicious' | 'Phishing'
  reasons: string[]
  timestamp: number
  phase2Pending?: boolean // Visual analysis in progress
}

// ── Service Worker ↔ Content Script Messages ──────────────────────────────────

export interface ExtractDomFeaturesRequest {
  type: 'extractDomFeatures'
}

export interface ExtractDomFeaturesReply {
  type: 'domFeaturesReply'
  features: number[] // Tier 2 features, ordered per contract
  success: boolean
  error?: string
}

export interface InjectBannerRequest {
  type: 'injectBanner'
  result: AnalysisResult
}

export interface BannerInjectedReply {
  type: 'bannerInjected'
  tabId: number
}

// ── Service Worker ↔ Popup Messages ──────────────────────────────────────────

export interface GetAnalysisResultRequest {
  type: 'getAnalysisResult'
  tabId: number
}

export interface GetAnalysisResultReply {
  type: 'analysisResultReply'
  result?: AnalysisResult
}

export interface AnalysisUpdateNotification {
  type: 'analysisUpdate'
  result: AnalysisResult
}

// Union types for type safety
export type ServiceWorkerToContentMessage = ExtractDomFeaturesRequest | InjectBannerRequest
export type ContentToServiceWorkerMessage = ExtractDomFeaturesReply | BannerInjectedReply

export type ServiceWorkerToPopupMessage = AnalysisUpdateNotification | GetAnalysisResultReply
export type PopupToServiceWorkerMessage = GetAnalysisResultRequest

export type AnyMessage =
  | ServiceWorkerToContentMessage
  | ContentToServiceWorkerMessage
  | ServiceWorkerToPopupMessage
  | PopupToServiceWorkerMessage

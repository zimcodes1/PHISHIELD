/**
 * Feature extraction for Model A (11 Tier 1+2 features)
 * Feature ordering MUST match training dataset exactly:
 * [0]=UsingIP, [1]=LongURL, [2]=ShortURL, [3]=Symbol@, [4]=PrefixSuffix-,
 * [5]=SubDomains, [6]=HTTPS, [7]=AnchorURL, [8]=LinksInScriptTags,
 * [9]=RequestURL, [10]=ServerFormHandler
 */

// ── Tier 1: URL String Features (instant, no DOM required) ──────────────────

/**
 * Extract features from URL string alone (Tier 1)
 * Returns array of 6 values in order: [UsingIP, LongURL, ShortURL, Symbol@, PrefixSuffix-, SubDomains]
 * Feature values: 1 = phishing signal, -1 = legitimate signal, 0 = neutral
 */
export function extractTier1Features(urlString: string): number[] {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname

    const features: number[] = []

    // [0] UsingIP: 1 if raw IPv4, -1 if domain
    features.push(isIpAddress(hostname) ? 1 : -1)

    // [1] LongURL: 1 if length > 54, -1 otherwise
    features.push(urlString.length > 54 ? 1 : -1)

    // [2] ShortURL: 1 if shortener detected, -1 otherwise
    const shortenerDomains = [
      'bit.ly', 'tinyurl.com', 'ow.ly', 'short.link', 'goo.gl',
      'tiny.cc', 'is.gd', 'buff.ly', 'adf.ly'
    ]
    const isShortener = shortenerDomains.some(domain =>
      hostname.includes(domain) || urlString.includes(domain)
    )
    features.push(isShortener ? 1 : -1)

    // [3] Symbol@: 1 if @ in URL, -1 otherwise
    // @ symbol tricks browsers into treating pre-@ as credentials
    features.push(urlString.includes('@') ? 1 : -1)

    // [4] PrefixSuffix-: -1 if hyphen in domain, 1 otherwise
    // Legitimate brands rarely hyphenate primary domain
    features.push(hostname.includes('-') ? -1 : 1)

    // [5] SubDomains: count subdomain levels
    // 1 = 1 subdomain (score 1), 0 = 2 subdomains (score 0), -1 = 3+ (score -1)
    const dotCount = (hostname.match(/\./g) || []).length
    let subdomainScore = 1 // default: 1 subdomain (dotCount=1 means domain.tld)
    if (dotCount === 2) subdomainScore = 0 // 2 subdomains
    if (dotCount >= 3) subdomainScore = -1 // 3+ subdomains
    features.push(subdomainScore)

    return features
  } catch {
    // Invalid URL — return neutral Tier 1 values
    return [0, 0, 0, 0, 0, 0]
  }
}

// ── Tier 2: DOM Features (require page HTML/rendering) ────────────────────

/**
 * Extract features from DOM (Tier 2)
 * Returns array of 5 values: [HTTPS, AnchorURL, LinksInScriptTags, RequestURL, ServerFormHandler]
 * Called by content script which has DOM access
 */
export function extractTier2Features(domInfo: DomInfo): number[] {
  const features: number[] = []

  // [6] HTTPS: 1 if uses https, -1 otherwise
  // Note: in real scenarios, also check certificate validity, but extension can't do that easily
  features.push(domInfo.usesHttps ? 1 : -1)

  // [7] AnchorURL: Percentage of anchors that are safe
  // 1 if >66% safe, 0 if 33-66%, -1 if <33%
  const anchorRatio = domInfo.safeLinkRatio
  if (anchorRatio > 0.66) features.push(1)
  else if (anchorRatio > 0.33) features.push(0)
  else features.push(-1)

  // [8] LinksInScriptTags: Ratio of script/link tags loading external resources
  // 1 if >66% internal, 0 if 33-66%, -1 if <33% (majority external)
  const scriptInternalRatio = domInfo.scriptInternalRatio
  if (scriptInternalRatio > 0.66) features.push(1)
  else if (scriptInternalRatio > 0.33) features.push(0)
  else features.push(-1)

  // [9] RequestURL: Percentage of embedded objects from own domain
  // 1 if >66% own domain, 0 if 33-66%, -1 if <33% (majority external)
  const requestInternalRatio = domInfo.requestInternalRatio
  if (requestInternalRatio > 0.66) features.push(1)
  else if (requestInternalRatio > 0.33) features.push(0)
  else features.push(-1)

  // [10] ServerFormHandler: Check form action attributes
  // 1 = safe/internal, 0 = suspicious (blank/javascript), -1 = external
  features.push(domInfo.formHandlerScore)

  return features
}

/**
 * Merge Tier 1 and Tier 2 features into final 11-feature vector
 * Order: [UsingIP, LongURL, ShortURL, Symbol@, PrefixSuffix-, SubDomains,
 *         HTTPS, AnchorURL, LinksInScriptTags, RequestURL, ServerFormHandler]
 */
export function mergeFeatures(tier1: number[], tier2: number[]): number[] {
  if (tier1.length !== 6) throw new Error('Tier 1 must have 6 features')
  if (tier2.length !== 5) throw new Error('Tier 2 must have 5 features')
  return [...tier1, ...tier2]
}

/**
 * Create neutral feature vector (for timeout/error fallback)
 * Returns all 0s (neutral, no strong signal)
 */
export function getNeutralFeatureVector(): number[] {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}

// ── Utility Functions ────────────────────────────────────────────────────────

function isIpAddress(hostname: string): boolean {
  // Simple IPv4 check: xxx.xxx.xxx.xxx where each part is 0-255
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Regex.test(hostname)) return false

  // Validate each octet is 0-255
  const parts = hostname.split('.')
  return parts.every(part => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255
  })
}

// ── DOM Info Type (passed from content script) ────────────────────────────────

export interface DomInfo {
  usesHttps: boolean
  safeLinkRatio: number // 0-1
  scriptInternalRatio: number // 0-1
  requestInternalRatio: number // 0-1
  formHandlerScore: number // 1, 0, or -1
}

/**
 * Create empty/neutral DomInfo for timeout fallback
 */
export function getNeutralDomInfo(): DomInfo {
  return {
    usesHttps: false,
    safeLinkRatio: 0.5,
    scriptInternalRatio: 0.5,
    requestInternalRatio: 0.5,
    formHandlerScore: 0
  }
}

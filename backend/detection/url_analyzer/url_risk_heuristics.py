from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from detection.url_analyzer.tier3_features import HIGH_TRAFFIC_DOMAINS, registered_domain

SUSPICIOUS_TLDS = {
    "xyz",
    "top",
    "icu",
    "cyou",
    "click",
    "rest",
    "cam",
    "buzz",
    "monster",
    "quest",
    "tk",
    "ml",
    "ga",
    "cf",
    "gq",
}

LURE_TOKENS = {
    "free",
    "gift",
    "bonus",
    "promo",
    "reward",
    "airdrop",
    "claim",
    "giveaway",
    "data",
    "bundle",
    "verify",
    "verification",
    "login",
    "signin",
    "account",
    "password",
    "secure",
    "security",
    "update",
    "wallet",
    "auth",
}

SHORTENER_INDICATORS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly",
    "buff.ly", "short.link", "rb.gy", "is.gd", "cutt.ly",
    "cut-ly.com", "v.gd", "short.cm", "adf.ly", "link.ax",
    "ping.fm", "u.to", "lnk.in", "go.gl", "tr.im",
    "shorte.st", "snip.li", "trim.by", "url.st", "dwz.cn",
}

BRAND_TOKENS = {
    "mtn",
    "airtel",
    "glo",
    "paypal",
    "google",
    "facebook",
    "instagram",
    "whatsapp",
    "microsoft",
    "apple",
    "netflix",
    "binance",
    "opay",
    "gtbank",
    "gtb",
    "zenith",
    "accessbank",
}


@dataclass(frozen=True)
class HeuristicResult:
    score: float
    reasons: list[str]


def score_url_heuristics(url: str, tier3_features: dict[str, int]) -> HeuristicResult:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    domain = registered_domain(url)
    host = (parsed.hostname or "").lower()
    tld = domain.rsplit(".", 1)[-1] if "." in domain else ""
    text = unquote(f"{host} {parsed.path} {parsed.query}").lower()

    if domain in HIGH_TRAFFIC_DOMAINS:
        return HeuristicResult(0.0, [])

    score = 0.0
    reasons: list[str] = []

    suspicious_tld = tld in SUSPICIOUS_TLDS
    is_shortener = any(host == s or host.endswith(f".{s}") for s in SHORTENER_INDICATORS)
    lure_hits = sorted(token for token in LURE_TOKENS if token in text)
    brand_hits = sorted(token for token in BRAND_TOKENS if token in text)
    indexed_bad = tier3_features.get("GoogleIndex") == -1
    dns_bad = tier3_features.get("DNSRecording") == -1
    low_traffic = tier3_features.get("WebsiteTraffic") in (-1, 0)
    young_domain = tier3_features.get("AgeofDomain") == -1

    if is_shortener:
        score += 0.30
        reasons.append("URL uses known shortener service")
    if suspicious_tld:
        score += 0.25
        reasons.append(f"suspicious .{tld} top-level domain")
    if lure_hits:
        score += min(0.35, 0.12 * len(lure_hits))
        reasons.append(f"phishing lure terms in URL: {', '.join(lure_hits[:3])}")
    if brand_hits and not any(token in domain for token in brand_hits):
        score += 0.25
        reasons.append(f"brand lure outside registered domain: {', '.join(brand_hits[:2])}")
    if indexed_bad or dns_bad:
        score += 0.15
        reasons.append("domain reputation signals are weak")
    if young_domain:
        score += 0.15
        reasons.append("newly registered domain")

    # Boost score for shortener + lure combination
    if is_shortener and lure_hits:
        score = max(score, 0.75)
    if suspicious_tld and lure_hits and (low_traffic or indexed_bad or dns_bad):
        score = max(score, 0.78)
    if brand_hits and lure_hits and domain not in HIGH_TRAFFIC_DOMAINS:
        score = max(score, 0.72)

    return HeuristicResult(min(score, 1.0), reasons[:3])

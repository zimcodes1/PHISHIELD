import ipaddress
from pathlib import Path
from urllib.parse import urlparse
from typing import Tuple

import joblib
import pandas as pd

from detection.url_analyzer.base import UrlSubCheck
from detection.url_analyzer.tier3_features import Tier3FeatureExtractor, TIER3_FALLBACKS
from detection.url_analyzer.url_risk_heuristics import score_url_heuristics

# Feature order must exactly match training — see Section 4.6 of the roadmap
FEATURES = [
    "UsingIP", "LongURL", "ShortURL", "Symbol@",
    "PrefixSuffix-", "SubDomains", "HTTPS",
    "AnchorURL", "LinksInScriptTags", "RequestURL", "ServerFormHandler",
    "WebsiteTraffic", "AgeofDomain", "DomainRegLen", "GoogleIndex", "DNSRecording",
]

# Importance ranking from training — used to build the reason string
FEATURE_IMPORTANCE_ORDER = [
    "HTTPS", "AnchorURL", "WebsiteTraffic", "SubDomains",
    "AgeofDomain", "PrefixSuffix-", "ServerFormHandler",
    "LinksInScriptTags", "RequestURL", "LongURL",
    "ShortURL", "UsingIP", "Symbol@", "DomainRegLen",
    "GoogleIndex", "DNSRecording",
]

SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly",
    "buff.ly", "short.link", "rb.gy", "is.gd", "cutt.ly",
    "cut-ly.com", "v.gd", "short.cm", "adf.ly", "link.ax",
    "ping.fm", "u.to", "lnk.in", "go.gl", "tr.im",
    "shorte.st", "snip.li", "trim.by", "url.st", "dwz.cn",
}

FEATURE_LABELS = {
    "HTTPS": "no HTTPS",
    "AnchorURL": "suspicious anchor links",
    "WebsiteTraffic": "near-zero web traffic",
    "SubDomains": "excessive subdomain depth",
    "AgeofDomain": "newly registered domain",
    "PrefixSuffix-": "hyphen in domain name",
    "ServerFormHandler": "suspicious form action",
    "LongURL": "abnormally long URL",
    "UsingIP": "IP address used as domain",
    "Symbol@": "@ symbol in URL",
}


def _extract_lexical_features(url: str) -> dict:
    """Extract Tier 1 + Tier 2 lexical features from the URL string alone."""
    if "://" not in url:
        url = f"https://{url}"
    parsed = urlparse(url)
    host = (parsed.hostname or parsed.path).lower().strip(".")

    # The training dataset encodes legitimate as 1, suspicious as 0, phishing as -1.
    try:
        ipaddress.ip_address(host)
        using_ip = -1
    except ValueError:
        using_ip = 1

    if len(url) < 54:
        long_url = 1
    elif len(url) <= 75:
        long_url = 0
    else:
        long_url = -1

    short_url = -1 if any(host == s or host.endswith(f".{s}") for s in SHORTENER_DOMAINS) else 1

    symbol_at = -1 if "@" in url else 1

    prefix_suffix = -1 if "-" in host else 1

    dot_count = host.count(".")
    if dot_count == 1:
        sub_domains = 1
    elif dot_count == 2:
        sub_domains = 0
    else:
        sub_domains = -1

    https = 1 if parsed.scheme == "https" else -1

    # Tier 2 DOM features — neutral defaults (page not fetched at this stage)
    # These are overridden when HTML is available via the pipeline
    anchor_url = 0
    links_in_script = 0
    request_url = 0
    server_form = 0

    return {
        "UsingIP": using_ip,
        "LongURL": long_url,
        "ShortURL": short_url,
        "Symbol@": symbol_at,
        "PrefixSuffix-": prefix_suffix,
        "SubDomains": sub_domains,
        "HTTPS": https,
        "AnchorURL": anchor_url,
        "LinksInScriptTags": links_in_script,
        "RequestURL": request_url,
        "ServerFormHandler": server_form,
    }


class RFModelCheck(UrlSubCheck):
    name = "rf_model_b"
    weight = 0.30

    def __init__(self, model_path: str | None = None) -> None:
        if model_path is None:
            model_path = str(Path(__file__).resolve().parents[2] / "models" / "model_b.pkl")
        self.model = joblib.load(model_path)
        self.tier3_extractor = Tier3FeatureExtractor()

    async def _execute(self, url: str) -> Tuple[float, str]:
        features = _extract_lexical_features(url)
        features.update(TIER3_FALLBACKS)
        tier3_features = await self.tier3_extractor.extract(url)
        features.update(tier3_features)

        vector = pd.DataFrame([[features[f] for f in FEATURES]], columns=FEATURES)
        model_prob = self._phishing_probability(vector)
        heuristic_result = score_url_heuristics(url, tier3_features)
        phishing_prob = max(model_prob, heuristic_result.score)

        reason = ""
        if phishing_prob > 0.5:
            # Build reason from top triggered phishing indicators in importance order
            triggered = [
                FEATURE_LABELS[f]
                for f in FEATURE_IMPORTANCE_ORDER
                if f in FEATURE_LABELS and features.get(f) in (1, -1)
                and _is_phishing_signal(f, features[f])
            ][:3]
            if triggered:
                reason = f"Model flagged: {', '.join(triggered)}"
            elif heuristic_result.reasons:
                reason = f"URL pattern flagged: {', '.join(heuristic_result.reasons)}"
            else:
                reason = "Model flagged URL as suspicious"

        return phishing_prob, reason

    def _phishing_probability(self, vector: pd.DataFrame) -> float:
        probabilities = self.model.predict_proba(vector)[0]
        classes = list(self.model.classes_)
        phishing_class = 0 if 0 in classes else classes[0]
        return float(probabilities[classes.index(phishing_class)])


def _is_phishing_signal(feature: str, value: int) -> bool:
    """Returns True if the feature value is the phishing-indicative direction."""
    return value == -1

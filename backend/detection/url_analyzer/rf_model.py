import re
from urllib.parse import urlparse
from typing import Tuple

import joblib
import numpy as np
import pandas as pd

from detection.url_analyzer.base import UrlSubCheck

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
}

# Median fallback values for Tier 3 features when unavailable
TIER3_MEDIANS = {
    "WebsiteTraffic": 0,   # -1/0/1 encoded; 0 = mid-range
    "AgeofDomain": -1,     # -1 = old domain (safe default)
    "DomainRegLen": -1,
    "GoogleIndex": 1,
    "DNSRecording": 1,
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
    parsed = urlparse(url)
    netloc = parsed.netloc.lower().split(":")[0]
    domain_parts = netloc.split(".")

    # UsingIP: raw IPv4 in netloc
    using_ip = 1 if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", netloc) else -1

    # LongURL: length > 54
    long_url = 1 if len(url) > 54 else -1

    # ShortURL: known shortener service
    short_url = 1 if any(netloc.endswith(s) for s in SHORTENER_DOMAINS) else -1

    # Symbol@: @ present in URL
    symbol_at = 1 if "@" in url else -1

    # PrefixSuffix-: hyphen in registered domain
    prefix_suffix = -1 if "-" in netloc else 1

    # SubDomains: 1=1 subdomain, 0=2, -1=3+
    dot_count = netloc.count(".")
    if dot_count == 1:
        sub_domains = 1
    elif dot_count == 2:
        sub_domains = 0
    else:
        sub_domains = -1

    # HTTPS: scheme check
    https = 1 if url.startswith("https") else -1

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
    weight = 0.40

    def __init__(self, model_path: str = "models/model_b.pkl") -> None:
        self.model = joblib.load(model_path)

    async def _execute(self, url: str) -> Tuple[float, str]:
        features = _extract_lexical_features(url)

        # Fill Tier 3 features with median fallbacks (network calls handled by other sub-checks)
        for feat, median in TIER3_MEDIANS.items():
            features[feat] = median

        vector = pd.DataFrame([[features[f] for f in FEATURES]], columns=FEATURES)
        # predict_proba returns [[prob_legit, prob_phishing]]
        phishing_prob: float = self.model.predict_proba(vector)[0][1]

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

        return phishing_prob, reason


def _is_phishing_signal(feature: str, value: int) -> bool:
    """Returns True if the feature value is the phishing-indicative direction."""
    # Features where 1 = phishing signal
    phishing_on_one = {"UsingIP", "LongURL", "ShortURL", "Symbol@", "AnchorURL",
                       "LinksInScriptTags", "RequestURL", "AgeofDomain",
                       "WebsiteTraffic", "DomainRegLen"}
    # Features where -1 = phishing signal
    phishing_on_neg = {"PrefixSuffix-", "SubDomains", "HTTPS",
                       "ServerFormHandler", "GoogleIndex", "DNSRecording"}

    if feature in phishing_on_one:
        return value == 1
    if feature in phishing_on_neg:
        return value == -1
    return False

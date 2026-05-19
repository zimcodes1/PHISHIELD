import re
from urllib.parse import urlparse
from typing import Tuple

from Levenshtein import distance as levenshtein_distance

from detection.url_analyzer.base import UrlSubCheck

class HeuristicsCheck(UrlSubCheck):
    name = "heuristics"
    weight = 0.15

    # Curated brand targeting registry (Global + Nigerian Financials)
    BRAND_LIST = [
        # Global Brands
        "google", "microsoft", "paypal", "apple", "amazon", "netflix", "facebook", 
        "instagram", "linkedin", "twitter", "yahoo", "outlook", "dropbox",
        # Nigerian Banks & Fintechs
        "gtbank", "zenithbank", "accessbank", "firstbank", "uafricabank", "uba", 
        "stanbicibtc", "fcmb", "wemabank", "sterling", "opay", "moniepoint", 
        "palmpay", "kuda", "piggyvest", "fluterwave", "interswitch", "paystack"
    ]

    # Target path configurations
    SUSPICIOUS_SEGMENTS = {"login", "verify", "account", "suspended", "update", "confirm"}
    
    # Notorious Free TLD registries
    FREE_TLDS = {".tk", ".ml", ".ga", ".cf", ".gq"}

    async def _execute(self, url: str) -> Tuple[float, str]:
        """
        Evaluates structural features of a URL against phishing heuristics.
        Returns the highest flagged trigger score, or 0.0 if clean.
        """
        parsed = urlparse(url)
        
        # Extract netloc and remove port designations if present (e.g., localhost:8000)
        netloc = parsed.netloc.lower().split(":")[0]
        path = parsed.path.lower()
        
        triggered: list[Tuple[float, str]] = []

        # --- Rule 1: IP-as-domain ---
        if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", netloc):
            triggered.append((0.9, "IP address used as domain"))

        # --- Rule 2: Typosquatting ---
        host_parts = netloc.split(".")
        for part in host_parts:
            if not part or part in {"com", "org", "net", "ng", "gov", "edu"}:
                continue
            for brand in self.BRAND_LIST:
                if part != brand and levenshtein_distance(part, brand) <= 2:
                    triggered.append((0.85, f"Possible typosquatting of '{brand}'"))
                    break

        # --- Rule 3: Free TLD abuse ---
        if any(netloc.endswith(tld) for tld in self.FREE_TLDS):
            triggered.append((0.4, "Free/abused TLD detected"))

        # --- Rule 4: Suspicious path segments ---
        if any(segment in path for segment in self.SUSPICIOUS_SEGMENTS):
            if not any(brand in netloc for brand in self.BRAND_LIST):
                triggered.append((0.5, "Suspicious path segment on unknown domain"))

        # --- Rule 5: Excessive subdomain depth ---
        if len(host_parts) > 4:
            triggered.append((0.5, "Excessive subdomain depth"))

        # --- Rule 6: Abnormal URL length ---
        url_len = len(url)
        if url_len > 300:
            triggered.append((0.6, "Abnormally long URL"))
        elif url_len > 200:
            triggered.append((0.3, "Unusually long URL"))

        if not triggered:
            return 0.0, ""
        return max(triggered, key=lambda x: x[0])



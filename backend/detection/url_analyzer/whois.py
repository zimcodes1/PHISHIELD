from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import Tuple

from whois import whois as whois_query

from detection.url_analyzer.base import UrlSubCheck


class WhoisAgeCheck(UrlSubCheck):
    name = "whois_age"
    weight = 0.15

    def _fallback_score(self) -> Tuple[float, str]:
        return 0.2, "WHOIS lookup failed — domain age unknown"

    async def _execute(self, url: str) -> Tuple[float, str]:
        domain = urlparse(url).netloc or url
        domain = domain.split(":")[0]

        try:
            w = whois_query(domain)
            creation_date = w.creation_date
            if isinstance(creation_date, list):
                creation_date = creation_date[0]
            if creation_date is None:
                return self._fallback_score()
            if creation_date.tzinfo is None:
                creation_date = creation_date.replace(tzinfo=timezone.utc)
        except Exception:
            return self._fallback_score()

        age_days = (datetime.now(timezone.utc) - creation_date).days

        if age_days < 7:   return 1.0, "Domain registered less than 7 days ago"
        if age_days <= 30: return 0.7, "Domain registered less than 30 days ago"
        if age_days <= 90: return 0.3, "Domain registered less than 90 days ago"
        return 0.0, ""

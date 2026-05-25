import asyncio
import json
import sys
from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import Tuple, Any

from detection.url_analyzer.base import UrlSubCheck

_WHOIS_SCRIPT = """
import json
import sys
from datetime import datetime
from whois import whois as whois_query

try:
    result = whois_query(sys.argv[1])
    creation_date = getattr(result, "creation_date", None)
    if isinstance(creation_date, list):
        creation_date = next((item for item in creation_date if item), None)
    if isinstance(creation_date, datetime):
        creation_date = creation_date.isoformat()
    elif creation_date is not None:
        creation_date = str(creation_date)
    print(json.dumps({"creation_date": creation_date}))
except Exception as exc:
    print(json.dumps({"error": str(exc)}))
    sys.exit(1)
"""


class WhoisAgeCheck(UrlSubCheck):
    name = "whois_age"
    weight = 0.15
    timeout_seconds = 4.0

    def _fallback_score(self) -> Tuple[float, str]:
        return 0.2, "WHOIS lookup failed - domain age unknown"

    async def _execute(self, url: str) -> Tuple[float, str]:
        domain = urlparse(url).netloc or url
        domain = domain.split(":")[0]

        if not domain:
            return self._fallback_score()

        try:
            creation_date = await self._query_creation_date(domain)
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
        return 0.0, "Domain is older than 90 days"

    async def _query_creation_date(self, domain: str) -> datetime | None:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            _WHOIS_SCRIPT,
            domain,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(
                proc.communicate(),
                timeout=self.timeout_seconds,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise

        if proc.returncode != 0:
            return None

        data: dict[str, Any] = json.loads(stdout.decode() or "{}")
        value = data.get("creation_date")
        if not value:
            return None
        return datetime.fromisoformat(value)

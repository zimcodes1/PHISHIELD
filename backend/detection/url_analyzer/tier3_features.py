import asyncio
import json
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

TIER3_FEATURES = [
    "WebsiteTraffic",
    "AgeofDomain",
    "DomainRegLen",
    "GoogleIndex",
    "DNSRecording",
]

TIER3_FALLBACKS = {
    "WebsiteTraffic": 0,
    "AgeofDomain": 1,
    "DomainRegLen": 1,
    "GoogleIndex": 1,
    "DNSRecording": 1,
}

HIGH_TRAFFIC_DOMAINS = {
    "google.com",
    "youtube.com",
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "wikipedia.org",
    "amazon.com",
    "microsoft.com",
    "apple.com",
    "linkedin.com",
    "github.com",
    "netflix.com",
    "paypal.com",
    "reddit.com",
    "yahoo.com",
    "bing.com",
    "cloudflare.com",
    "openai.com",
}

_WHOIS_SCRIPT = """
import json
import sys
from datetime import datetime
from whois import whois as whois_query

def encode_date(value):
    if isinstance(value, list):
        value = next((item for item in value if item), None)
    if isinstance(value, datetime):
        return value.isoformat()
    if value is not None:
        return str(value)
    return None

try:
    result = whois_query(sys.argv[1])
    print(json.dumps({
        "creation_date": encode_date(getattr(result, "creation_date", None)),
        "expiration_date": encode_date(getattr(result, "expiration_date", None)),
    }))
except Exception as exc:
    print(json.dumps({"error": str(exc)}))
    sys.exit(1)
"""

_DNS_SCRIPT = """
import json
import socket
import sys

try:
    socket.getaddrinfo(sys.argv[1], None)
    print(json.dumps({"resolves": True}))
except Exception:
    print(json.dumps({"resolves": False}))
"""


class Tier3FeatureExtractor:
    def __init__(self, timeout_seconds: float = 3.0) -> None:
        self.timeout_seconds = timeout_seconds

    async def extract(self, url: str) -> dict[str, int]:
        domain = registered_domain(url)
        if not domain:
            return TIER3_FALLBACKS.copy()

        dns_task = asyncio.create_task(self._dns_recording(domain))
        whois_task = asyncio.create_task(self._domain_dates(domain))
        dns_recording, dates = await asyncio.gather(dns_task, whois_task)

        age_feature = self._age_of_domain(dates.get("creation_date"))
        reg_len_feature = self._domain_registration_length(
            dates.get("creation_date"),
            dates.get("expiration_date"),
        )
        traffic_feature = 1 if domain in HIGH_TRAFFIC_DOMAINS else 0
        google_index_feature = self._google_index_proxy(domain, age_feature, dns_recording)

        return {
            "WebsiteTraffic": traffic_feature,
            "AgeofDomain": age_feature,
            "DomainRegLen": reg_len_feature,
            "GoogleIndex": google_index_feature,
            "DNSRecording": dns_recording,
        }

    async def _dns_recording(self, domain: str) -> int:
        data = await self._run_json_script(_DNS_SCRIPT, domain)
        if data is None:
            return TIER3_FALLBACKS["DNSRecording"]
        return 1 if data.get("resolves") else -1

    async def _domain_dates(self, domain: str) -> dict[str, datetime | None]:
        data = await self._run_json_script(_WHOIS_SCRIPT, domain)
        if data is None:
            return {"creation_date": None, "expiration_date": None}
        return {
            "creation_date": parse_datetime(data.get("creation_date")),
            "expiration_date": parse_datetime(data.get("expiration_date")),
        }

    async def _run_json_script(self, script: str, arg: str) -> dict | None:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            script,
            arg,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=self.timeout_seconds)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return None

        if proc.returncode != 0:
            return None
        return json.loads(stdout.decode() or "{}")

    def _age_of_domain(self, creation_date: datetime | None) -> int:
        if creation_date is None:
            return TIER3_FALLBACKS["AgeofDomain"]
        if creation_date.tzinfo is None:
            creation_date = creation_date.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - creation_date).days
        return 1 if age_days >= 180 else -1

    def _domain_registration_length(
        self,
        creation_date: datetime | None,
        expiration_date: datetime | None,
    ) -> int:
        if creation_date is None or expiration_date is None:
            return TIER3_FALLBACKS["DomainRegLen"]
        if creation_date.tzinfo is None:
            creation_date = creation_date.replace(tzinfo=timezone.utc)
        if expiration_date.tzinfo is None:
            expiration_date = expiration_date.replace(tzinfo=timezone.utc)
        registration_days = (expiration_date - creation_date).days
        return 1 if registration_days > 365 else -1

    def _google_index_proxy(self, domain: str, age_feature: int, dns_recording: int) -> int:
        if domain in HIGH_TRAFFIC_DOMAINS:
            return 1
        if dns_recording == -1:
            return -1
        return 1 if age_feature == 1 else 0


def registered_domain(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or parsed.path).lower().strip(".")
    if not host:
        return ""
    parts = host.split(".")
    if len(parts) <= 2:
        return host
    if parts[-2] in {"co", "com", "org", "net", "edu", "gov"} and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None

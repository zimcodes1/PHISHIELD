import asyncio
from typing import Tuple
from urllib.parse import urlparse

from api.schemas import LayerResult
from detection.url_analyzer.google_safe_browsing import GoogleSafeBrowsingCheck
from detection.url_analyzer.urlhaus_lookup import UrlHausLookup
from detection.url_analyzer.whois import WhoisAgeCheck
from detection.url_analyzer.rf_model import RFModelCheck

_SUB_CHECKS = [
    RFModelCheck(),
    GoogleSafeBrowsingCheck(),
    UrlHausLookup(),
    WhoisAgeCheck(),
]


async def analyze_url(url: str) -> Tuple[float, list[str], list[LayerResult]]:
    """
    Layer 1 — URL Analyzer.
    Returns (final_score, reasons, sub_check_results).

    Scoring logic:
    - Confirmed GSB/URLhaus hit (1.0) overrides everything.
    - Otherwise the RF model score acts as a floor because a reputation miss
      means "not found", not "confirmed safe".
    """
    normalized_url = _normalize_url(url)
    results: list[Tuple[float, str]] = await asyncio.gather(
        *[check.run(normalized_url) for check in _SUB_CHECKS]
    )

    rf_score   = results[0][0]
    gsb_score  = results[1][0]
    haus_score = results[2][0]

    if gsb_score == 1.0 or haus_score == 1.0:
        final_score = 1.0
    else:
        weighted_sum = sum(
            score * check.weight
            for (score, _), check in zip(results, _SUB_CHECKS)
        )
        total_weight = sum(check.weight for check in _SUB_CHECKS)
        final_score = min(max(weighted_sum / total_weight, rf_score), 1.0)

    # Rank reasons by sub-check weight, highest first
    reasons = [
        reason
        for _, (score, reason), check in sorted(
            zip(range(len(_SUB_CHECKS)), results, _SUB_CHECKS),
            key=lambda x: x[2].weight,
            reverse=True,
        )
        if reason and score >= 0.3
    ]

    sub_checks = [
        LayerResult(
            name=check.name,
            score=score,
            reasons=[reason] if reason else [],
            weight=check.weight,
        )
        for (score, reason), check in zip(results, _SUB_CHECKS)
    ]

    return final_score, reasons, sub_checks


def _normalize_url(url: str) -> str:
    candidate = url.strip()
    parsed = urlparse(candidate)
    if parsed.scheme:
        return candidate
    if "@" in candidate and "/" not in candidate:
        candidate = candidate.rsplit("@", 1)[-1]
    return f"http://{candidate}"

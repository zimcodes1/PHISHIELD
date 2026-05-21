import asyncio
from typing import Tuple

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


async def analyze_url(url: str) -> Tuple[float, list[str]]:
    """
    Layer 1 — URL Analyzer.
    Runs all sub-checks concurrently, returns a weighted-average score (0–1)
    and a list of non-empty reason strings ranked by their sub-check weight.
    """
    results: list[Tuple[float, str]] = await asyncio.gather(
        *[check.run(url) for check in _SUB_CHECKS]
    )

    weighted_sum = sum(
        score * check.weight
        for (score, _), check in zip(results, _SUB_CHECKS)
    )
    total_weight = sum(check.weight for check in _SUB_CHECKS)
    final_score = min(weighted_sum / total_weight, 1.0)

    # Rank reasons by the weight of the sub-check that produced them
    reasons = [
        reason
        for _, (_, reason), check in sorted(
            zip(range(len(_SUB_CHECKS)), results, _SUB_CHECKS),
            key=lambda x: x[2].weight,
            reverse=True,
        )
        if reason
    ]
    return final_score, reasons


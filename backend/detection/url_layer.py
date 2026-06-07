import asyncio
from typing import Tuple
from urllib.parse import urlparse

from api.schemas import LayerResult
from detection.url_analyzer.google_safe_browsing import GoogleSafeBrowsingCheck
from detection.url_analyzer.urlhaus_lookup import UrlHausLookup
from detection.url_analyzer.whois import WhoisAgeCheck
from detection.url_analyzer.rf_model import RFModelCheck

_RF_CHECK: RFModelCheck | None = None

_REPUTATION_CHECKS = [
    GoogleSafeBrowsingCheck(),
    UrlHausLookup(),
    WhoisAgeCheck(),
]


def _get_rf_check() -> RFModelCheck:
    global _RF_CHECK
    if _RF_CHECK is None:
        _RF_CHECK = RFModelCheck()
    return _RF_CHECK


async def analyze_url(url: str) -> Tuple[float, list[str], list[LayerResult]]:
    """
    Layer 1 — URL Analyzer.
    Returns (final_score, reasons, sub_check_results).

    Scoring logic:
    - Confirmed GSB/URLhaus hit (1.0) overrides everything.
    - Sub-checks that return None (no record found) are excluded entirely
      from the weighted average so they don't dilute the score.
    - The RF model always produces a value and acts as a floor.
    """
    normalized_url = _normalize_url(url)
    sub_checks = [_get_rf_check(), *_REPUTATION_CHECKS]
    results: list[Tuple[float | None, str]] = await asyncio.gather(
        *[check.run(normalized_url) for check in sub_checks]
    )

    rf_score   = results[0][0]  # RF model always returns a value
    gsb_score  = results[1][0]
    haus_score = results[2][0]

    # Confirmed threat — override immediately
    if gsb_score == 1.0 or haus_score == 1.0:
        final_score = 1.0
    else:
        # Only include sub-checks that returned meaningful scores (>0 or explicit 0 for legitimate)
        # Exclude scores of 0 from API failures/timeouts since they don't represent actual cleanliness
        active = [
            (score, check)
            for (score, _), check in zip(results, sub_checks)
            if score is not None and score > 0
        ]
        if not active:
            # If all external checks failed, rely on RF score
            final_score = rf_score or 0.0
        else:
            weighted_sum = sum(score * check.weight for score, check in active)
            total_weight = sum(check.weight for _, check in active)
            base_score = weighted_sum / total_weight if total_weight > 0 else 0.0
            # RF score acts as a floor — never let reputation misses push below it
            final_score = min(max(base_score, rf_score or 0.0), 1.0)

    # Collect reasons only from active sub-checks with meaningful scores
    reasons = [
        reason
        for (score, reason), check in sorted(
            zip(results, sub_checks),
            key=lambda x: x[1].weight,
            reverse=True,
        )
        if score is not None and reason and score >= 0.3
    ]

    # Only include sub-checks that returned data in the breakdown
    sub_checks = [
        LayerResult(
            name=check.name,
            score=score,
            reasons=[reason] if reason else [],
            weight=check.weight,
        )
        for (score, reason), check in zip(results, sub_checks)
        if score is not None
    ]

    return final_score, reasons, sub_checks


async def analyze_url_without_rf(url: str) -> Tuple[float, list[str], list[LayerResult]]:
    """
    Layer 1 for the browser extension.

    The extension already runs Model A locally from ONNX, so this backend path
    only performs the server-side reputation/domain checks. The extension then
    merges these sub-checks with its local RF score using the same floor and
    confirmed-threat override rules as analyze_url().
    """
    normalized_url = _normalize_url(url)
    results: list[Tuple[float | None, str]] = await asyncio.gather(
        *[check.run(normalized_url) for check in _REPUTATION_CHECKS]
    )

    gsb_score = results[0][0]
    haus_score = results[1][0]

    if gsb_score == 1.0 or haus_score == 1.0:
        final_score = 1.0
    else:
        active = [
            (score, check)
            for (score, _), check in zip(results, _REPUTATION_CHECKS)
            if score is not None and score > 0
        ]
        if not active:
            final_score = 0.0
        else:
            weighted_sum = sum(score * check.weight for score, check in active)
            total_weight = sum(check.weight for _, check in active)
            final_score = min(weighted_sum / total_weight if total_weight > 0 else 0.0, 1.0)

    reasons = [
        reason
        for (score, reason), check in sorted(
            zip(results, _REPUTATION_CHECKS),
            key=lambda x: x[1].weight,
            reverse=True,
        )
        if score is not None and reason and score >= 0.3
    ]

    sub_checks = [
        LayerResult(
            name=check.name,
            score=score,
            reasons=[reason] if reason else [],
            weight=check.weight,
        )
        for (score, reason), check in zip(results, _REPUTATION_CHECKS)
        if score is not None
    ]

    return final_score, reasons, sub_checks


def _normalize_url(url: str) -> str:
    candidate = url.strip()
    parsed = urlparse(candidate)
    if parsed.scheme:
        return candidate
    if "@" in candidate and "/" not in candidate:
        candidate = candidate.rsplit("@", 1)[-1]
    return f"https://{candidate}"

import asyncio
import uuid
from datetime import datetime, timezone
from collections.abc import Mapping
from typing import Optional
from api.schemas import (
    AnalysisResponse, EmailRequest, LayerResult, URLRequest, Verdict,
)
from detection.url_layer import analyze_url

# --- Ensemble layer weights (Section 6.4) ---
# Visual (Layer 4) is excluded here — it runs async post-response via /analyze/visual
_WEIGHTS = {
    "url":     0.30,
    "nlp":     0.35,
    "headers": 0.20,
}


def _compute_verdict(score: int) -> Verdict:
    if score >= 70:
        return Verdict.PHISHING
    if score >= 40:
        return Verdict.SUSPICIOUS
    return Verdict.CLEAN


def _build_layer_result(name: str, weight: float, score: float, reasons: list[str]) -> LayerResult:
    return LayerResult(name=name, score=score, reasons=reasons, weight=weight)


def _ensemble(layers: Mapping[str, tuple[float, list[str]] | None]) -> tuple[int, list[str]]:
    """
    Weighted average over whichever layers ran.
    Excludes skipped layers and redistributes their weight proportionally.
    Returns (risk_score 0–100, top_3_reasons).
    """
    active = {k: v for k, v in layers.items() if v is not None}
    total_weight = sum(_WEIGHTS[k] for k in active)

    weighted_sum = sum(
        score * (_WEIGHTS[k] / total_weight)
        for k, (score, _) in active.items()
    )
    risk_score = min(round(weighted_sum * 100), 100)

    # Rank all reasons by the score of the layer that produced them, highest first
    ranked_reasons = [
        reason
        for _, (score, reasons) in sorted(active.items(), key=lambda x: x[1][0], reverse=True)
        for reason in reasons
        if reason
    ]
    return risk_score, ranked_reasons[:3]


# ---------------------------------------------------------------------------
# Stub analyzers — replaced with real implementations in Week 2
# ---------------------------------------------------------------------------

async def _run_nlp(text: str) -> tuple[float, list[str]]:
    """Layer 2 — NLP (GPT-4o-mini). Returns neutral score until implemented."""
    return 0.3, ["NLP analysis unavailable"]


async def _run_headers(raw_headers: str) -> tuple[float, list[str]]:
    """Layer 3 — Header analysis. Returns neutral score until implemented."""
    return 0.0, []


# ---------------------------------------------------------------------------
# Public pipeline entry points
# ---------------------------------------------------------------------------

async def run_url_pipeline(request: URLRequest) -> AnalysisResponse:
    """
    URL scan: Layer 1 (URL+RF) and Layer 2 (NLP) run concurrently.
    Layer 3 (Headers) is skipped — weight redistributed automatically.
    """
    (url_score, url_reasons), (nlp_score, nlp_reasons) = await asyncio.gather(
        analyze_url(request.url),
        _run_nlp(request.url),
    )

    layers_data = {
        "url": (url_score, url_reasons),
        "nlp": (nlp_score, nlp_reasons),
    }
    risk_score, top_reasons = _ensemble(layers_data)

    layers_list = [
        _build_layer_result("URL + RF Model", _WEIGHTS["url"], url_score, url_reasons),
        _build_layer_result("NLP",            _WEIGHTS["nlp"], nlp_score, nlp_reasons),
    ]

    return AnalysisResponse(
        scan_id=uuid.uuid4(),
        risk_score=risk_score,
        verdict=_compute_verdict(risk_score),
        top_reasons=top_reasons,
        layers_list=layers_list,
        timestamp=datetime.now(timezone.utc),
    )


async def run_email_pipeline(request: EmailRequest) -> AnalysisResponse:
    """
    Email scan: all three layers run concurrently.
    NLP receives subject + body (first 2000 chars).
    Headers layer only runs when raw_headers is provided.
    """
    nlp_input = f"{request.subject}\n\n{request.body}"[:2000]

    tasks = [
        analyze_url(request.sender),   # Layer 1 — run on sender domain
        _run_nlp(nlp_input),           # Layer 2
    ]
    has_headers = bool(request.raw_headers)
    if has_headers:
        tasks.append(_run_headers(request.raw_headers))  # type: ignore[arg-type]

    results = await asyncio.gather(*tasks)

    url_score,  url_reasons  = results[0]
    nlp_score,  nlp_reasons  = results[1]
    hdr_score,  hdr_reasons  = results[2] if has_headers else (None, [])

    layers_data: dict[str, Optional[tuple[float, list[str]]]] = {
        "url": (url_score, url_reasons),
        "nlp": (nlp_score, nlp_reasons),
        "headers": (hdr_score, hdr_reasons) if has_headers else None,  # type: ignore[dict-item]
    }
    risk_score, top_reasons = _ensemble(layers_data)

    layers_list = [
        _build_layer_result("URL + RF Model", _WEIGHTS["url"], url_score, url_reasons),
        _build_layer_result("NLP",            _WEIGHTS["nlp"], nlp_score, nlp_reasons),
    ]
    if has_headers:
        layers_list.append(
            _build_layer_result("Headers", _WEIGHTS["headers"], hdr_score, hdr_reasons)  # type: ignore[arg-type]
        )

    return AnalysisResponse(
        scan_id=uuid.uuid4(),
        risk_score=risk_score,
        verdict=_compute_verdict(risk_score),
        top_reasons=top_reasons,
        layers_list=layers_list,
        timestamp=datetime.now(timezone.utc),
    )

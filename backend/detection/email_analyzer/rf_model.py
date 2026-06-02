import re
from email import policy
from email.parser import Parser
from email.utils import parseaddr
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from api.schemas import EmailRequest

FEATURE_NAMES = [
    "subject_len",
    "body_len",
    "total_len",
    "word_count",
    "unique_word_ratio",
    "uppercase_ratio",
    "digit_ratio",
    "punctuation_count",
    "exclamation_count",
    "question_count",
    "url_count",
    "email_count",
    "suspicious_word_count",
    "money_word_count",
    "brand_word_count",
    "has_html",
    "sender_domain_len",
    "sender_is_free_mail",
    "spf_fail",
    "dkim_fail",
    "dmarc_fail",
    "auth_missing",
    "reply_to_mismatch",
    "return_path_mismatch",
]

SUSPICIOUS_WORDS = {
    "urgent", "verify", "verification", "password", "account", "login",
    "signin", "click", "confirm", "suspend", "suspended", "limited",
    "update", "security", "alert", "bank", "wallet", "invoice", "payment",
    "claim", "reward", "winner", "free", "gift", "bonus", "prize",
}
MONEY_WORDS = {
    "payment", "invoice", "wire", "transfer", "bank", "account", "refund",
    "deposit", "bitcoin", "crypto",
}
BRAND_WORDS = {
    "paypal", "google", "microsoft", "apple", "facebook", "instagram",
    "netflix", "amazon", "binance", "mtn", "airtel", "opay",
}
FREE_MAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com",
    "icloud.com", "proton.me", "protonmail.com",
}
URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

_MODEL: dict[str, Any] | None = None


async def analyze_email_rf(request: EmailRequest) -> tuple[float, list[str]]:
    """
    Email Random Forest layer.
    Consumes the same fields as EmailRequest and returns phishing probability.
    """
    model_bundle = _load_model_bundle()
    if model_bundle is None:
        return 0.0, []

    features = extract_email_features(request)
    model = model_bundle["model"] if isinstance(model_bundle, dict) else model_bundle
    raw_score = float(model.predict_proba(features)[:, 1][0])
    score = _calibrate_score(raw_score, features.iloc[0].to_dict(), request.raw_headers or "")
    reasons = _build_reasons(score, features.iloc[0].to_dict())
    return score, reasons


def _load_model_bundle() -> dict[str, Any] | Any | None:
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    model_path = Path(__file__).resolve().parents[2] / "models" / "email_rf_model.pkl"
    if not model_path.exists():
        return None
    _MODEL = joblib.load(model_path)
    return _MODEL


def extract_email_features(request: EmailRequest) -> pd.DataFrame:
    subject = request.subject or ""
    body = request.body or ""
    sender = str(request.sender or "")
    raw_headers = request.raw_headers or ""
    text = f"{subject} {body}"
    lower_text = text.lower()
    words = re.findall(r"[a-zA-Z0-9_]+", lower_text)
    chars = list(text)
    total_len = len(text)
    sender_domain = _domain_from_email(sender)
    reply_to_domain = _domain_from_email(_header_value(raw_headers, "Reply-To"))
    return_path_domain = _domain_from_email(_header_value(raw_headers, "Return-Path"))
    headers_lower = raw_headers.lower()

    row = {
        "subject_len": len(subject),
        "body_len": len(body),
        "total_len": total_len,
        "word_count": len(words),
        "unique_word_ratio": len(set(words)) / max(len(words), 1),
        "uppercase_ratio": sum(c.isupper() for c in chars) / max(total_len, 1),
        "digit_ratio": sum(c.isdigit() for c in chars) / max(total_len, 1),
        "punctuation_count": sum(not c.isalnum() and not c.isspace() for c in chars),
        "exclamation_count": text.count("!"),
        "question_count": text.count("?"),
        "url_count": len(URL_RE.findall(text)),
        "email_count": len(EMAIL_RE.findall(text)),
        "suspicious_word_count": sum(word in SUSPICIOUS_WORDS for word in words),
        "money_word_count": sum(word in MONEY_WORDS for word in words),
        "brand_word_count": sum(word in BRAND_WORDS for word in words),
        "has_html": int("<html" in lower_text or "</" in lower_text or "href=" in lower_text),
        "sender_domain_len": len(sender_domain),
        "sender_is_free_mail": int(sender_domain in FREE_MAIL_DOMAINS),
        "spf_fail": int("spf=fail" in headers_lower or "spf=softfail" in headers_lower),
        "dkim_fail": int("dkim=fail" in headers_lower or "dkim=none" in headers_lower),
        "dmarc_fail": int("dmarc=fail" in headers_lower or "dmarc=none" in headers_lower),
        "auth_missing": int(bool(raw_headers.strip()) and "authentication-results" not in headers_lower),
        "reply_to_mismatch": int(bool(reply_to_domain and sender_domain and reply_to_domain != sender_domain)),
        "return_path_mismatch": int(bool(return_path_domain and sender_domain and return_path_domain != sender_domain)),
    }
    return pd.DataFrame([row], columns=FEATURE_NAMES).astype("float32")


def _build_reasons(score: float, features: dict[str, float]) -> list[str]:
    if score < 0.5:
        return []

    reasons: list[str] = []
    if features["suspicious_word_count"] >= 2:
        reasons.append("Email contains multiple phishing-related terms")
    if features["url_count"] >= 1:
        reasons.append("Email body contains links")
    if features["dmarc_fail"] == 1:
        reasons.append("DMARC-related header feature indicates failure or absence")
    if features["spf_fail"] == 1:
        reasons.append("SPF-related header feature indicates failure or soft failure")
    if features["dkim_fail"] == 1:
        reasons.append("DKIM-related header feature indicates failure or absence")
    if features["reply_to_mismatch"] == 1:
        reasons.append("Reply-To domain differs from sender domain")
    if features["brand_word_count"] >= 1:
        reasons.append("Email references known brand names")
    if not reasons:
        reasons.append("Email Random Forest model flagged phishing-like patterns")
    return reasons[:3]


def _calibrate_score(raw_score: float, features: dict[str, float], raw_headers: str) -> float:
    header_fail_count = int(features["spf_fail"] + features["dkim_fail"] + features["dmarc_fail"])
    has_mismatch = features["reply_to_mismatch"] == 1 or features["return_path_mismatch"] == 1
    has_lure_language = features["suspicious_word_count"] >= 2
    has_link = features["url_count"] >= 1
    has_brand_or_money = features["brand_word_count"] >= 1 or features["money_word_count"] >= 1

    score = raw_score
    if has_lure_language and has_link:
        score = max(score, 0.65)
    if header_fail_count >= 2:
        score = max(score, 0.70)
    if has_mismatch and (has_lure_language or has_brand_or_money):
        score = max(score, 0.68)

    has_any_phishing_signal = (
        has_lure_language
        or has_link
        or has_brand_or_money
        or header_fail_count > 0
        or has_mismatch
        or features["sender_is_free_mail"] == 1
    )
    auth_present = bool(raw_headers.strip())
    auth_clean = auth_present and header_fail_count == 0 and not has_mismatch
    if not has_any_phishing_signal and auth_clean:
        score = min(score, 0.20)
    elif not has_any_phishing_signal:
        score = min(score, 0.30)

    return min(max(score, 0.0), 1.0)


def _header_value(raw_headers: str, name: str) -> str:
    if not raw_headers:
        return ""
    try:
        message = Parser(policy=policy.default).parsestr(raw_headers)
        return str(message.get(name, ""))
    except Exception:
        return ""


def _domain_from_email(value: str) -> str:
    _, address = parseaddr(str(value or ""))
    if "@" not in address:
        return ""
    return address.rsplit("@", 1)[-1].strip(">").lower()

import re
from email import policy
from email.parser import Parser
from email.utils import parseaddr
from urllib.parse import unquote

AUTH_SCORES = {
    "spf": {
        "fail": 0.70,
        "softfail": 0.40,
        "neutral": 0.25,
        "none": 0.25,
        "permerror": 0.35,
        "temperror": 0.15,
    },
    "dkim": {
        "fail": 0.70,
        "neutral": 0.25,
        "none": 0.45,
        "permerror": 0.70,
        "temperror": 0.15,
    },
    "dmarc": {
        "fail": 0.80,
        "neutral": 0.35,
        "none": 0.45,
        "permerror": 0.60,
        "temperror": 0.20,
    },
}

AUTH_REASONS = {
    ("spf", "fail"): "SPF authentication failed - sending server is not authorized",
    ("spf", "softfail"): "SPF softfail - sending server may not be authorized",
    ("spf", "neutral"): "SPF returned neutral",
    ("spf", "none"): "SPF result missing or not published",
    ("spf", "permerror"): "SPF permanent error",
    ("spf", "temperror"): "SPF temporary error",
    ("dkim", "fail"): "DKIM signature verification failed",
    ("dkim", "neutral"): "DKIM returned neutral",
    ("dkim", "none"): "DKIM signature is missing",
    ("dkim", "permerror"): "DKIM permanent verification error",
    ("dkim", "temperror"): "DKIM temporary verification error",
    ("dmarc", "fail"): "DMARC policy check failed",
    ("dmarc", "neutral"): "DMARC returned neutral",
    ("dmarc", "none"): "DMARC result missing or not published",
    ("dmarc", "permerror"): "DMARC permanent error",
    ("dmarc", "temperror"): "DMARC temporary error",
}

BRAND_DOMAINS = {
    "paypal": "paypal.com",
    "google": "google.com",
    "microsoft": "microsoft.com",
    "apple": "apple.com",
    "facebook": "facebook.com",
    "instagram": "instagram.com",
    "netflix": "netflix.com",
    "amazon": "amazon.com",
    "binance": "binance.com",
    "mtn": "mtn.com",
    "airtel": "airtel.com",
    "opay": "opayweb.com",
    "gtbank": "gtbank.com",
    "zenith": "zenithbank.com",
    "access": "accessbankplc.com",
}

PUBLIC_SUFFIX_2_PARTS = {"co", "com", "org", "net", "edu", "gov", "ac"}


def analyze_headers(raw_headers: str, sender: str = "") -> tuple[float, list[str]]:
    if not raw_headers or not raw_headers.strip():
        return 0.0, []

    message = Parser(policy=policy.default).parsestr(raw_headers)
    reasons: list[tuple[float, str]] = []

    auth_headers = message.get_all("Authentication-Results", [])
    auth_text = "\n".join(str(header) for header in auth_headers).lower()
    if auth_text:
        reasons.extend(_authentication_findings(auth_text))
    else:
        reasons.append((0.25, "Authentication-Results header is missing"))

    from_header = str(message.get("From", ""))
    reply_to_header = str(message.get("Reply-To", ""))
    return_path_header = str(message.get("Return-Path", ""))
    delivered_to_header = str(message.get("Delivered-To", ""))

    from_email = _email_from_header(from_header) or sender
    from_domain = _registered_domain(_domain_from_email(from_email))
    sender_domain = _registered_domain(_domain_from_email(sender))

    if sender_domain and from_domain and sender_domain != from_domain:
        reasons.append((0.40, "Sender address domain does not match From header domain"))

    reply_to_domain = _registered_domain(_domain_from_email(_email_from_header(reply_to_header)))
    if reply_to_domain and from_domain and reply_to_domain != from_domain:
        reasons.append((0.35, "Reply-To domain differs from From domain"))

    return_path_domain = _registered_domain(_domain_from_email(_email_from_header(return_path_header)))
    if return_path_domain and from_domain and return_path_domain != from_domain:
        reasons.append((0.25, "Return-Path domain differs from From domain"))

    auth_domains = _auth_domains(auth_text)
    for label, domain in auth_domains.items():
        registered = _registered_domain(domain)
        if registered and from_domain and registered != from_domain:
            reasons.append((0.30, f"{label} domain does not align with From domain"))

    display_name, _ = parseaddr(from_header)
    spoof_reason = _brand_spoof_reason(display_name, from_domain)
    if spoof_reason:
        reasons.append((0.65, spoof_reason))

    received_count = len(message.get_all("Received", []))
    if received_count == 0:
        reasons.append((0.20, "No Received header chain present"))

    if delivered_to_header and from_domain:
        delivered_domain = _registered_domain(_domain_from_email(_email_from_header(delivered_to_header)))
        if delivered_domain and delivered_domain == from_domain:
            reasons.append((0.15, "From domain matches recipient domain unexpectedly"))

    if not reasons:
        return 0.0, []

    score = _combine_scores(score for score, _ in reasons)
    ranked_reasons = [
        reason
        for _, reason in sorted(reasons, key=lambda item: item[0], reverse=True)
    ]
    return score, _dedupe(ranked_reasons)[:4]


def _authentication_findings(auth_text: str) -> list[tuple[float, str]]:
    findings: list[tuple[float, str]] = []
    for mechanism in ("spf", "dkim", "dmarc"):
        result = _last_auth_result(auth_text, mechanism)
        if not result or result == "pass":
            continue
        score = AUTH_SCORES[mechanism].get(result, 0.20)
        reason = AUTH_REASONS.get((mechanism, result), f"{mechanism.upper()} returned {result}")
        findings.append((score, reason))
    return findings


def _last_auth_result(auth_text: str, mechanism: str) -> str | None:
    matches = re.findall(
        rf"\b{mechanism}\s*=\s*(pass|fail|softfail|neutral|none|permerror|temperror)\b",
        auth_text,
    )
    return matches[-1] if matches else None


def _auth_domains(auth_text: str) -> dict[str, str]:
    patterns = {
        "SPF mail-from": r"smtp\.mailfrom=([^\s;,)]+)",
        "DKIM signing": r"header\.d=([^\s;,)]+)",
        "DMARC header-from": r"header\.from=([^\s;,)]+)",
    }
    domains: dict[str, str] = {}
    for label, pattern in patterns.items():
        matches = re.findall(pattern, auth_text)
        if matches:
            domains[label] = matches[-1].strip("<>").lower()
    return domains


def _combine_scores(scores: object) -> float:
    clean_probability = 1.0
    for score in scores:
        clean_probability *= 1.0 - min(float(score), 1.0)
    return round(min(1.0 - clean_probability, 1.0), 3)


def _email_from_header(value: str) -> str:
    _, address = parseaddr(unquote(value or ""))
    return address.lower()


def _domain_from_email(address: str) -> str:
    if not address or "@" not in address:
        return ""
    return address.rsplit("@", 1)[-1].strip(">").lower()


def _registered_domain(domain: str) -> str:
    domain = (domain or "").strip(".").lower()
    if not domain:
        return ""
    parts = domain.split(".")
    if len(parts) <= 2:
        return domain
    if parts[-2] in PUBLIC_SUFFIX_2_PARTS and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def _brand_spoof_reason(display_name: str, from_domain: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", (display_name or "").lower())
    for brand, expected_domain in BRAND_DOMAINS.items():
        if brand in normalized.split() and from_domain and from_domain != expected_domain:
            return f"Display name claims {brand} but sender domain is {from_domain}"
    return ""


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped

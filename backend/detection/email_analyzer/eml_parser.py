from email import policy
from email.message import EmailMessage, Message
from email.parser import BytesParser
from email.utils import parseaddr

from pydantic import ValidationError

from api.schemas import EmailRequest


class EMLParseError(ValueError):
    pass


def extract_email_request_from_eml(raw_eml: bytes) -> EmailRequest:
    if not raw_eml:
        raise EMLParseError("Uploaded .eml file is empty")

    try:
        message = BytesParser(policy=policy.default).parsebytes(raw_eml)
    except Exception as exc:
        raise EMLParseError("Uploaded file could not be parsed as a raw .eml email") from exc

    subject = str(message.get("Subject", "")).strip()
    sender = _sender_from_message(message)
    body = _body_from_message(message).strip()
    raw_headers = _raw_headers_from_message(message)

    if not sender:
        raise EMLParseError("Uploaded .eml file is missing a valid From sender address")
    if not body:
        body = "(No email body found)"

    try:
        return EmailRequest(
            subject=subject or "(No subject)",
            body=body,
            sender=sender,
            raw_headers=raw_headers,
        )
    except ValidationError as exc:
        raise EMLParseError("Uploaded .eml file does not contain a valid sender email address") from exc


def _sender_from_message(message: Message) -> str:
    _, address = parseaddr(str(message.get("From", "")))
    return address.lower()


def _raw_headers_from_message(message: Message) -> str:
    return "\n".join(f"{name}: {value}" for name, value in message.items())


def _body_from_message(message: Message) -> str:
    if isinstance(message, EmailMessage):
        plain = message.get_body(preferencelist=("plain",))
        if plain is not None:
            return _message_part_content(plain)

        html = message.get_body(preferencelist=("html",))
        if html is not None:
            return _message_part_content(html)

    if message.is_multipart():
        parts: list[str] = []
        for part in message.walk():
            if part.is_multipart():
                continue
            content_type = part.get_content_type()
            if content_type in {"text/plain", "text/html"}:
                content = _message_part_content(part)
                if content:
                    parts.append(content)
        return "\n\n".join(parts)

    return _message_part_content(message)


def _message_part_content(part: Message) -> str:
    try:
        content = part.get_content()
    except Exception:
        payload = part.get_payload(decode=True)
        if isinstance(payload, bytes):
            charset = part.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace")
        return str(part.get_payload() or "")

    if isinstance(content, bytes):
        charset = part.get_content_charset() or "utf-8"
        return content.decode(charset, errors="replace")
    return str(content or "")

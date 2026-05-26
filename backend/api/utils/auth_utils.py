import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv  # type: ignore

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRY_MINUTES  = float(os.getenv("ACCESS_TOKEN_EXPIRY_MINUTES", "60"))
REFRESH_TOKEN_EXPIRY_DAYS    = float(os.getenv("REFRESH_TOKEN_EXPIRY_DAYS", "7"))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: UUID, expiry: timedelta, token_type: str) -> str:
    if not SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: SECRET_KEY not set",
        )
    payload = {
        "sub":  str(user_id),
        "type": token_type,
        "exp":  datetime.now(timezone.utc) + expiry,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: UUID) -> str:
    return _create_token(user_id, timedelta(minutes=ACCESS_TOKEN_EXPIRY_MINUTES), "access")


def create_refresh_token(user_id: UUID) -> str:
    return _create_token(user_id, timedelta(days=REFRESH_TOKEN_EXPIRY_DAYS), "refresh")


def _decode_token(token: str, expected_type: str) -> UUID:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: SECRET_KEY not set",
        )
    try:
        # algorithms must be a list — passing a bare string is a python-jose bug trap
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            raise exc
        user_id_str: str | None = payload.get("sub")
        if not user_id_str:
            raise exc
        return UUID(user_id_str)
    except (JWTError, ValueError):
        raise exc


def decode_access_token(token: str) -> UUID:
    return _decode_token(token, "access")


def decode_refresh_token(token: str) -> UUID:
    return _decode_token(token, "refresh")

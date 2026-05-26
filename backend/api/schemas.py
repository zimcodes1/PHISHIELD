from pydantic import BaseModel, Field, SecretStr, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from enum import Enum

#Define Verdict Enum
class Verdict(str, Enum):
    CLEAN = "Clean";
    SUSPICIOUS = "Suspicious";
    PHISHING = "Phishing";

class UserCreate(BaseModel):
    fullname: str;
    email: EmailStr;
    password: SecretStr = Field(..., min_length=8);
    class Config:
        from_attributes = True
        extra = "forbid"
        json_schema_extra = {
            "example": {
                "fullname": "John Doe",
                "email": "user@example.com",
                "password": "SuperSecurePassword123"
            }
        }

class UserResponse(BaseModel):
    id: UUID;
    email: EmailStr;
    fullname: str;
    created_at: datetime;
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str;
    refresh_token: str;
    token_type: str = "bearer";
    class Config:
        from_attributes = True

class RefreshRequest(BaseModel):
    refresh_token: str;

class URLRequest(BaseModel):
    url: str;

class EmailRequest(BaseModel):
    subject: str;
    body: str;
    sender: EmailStr;
    raw_headers: Optional[str] = None;
    class Config:
        from_attributes = True

class LayerResult(BaseModel):
    name: str;
    score: float;
    reasons: List[str];
    weight: float;
    sub_checks: Optional[List["LayerResult"]] = None;

class AnalysisResponse(BaseModel):
    scan_id: UUID;
    risk_score: int;
    verdict: Verdict;
    top_reasons: List[str];
    layers_list: List[LayerResult];
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    class Config:
        from_attributes = True

class UserProfile(BaseModel):
    id: UUID;
    email: EmailStr;
    fullname: str;
    created_at: datetime;
    class Config:
        from_attributes = True

class UpdatePasswordRequest(BaseModel):
    old_password: SecretStr;
    new_password: SecretStr = Field(..., min_length=8);

class ForgotPasswordRequest(BaseModel):
    email: EmailStr;

class ResetPasswordRequest(BaseModel):
    token: str;
    new_password: SecretStr = Field(..., min_length=8);
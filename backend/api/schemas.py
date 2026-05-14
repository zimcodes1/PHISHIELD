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
    username: str;
    fullname:str;
    email:EmailStr;
    password:SecretStr = Field(..., min_length=8);
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: UUID;
    email: EmailStr;
    fullname: str;
    created_at: datetime;

class TokenResponse(BaseModel):
    access_token: str;
    token_type:str = "bearer";

class URLRequest(BaseModel):
    url: str;

class EmailRequest(BaseModel):
    subject: str;
    body: str;
    sender: EmailStr;
    raw_headers: Optional[str] = None;

class LayerResult(BaseModel):
    name: str;
    score: float;
    reasons: List[str];
    weight: float;

class AnalysisResponse(BaseModel):
    scan_id: UUID;
    risk_score: int;
    verdict: Verdict;
    top_reasons: List[str];
    layers_list: List[LayerResult];
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class HomeResponse(BaseModel):
    message:str;
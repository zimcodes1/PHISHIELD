from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON
import datetime
import uuid
from .database import Base
from enum import Enum
from api.schemas import Verdict

def generate_uuid():
    return str(uuid.uuid4())

class ScanType(str, Enum):
    URL = "url"                      # dashboard URL input
    EMAIL_TEXT = "email_text"        # dashboard pasted email
    EMAIL_FILE = "email_file"        # dashboard .eml upload
    EXTENSION_URL = "extension_url"  # extension auto-scan

class UserVerdict(str, Enum):
    FALSE_POSITIVE = "false_positive"
    FALSE_NEGATIVE = "false_negative"

class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password= Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    scans =  relationship('Scan', back_populates='user')
    feedback = relationship("Feedback", back_populates="user")


class Scan(Base):
    __tablename__ = "scans"

    id          = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id     = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    scan_type   = Column(SAEnum(ScanType), nullable=False)
    input_value = Column(Text, nullable=False)       # URL string or email subject line

    # Ensemble result
    risk_score  = Column(Integer, nullable=False)    # 0–100
    verdict     = Column(SAEnum(Verdict), nullable=False)
    top_reasons = Column(JSON, nullable=False)       # list[str], top 3 across all layers

    # Per-layer breakdown — stored as JSON, matches the LayerResult Pydantic schema
    layers_list = Column(JSON, nullable=True)        # list[LayerResult dict]

    # Visual layer — nullable, patched in async after extension Phase 2
    visual_score       = Column(Float, nullable=True)
    visual_reasons     = Column(JSON, nullable=True)      # list[str]
    visual_analyzed_at = Column(DateTime, nullable=True)

    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user     = relationship("User", back_populates="scans")
    feedback = relationship("Feedback", back_populates="scan", uselist=False)

class Feedback(Base):
    __tablename__ = 'feedback',
    id = Column(String, primary_key=True, default=generate_uuid, nullable=False, index=True)
    scan_id = Column(String, ForeignKey('scans.id'), nullable=False, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False, index=True)
    user_verdict = Column(SAEnum(UserVerdict), nullable=False)
    note = Column(Text, nullable=True)
    created_at =  Column(DateTime, default=datetime.datetime.utcnow)
    scan = relationship('Scan', back_populates='feedback')
    user = relationship('User', back_populates='feedback')


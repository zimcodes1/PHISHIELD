from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import User
from utils.auth_utils import decode_access_token

# Instructs FastAPI to look for a bearer token at this specific endpoint path
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> User:
    """
    Middleware dependency to validate incoming JWTs.
    Returns the complete User record if authorization succeeds.
    """
    # 1. Decode token string and validate expiration/signature via python-jose
    user_id: UUID = decode_access_token(token)
    
    # 2. Match the string-mapped SQLite primary key against the token subject UUID
    user = db.query(User).filter(User.id == str(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="User account does not exist"
        )
        
    return user

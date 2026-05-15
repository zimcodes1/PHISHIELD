from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import User
from api.utils.auth_utils import hash_password, verify_password, create_access_token
from api.schemas import UserCreate, UserResponse, TokenResponse

router = APIRouter(prefix='/api/v1/auth', tags=["Authentication"])

@router.post("/register", response_model=UserResponse,status_code=status.HTTP_201_CREATED)
def register_user(user_in:UserCreate, db: Session = Depends(get_db)):
    """
    Validates input schemas, checks for email duplicates, 
    hashes the incoming password, and commits a new user to SQLite.
    """
    # Extract raw password string from Pydantic SecretStr object
    raw_password = user_in.password.get_secret_value()
    # Enforce uniqueness on email fields
    email_exists = db.query(User).filter(User.email == user_in.email).first()
    if email_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )
    #Hash plain text using passlib context and prepare DB entity
    db_user = User(
        email=user_in.email,
        username=user_in.username,
        fullname=user_in.fullname,
        password=hash_password(raw_password)
    )
    # Commit to database and populate the auto-generated UUID string
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post('/login', response_model=TokenResponse)
def login_user(formdata:OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Validates credentials against standard OAuth2 form payloads 
    and returns a signed python-jose JWT access token.
    """
    # OAuth2 form payload maps the user's email string to form_data.username
    user = db.query(User).filter(User.email == formdata.username).first()
    # Fail cleanly on either username mismatch OR bad password string
    if not user or not verify_password(formdata.password, str(user.password)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate":"Bearer"}
        )
    # Generate token using the decoded UUID instance of the user
    token_string = create_access_token(user_id=UUID(str(user.id)))
    return {
        "access_token": token_string,
        "token_type": "bearer"
    }
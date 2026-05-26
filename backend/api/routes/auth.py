from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import User
from api.dependencies import get_current_user
from api.utils.auth_utils import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_refresh_token,
)
from api.schemas import UserCreate, UserResponse, TokenResponse, UserProfile, RefreshRequest, UpdatePasswordRequest

router = APIRouter(prefix='/api/v1/auth', tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )
    db_user = User(
        email=user_in.email,
        fullname=user_in.fullname,
        password=hash_password(user_in.password.get_secret_value()),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login", response_model=TokenResponse)
def login_user(formdata: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == formdata.username).first()
    if not user or not verify_password(formdata.password, str(user.password)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    from uuid import UUID
    uid = UUID(str(user.id))
    return {
        "access_token":  create_access_token(uid),
        "refresh_token": create_refresh_token(uid),
        "token_type":    "bearer",
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(body: RefreshRequest, db: Session = Depends(get_db)):
    """
    Accepts a valid refresh token and returns a new access + refresh token pair.
    Old refresh token is implicitly invalidated by issuing a new one.
    """
    user_id = decode_refresh_token(body.refresh_token)
    user = db.query(User).filter(User.id == str(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {
        "access_token":  create_access_token(user_id),
        "refresh_token": create_refresh_token(user_id),
        "token_type":    "bearer",
    }


@router.get("/me", response_model=UserProfile)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/update-password", status_code=status.HTTP_200_OK)
async def reset_password(data: UpdatePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.old_password.get_secret_value(), str(current_user.password)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.password = hash_password(data.new_password.get_secret_value())  # type: ignore[assignment]
    db.commit()
    return {"detail": "Password updated successfully"}    
import datetime
from uuid import UUID
from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
import dotenv
import os

#Load local enviroment variables
dotenv.load_dotenv()

# CryptContext configuration for secure Bcrypt hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Global Configuration Parameters
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRY_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRY")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)

def create_access_token(user_id:UUID) -> str:
        """Signs a payload using python-jose string encoding."""
        if ACCESS_TOKEN_EXPIRY_MINUTES and SECRET_KEY and ALGORITHM:
            expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=float(ACCESS_TOKEN_EXPIRY_MINUTES))
            to_encode = {
                 "sub": str(user_id),
                 "exp": expire
            }
            return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        else:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server misconfiguration"
             )

def decode_access_token(token:str) -> UUID:
      """Decodes a token string and handles python-jose specific exceptions."""
      credential_exceptions = HTTPException(
           status_code=status.HTTP_401_UNAUTHORIZED,
           detail="Could not validate credentials",
           headers={"WWW-Authenticate":"Bearer"},
      )
      if not (ACCESS_TOKEN_EXPIRY_MINUTES and SECRET_KEY and ALGORITHM):
          raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
              detail="Server misconfiguration"
          )
      try:
          # python-jose throws a JWTError if validation, signatures, or expiration fails
          payload = jwt.decode(token, SECRET_KEY, ALGORITHM)
          user_id_str: str | None = payload.get("sub")
          if user_id_str is None:
              raise credential_exceptions
          return UUID(user_id_str)
      except (JWTError, ValueError):
          raise credential_exceptions
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

#local file path to the database
DATABASE_URL = "sqlite:///./datbase.db"

# connect_args={"check_same_thread": False} is mandatory ONLY for SQLite.
# It allows FastAPI to interact with the database across multiple threads safely.
engine = create_engine(DATABASE_URL, connect_args={"check_same_tread":False})


# Create a session factory for generating isolated database transactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class that database models will inherit from
Base = declarative_base()

# Dependency provider to inject database sessions into FastAPI endpoints safely
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
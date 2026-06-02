from fastapi import FastAPI, Depends, status
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from database.database import engine, Base, get_db
from database.models import User
from .dependencies import get_current_user
from api.routes.auth import router as auth_router
from api.routes.analyze import router as analyzer_routes

# Executed immediately on application module import.
# It inspects local engine directory and establishes 'sql_app.db' instantly.
Base.metadata.create_all(bind=engine)


cors_allowed_origins = [
    "http://localhost:5173",
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=["*"]
)

#Register public auth routes
app.include_router(auth_router)
#Register protected analysis routes
app.include_router(analyzer_routes)

@app.get('/check-health', tags=["App Status"])
def check_sync_status(db:Session=Depends(get_db)):
    # Simple query check ensuring database reads work flawlessly
    user_count = db.query(User).count()
    return{
        "Database Engine":"Synchronous_Sqlite",
        "Initialized": True,
        "Current User Count": user_count,
    }
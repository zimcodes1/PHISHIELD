from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

cors_allowed_origins = [
    "http://localhost:5173",
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=["Content-Type"]
)

@app.get('/home')
def home():
    return{"message":"Welcome"}
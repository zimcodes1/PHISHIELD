from fastapi import APIRouter, Depends, HTTPException
from api.dependencies import get_current_user
from api.schemas import URLRequest, EmailRequest, AnalysisResponse
from database.models import User
from detection.pipeline import run_url_pipeline, run_email_pipeline


router = APIRouter(prefix='/api/v1/analyze', tags=["Analyser"])


@router.post('/url', response_model=AnalysisResponse)
async def analyze_url(request: URLRequest, current_user: User = Depends(get_current_user)):
    try:
        return await run_url_pipeline(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/email', response_model=AnalysisResponse)
async def analyze_email(request: EmailRequest, current_user: User = Depends(get_current_user)):
    try:
        return await run_email_pipeline(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
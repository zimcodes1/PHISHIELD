from fastapi import APIRouter, Depends, HTTPException
from api.dependencies import get_current_user, get_db
from api.schemas import URLRequest, EmailRequest, AnalysisResponse, HistoryResponse
from database.models import User
from detection.pipeline import run_url_pipeline, run_email_pipeline
from database.models import Scan
from sqlalchemy.orm import Session
from fastapi import status

router = APIRouter(prefix='/api/v1/analyze', tags=["Analyser"])


@router.post('/url', response_model=AnalysisResponse)
async def analyze_url(request: URLRequest, current_user: User = Depends(get_current_user), db:Session = Depends(get_db), ):
    try:
        scan_result =  await run_url_pipeline(request)
        risk_score = scan_result.risk_score
        verdict = scan_result.verdict
        # Persist scan result to database with associated user and input details
        db_scan = Scan(
            user_id=current_user.id, 
            scan_type='url', 
            input_value=request.url, 
            risk_score=risk_score, 
            verdict=verdict.value,
            top_reasons=scan_result.top_reasons,
            layers_list=[layer.model_dump() for layer in scan_result.layers_list],
        )
        db.add(db_scan)
        db.commit()
        db.refresh(db_scan)
        return scan_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/email', response_model=AnalysisResponse)
async def analyze_email(request: EmailRequest, current_user: User = Depends(get_current_user)):
    try:
        return await run_email_pipeline(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/history', response_model=HistoryResponse, status_code=status.HTTP_200_OK)
async def get_analysis_history(
    page: int = 1,
    page_size: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Calculate offset for pagination
    offset = (page - 1) * page_size
    
    # Query scans for the current user with pagination
    scans = db.query(Scan).filter(Scan.user_id == current_user.id).offset(offset).limit(page_size).all()
    
    # Get total count of scans for the user
    total_scans = db.query(Scan).filter(Scan.user_id == current_user.id).count()
    
    return {
        "page": page,
        "page_size": page_size,
        "total_scans": total_scans,
        "scans": scans
    }

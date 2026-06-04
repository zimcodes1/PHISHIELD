from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from api.dependencies import get_current_user, get_db
from api.schemas import URLRequest, EmailRequest, AnalysisResponse, HistoryResponse
from database.models import Scan, ScanType, User
from detection.pipeline import run_url_pipeline, run_email_pipeline
from detection.email_analyzer.eml_parser import EMLParseError, extract_email_request_from_eml
from sqlalchemy.orm import Session
from fastapi import status

router = APIRouter(prefix='/api/v1/analyze', tags=["Analyser"])


@router.post('/extension/url', response_model=AnalysisResponse)
async def analyze_url_anonymous(request: URLRequest):
    """Unauthenticated URL analysis for the browser extension. Results are not persisted."""
    try:
        scan_result = await run_url_pipeline(request)
        scan_result.scan_id = uuid4()
        return scan_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/url', response_model=AnalysisResponse)
async def analyze_url(request: URLRequest, current_user: User = Depends(get_current_user), db:Session = Depends(get_db), ):
    try:
        scan_result =  await run_url_pipeline(request)
        db_scan = _persist_scan(db, current_user, ScanType.URL, request.url, scan_result)
        scan_result.scan_id = UUID(str(db_scan.id))
        return scan_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/email', response_model=AnalysisResponse)
async def analyze_email(
    request: EmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        scan_result = await run_email_pipeline(request)
        db_scan = _persist_scan(db, current_user, ScanType.EMAIL_TEXT, request.subject, scan_result)
        scan_result.scan_id = UUID(str(db_scan.id))
        return scan_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/email/upload', response_model=AnalysisResponse)
async def analyze_email_upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = file.filename or "uploaded-email.eml"
    if not filename.lower().endswith(".eml"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .eml files are supported")

    try:
        raw_eml = await file.read()
        request = extract_email_request_from_eml(raw_eml)
        scan_result = await run_email_pipeline(request)
        input_value = request.subject or filename
        db_scan = _persist_scan(db, current_user, ScanType.EMAIL_FILE, input_value, scan_result)
        scan_result.scan_id = UUID(str(db_scan.id))
        return scan_result
    except EMLParseError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get('/history', response_model=HistoryResponse, status_code=status.HTTP_200_OK)
async def get_analysis_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Calculate offset for pagination
    offset = (page - 1) * page_size
    
    # Query scans for the current user with pagination
    scans = (
        db.query(Scan)
        .filter(Scan.user_id == current_user.id)
        .order_by(Scan.timestamp.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    
    # Get total count of scans for the user
    total_scans = db.query(Scan).filter(Scan.user_id == current_user.id).count()
    
    return {
        "page": page,
        "page_size": page_size,
        "total_scans": total_scans,
        "scans": scans
    }


def _persist_scan(
    db: Session,
    current_user: User,
    scan_type: ScanType,
    input_value: str,
    scan_result: AnalysisResponse,
) -> Scan:
    db_scan = Scan(
        user_id=current_user.id,
        scan_type=scan_type,
        input_value=input_value,
        risk_score=scan_result.risk_score,
        verdict=scan_result.verdict,
        top_reasons=scan_result.top_reasons,
        layers_list=[layer.model_dump() for layer in scan_result.layers_list],
    )
    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)
    return db_scan

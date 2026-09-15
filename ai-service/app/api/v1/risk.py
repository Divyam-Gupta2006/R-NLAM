from fastapi import APIRouter, HTTPException, status
from app.schemas.risk import DelayRiskAssessmentRequest, DelayRiskAssessmentResponse
from app.services.risk_service import risk_engine

router = APIRouter(prefix="/risk", tags=["AI Delay-Risk Engine"])

@router.post(
    "/assess-delay",
    response_model=DelayRiskAssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Assess Land Acquisition Project Delay Risk",
    description=(
        "Evaluates project risk score (0-100), categorizes risk level (LOW, MEDIUM, HIGH, CRITICAL), "
        "and details contributing factors & recommended mitigation attention points based on historical duration, "
        "pending tasks, statutory deadlines, objections count, compensation backlog, and parcel disputes."
    )
)
async def assess_delay(req: DelayRiskAssessmentRequest) -> DelayRiskAssessmentResponse:
    try:
        return risk_engine.assess(req)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delay risk assessment engine failure: {str(e)}"
        )

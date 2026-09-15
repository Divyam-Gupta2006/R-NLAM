from fastapi import APIRouter, HTTPException, status
from app.schemas.analytics import NLPQueryRequest, NLPQueryResponse
from app.services.nlp_service import nlp_parser

router = APIRouter(prefix="/analytics", tags=["Natural Language Analytics"])

@router.post(
    "/nlp-query",
    response_model=NLPQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse Natural Language Query to Authorized Spatial SQL & Charts",
    description=(
        "Translates natural language questions regarding compensation backlogs, project possession thresholds, "
        "parcel disputes, or timelines into authorized SQL/JSON queries along with visual chart and map configurations."
    )
)
async def parse_nlp_query(req: NLPQueryRequest) -> NLPQueryResponse:
    try:
        if not req.query or len(req.query.strip()) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query must contain at least 3 characters."
            )
        return nlp_parser.parse(req)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"NLP analytics query parsing failure: {str(e)}"
        )

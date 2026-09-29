from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.services.extraction import REVIEW_THRESHOLD, extract
from app.services.legal_rag import index
from app.services.text_sources import OcrUnavailable, extract_text

router = APIRouter(tags=["Document & Case AI"])


@router.post(
    "/documents/extract",
    summary="Extract structured fields from an award, gazette notification or 7/12/khasra extract",
    description=(
        "Accepts a PDF (text layer), a plain-text file, an image (only if Tesseract is installed) or raw text. "
        f"Returns each field with a confidence and the snippet it came from; fields below {REVIEW_THRESHOLD} "
        "are flagged needs_review and must be confirmed by a person. Nothing is decided here."
    ),
)
async def extract_document(file: Optional[UploadFile] = File(None), raw_text: Optional[str] = Form(None)):
    if file is None and not (raw_text and raw_text.strip()):
        raise HTTPException(status_code=422, detail="Provide a file or raw_text")
    try:
        if file is not None:
            src = extract_text(await file.read(), file.filename or "", file.content_type)
        else:
            from app.services.text_sources import TextSource

            src = TextSource(text=raw_text or "", method="plain-text", confidence_factor=1.0)
    except OcrUnavailable as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    result = extract(src.text, method=src.method, confidence_factor=src.confidence_factor).to_dict()
    result["characters"] = len(src.text)
    result["review_threshold"] = REVIEW_THRESHOLD
    return result


class Question(BaseModel):
    question: str = Field(..., min_length=5, max_length=500, examples=["Within how many days can a person object after the preliminary notification?"])


@router.post(
    "/legal/ask",
    summary="Answer a question from the RFCTLARR Act 2013 text and R-NLAM rule packs, with section citations",
    description="Retrieval-only (BM25 over sections, schedule items and rule-pack entries). Quotes the source; refuses when retrieval is weak; flags close calls between sections.",
)
def ask(q: Question):
    return index().answer(q.question)

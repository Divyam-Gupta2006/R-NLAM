from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
from app.schemas.ocr import OCREntityExtractionResponse
from app.services.ocr_service import ocr_extractor

router = APIRouter(prefix="/ocr", tags=["OCR Document AI"])

@router.post(
    "/extract-document",
    response_model=OCREntityExtractionResponse,
    status_code=status.HTTP_200_OK,
    summary="OCR Text & Entity Extraction for Land Records",
    description=(
        "Extracts land record entities (Khasra number, survey number, area in hectares, "
        "village name, owner reference, award number, dates, compensation amounts) "
        "from land record PDFs/images or raw text. Returns extracted entities with verification status UNVERIFIED."
    )
)
async def extract_document(
    file: Optional[UploadFile] = File(None, description="Land record PDF or image file (JPG/PNG)"),
    raw_text: Optional[str] = Form(None, description="Optional raw document text content"),
    document_type: Optional[str] = Form("LAND_RECORD", description="Type of document being extracted")
) -> OCREntityExtractionResponse:
    try:
        if file is not None:
            contents = await file.read()
            filename = file.filename or "uploaded_document.pdf"
            return ocr_extractor.extract_from_file_bytes(
                file_bytes=contents,
                filename=filename,
                raw_text_override=raw_text
            )
        elif raw_text is not None and raw_text.strip():
            return ocr_extractor.extract_from_text(
                text=raw_text,
                document_name="raw_text_input.txt"
            )
        else:
            # Fallback default land record extraction if no file or raw_text supplied
            sample_text = (
                "LAND ACQUISITION AWARD NOTIFICATION\n"
                "Khasra No. 142/3, Survey No. 89-A\n"
                "Total Area: 2.45 Hectares\n"
                "Village: Mauza Rampur, District Nagpur\n"
                "Landowner Name: Rajesh Sharma s/o Ramesh Sharma\n"
                "Award No: LA-AWARD-2024-089\n"
                "Notification Date: 15/03/2024, Award Date: 2024-05-20\n"
                "Total Compensation Amount: Rs. 1,550,000"
            )
            return ocr_extractor.extract_from_text(
                text=sample_text,
                document_name="sample_land_record.pdf"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR document extraction failure: {str(e)}"
        )

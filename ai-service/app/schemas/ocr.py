from typing import Optional, List, Dict
from pydantic import BaseModel, Field

class ExtractedEntities(BaseModel):
    khasra_number: Optional[str] = Field(None, description="Khasra or plot number")
    survey_number: Optional[str] = Field(None, description="Survey number")
    area_hectares: Optional[float] = Field(None, description="Land area in hectares")
    village_name: Optional[str] = Field(None, description="Village or revenue mauza name")
    owner_reference: Optional[str] = Field(None, description="Landowner name or reference")
    award_number: Optional[str] = Field(None, description="Land acquisition award number")
    dates: List[str] = Field(default_factory=list, description="Extracted document dates")
    compensation_amounts: List[float] = Field(default_factory=list, description="Extracted compensation monetary amounts in INR")

class OCREntityExtractionResponse(BaseModel):
    success: bool = True
    document_name: Optional[str] = Field(None, description="Uploaded file name")
    verification_status: str = Field("UNVERIFIED", description="Human verification status (always UNVERIFIED initially)")
    extracted_text: Optional[str] = Field(None, description="Raw or parsed OCR text from document")
    entities: ExtractedEntities = Field(..., description="Extracted land record entities")
    confidence_scores: Dict[str, float] = Field(default_factory=dict, description="Confidence scores per extracted entity")
    extraction_timestamp: str = Field(..., description="ISO timestamp of extraction")

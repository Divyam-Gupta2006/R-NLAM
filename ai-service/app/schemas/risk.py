from typing import Optional, List
from pydantic import BaseModel, Field

class DelayRiskAssessmentRequest(BaseModel):
    project_id: Optional[str] = Field(None, description="Unique project identifier e.g. PRJ-2024-001")
    project_name: Optional[str] = Field(None, description="Human readable project title")
    historical_duration: float = Field(..., ge=0, description="Historical elapsed duration in months or days")
    pending_tasks: int = Field(..., ge=0, description="Number of incomplete workflow tasks")
    statutory_deadlines: int = Field(..., description="Days remaining until critical statutory deadline (negative if overdue)")
    objections_count: int = Field(..., ge=0, description="Count of active land acquisition objections (Section 15)")
    compensation_backlog: float = Field(..., ge=0, description="Unpaid compensation amount in INR or backlog severity index")
    parcel_disputes: int = Field(..., ge=0, description="Number of disputed land parcels or active litigations")
    total_parcels: Optional[int] = Field(None, description="Total parcels in project boundary")
    possession_percentage: Optional[float] = Field(None, description="Percentage of land possession acquired so far (0-100)")

class ContributingFactor(BaseModel):
    factor_name: str = Field(..., description="Name of risk factor")
    impact_score: float = Field(..., description="Calculated contribution to overall risk score (0-100 scale)")
    severity: str = Field(..., description="Severity level: LOW, MEDIUM, HIGH, CRITICAL")
    description: str = Field(..., description="Human readable explanation of why this factor contributes to delay risk")

class DelayRiskAssessmentResponse(BaseModel):
    project_id: Optional[str] = Field(None, description="Project ID evaluated")
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Overall AI delay risk score from 0 (lowest risk) to 100 (highest risk)")
    risk_level: str = Field(..., description="Categorized risk level: LOW, MEDIUM, HIGH, or CRITICAL")
    contributing_factors: List[ContributingFactor] = Field(..., description="Breakdown of key factors driving delay risk")
    recommended_attention: List[str] = Field(..., description="Actionable recommendations for project officers to mitigate risk")
    assessed_at: str = Field(..., description="ISO timestamp of delay risk assessment")

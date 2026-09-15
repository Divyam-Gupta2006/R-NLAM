from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class NLPQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, description="Natural language question or request")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Optional contextual scope e.g. state, district, user role")

class VisualizationConfig(BaseModel):
    chart_type: str = Field(..., description="Recommended visualization type: bar, pie, line, map, table")
    title: str = Field(..., description="Suggested chart or view title")
    x_axis: Optional[str] = Field(None, description="Column name for horizontal axis")
    y_axis: Optional[str] = Field(None, description="Column name for vertical axis")
    map_layer: Optional[str] = Field(None, description="GIS map layer name if spatial visualization")

class NLPQueryResponse(BaseModel):
    query: str = Field(..., description="Original user query")
    intent: str = Field(..., description="Identified analytical intent classification")
    generated_sql: str = Field(..., description="Authorized SQL / PostGIS spatial query representation")
    json_query: Dict[str, Any] = Field(..., description="Structured JSON AST query representation")
    visualization: VisualizationConfig = Field(..., description="Visualization metadata for frontend charts/maps")
    result_summary: str = Field(..., description="Natural language summary answer or key finding")
    sample_results: List[Dict[str, Any]] = Field(default_factory=list, description="Sample structured query response dataset")
    processed_at: str = Field(..., description="ISO timestamp of query parsing")

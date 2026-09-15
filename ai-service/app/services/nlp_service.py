import re
import datetime
from typing import Dict, Any, List
from app.schemas.analytics import NLPQueryRequest, NLPQueryResponse, VisualizationConfig

class NLPAnalyticsParser:
    """
    Natural Language Analytics query parser & SQL/GIS translator.
    Parses user queries into authorized SQL, JSON AST, and chart/map specs.
    """

    def parse(self, req: NLPQueryRequest) -> NLPQueryResponse:
        query_text = req.query.strip()
        lower_q = query_text.lower()

        # 1. Compensation Backlog Query
        if "compensation" in lower_q or "backlog" in lower_q or "unpaid" in lower_q:
            return self._handle_compensation_backlog(query_text)

        # 2. Possession Percentage Query
        elif "possession" in lower_q or "possession percentage" in lower_q or "below" in lower_q:
            threshold = self._extract_percentage_threshold(query_text) or 70.0
            return self._handle_possession_query(query_text, threshold)

        # 3. Disputed Parcels & Objections
        elif "dispute" in lower_q or "objection" in lower_q or "litigation" in lower_q:
            return self._handle_disputes_query(query_text)

        # 4. Delay & Risk Assessment
        elif "delay" in lower_q or "risk" in lower_q or "critical" in lower_q:
            return self._handle_delay_risk_query(query_text)

        # 5. Fallback Generic Analytics Query
        else:
            return self._handle_generic_query(query_text)

    def _extract_percentage_threshold(self, query: str) -> float:
        match = re.search(r"(\d+(?:\.\d+)?)\s*%", query)
        if match:
            return float(match.group(1))
        match = re.search(r"below\s*(\d+(?:\.\d+)?)", query, re.IGNORECASE)
        if match:
            return float(match.group(1))
        return 70.0

    def _handle_compensation_backlog(self, query: str) -> NLPQueryResponse:
        intent = "COMPENSATION_BACKLOG_BY_DISTRICT"
        sql = (
            "SELECT district, "
            "COUNT(id) AS total_parcels, "
            "SUM(compensation_amount - compensation_paid) AS total_backlog_inr, "
            "AVG(compensation_paid / NULLIF(compensation_amount, 0)) * 100 AS disbursement_rate_pct "
            "FROM land_parcels "
            "WHERE compensation_paid < compensation_amount "
            "GROUP BY district "
            "ORDER BY total_backlog_inr DESC "
            "LIMIT 10;"
        )
        json_ast = {
            "target_table": "land_parcels",
            "filters": [{"field": "compensation_paid", "operator": "<", "value": "compensation_amount"}],
            "aggregations": [
                {"func": "COUNT", "field": "id", "alias": "total_parcels"},
                {"func": "SUM", "field": "compensation_unpaid", "alias": "total_backlog_inr"}
            ],
            "group_by": ["district"],
            "order_by": [{"field": "total_backlog_inr", "direction": "DESC"}],
            "limit": 10
        }
        viz = VisualizationConfig(
            chart_type="bar",
            title="Top Districts by Compensation Disbursement Backlog (INR)",
            x_axis="district",
            y_axis="total_backlog_inr",
            map_layer="district_compensation_choropleth"
        )
        samples = [
            {"district": "Nagpur", "total_parcels": 42, "total_backlog_inr": 45000000.0, "disbursement_rate_pct": 32.5},
            {"district": "Pune", "total_parcels": 28, "total_backlog_inr": 32500000.0, "disbursement_rate_pct": 45.0},
            {"district": "Nashik", "total_parcels": 19, "total_backlog_inr": 18200000.0, "disbursement_rate_pct": 58.2},
            {"district": "Thane", "total_parcels": 15, "total_backlog_inr": 14000000.0, "disbursement_rate_pct": 61.0}
        ]
        return NLPQueryResponse(
            query=query,
            intent=intent,
            generated_sql=sql,
            json_query=json_ast,
            visualization=viz,
            result_summary="Identified top districts with highest unpaid compensation. Nagpur and Pune account for 70% of current pending disbursement backlog.",
            sample_results=samples,
            processed_at=datetime.datetime.utcnow().isoformat() + "Z"
        )

    def _handle_possession_query(self, query: str, threshold: float) -> NLPQueryResponse:
        intent = "POSSESSION_BELOW_THRESHOLD"
        sql = (
            f"SELECT project_id, project_name, district, possession_percentage, total_area_hectares "
            f"FROM acquisition_projects "
            f"WHERE possession_percentage < {threshold} "
            f"ORDER BY possession_percentage ASC "
            f"LIMIT 15;"
        )
        json_ast = {
            "target_table": "acquisition_projects",
            "filters": [{"field": "possession_percentage", "operator": "<", "value": threshold}],
            "select": ["project_id", "project_name", "district", "possession_percentage", "total_area_hectares"],
            "order_by": [{"field": "possession_percentage", "direction": "ASC"}],
            "limit": 15
        }
        viz = VisualizationConfig(
            chart_type="bar",
            title=f"Projects with Physical Possession Below {threshold}%",
            x_axis="project_name",
            y_axis="possession_percentage",
            map_layer="project_possession_polygons"
        )
        samples = [
            {"project_id": "PRJ-NH-044", "project_name": "NH-44 Expressway Widening Phase II", "district": "Solapur", "possession_percentage": 42.5, "total_area_hectares": 120.5},
            {"project_id": "PRJ-RAIL-089", "project_name": "Western Freight Corridor Link", "district": "Palghar", "possession_percentage": 58.0, "total_area_hectares": 85.2},
            {"project_id": "PRJ-IND-102", "project_name": "MIDC Industrial Park Extension", "district": "Aurangabad", "possession_percentage": 65.4, "total_area_hectares": 210.0}
        ]
        return NLPQueryResponse(
            query=query,
            intent=intent,
            generated_sql=sql,
            json_query=json_ast,
            visualization=viz,
            result_summary=f"Found {len(samples)} major infrastructure projects where physical land possession is below the {threshold}% threshold.",
            sample_results=samples,
            processed_at=datetime.datetime.utcnow().isoformat() + "Z"
        )

    def _handle_disputes_query(self, query: str) -> NLPQueryResponse:
        intent = "PARCEL_DISPUTES_AND_OBJECTIONS"
        sql = (
            "SELECT p.id AS parcel_id, p.khasra_number, p.village_name, p.district, "
            "o.objection_type, o.status AS objection_status, o.filed_date "
            "FROM land_parcels p "
            "JOIN objections o ON p.id = o.parcel_id "
            "WHERE o.status IN ('PENDING', 'UNDER_HEARING') "
            "ORDER BY o.filed_date DESC "
            "LIMIT 20;"
        )
        json_ast = {
            "target_table": "land_parcels",
            "joins": [{"table": "objections", "on": "land_parcels.id = objections.parcel_id"}],
            "filters": [{"field": "objections.status", "operator": "IN", "value": ["PENDING", "UNDER_HEARING"]}],
            "order_by": [{"field": "objections.filed_date", "direction": "DESC"}],
            "limit": 20
        }
        viz = VisualizationConfig(
            chart_type="pie",
            title="Active Parcel Objections by Objection Category",
            x_axis="objection_type",
            y_axis="count",
            map_layer="disputed_parcels_heatmap"
        )
        samples = [
            {"parcel_id": "PCL-1042", "khasra_number": "142/3", "village_name": "Rampur", "district": "Nagpur", "objection_type": "Title Dispute / Heirship", "objection_status": "UNDER_HEARING", "filed_date": "2024-02-10"},
            {"parcel_id": "PCL-1089", "khasra_number": "89-A", "village_name": "Shivpuri", "district": "Pune", "objection_type": "Low Compensation Rate", "objection_status": "PENDING", "filed_date": "2024-03-01"}
        ]
        return NLPQueryResponse(
            query=query,
            intent=intent,
            generated_sql=sql,
            json_query=json_ast,
            visualization=viz,
            result_summary="Extracted active litigation and Section 15 objections across parcels. Title disputes and compensation rate objections represent the primary categories.",
            sample_results=samples,
            processed_at=datetime.datetime.utcnow().isoformat() + "Z"
        )

    def _handle_delay_risk_query(self, query: str) -> NLPQueryResponse:
        intent = "PROJECT_DELAY_RISK_SUMMARY"
        sql = (
            "SELECT project_id, project_name, risk_score, risk_level, "
            "pending_tasks, statutory_deadlines, objections_count "
            "FROM delay_risk_assessments "
            "WHERE risk_level IN ('HIGH', 'CRITICAL') "
            "ORDER BY risk_score DESC "
            "LIMIT 10;"
        )
        json_ast = {
            "target_table": "delay_risk_assessments",
            "filters": [{"field": "risk_level", "operator": "IN", "value": ["HIGH", "CRITICAL"]}],
            "order_by": [{"field": "risk_score", "direction": "DESC"}],
            "limit": 10
        }
        viz = VisualizationConfig(
            chart_type="bar",
            title="Critical and High Delay-Risk Projects",
            x_axis="project_name",
            y_axis="risk_score",
            map_layer="high_risk_projects_map"
        )
        samples = [
            {"project_id": "PRJ-2024-001", "project_name": "Ring Road Phase 1", "risk_score": 84.5, "risk_level": "CRITICAL", "pending_tasks": 32, "statutory_deadlines": -14, "objections_count": 18},
            {"project_id": "PRJ-2024-009", "project_name": "Metro Rail Depot", "risk_score": 76.2, "risk_level": "CRITICAL", "pending_tasks": 24, "statutory_deadlines": 5, "objections_count": 12}
        ]
        return NLPQueryResponse(
            query=query,
            intent=intent,
            generated_sql=sql,
            json_query=json_ast,
            visualization=viz,
            result_summary="Identified projects exceeding acceptable delay risk thresholds. Immediate intervention recommended on statutory deadline extensions.",
            sample_results=samples,
            processed_at=datetime.datetime.utcnow().isoformat() + "Z"
        )

    def _handle_generic_query(self, query: str) -> NLPQueryResponse:
        intent = "GENERIC_LAND_RECORD_SEARCH"
        sql = (
            "SELECT id, project_name, district, state, total_parcels, status "
            "FROM acquisition_projects "
            "WHERE project_name ILIKE '%land%' OR district ILIKE '%land%' "
            "ORDER BY created_at DESC "
            "LIMIT 10;"
        )
        json_ast = {
            "target_table": "acquisition_projects",
            "select": ["id", "project_name", "district", "state", "total_parcels", "status"],
            "limit": 10
        }
        viz = VisualizationConfig(
            chart_type="table",
            title="Land Acquisition Search Results",
            x_axis="project_name",
            y_axis="total_parcels",
            map_layer=None
        )
        return NLPQueryResponse(
            query=query,
            intent=intent,
            generated_sql=sql,
            json_query=json_ast,
            visualization=viz,
            result_summary=f"Parsed natural language query '{query}'. Generated structured spatial SQL query parameters.",
            sample_results=[],
            processed_at=datetime.datetime.utcnow().isoformat() + "Z"
        )

nlp_parser = NLPAnalyticsParser()

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_assess_delay_critical_risk():
    payload = {
        "project_id": "PRJ-2024-001",
        "project_name": "Ring Road Highway Expansion",
        "historical_duration": 30.5,
        "pending_tasks": 35,
        "statutory_deadlines": -15,
        "objections_count": 22,
        "compensation_backlog": 45000000.0,
        "parcel_disputes": 14
    }
    response = client.post("/api/v1/risk/assess-delay", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == "PRJ-2024-001"
    assert 0.0 <= data["risk_score"] <= 100.0
    assert data["risk_level"] in ["HIGH", "CRITICAL"]
    assert len(data["contributing_factors"]) > 0
    assert len(data["recommended_attention"]) > 0

def test_assess_delay_low_risk():
    payload = {
        "project_id": "PRJ-2024-002",
        "project_name": "Substation Land Acquisition",
        "historical_duration": 3.0,
        "pending_tasks": 2,
        "statutory_deadlines": 90,
        "objections_count": 0,
        "compensation_backlog": 0.0,
        "parcel_disputes": 0
    }
    response = client.post("/api/v1/risk/assess-delay", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "LOW"
    assert data["risk_score"] < 25.0

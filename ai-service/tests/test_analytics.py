from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_nlp_query_compensation_backlog():
    payload = {
        "query": "Which districts have the highest compensation backlog?"
    }
    response = client.post("/api/v1/analytics/nlp-query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "COMPENSATION_BACKLOG_BY_DISTRICT"
    assert "SELECT" in data["generated_sql"]
    assert data["visualization"]["chart_type"] == "bar"
    assert len(data["sample_results"]) > 0

def test_nlp_query_possession_threshold():
    payload = {
        "query": "Show projects where possession is below 70%"
    }
    response = client.post("/api/v1/analytics/nlp-query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "POSSESSION_BELOW_THRESHOLD"
    assert "possession_percentage < 70" in data["generated_sql"]
    assert data["visualization"]["chart_type"] == "bar"

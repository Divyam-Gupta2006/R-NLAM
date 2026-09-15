import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ocr_extract_document_raw_text():
    raw_text = (
        "LAND RECORD NOTIFICATION\n"
        "Khasra No: 142/3\n"
        "Survey No: 89-A\n"
        "Area: 2.45 Hectares\n"
        "Village: Mauza Rampur\n"
        "Owner: Rajesh Sharma s/o Ramesh Sharma\n"
        "Award No: LA-AWARD-2024-089\n"
        "Date: 15/03/2024\n"
        "Compensation Amount: Rs. 1,550,000"
    )
    response = client.post(
        "/api/v1/ocr/extract-document",
        data={"raw_text": raw_text, "document_type": "LAND_RECORD"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["verification_status"] == "UNVERIFIED"

    entities = data["entities"]
    assert entities["khasra_number"] == "142/3"
    assert entities["survey_number"] == "89-A"
    assert entities["area_hectares"] == 2.45
    assert "Rampur" in entities["village_name"]
    assert "Rajesh Sharma" in entities["owner_reference"]
    assert entities["award_number"] == "LA-AWARD-2024-089"
    assert 1550000.0 in entities["compensation_amounts"]

def test_ocr_extract_document_file_upload():
    content = b"Khasra No: 205/1\nSurvey No: 12-B\nArea: 1.80 Hectares\nVillage: Chandrapur\nAward No: AWARD/2024/77\nCompensation: 850000"
    file_payload = ("test_record.txt", io.BytesIO(content), "text/plain")

    response = client.post(
        "/api/v1/ocr/extract-document",
        files={"file": file_payload}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verification_status"] == "UNVERIFIED"
    assert data["entities"]["khasra_number"] == "205/1"
    assert data["entities"]["survey_number"] == "12-B"
    assert data["entities"]["area_hectares"] == 1.80

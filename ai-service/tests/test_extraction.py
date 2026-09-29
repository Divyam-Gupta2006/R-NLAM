import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.extraction import REVIEW_THRESHOLD, extract
from app.services.text_sources import OcrUnavailable, extract_text

client = TestClient(app)

ENGLISH_AWARD = """GOVERNMENT OF MAHARASHTRA
Office of the Collector, Wardha
Award No: LA/WRD/NH-WY/2025/017
Award under section 23 of the Right to Fair Compensation and Transparency in Land Acquisition,
Rehabilitation and Resettlement Act, 2013
Village: Selukate, District: Wardha
Survey No. 45/2A
Name of the owner: Ramesh Govind Patil s/o Govind Patil
Area acquired: 1.25 hectares
Market value: Rs. 18,40,000
Solatium (100%): Rs. 18,40,000
Total compensation: Rs. 36,80,000
Date of award: 14 March 2025
"""

MARATHI_712 = """गाव नमुना सात (७/१२)
गाव: आंजी
जिल्हा: वर्धा
गट क्र. १२३/४
भोगवटदाराचे नाव: सुनीता रामराव देशमुख
क्षेत्र ०.८५ हेक्टर
दिनांक १२/०१/२०२४
"""


def values(result, key):
    return [f.value for f in result.fields[key]]


def test_english_award_fields():
    r = extract(ENGLISH_AWARD)
    assert r.document_type == "AWARD"
    assert values(r, "survey_numbers") == ["45/2A"]
    assert values(r, "owner_names") == ["Ramesh Govind Patil"]
    assert values(r, "area_hectares") == [1.25]
    assert 3680000 in values(r, "amounts_inr")
    assert values(r, "dates") == ["2025-03-14"]
    assert "s.23" in values(r, "sections")
    assert values(r, "village") == ["Selukate"]
    assert values(r, "district") == ["Wardha"]
    assert values(r, "award_number") == ["LA/WRD/NH-WY/2025/017"]


def test_owner_notes_market_value_and_reference():
    r = extract("Reference: AWD/MH-WRD/2026/0029\nName of the owner: Pandurang Shankarrao Dhote (share 100%)\nMarket value: Rs. 13,12,280")
    assert values(r, "owner_names") == ["Pandurang Shankarrao Dhote"]
    assert values(r, "amounts_inr") == [1312280]
    assert not r.fields["amounts_inr"][0].needs_review
    assert values(r, "reference_number") == ["AWD/MH-WRD/2026/0029"]


def test_every_field_has_evidence_from_the_text():
    r = extract(ENGLISH_AWARD)
    flat = " ".join(ENGLISH_AWARD.split())
    for fs in r.fields.values():
        for f in fs:
            assert f.evidence and f.evidence in flat


def test_marathi_7_12_with_devanagari_digits():
    r = extract(MARATHI_712)
    assert r.document_type == "KHASRA_EXTRACT"
    assert values(r, "survey_numbers") == ["123/4"]
    assert values(r, "owner_names") == ["सुनीता रामराव देशमुख"]
    assert values(r, "area_hectares") == [0.85]
    assert values(r, "dates") == ["2024-01-12"]
    assert values(r, "village") == ["आंजी"]
    assert values(r, "district") == ["वर्धा"]


def test_unlabelled_values_are_flagged_for_review():
    r = extract("Paid Rs. 5,000 on 01/02/2024 for 2 acres.")
    amount = r.fields["amounts_inr"][0]
    area = r.fields["area_hectares"][0]
    assert amount.confidence < REVIEW_THRESHOLD and amount.needs_review
    assert area.needs_review and area.value == pytest.approx(0.8094, abs=1e-4)
    assert r.needs_review


def test_conflicting_single_valued_field_needs_review():
    r = extract("Village: Anji\nVillage: Borgaon\nAward No: LA/1/2024")
    assert len(r.fields["village"]) == 2
    assert all(f.needs_review for f in r.fields["village"])


def test_ocr_confidence_factor_lowers_confidence():
    plain = extract(ENGLISH_AWARD)
    ocr = extract(ENGLISH_AWARD, method="tesseract", confidence_factor=0.85)
    assert ocr.fields["survey_numbers"][0].confidence < plain.fields["survey_numbers"][0].confidence
    assert ocr.text_method == "tesseract"


def test_unknown_document_is_low_confidence():
    r = extract("Minutes of the cricket club meeting.")
    assert r.document_type == "UNKNOWN" and r.needs_review


def _pdf(text: str) -> bytes:
    """A minimal one-page PDF with a text layer (no extra dependency)."""
    lines = [l.replace("(", "[").replace(")", "]") for l in text.splitlines()]
    ops = "BT /F1 11 Tf 40 800 Td 14 TL " + " ".join(f"({l}) '" for l in lines) + " ET"
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(ops)} >>\nstream\n{ops}\nendstream",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n{o}\nendobj\n".encode("latin-1"))
    xref = out.tell()
    out.write(f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return out.getvalue()


def test_pdf_text_layer_is_read():
    src = extract_text(_pdf("Survey No: 77/1\nArea: 0.5 hectares"), "award.pdf", "application/pdf")
    assert src.method == "pdf-text-layer"
    assert "77/1" in src.text


def test_image_without_ocr_engine_is_refused(monkeypatch):
    import app.services.text_sources as ts

    monkeypatch.setattr(ts, "_tesseract_available", lambda: False)
    with pytest.raises(OcrUnavailable):
        extract_text(b"\x89PNG\r\n", "scan.png", "image/png")


def test_endpoint_accepts_text_and_file():
    r = client.post("/api/v1/documents/extract", data={"raw_text": ENGLISH_AWARD})
    assert r.status_code == 200
    body = r.json()
    assert body["document_type"] == "AWARD"
    assert body["review_threshold"] == REVIEW_THRESHOLD
    r = client.post("/api/v1/documents/extract", files={"file": ("a.pdf", _pdf("Survey No: 77/1"), "application/pdf")})
    assert r.status_code == 200 and r.json()["text_method"] == "pdf-text-layer"


def test_endpoint_rejects_empty_input_and_unreadable_images(monkeypatch):
    assert client.post("/api/v1/documents/extract").status_code == 422
    import app.services.text_sources as ts

    monkeypatch.setattr(ts, "_tesseract_available", lambda: False)
    r = client.post("/api/v1/documents/extract", files={"file": ("s.png", b"\x89PNG", "image/png")})
    assert r.status_code == 422 and "OCR" in r.json()["detail"]

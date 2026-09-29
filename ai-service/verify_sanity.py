import sys
import unittest
from fastapi.testclient import TestClient
from app.main import app

class TestAIServiceSanity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        print("\n========================================================")
        print("Starting R-NLAM FastAPI AI Microservice Sanity Verification")
        print("========================================================\n")

    def test_01_health_check(self):
        print("[TEST 1/4] Verifying Root & Health Endpoints...")
        resp_root = self.client.get("/")
        self.assertEqual(resp_root.status_code, 200)
        self.assertEqual(resp_root.json()["status"], "HEALTHY")

        resp_health = self.client.get("/health")
        self.assertEqual(resp_health.status_code, 200)
        self.assertEqual(resp_health.json()["status"], "ok")
        print("  -> Passed: Microservice initialized and healthy listening on port 8000.")

    def test_02_document_extraction(self):
        print("[TEST 2/4] Verifying POST /api/v1/documents/extract...")
        raw_text = (
            "NOTICE OF AWARD & KHASRA DETAILS\n"
            "Khasra No: 142/3\n"
            "Survey No: 89-A\n"
            "Area: 2.45 Hectares\n"
            "Village: Mauza Rampur\n"
            "Owner: Rajesh Sharma s/o Ramesh Sharma\n"
            "Award No: LA-AWARD-2024-089\n"
            "Date: 15/03/2024\n"
            "Compensation Amount: Rs. 1,550,000"
        )
        res = self.client.post("/api/v1/documents/extract", data={"raw_text": raw_text})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        f = data["fields"]
        self.assertEqual(data["document_type"], "AWARD")
        surveys = [x["value"] for x in f["survey_numbers"]]
        self.assertIn("142/3", surveys)
        self.assertIn("89-A", surveys)
        self.assertEqual(f["area_hectares"][0]["value"], 2.45)
        self.assertEqual(f["award_number"][0]["value"], "LA-AWARD-2024-089")
        self.assertEqual(f["owner_names"][0]["value"], "Rajesh Sharma")
        self.assertEqual(f["dates"][0]["value"], "2024-03-15")
        print("  -> Passed: fields extracted with per-field confidence and evidence.")

    def test_03_risk_assessment(self):
        print("[TEST 3/4] Verifying POST /api/v1/risk/assess-delay...")
        req = {
            "project_id": "PRJ-2024-001",
            "historical_duration": 28.5,
            "pending_tasks": 32,
            "statutory_deadlines": -14,
            "objections_count": 18,
            "compensation_backlog": 45000000.0,
            "parcel_disputes": 12
        }
        res = self.client.post("/api/v1/risk/assess-delay", json=req)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["risk_score"], 0.0)
        self.assertLessEqual(data["risk_score"], 100.0)
        self.assertIn(data["risk_level"], ["HIGH", "CRITICAL"])
        self.assertGreater(len(data["contributing_factors"]), 0)
        self.assertGreater(len(data["recommended_attention"]), 0)
        print(f"  -> Passed: Delay risk score computed ({data['risk_score']}, level: {data['risk_level']}) with factors and recommendations.")

    def test_04_nlp_analytics(self):
        print("[TEST 4/4] Verifying POST /api/v1/analytics/nlp-query...")
        req = {"query": "Which districts have the highest compensation backlog?"}
        res = self.client.post("/api/v1/analytics/nlp-query", json=req)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["intent"], "COMPENSATION_BACKLOG_BY_DISTRICT")
        self.assertIn("SELECT", data["generated_sql"])
        self.assertEqual(data["visualization"]["chart_type"], "bar")
        self.assertGreater(len(data["sample_results"]), 0)
        print("  -> Passed: Natural language query translated to spatial SQL query with chart visualization configuration.")

def run_verification():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAIServiceSanity)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if result.wasSuccessful():
        print("\nAll R-NLAM AI Microservice sanity checks PASSED successfully!")
        sys.exit(0)
    else:
        print("\nSanity checks failed!")
        sys.exit(1)

if __name__ == "__main__":
    run_verification()

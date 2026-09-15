import datetime
import numpy as np
import pandas as pd
from typing import List, Tuple
from sklearn.ensemble import RandomForestRegressor
from app.schemas.risk import DelayRiskAssessmentRequest, DelayRiskAssessmentResponse, ContributingFactor

class DelayRiskEngine:
    """
    AI Delay-Risk Engine for Land Acquisition Projects.
    Combines Scikit-Learn Random Forest Regressor ML model with expert rules
    to score overall completion delay risk (0-100) and generate mitigation advice.
    """

    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=50, random_state=42)
        self._train_baseline_model()

    def _train_baseline_model(self):
        """
        Train ML model on synthetic benchmark dataset representing land acquisition project delay patterns.
        Features: [historical_duration, pending_tasks, statutory_deadlines, objections_count, compensation_backlog_inr, parcel_disputes]
        Target: Risk score (0.0 - 100.0)
        """
        np.random.seed(42)
        n_samples = 500

        durations = np.random.uniform(1, 48, n_samples)          # 1 to 48 months
        pending = np.random.randint(0, 50, n_samples)            # 0 to 50 pending tasks
        deadlines = np.random.uniform(-60, 180, n_samples)       # -60 (overdue) to 180 days remaining
        objections = np.random.randint(0, 40, n_samples)         # 0 to 40 objections
        backlogs = np.random.uniform(0, 50000000, n_samples)     # 0 to 5 Cr INR
        disputes = np.random.randint(0, 25, n_samples)           # 0 to 25 disputes

        # Target calculation (synthetic risk ground truth)
        risk_scores = (
            (durations / 48.0) * 15.0 +
            (pending / 50.0) * 20.0 +
            np.where(deadlines < 0, np.minimum(abs(deadlines)/60.0 * 25.0, 25.0), np.maximum((180 - deadlines)/180.0 * 10.0, 0)) +
            (objections / 40.0) * 15.0 +
            (backlogs / 50000000.0) * 15.0 +
            (disputes / 25.0) * 20.0
        )
        risk_scores = np.clip(risk_scores, 0.0, 100.0)

        X = np.column_stack([durations, pending, deadlines, objections, backlogs, disputes])
        y = risk_scores

        self.model.fit(X, y)

    def assess(self, req: DelayRiskAssessmentRequest) -> DelayRiskAssessmentResponse:
        # Prepare feature vector
        features = np.array([[
            req.historical_duration,
            req.pending_tasks,
            req.statutory_deadlines,
            req.objections_count,
            req.compensation_backlog,
            req.parcel_disputes
        ]])

        # ML Prediction
        ml_score = float(self.model.predict(features)[0])

        # Rule-assisted adjustments for critical boundary conditions
        rule_score = self._compute_rule_score(req)
        final_score = round(float(np.clip(0.6 * ml_score + 0.4 * rule_score, 0.0, 100.0)), 1)

        # Categorize risk level
        risk_level = self._categorize_level(final_score)

        # Compute contributing factors breakdown
        contributing_factors = self._evaluate_factors(req)

        # Recommend attention points
        recommendations = self._generate_recommendations(req, final_score, contributing_factors)

        return DelayRiskAssessmentResponse(
            project_id=req.project_id or "PRJ-UNASSIGNED",
            risk_score=final_score,
            risk_level=risk_level,
            contributing_factors=contributing_factors,
            recommended_attention=recommendations,
            assessed_at=datetime.datetime.utcnow().isoformat() + "Z"
        )

    def _compute_rule_score(self, req: DelayRiskAssessmentRequest) -> float:
        score = 0.0
        # Historical duration factor
        if req.historical_duration > 24:
            score += 15.0
        elif req.historical_duration > 12:
            score += 8.0

        # Pending tasks factor
        if req.pending_tasks > 25:
            score += 20.0
        elif req.pending_tasks > 10:
            score += 10.0

        # Statutory deadlines (negative means overdue)
        if req.statutory_deadlines < 0:
            score += min(25.0, abs(req.statutory_deadlines) * 0.8)
        elif req.statutory_deadlines <= 15:
            score += 15.0

        # Objections count
        if req.objections_count > 15:
            score += 15.0
        elif req.objections_count > 5:
            score += 8.0

        # Compensation backlog
        if req.compensation_backlog > 10000000: # > 1 Cr
            score += 15.0
        elif req.compensation_backlog > 2000000: # > 20 Lakhs
            score += 8.0

        # Parcel disputes
        if req.parcel_disputes > 10:
            score += 20.0
        elif req.parcel_disputes > 3:
            score += 10.0

        return min(100.0, score)

    def _categorize_level(self, score: float) -> str:
        if score < 25.0:
            return "LOW"
        elif score < 50.0:
            return "MEDIUM"
        elif score < 75.0:
            return "HIGH"
        else:
            return "CRITICAL"

    def _evaluate_factors(self, req: DelayRiskAssessmentRequest) -> List[ContributingFactor]:
        factors = []

        # 1. Parcel Disputes
        dispute_impact = min(35.0, req.parcel_disputes * 2.8)
        disp_sev = "CRITICAL" if req.parcel_disputes > 10 else ("HIGH" if req.parcel_disputes > 5 else "MEDIUM" if req.parcel_disputes > 0 else "LOW")
        factors.append(ContributingFactor(
            factor_name="Parcel Ownership Disputes",
            impact_score=round(dispute_impact, 1),
            severity=disp_sev,
            description=f"{req.parcel_disputes} active land parcel ownership disputes requiring judicial / revenue hearing."
        ))

        # 2. Statutory Deadlines
        if req.statutory_deadlines < 0:
            dl_impact = min(30.0, 15.0 + abs(req.statutory_deadlines) * 0.5)
            dl_sev = "CRITICAL"
            dl_desc = f"Statutory deadline is OVERDUE by {abs(req.statutory_deadlines)} days!"
        else:
            dl_impact = max(0.0, (60.0 - req.statutory_deadlines) * 0.3)
            dl_sev = "HIGH" if req.statutory_deadlines <= 10 else ("MEDIUM" if req.statutory_deadlines <= 30 else "LOW")
            dl_desc = f"{req.statutory_deadlines} days remaining until upcoming statutory milestone deadline."
        factors.append(ContributingFactor(
            factor_name="Statutory Deadline Urgency",
            impact_score=round(dl_impact, 1),
            severity=dl_sev,
            description=dl_desc
        ))

        # 3. Compensation Backlog
        backlog_cr = req.compensation_backlog / 10000000.0
        cb_impact = min(25.0, backlog_cr * 10.0)
        cb_sev = "CRITICAL" if backlog_cr > 2.0 else ("HIGH" if backlog_cr > 0.5 else "MEDIUM" if backlog_cr > 0 else "LOW")
        factors.append(ContributingFactor(
            factor_name="Compensation Disbursement Backlog",
            impact_score=round(cb_impact, 1),
            severity=cb_sev,
            description=f"₹{req.compensation_backlog:,.2f} in pending compensation payments to landowners."
        ))

        # 4. Objections Count
        obj_impact = min(20.0, req.objections_count * 1.2)
        obj_sev = "HIGH" if req.objections_count > 15 else ("MEDIUM" if req.objections_count > 5 else "LOW")
        factors.append(ContributingFactor(
            factor_name="Section 15 Objections",
            impact_score=round(obj_impact, 1),
            severity=obj_sev,
            description=f"{req.objections_count} formal Section 15 objections filed awaiting hearing collector disposal."
        ))

        # 5. Pending Tasks
        task_impact = min(20.0, req.pending_tasks * 0.8)
        task_sev = "HIGH" if req.pending_tasks > 20 else ("MEDIUM" if req.pending_tasks > 8 else "LOW")
        factors.append(ContributingFactor(
            factor_name="Workflow Task Backlog",
            impact_score=round(task_impact, 1),
            severity=task_sev,
            description=f"{req.pending_tasks} administrative workflow tasks currently incomplete."
        ))

        # Sort factors by impact score descending
        factors.sort(key=lambda x: x.impact_score, reverse=True)
        return factors

    def _generate_recommendations(self, req: DelayRiskAssessmentRequest, score: float, factors: List[ContributingFactor]) -> List[str]:
        recs = []
        if req.statutory_deadlines < 0:
            recs.append("IMMEDIATE ACTION: Statutory deadline lapsed. Submit formal notification extension to District Collector immediately.")

        if req.parcel_disputes > 5:
            recs.append("Establish a Fast-Track Revenue Lok Adalat bench for resolving title & ownership disputes.")

        if req.compensation_backlog > 5000000:
            recs.append("Expedite Direct Benefit Transfer (DBT) batch processing via Treasury Integration to clear compensation backlog.")

        if req.objections_count > 10:
            recs.append("Schedule daily Section 15 hearing sessions with designated Competent Authority (CALA).")

        if req.pending_tasks > 15:
            recs.append("Reassign field verification & surveyor teams to clear task bottleneck in pending parcels.")

        if not recs:
            recs.append("Project progress is within normal statutory operational parameters. Maintain regular weekly audit cycle.")

        return recs

risk_engine = DelayRiskEngine()

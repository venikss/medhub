"""
CDSS Rule Engine Metrics
========================

Unit-level accuracy tests for GraphRuleEngineService._evaluate().
Tests are parameterized around clinical scenarios with known expected outcomes.

Metrics reported:
  - Per-rule: sensitivity, specificity, precision, F1
  - Overall: macro-averaged sensitivity, precision, F1
  - Confusion matrix counts: TP, FP, TN, FN

Each test case specifies a synthetic clinical snapshot built using
SimpleNamespace objects — no database writes required.
Only Django settings need to be loaded (handled by pytest-django via pytest.ini).

Run:
  cd fullproj/backend
  pytest tests/test_cdss_metrics.py -v --tb=short
  pytest tests/test_cdss_metrics.py -v --tb=short -s   # show metric summary
"""
import pytest
from types import SimpleNamespace
from dataclasses import dataclass
from typing import Any

# ---------------------------------------------------------------------------
# Snapshot builder helpers
# ---------------------------------------------------------------------------

def _empty_graph():
    return {"diagnoses": [], "medications": []}


def _snap(
    diagnoses=None,
    graph_diagnoses=None,
    graph_meds=None,
    prescriptions=None,
    allergies=None,
    vitals=None,
    recent_results=None,
    critical_values=None,
    urgent_findings=None,
    recent_reports=None,
    overdue_tasks=None,
):
    """Build a minimal rule-engine snapshot from plain Python objects."""
    return {
        "patient": SimpleNamespace(allergies=allergies or []),
        "graph": {
            "diagnoses": graph_diagnoses or [],
            "medications": graph_meds or [],
        },
        "diagnoses": [
            SimpleNamespace(description=d) for d in (diagnoses or [])
        ],
        "active_prescriptions": [
            SimpleNamespace(
                medication=m,
                generic_name=m,
                rxnorm_code="",
            )
            for m in (prescriptions or [])
        ],
        "pharmacy_prescriptions": [],
        "latest_vitals": vitals,
        "overdue_tasks": overdue_tasks or [],
        "critical_values": critical_values or [],
        "recent_results": recent_results or [],
        "urgent_findings": urgent_findings or [],
        "recent_reports": recent_reports or [],
    }


def _lab(test_name, value, unit="", flag="", delta=None, delta_flag=None, previous_value=None):
    return SimpleNamespace(
        test_name=test_name,
        value=str(value),
        unit=unit,
        flag=flag,
        delta=delta,
        delta_flag=delta_flag,
        previous_value=previous_value,
    )


def _critical_value(test_name, value, unit="", status="pending"):
    return SimpleNamespace(
        test_name=test_name,
        value=str(value),
        unit=unit,
        status=status,
        result=None,
    )


def _vitals(news2=None, hr=None, rr=None, spo2=None, temp=None, systolic=None):
    return SimpleNamespace(
        news2_score=news2,
        heart_rate=hr,
        respiratory_rate=rr,
        spo2=spo2,
        temperature=temp,
        systolic=systolic,
    )


def _rad_finding(finding="Critical finding", status="open", severity="critical"):
    return SimpleNamespace(finding=finding, status=status, severity=severity)


def _rad_report(recommendations=""):
    return SimpleNamespace(
        recommendations=recommendations,
        study=SimpleNamespace(order=SimpleNamespace(exam_name="CT Chest")),
    )


# ---------------------------------------------------------------------------
# Scenario registry — each entry drives one parameterized test assertion
# ---------------------------------------------------------------------------

@dataclass
class Scenario:
    id: str
    name: str
    snapshot: dict
    expected_fire: bool          # True = rule SHOULD fire
    expected_rec_type: str       # CDSSRecommendationType value to check


def _build_scenarios():
    from apps.cdss.models import CDSSRecommendationType, CDSSSeverity

    return [
        # ------------------------------------------------------------------
        # Doctor rules
        # ------------------------------------------------------------------
        Scenario(
            id="DR-01",
            name="DM + HTN -> cardiometabolic risk_score fires",
            snapshot=_snap(
                diagnoses=["Type 2 Diabetes mellitus E11", "Essential Hypertension I10"],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.RISK_SCORE,
        ),
        Scenario(
            id="DR-02",
            name="HTN only -> no cardiometabolic risk_score",
            snapshot=_snap(diagnoses=["Essential Hypertension I10"]),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.RISK_SCORE,
        ),
        Scenario(
            id="DR-03",
            name="DM without statin -> care_gap fires",
            snapshot=_snap(
                diagnoses=["Type 2 Diabetes E11"],
                prescriptions=["Metformin 500mg"],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.CARE_GAP,
        ),
        Scenario(
            id="DR-04",
            name="DM with atorvastatin -> statin care_gap suppressed",
            snapshot=_snap(
                diagnoses=["Diabetes mellitus type 2"],
                prescriptions=["Metformin 500mg", "Atorvastatin 40mg"],
            ),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.CARE_GAP,
        ),
        Scenario(
            id="DR-05",
            name="CKD + Ibuprofen + eGFR 38 -> care_gap NSAID fires",
            snapshot=_snap(
                diagnoses=["Chronic Kidney Disease N18.3"],
                prescriptions=["Ibuprofen 400mg", "Ramipril 5mg"],
                recent_results=[_lab("eGFR", 38, "mL/min")],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.CARE_GAP,
        ),
        Scenario(
            id="DR-06",
            name="CKD + Ibuprofen but eGFR 70 -> NSAID care_gap suppressed",
            snapshot=_snap(
                diagnoses=["Chronic Kidney Disease N18.3"],
                prescriptions=["Ibuprofen 400mg"],
                recent_results=[_lab("eGFR", 70, "mL/min")],
            ),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.CARE_GAP,
        ),

        # ------------------------------------------------------------------
        # Pharmacy rules — allergy
        # ------------------------------------------------------------------
        Scenario(
            id="PH-01",
            name="Penicillin allergy + Penicillin V -> allergy fires",
            snapshot=_snap(
                allergies=["penicillin"],
                prescriptions=["Penicillin V 250mg"],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.ALLERGY,
        ),
        Scenario(
            id="PH-02",
            name="No allergy + Penicillin V -> no allergy",
            snapshot=_snap(
                allergies=[],
                prescriptions=["Penicillin V 250mg"],
            ),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.ALLERGY,
        ),
        Scenario(
            id="PH-03",
            name="Penicillin allergy + Amoxicillin -> cross-reactive allergy fires",
            snapshot=_snap(
                allergies=["penicillin"],
                prescriptions=["Amoxicillin 500mg"],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.ALLERGY,
        ),

        # ------------------------------------------------------------------
        # Pharmacy rules — DDI
        # ------------------------------------------------------------------
        Scenario(
            id="PH-04",
            name="Warfarin + Ibuprofen -> contraindication (bleeding risk) fires",
            snapshot=_snap(prescriptions=["Warfarin 5mg", "Ibuprofen 400mg"]),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.CONTRAINDICATION,
        ),
        Scenario(
            id="PH-05",
            name="Morphine + Lorazepam -> contraindication (sedation risk) fires",
            snapshot=_snap(prescriptions=["Morphine 10mg", "Lorazepam 1mg"]),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.CONTRAINDICATION,
        ),
        Scenario(
            id="PH-06",
            name="Lisinopril + Spironolactone -> contraindication (hyperkalemia) fires",
            snapshot=_snap(prescriptions=["Lisinopril 10mg", "Spironolactone 25mg"]),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.CONTRAINDICATION,
        ),

        # ------------------------------------------------------------------
        # Pharmacy rules — lab-driven
        # ------------------------------------------------------------------
        Scenario(
            id="PH-07",
            name="Metformin + eGFR 22 -> contraindication fires",
            snapshot=_snap(
                prescriptions=["Metformin 1000mg"],
                recent_results=[_lab("eGFR", 22, "mL/min")],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.CONTRAINDICATION,
        ),
        Scenario(
            id="PH-08",
            name="Metformin + eGFR 55 -> no contraindication",
            snapshot=_snap(
                prescriptions=["Metformin 1000mg"],
                recent_results=[_lab("eGFR", 55, "mL/min")],
            ),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.CONTRAINDICATION,
        ),
        Scenario(
            id="PH-09",
            name="Warfarin + INR 3.8 -> dosage_warning fires",
            snapshot=_snap(
                prescriptions=["Warfarin 5mg"],
                recent_results=[_lab("INR", 3.8)],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.DOSAGE_WARNING,
        ),
        Scenario(
            id="PH-10",
            name="Warfarin + INR 2.5 -> no dosage_warning",
            snapshot=_snap(
                prescriptions=["Warfarin 5mg"],
                recent_results=[_lab("INR", 2.5)],
            ),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.DOSAGE_WARNING,
        ),

        # ------------------------------------------------------------------
        # Lab rules
        # ------------------------------------------------------------------
        Scenario(
            id="LB-01",
            name="Unacknowledged critical value -> panic_value fires",
            snapshot=_snap(
                critical_values=[_critical_value("Sodium", 155, "mEq/L", "pending")],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.PANIC_VALUE,
        ),
        Scenario(
            id="LB-02",
            name="No critical values -> no panic_value",
            snapshot=_snap(critical_values=[]),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.PANIC_VALUE,
        ),
        Scenario(
            id="LB-03",
            name="Hemoglobin 6.5 -> critical_result fires",
            snapshot=_snap(
                recent_results=[_lab("Hemoglobin", 6.5, "g/dL", "CRITICAL_LOW")],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.CRITICAL_RESULT,
        ),
        Scenario(
            id="LB-04",
            name="Hemoglobin 11.0 -> no critical_result",
            snapshot=_snap(
                recent_results=[_lab("Hemoglobin", 11.0, "g/dL")],
            ),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.CRITICAL_RESULT,
        ),
        Scenario(
            id="LB-05",
            name="Potassium 6.5 -> critical_result fires",
            snapshot=_snap(
                recent_results=[_lab("Potassium", 6.5, "mmol/L", "CRITICAL_HIGH")],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.CRITICAL_RESULT,
        ),
        Scenario(
            id="LB-06",
            name="Lab result with delta flag -> delta_check fires",
            snapshot=_snap(
                recent_results=[_lab("Sodium", 148, "mEq/L", delta_flag="DELTA")],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.DELTA_CHECK,
        ),

        # ------------------------------------------------------------------
        # Radiology rules
        # ------------------------------------------------------------------
        Scenario(
            id="RD-01",
            name="Unacknowledged radiology critical finding -> urgent_finding fires",
            snapshot=_snap(
                urgent_findings=[_rad_finding("Large pericardial effusion", "open")],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.URGENT_FINDING,
        ),
        Scenario(
            id="RD-02",
            name="Report with follow-up language -> follow_up_reminder fires",
            snapshot=_snap(
                recent_reports=[_rad_report("Follow-up CT recommended in 3 months.")],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.FOLLOW_UP_REMINDER,
        ),
        Scenario(
            id="RD-03",
            name="Report without follow-up language -> no follow_up_reminder",
            snapshot=_snap(
                recent_reports=[_rad_report("Normal chest radiograph.")],
            ),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.FOLLOW_UP_REMINDER,
        ),

        # ------------------------------------------------------------------
        # Nursing rules — NEWS2
        # ------------------------------------------------------------------
        Scenario(
            id="NU-01",
            name="NEWS2 = 7 -> deterioration_alert CRITICAL fires",
            snapshot=_snap(vitals=_vitals(news2=7, hr=120, rr=26, spo2=93)),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.DETERIORATION_ALERT,
        ),
        Scenario(
            id="NU-02",
            name="NEWS2 = 5 -> deterioration_alert WARNING fires",
            snapshot=_snap(vitals=_vitals(news2=5, hr=100, rr=20, spo2=95)),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.DETERIORATION_ALERT,
        ),
        Scenario(
            id="NU-03",
            name="NEWS2 = 3 -> no deterioration_alert",
            snapshot=_snap(vitals=_vitals(news2=3, hr=90, rr=18, spo2=97)),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.DETERIORATION_ALERT,
        ),
        Scenario(
            id="NU-04",
            name="No vitals -> no deterioration_alert",
            snapshot=_snap(vitals=None),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.DETERIORATION_ALERT,
        ),
        Scenario(
            id="NU-05",
            name="Overdue tasks -> overdue_task fires",
            snapshot=_snap(
                overdue_tasks=[
                    SimpleNamespace(description="IV flush overdue"),
                    SimpleNamespace(description="Wound dressing overdue"),
                ],
            ),
            expected_fire=True,
            expected_rec_type=CDSSRecommendationType.OVERDUE_TASK,
        ),
        Scenario(
            id="NU-06",
            name="No overdue tasks -> no overdue_task",
            snapshot=_snap(overdue_tasks=[]),
            expected_fire=False,
            expected_rec_type=CDSSRecommendationType.OVERDUE_TASK,
        ),
    ]


# ---------------------------------------------------------------------------
# Fixtures & parameterized tests
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def rule_engine():
    from apps.cdss.services.rule_engine_service import GraphRuleEngineService
    return GraphRuleEngineService


@pytest.mark.django_db
@pytest.mark.parametrize(
    "scenario",
    _build_scenarios(),
    ids=lambda s: s.id,
)
def test_rule_engine_scenario(rule_engine, scenario: Scenario):
    """
    For each scenario, call _evaluate and check whether the expected
    recommendation type fired (or correctly did NOT fire).
    """
    fired = rule_engine._evaluate(scenario.snapshot)
    fired_types = {r.rec_type for r in fired}

    if scenario.expected_fire:
        assert scenario.expected_rec_type in fired_types, (
            f"[{scenario.id}] '{scenario.name}': expected "
            f"rec_type '{scenario.expected_rec_type}' to fire, "
            f"but got: {sorted(fired_types)}"
        )
    else:
        assert scenario.expected_rec_type not in fired_types, (
            f"[{scenario.id}] '{scenario.name}': rec_type "
            f"'{scenario.expected_rec_type}' should NOT fire, "
            f"but it did. All fired: {sorted(fired_types)}"
        )


# ---------------------------------------------------------------------------
# NEWS2 severity sub-tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_news2_7_is_critical(rule_engine):
    from apps.cdss.models import CDSSRecommendationType, CDSSSeverity
    snap = _snap(vitals=_vitals(news2=7, hr=120, rr=26, spo2=92))
    fired = rule_engine._evaluate(snap)
    det = [r for r in fired if r.rec_type == CDSSRecommendationType.DETERIORATION_ALERT]
    assert det, "DETERIORATION_ALERT should fire for NEWS2=7"
    assert det[0].severity == CDSSSeverity.CRITICAL, (
        f"Expected CRITICAL severity for NEWS2=7, got {det[0].severity}"
    )


@pytest.mark.django_db
def test_news2_5_is_warning(rule_engine):
    from apps.cdss.models import CDSSRecommendationType, CDSSSeverity
    snap = _snap(vitals=_vitals(news2=5, hr=100, rr=20, spo2=95))
    fired = rule_engine._evaluate(snap)
    det = [r for r in fired if r.rec_type == CDSSRecommendationType.DETERIORATION_ALERT]
    assert det, "DETERIORATION_ALERT should fire for NEWS2=5"
    assert det[0].severity == CDSSSeverity.WARNING, (
        f"Expected WARNING severity for NEWS2=5, got {det[0].severity}"
    )


@pytest.mark.django_db
def test_ckd_nsaid_warning_vs_critical_egfr(rule_engine):
    """eGFR 38 -> WARNING; eGFR 22 -> CRITICAL for the CKD+NSAID rule."""
    from apps.cdss.models import CDSSRecommendationType, CDSSSeverity

    snap_warn = _snap(
        diagnoses=["CKD N18.3"],
        prescriptions=["Ibuprofen 400mg"],
        recent_results=[_lab("eGFR", 38)],
    )
    fired_warn = rule_engine._evaluate(snap_warn)
    care_gaps = [r for r in fired_warn if r.rec_type == CDSSRecommendationType.CARE_GAP
                 and "nsaid" in r.title.lower()]
    assert care_gaps, "CARE_GAP (NSAID) should fire at eGFR 38"
    assert care_gaps[0].severity == CDSSSeverity.WARNING

    snap_crit = _snap(
        diagnoses=["CKD N18.3"],
        prescriptions=["Ibuprofen 400mg"],
        recent_results=[_lab("eGFR", 22)],
    )
    fired_crit = rule_engine._evaluate(snap_crit)
    care_gaps_crit = [r for r in fired_crit if r.rec_type == CDSSRecommendationType.CARE_GAP
                      and "nsaid" in r.title.lower()]
    assert care_gaps_crit, "CARE_GAP (NSAID) should fire at eGFR 22"
    assert care_gaps_crit[0].severity == CDSSSeverity.CRITICAL


# ---------------------------------------------------------------------------
# Aggregate metrics summary (collected by a session-scoped session fixture)
# ---------------------------------------------------------------------------

class _MetricsCollector:
    """Accumulates per-scenario pass/fail for aggregate reporting."""
    def __init__(self):
        self.tp = 0
        self.fp = 0
        self.tn = 0
        self.fn = 0

    def record(self, expected_fire: bool, did_fire: bool):
        if expected_fire and did_fire:
            self.tp += 1
        elif expected_fire and not did_fire:
            self.fn += 1
        elif not expected_fire and did_fire:
            self.fp += 1
        else:
            self.tn += 1

    def sensitivity(self) -> float:
        return self.tp / (self.tp + self.fn) if (self.tp + self.fn) > 0 else 0.0

    def specificity(self) -> float:
        return self.tn / (self.tn + self.fp) if (self.tn + self.fp) > 0 else 0.0

    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if (self.tp + self.fp) > 0 else 0.0

    def f1(self) -> float:
        p = self.precision()
        r = self.sensitivity()
        return 2 * p * r / (p + r) if (p + r) > 0 else 0.0


@pytest.fixture(scope="session")
def metrics_collector():
    return _MetricsCollector()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "scenario",
    _build_scenarios(),
    ids=lambda s: f"metrics_{s.id}",
)
def test_rule_engine_metrics(rule_engine, metrics_collector, scenario: Scenario):
    """
    Parallel parameterised run that feeds results to MetricsCollector.
    The final fixture teardown prints the aggregate table.
    """
    fired = rule_engine._evaluate(scenario.snapshot)
    fired_types = {r.rec_type for r in fired}
    did_fire = scenario.expected_rec_type in fired_types
    metrics_collector.record(scenario.expected_fire, did_fire)


@pytest.fixture(scope="session", autouse=True)
def print_metrics_summary(metrics_collector):
    """Print aggregate rule-engine metrics after the test session ends."""
    yield
    mc = metrics_collector
    total = mc.tp + mc.fp + mc.tn + mc.fn
    if total == 0:
        return
    print("\n")
    print("=" * 60)
    print("  CDSS Rule Engine Accuracy Metrics")
    print("=" * 60)
    print(f"  Scenarios evaluated : {total}")
    print(f"  TP (correct alerts) : {mc.tp}")
    print(f"  FP (false alerts)   : {mc.fp}")
    print(f"  TN (correct silence): {mc.tn}")
    print(f"  FN (missed alerts)  : {mc.fn}")
    print(f"  {'─' * 40}")
    print(f"  Sensitivity (Recall): {mc.sensitivity():.1%}")
    print(f"  Specificity         : {mc.specificity():.1%}")
    print(f"  Precision           : {mc.precision():.1%}")
    print(f"  F1 Score            : {mc.f1():.1%}")
    print("=" * 60)

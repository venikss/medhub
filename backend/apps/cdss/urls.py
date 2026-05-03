"""
CDSS URL configuration.
Fixed: added /respond/, /expire/, /stats/ endpoints.
Kept /acknowledge/ and /override/ as backward-compatible aliases.
"""

from django.urls import path
from .views import (
    CDSSConsultRequestDetailView,
    CDSSConsultRequestListView,
    CDSSRecommendationListView,
    CDSSRecommendationDetailView,
    CDSSRespondView,
    CDSSExpireView,
    CDSSFeedbackView,
    CDSSOverrideListView,
    CDSSPatientSummaryView,
    CDSSStatsView,
    HospitalKnowledgeGraphView,
    HospitalCDSSKnowledgeSummaryView,
    PatientModuleGraphSummaryView,
    PatientKnowledgeGraphView,
    CDSSAIConsultView,
    CDSSRuleRefreshView,
    CDSSPatientReportView,
    CDSSChatView,
    CDSSEncounterSuggestView,
    CDSSAcceptAIDiagnosisView,
    PharmacyRxAISuggestView,
    LabResultAISuggestView,
)

urlpatterns = [
    # Stats — must come before parameterised routes
    path("stats", CDSSStatsView.as_view(), name="cdss-stats-noslash"),
    path("stats/", CDSSStatsView.as_view(), name="cdss-stats"),

    # Recommendations CRUD
    path("recommendations", CDSSRecommendationListView.as_view(), name="cdss-list-noslash"),
    path("recommendations/", CDSSRecommendationListView.as_view(), name="cdss-list"),
    path("recommendations/<uuid:pk>", CDSSRecommendationDetailView.as_view(), name="cdss-detail-noslash"),
    path("recommendations/<uuid:pk>/", CDSSRecommendationDetailView.as_view(), name="cdss-detail"),

    # Doctor-requested support / consults
    path("requests", CDSSConsultRequestListView.as_view(), name="cdss-request-list-noslash"),
    path("requests/", CDSSConsultRequestListView.as_view(), name="cdss-request-list"),
    path("requests/<uuid:pk>", CDSSConsultRequestDetailView.as_view(), name="cdss-request-detail-noslash"),
    path("requests/<uuid:pk>/", CDSSConsultRequestDetailView.as_view(), name="cdss-request-detail"),

    # Unified respond (spec: POST /recommendations/:id/respond)
    path("recommendations/<uuid:pk>/respond", CDSSRespondView.as_view(), name="cdss-respond-noslash"),
    path("recommendations/<uuid:pk>/respond/", CDSSRespondView.as_view(), name="cdss-respond"),

    # Expire
    path("recommendations/<uuid:pk>/expire", CDSSExpireView.as_view(), name="cdss-expire-noslash"),
    path("recommendations/<uuid:pk>/expire/", CDSSExpireView.as_view(), name="cdss-expire"),

    # Feedback
    path("recommendations/<uuid:pk>/feedback", CDSSFeedbackView.as_view(), name="cdss-feedback-noslash"),
    path("recommendations/<uuid:pk>/feedback/", CDSSFeedbackView.as_view(), name="cdss-feedback"),

    # Override history (admin)
    path("overrides", CDSSOverrideListView.as_view(), name="cdss-overrides-noslash"),
    path("overrides/", CDSSOverrideListView.as_view(), name="cdss-overrides"),

    # Patient alert summary
    path("patients/<uuid:patient_pk>/summary", CDSSPatientSummaryView.as_view(), name="cdss-patient-summary-noslash"),
    path("patients/<uuid:patient_pk>/summary/", CDSSPatientSummaryView.as_view(), name="cdss-patient-summary"),
    path("patients/<uuid:patient_pk>/graph-summary", PatientModuleGraphSummaryView.as_view(), name="cdss-patient-graph-summary-noslash"),
    path("patients/<uuid:patient_pk>/graph-summary/", PatientModuleGraphSummaryView.as_view(), name="cdss-patient-graph-summary"),

    # Knowledge Graph Data
    path("graph/hospital", HospitalKnowledgeGraphView.as_view(), name="cdss-hospital-graph-noslash"),
    path("graph/hospital/", HospitalKnowledgeGraphView.as_view(), name="cdss-hospital-graph"),
    path("graph/hospital/summary", HospitalCDSSKnowledgeSummaryView.as_view(), name="cdss-hospital-graph-summary-noslash"),
    path("graph/hospital/summary/", HospitalCDSSKnowledgeSummaryView.as_view(), name="cdss-hospital-graph-summary"),
    path("patients/<uuid:patient_pk>/graph", PatientKnowledgeGraphView.as_view(), name="cdss-patient-graph-noslash"),
    path("patients/<uuid:patient_pk>/graph/", PatientKnowledgeGraphView.as_view(), name="cdss-patient-graph"),
    
    # GraphRAG AI Consult
    path("patients/<uuid:patient_pk>/ai_consult", CDSSAIConsultView.as_view(), name="cdss-ai-consult-noslash"),
    path("patients/<uuid:patient_pk>/ai_consult/", CDSSAIConsultView.as_view(), name="cdss-ai-consult"),

    # Graph-backed rule engine refresh
    path("patients/<uuid:patient_pk>/run_rules", CDSSRuleRefreshView.as_view(), name="cdss-run-rules-noslash"),
    path("patients/<uuid:patient_pk>/run_rules/", CDSSRuleRefreshView.as_view(), name="cdss-run-rules"),

    # NLP patient report
    path("patients/<uuid:patient_pk>/report", CDSSPatientReportView.as_view(), name="cdss-patient-report-noslash"),
    path("patients/<uuid:patient_pk>/report/", CDSSPatientReportView.as_view(), name="cdss-patient-report"),

    # Multi-turn chat
    path("patients/<uuid:patient_pk>/chat", CDSSChatView.as_view(), name="cdss-chat-noslash"),
    path("patients/<uuid:patient_pk>/chat/", CDSSChatView.as_view(), name="cdss-chat"),

    # Encounter AI suggest (differential diagnosis + assessment + plan)
    path("encounters/<uuid:encounter_pk>/suggest", CDSSEncounterSuggestView.as_view(), name="cdss-encounter-suggest-noslash"),
    path("encounters/<uuid:encounter_pk>/suggest/", CDSSEncounterSuggestView.as_view(), name="cdss-encounter-suggest"),

    # Accept AI diagnosis suggestion → creates Diagnosis + syncs to ontology catalog
    path("encounters/<uuid:encounter_pk>/accept_diagnosis", CDSSAcceptAIDiagnosisView.as_view(), name="cdss-accept-diagnosis-noslash"),
    path("encounters/<uuid:encounter_pk>/accept_diagnosis/", CDSSAcceptAIDiagnosisView.as_view(), name="cdss-accept-diagnosis"),

    # Pharmacy Rx AI verification suggest
    path("prescriptions/<uuid:prescription_pk>/ai_suggest", PharmacyRxAISuggestView.as_view(), name="cdss-rx-ai-suggest-noslash"),
    path("prescriptions/<uuid:prescription_pk>/ai_suggest/", PharmacyRxAISuggestView.as_view(), name="cdss-rx-ai-suggest"),

    # Lab Result AI interpretation suggest
    path("lab-panels/<uuid:panel_pk>/ai_suggest", LabResultAISuggestView.as_view(), name="cdss-lab-ai-suggest-noslash"),
    path("lab-panels/<uuid:panel_pk>/ai_suggest/", LabResultAISuggestView.as_view(), name="cdss-lab-ai-suggest"),
]

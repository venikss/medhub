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
    CDSSChatStreamView,
    CDSSEncounterSuggestView,
    CDSSAcceptAIDiagnosisView,
    PharmacyRxAISuggestView,
    LabResultAISuggestView,
    RadiologyAppropriatenessView,
    RadiologyReportAIAssistView,
)

urlpatterns = [
    path("stats", CDSSStatsView.as_view(), name="cdss-stats-noslash"),
    path("stats/", CDSSStatsView.as_view(), name="cdss-stats"),

    path("recommendations", CDSSRecommendationListView.as_view(), name="cdss-list-noslash"),
    path("recommendations/", CDSSRecommendationListView.as_view(), name="cdss-list"),
    path("recommendations/<uuid:pk>", CDSSRecommendationDetailView.as_view(), name="cdss-detail-noslash"),
    path("recommendations/<uuid:pk>/", CDSSRecommendationDetailView.as_view(), name="cdss-detail"),

    path("requests", CDSSConsultRequestListView.as_view(), name="cdss-request-list-noslash"),
    path("requests/", CDSSConsultRequestListView.as_view(), name="cdss-request-list"),
    path("requests/<uuid:pk>", CDSSConsultRequestDetailView.as_view(), name="cdss-request-detail-noslash"),
    path("requests/<uuid:pk>/", CDSSConsultRequestDetailView.as_view(), name="cdss-request-detail"),

    path("recommendations/<uuid:pk>/respond", CDSSRespondView.as_view(), name="cdss-respond-noslash"),
    path("recommendations/<uuid:pk>/respond/", CDSSRespondView.as_view(), name="cdss-respond"),

    path("recommendations/<uuid:pk>/expire", CDSSExpireView.as_view(), name="cdss-expire-noslash"),
    path("recommendations/<uuid:pk>/expire/", CDSSExpireView.as_view(), name="cdss-expire"),

    path("recommendations/<uuid:pk>/feedback", CDSSFeedbackView.as_view(), name="cdss-feedback-noslash"),
    path("recommendations/<uuid:pk>/feedback/", CDSSFeedbackView.as_view(), name="cdss-feedback"),

    path("overrides", CDSSOverrideListView.as_view(), name="cdss-overrides-noslash"),
    path("overrides/", CDSSOverrideListView.as_view(), name="cdss-overrides"),

    path("patients/<uuid:patient_pk>/summary", CDSSPatientSummaryView.as_view(), name="cdss-patient-summary-noslash"),
    path("patients/<uuid:patient_pk>/summary/", CDSSPatientSummaryView.as_view(), name="cdss-patient-summary"),
    path("patients/<uuid:patient_pk>/graph-summary", PatientModuleGraphSummaryView.as_view(), name="cdss-patient-graph-summary-noslash"),
    path("patients/<uuid:patient_pk>/graph-summary/", PatientModuleGraphSummaryView.as_view(), name="cdss-patient-graph-summary"),

    path("graph/hospital", HospitalKnowledgeGraphView.as_view(), name="cdss-hospital-graph-noslash"),
    path("graph/hospital/", HospitalKnowledgeGraphView.as_view(), name="cdss-hospital-graph"),
    path("graph/hospital/summary", HospitalCDSSKnowledgeSummaryView.as_view(), name="cdss-hospital-graph-summary-noslash"),
    path("graph/hospital/summary/", HospitalCDSSKnowledgeSummaryView.as_view(), name="cdss-hospital-graph-summary"),
    path("patients/<uuid:patient_pk>/graph", PatientKnowledgeGraphView.as_view(), name="cdss-patient-graph-noslash"),
    path("patients/<uuid:patient_pk>/graph/", PatientKnowledgeGraphView.as_view(), name="cdss-patient-graph"),
    
    path("patients/<uuid:patient_pk>/ai_consult", CDSSAIConsultView.as_view(), name="cdss-ai-consult-noslash"),
    path("patients/<uuid:patient_pk>/ai_consult/", CDSSAIConsultView.as_view(), name="cdss-ai-consult"),

    path("patients/<uuid:patient_pk>/run_rules", CDSSRuleRefreshView.as_view(), name="cdss-run-rules-noslash"),
    path("patients/<uuid:patient_pk>/run_rules/", CDSSRuleRefreshView.as_view(), name="cdss-run-rules"),

    path("patients/<uuid:patient_pk>/report", CDSSPatientReportView.as_view(), name="cdss-patient-report-noslash"),
    path("patients/<uuid:patient_pk>/report/", CDSSPatientReportView.as_view(), name="cdss-patient-report"),

    path("patients/<uuid:patient_pk>/chat", CDSSChatView.as_view(), name="cdss-chat-noslash"),
    path("patients/<uuid:patient_pk>/chat/", CDSSChatView.as_view(), name="cdss-chat"),
    path("patients/<uuid:patient_pk>/chat/stream", CDSSChatStreamView.as_view(), name="cdss-chat-stream-noslash"),
    path("patients/<uuid:patient_pk>/chat/stream/", CDSSChatStreamView.as_view(), name="cdss-chat-stream"),

    path("encounters/<uuid:encounter_pk>/suggest", CDSSEncounterSuggestView.as_view(), name="cdss-encounter-suggest-noslash"),
    path("encounters/<uuid:encounter_pk>/suggest/", CDSSEncounterSuggestView.as_view(), name="cdss-encounter-suggest"),

    path("encounters/<uuid:encounter_pk>/accept_diagnosis", CDSSAcceptAIDiagnosisView.as_view(), name="cdss-accept-diagnosis-noslash"),
    path("encounters/<uuid:encounter_pk>/accept_diagnosis/", CDSSAcceptAIDiagnosisView.as_view(), name="cdss-accept-diagnosis"),

    path("prescriptions/<uuid:prescription_pk>/ai_suggest", PharmacyRxAISuggestView.as_view(), name="cdss-rx-ai-suggest-noslash"),
    path("prescriptions/<uuid:prescription_pk>/ai_suggest/", PharmacyRxAISuggestView.as_view(), name="cdss-rx-ai-suggest"),

    path("lab-panels/<uuid:panel_pk>/ai_suggest", LabResultAISuggestView.as_view(), name="cdss-lab-ai-suggest-noslash"),
    path("lab-panels/<uuid:panel_pk>/ai_suggest/", LabResultAISuggestView.as_view(), name="cdss-lab-ai-suggest"),

    path("imaging-orders/<uuid:order_pk>/appropriateness", RadiologyAppropriatenessView.as_view(), name="cdss-rad-appropriateness-noslash"),
    path("imaging-orders/<uuid:order_pk>/appropriateness/", RadiologyAppropriatenessView.as_view(), name="cdss-rad-appropriateness"),

    path("radiology-reports/<uuid:report_pk>/ai_assist", RadiologyReportAIAssistView.as_view(), name="cdss-rad-report-ai-assist-noslash"),
    path("radiology-reports/<uuid:report_pk>/ai_assist/", RadiologyReportAIAssistView.as_view(), name="cdss-rad-report-ai-assist"),
]

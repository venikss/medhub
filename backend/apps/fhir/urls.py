from django.urls import path
from .views import (
    FhirCapabilityStatementView,
    FhirPatientView,
    FhirPatientEverythingView,
    FhirConditionView,
    FhirMedicationRequestView,
    FhirObservationView,
    FhirDiagnosticReportView,
    FhirImagingStudyView,
)

urlpatterns = [
    path("metadata", FhirCapabilityStatementView.as_view(), name="fhir-metadata"),

    path("Patient/<uuid:pk>/", FhirPatientView.as_view(), name="fhir-patient"),
    path("Patient/<uuid:pk>/$everything", FhirPatientEverythingView.as_view(), name="fhir-patient-everything"),

    path("Condition/<uuid:pk>/", FhirConditionView.as_view(), name="fhir-condition"),
    path("MedicationRequest/<uuid:pk>/", FhirMedicationRequestView.as_view(), name="fhir-medication-request"),
    path("Observation/<uuid:pk>/", FhirObservationView.as_view(), name="fhir-observation"),
    path("DiagnosticReport/<uuid:pk>/", FhirDiagnosticReportView.as_view(), name="fhir-diagnostic-report"),
    path("ImagingStudy/<uuid:pk>/", FhirImagingStudyView.as_view(), name="fhir-imaging-study"),
]

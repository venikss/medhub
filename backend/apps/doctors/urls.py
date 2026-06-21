"""
Doctors module URL routing — fixed paths and added missing endpoints.
"""

from django.urls import path
from . import views

urlpatterns = [
    path("patients/<uuid:patient_id>/chart/", views.DoctorPatientChartView.as_view(), name="doctor-patient-chart"),

    path("encounters/", views.EncounterListCreateView.as_view(), name="encounter-list-create"),
    path("encounters/<uuid:pk>/", views.EncounterDetailView.as_view(), name="encounter-detail"),
    path("encounters/<uuid:pk>/sign/", views.EncounterSignView.as_view(), name="encounter-sign"),
    path("encounters/<uuid:pk>/amend/", views.EncounterAmendView.as_view(), name="encounter-amend"),

    path("diagnoses/", views.DiagnosisListCreateView.as_view(), name="diagnosis-list-create"),
    path("diagnoses/<uuid:pk>/", views.DiagnosisDetailView.as_view(), name="diagnosis-detail"),
    path("diagnoses/<uuid:pk>/status/", views.DiagnosisStatusView.as_view(), name="diagnosis-status"),
    path("icd10/search/", views.ICD10SearchView.as_view(), name="icd10-search"),
    path("diagnosis-catalog/search/", views.DiagnosisCatalogSearchView.as_view(), name="diagnosis-catalog-search"),

    path("orders/", views.OrderListCreateView.as_view(), name="order-list-create"),
    path("orders/<uuid:pk>/", views.OrderDetailView.as_view(), name="order-detail"),

    path("prescriptions/", views.PrescriptionListCreateView.as_view(), name="prescription-list-create"),
    path("prescriptions/<uuid:pk>/", views.PrescriptionDetailView.as_view(), name="prescription-detail"),
    path("prescriptions/<uuid:pk>/status/", views.PrescriptionStatusView.as_view(), name="prescription-status"),

    path("referrals/", views.ReferralListCreateView.as_view(), name="referral-list-create"),
    path("referrals/<uuid:pk>/", views.ReferralDetailView.as_view(), name="referral-detail"),
    path("referrals/<uuid:pk>/status/", views.ReferralStatusView.as_view(), name="referral-status"),

    path("<uuid:pk>/results/", views.DoctorResultsInboxView.as_view(), name="doctor-results"),

    path("results/<uuid:pk>/review/", views.ResultReviewView.as_view(), name="result-review"),
]

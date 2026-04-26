"""
Patients module URL routing.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Patient CRUD
    path("", views.PatientListCreateView.as_view(), name="patient-list-create"),
    path("/", views.PatientListCreateView.as_view(), name="patient-list-create-slash"),
    path("search", views.PatientSearchView.as_view(), name="patient-search"),
    path("search/", views.PatientSearchView.as_view(), name="patient-search-slash"),
    path("merge", views.PatientMergeView.as_view(), name="patient-merge"),
    path("merge/", views.PatientMergeView.as_view(), name="patient-merge-slash"),
    path("<uuid:pk>", views.PatientDetailView.as_view(), name="patient-detail"),
    path("<uuid:pk>/", views.PatientDetailView.as_view(), name="patient-detail-slash"),
    path("<uuid:pk>/duplicates", views.PatientDuplicatesView.as_view(), name="patient-duplicates"),
    path("<uuid:pk>/duplicates/", views.PatientDuplicatesView.as_view(), name="patient-duplicates-slash"),
    path("<uuid:pk>/avatar", views.PatientAvatarView.as_view(), name="patient-avatar"),
    path("<uuid:pk>/avatar/", views.PatientAvatarView.as_view(), name="patient-avatar-slash"),
    path("<uuid:pk>/insurance/card", views.PatientInsuranceCardView.as_view(), name="patient-insurance-card"),
    path("<uuid:pk>/insurance/card/", views.PatientInsuranceCardView.as_view(), name="patient-insurance-card-slash"),

    # Consents
    path("<uuid:patient_pk>/consents/", views.ConsentListCreateView.as_view(), name="consent-list-create"),
    path("<uuid:patient_pk>/consents/<uuid:consent_pk>/sign/", views.ConsentSignView.as_view(), name="consent-sign"),
    path("<uuid:patient_pk>/consents/<uuid:consent_pk>/upload/", views.ConsentFileUploadView.as_view(), name="consent-upload"),

    # Admissions
    path("admissions", views.AdmissionListCreateView.as_view(), name="admission-list-create"),
    path("admissions/", views.AdmissionListCreateView.as_view(), name="admission-list-create-slash"),
    path("admissions/<uuid:pk>", views.AdmissionDetailView.as_view(), name="admission-detail"),
    path("admissions/<uuid:pk>/", views.AdmissionDetailView.as_view(), name="admission-detail-slash"),
    path("admissions/<uuid:pk>/status", views.AdmissionStatusView.as_view(), name="admission-status"),
    path("admissions/<uuid:pk>/status/", views.AdmissionStatusView.as_view(), name="admission-status-slash"),
    path("admissions/<uuid:pk>/discharge", views.AdmissionDischargeView.as_view(), name="admission-discharge"),
    path("admissions/<uuid:pk>/discharge/", views.AdmissionDischargeView.as_view(), name="admission-discharge-slash"),
    path("admissions/<uuid:pk>/transfer", views.AdmissionTransferView.as_view(), name="admission-transfer"),
    path("admissions/<uuid:pk>/transfer/", views.AdmissionTransferView.as_view(), name="admission-transfer-slash"),
    
    path("frontdesk/summary", views.FrontDeskSummaryView.as_view(), name="frontdesk-summary"),
    path("frontdesk/summary/", views.FrontDeskSummaryView.as_view(), name="frontdesk-summary-slash"),
    path("frontdesk/admission-lookups", views.FrontDeskAdmissionLookupsView.as_view(), name="frontdesk-admission-lookups"),
    path("frontdesk/admission-lookups/", views.FrontDeskAdmissionLookupsView.as_view(), name="frontdesk-admission-lookups-slash"),
    path("frontdesk/checkin", views.FrontDeskCheckInView.as_view(), name="frontdesk-checkin"),
    path("frontdesk/checkin/", views.FrontDeskCheckInView.as_view(), name="frontdesk-checkin-slash"),
    path("frontdesk/patients/<uuid:pk>/summary", views.FrontDeskPatientSummaryView.as_view(), name="frontdesk-patient-summary"),
    path("frontdesk/patients/<uuid:pk>/summary/", views.FrontDeskPatientSummaryView.as_view(), name="frontdesk-patient-summary-slash"),

    # Beds & Wards
    path("wards", views.WardListView.as_view(), name="ward-list"),
    path("wards/", views.WardListView.as_view(), name="ward-list-slash"),
    path("beds", views.BedListView.as_view(), name="bed-list"),
    path("beds/", views.BedListView.as_view(), name="bed-list-slash"),
    path("beds/<uuid:pk>", views.BedDetailView.as_view(), name="bed-detail"),
    path("beds/<uuid:pk>/", views.BedDetailView.as_view(), name="bed-detail-slash"),
    path("beds/<uuid:pk>/status", views.BedStatusView.as_view(), name="bed-status"),
    path("beds/<uuid:pk>/status/", views.BedStatusView.as_view(), name="bed-status-slash"),

    # Queue
    path("queue/", views.QueueListCreateView.as_view(), name="queue-list-create"),
    path("queue/stats/", views.QueueStatsView.as_view(), name="queue-stats"),
    path("queue/<uuid:pk>/status/", views.QueueStatusView.as_view(), name="queue-status"),  # FIXED: added
    path("queue/<uuid:pk>/call/", views.QueueCallView.as_view(), name="queue-call"),

    # Appointments
    path("appointments/", views.AppointmentListCreateView.as_view(), name="appointment-list-create"),
    path("appointments/<uuid:pk>/", views.AppointmentDetailView.as_view(), name="appointment-detail"),
    path("appointments/<uuid:pk>/status/", views.AppointmentStatusView.as_view(), name="appointment-status"),  # FIXED: added
]

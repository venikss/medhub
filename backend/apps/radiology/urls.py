"""
Radiology module URL routing — fixed paths and added missing endpoints.
"""

from django.urls import path
from . import views

urlpatterns = [
    path("stats/", views.RadiologyStatsView.as_view(), name="radiology-stats"),
    path("dashboard/", views.RadiologyDashboardView.as_view(), name="radiology-dashboard"),
    path("orders/", views.ImagingOrderListCreateView.as_view(), name="imaging-order-list-create"),
    path("orders/<uuid:pk>/", views.ImagingOrderDetailView.as_view(), name="imaging-order-detail"),
    path("orders/<uuid:pk>/cancel/", views.ImagingOrderCancelView.as_view(), name="imaging-order-cancel"),
    path("orders/<uuid:pk>/protocol/", views.ImagingOrderProtocolView.as_view(), name="imaging-order-protocol"),
    path("orders/<uuid:pk>/schedule/", views.ImagingOrderScheduleView.as_view(), name="imaging-order-schedule"),
    path("orders/<uuid:pk>/assign/", views.ImagingOrderAssignView.as_view(), name="imaging-order-assign"),

    path("studies/", views.ImagingStudyListCreateView.as_view(), name="imaging-study-list-create"),
    path("studies/<uuid:pk>/", views.ImagingStudyDetailView.as_view(), name="imaging-study-detail"),
    path("studies/<uuid:pk>/status/", views.ImagingStudyStatusView.as_view(), name="imaging-study-status"),
    path("studies/<uuid:pk>/priors/", views.ImagingStudyPriorsView.as_view(), name="imaging-study-priors"),
    path("studies/<uuid:pk>/images/", views.ImagingStudyImageUploadView.as_view(), name="imaging-study-images"),

    path("reports/", views.RadiologyReportListCreateView.as_view(), name="radiology-report-list-create"),
    path("reports/<uuid:pk>/", views.RadiologyReportDetailView.as_view(), name="radiology-report-detail"),
    path("reports/<uuid:pk>/sign/", views.RadiologyReportSignView.as_view(), name="radiology-report-sign"),
    path("reports/<uuid:pk>/addendum/", views.RadiologyReportAddendumView.as_view(), name="radiology-report-addendum"),

    path("critical/", views.RadCriticalFindingListView.as_view(), name="rad-critical-finding-list"),
    path("critical/create/", views.RadCriticalFindingCreateView.as_view(), name="rad-critical-finding-create"),
    path("critical/<uuid:pk>/notify/", views.RadCriticalFindingNotifyView.as_view(), name="rad-critical-notify"),
    path("critical/<uuid:pk>/acknowledge/", views.RadCriticalFindingAcknowledgeView.as_view(), name="rad-critical-acknowledge"),

    path("schedules/", views.ModalityScheduleListCreateView.as_view(), name="modality-schedule-list-create"),
    path("schedules/<uuid:pk>/", views.ModalityScheduleDetailView.as_view(), name="modality-schedule-detail"),
    path("studies/<uuid:pk>/dicom-file/", views.DicomServeView.as_view(), name="study-dicom-serve"),
    path("studies/<uuid:pk>/dicom-analyze/", views.DicomAnalyzeView.as_view(), name="study-dicom-analyze"),
    path("studies/<uuid:pk>/series/", views.DicomSeriesListView.as_view(), name="study-dicom-series"),
]

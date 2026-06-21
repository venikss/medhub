"""
Laboratory module URL routing.

Fixed:
  - CriticalValueAcknowledgeView now uses PUT (was POST)
  - Both notify and acknowledge now share the `critical/` prefix (was `critical-values/`)
  - acknowledge lookup is by result_id (consistent with notify) not pk
  - Added GET /lab/results/:id (LabResultDetailView)
"""

from django.urls import path
from . import views

urlpatterns = [
    path("worklist/", views.LabWorklistView.as_view(), name="lab-worklist"),

    path("specimens/", views.SpecimenListCreateView.as_view(), name="specimen-list-create"),
    path("recollections/", views.RecollectionRequestListView.as_view(), name="recollection-list"),
    path("specimens/recollect/", views.SpecimenRecollectView.as_view(), name="specimen-recollect"),
    path("specimens/<uuid:pk>/", views.SpecimenDetailView.as_view(), name="specimen-detail"),
    path("specimens/<uuid:pk>/receive/", views.SpecimenReceiveView.as_view(), name="specimen-receive"),
    path("specimens/<uuid:pk>/reject/", views.SpecimenRejectView.as_view(), name="specimen-reject"),

    path("accessions/", views.AccessionListCreateView.as_view(), name="accession-list-create"),
    path("accessions/<uuid:pk>/", views.AccessionDetailView.as_view(), name="accession-detail"),

    path("analyzers/queue/", views.AnalyzerQueueListView.as_view(), name="analyzer-queue-list"),
    path("analyzers/queue/<uuid:pk>/status/", views.AnalyzerQueueStatusView.as_view(), name="analyzer-queue-status"),

    path("panels/", views.LabPanelListCreateView.as_view(), name="lab-panel-list-create"),
    path("panels/<uuid:pk>/", views.LabPanelDetailView.as_view(), name="lab-panel-detail"),
    path("panels/<uuid:pk>/results/", views.LabPanelResultsView.as_view(), name="lab-panel-results"),
    path("panels/<uuid:pk>/verify/", views.LabPanelVerifyView.as_view(), name="lab-panel-verify"),

    path("results/", views.LabResultListCreateView.as_view(), name="lab-result-list-create"),
    path("results/<uuid:pk>/", views.LabResultDetailView.as_view(), name="lab-result-detail"),
    path("results/<uuid:pk>/verify/", views.LabResultVerifyView.as_view(), name="lab-result-verify"),

    path("reports/", views.LabReportListView.as_view(), name="lab-report-list"),
    path("reports/<uuid:pk>/", views.LabReportDetailView.as_view(), name="lab-report-detail"),
    path("reports/<uuid:pk>/release/", views.LabReportReleaseView.as_view(), name="lab-report-release"),
    path("reports/<uuid:pk>/correct/", views.LabReportCorrectView.as_view(), name="lab-report-correct"),
    path("reports/<uuid:pk>/attachment/", views.LabReportAttachmentView.as_view(), name="lab-report-attachment"),

    path("critical/", views.CriticalValueListView.as_view(), name="critical-value-list-alias"),
    path("critical-values/", views.CriticalValueListView.as_view(), name="critical-value-list"),
    path("critical/<uuid:result_id>/notify/", views.CriticalValueNotifyView.as_view(), name="critical-value-notify"),
    path("critical/<uuid:result_id>/acknowledge/", views.CriticalValueAcknowledgeView.as_view(), name="critical-value-acknowledge"),
]

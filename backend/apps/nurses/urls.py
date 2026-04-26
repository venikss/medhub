"""
Nurses module URL routing — fixed paths and added missing endpoints.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Vitals
    path("vitals/", views.VitalsListCreateView.as_view(), name="vitals-list-create"),
    path("vitals/<uuid:pk>/", views.VitalsDetailView.as_view(), name="vitals-detail"),
    # FIX: GET /patients/:id/vitals/latest
    path("patients/<uuid:patient_id>/vitals/latest/", views.VitalsLatestView.as_view(), name="vitals-latest"),

    # Intake/Output — FIX: added DELETE /io/:id
    path("io/", views.IntakeOutputListCreateView.as_view(), name="io-list-create"),
    path("io/<uuid:pk>/", views.IntakeOutputDetailView.as_view(), name="io-detail"),

    # Pain
    path("pain/", views.PainAssessmentListCreateView.as_view(), name="pain-list-create"),

    # MAR — FIX: replaced hold-only with generic status endpoint, kept administer
    path("mar/", views.MARListView.as_view(), name="mar-list"),
    path("mar/<uuid:pk>/administer/", views.MARAdministerView.as_view(), name="mar-administer"),
    path("mar/<uuid:pk>/status/", views.MARStatusView.as_view(), name="mar-status"),

    # Nursing Notes
    path("notes/", views.NursingNoteListCreateView.as_view(), name="nursing-note-list-create"),
    path("notes/<uuid:pk>/", views.NursingNoteDetailView.as_view(), name="nursing-note-detail"),

    # Tasks — FIX: added dedicated /complete/ endpoint
    path("tasks/", views.TaskListCreateView.as_view(), name="task-list-create"),
    path("tasks/<uuid:pk>/", views.TaskDetailView.as_view(), name="task-detail"),
    path("tasks/<uuid:pk>/complete/", views.TaskCompleteView.as_view(), name="task-complete"),

    # Wounds
    path("wounds/", views.WoundListCreateView.as_view(), name="wound-list-create"),
    path("wounds/<uuid:pk>/", views.WoundDetailView.as_view(), name="wound-detail"),
    path("wounds/<uuid:pk>/photo/", views.WoundPhotoView.as_view(), name="wound-photo"),

    # Handoffs
    path("handoffs/", views.HandoffListCreateView.as_view(), name="handoff-list-create"),
    path("handoffs/<uuid:pk>/acknowledge/", views.HandoffAcknowledgeView.as_view(), name="handoff-acknowledge"),

    # Discharge Checklist — FIX: uses patient_id not admission_id
    path("patients/<uuid:patient_id>/discharge-checklist/", views.DischargeChecklistView.as_view(), name="discharge-checklist"),
    path("patients/<uuid:patient_id>/discharge-checklist/<uuid:pk>/", views.DischargeChecklistItemView.as_view(), name="discharge-checklist-item"),
]
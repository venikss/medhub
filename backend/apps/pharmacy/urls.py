"""
Pharmacy module URL routing.

Added:
  - /formulary/:id/stock/  (FormularyStockView)
  - /refills/              (RefillListCreateView)
  - /substitutions/        (SubstitutionListCreateView)
  - /substitutions/:id/    (SubstitutionDetailView)
"""

from django.urls import path
from . import views

urlpatterns = [
    path("stats/", views.PharmacyStatsView.as_view(), name="pharmacy-stats"),
    path("dashboard/", views.PharmacyDashboardView.as_view(), name="pharmacy-dashboard"),
    path("profiles/", views.PharmacyProfilesView.as_view(), name="pharmacy-profiles"),

    path("prescriptions/", views.PharmacyRxListView.as_view(), name="pharmacy-rx-list"),
    path("prescriptions/<uuid:pk>/", views.PharmacyRxDetailView.as_view(), name="pharmacy-rx-detail"),
    path("prescriptions/<uuid:pk>/verify/", views.PharmacyRxVerifyView.as_view(), name="pharmacy-rx-verify"),
    path("prescriptions/<uuid:pk>/reject/", views.PharmacyRxRejectView.as_view(), name="pharmacy-rx-reject"),
    path("prescriptions/<uuid:pk>/hold/", views.PharmacyRxHoldView.as_view(), name="pharmacy-rx-hold"),
    path("prescriptions/<uuid:pk>/cancel/", views.PharmacyRxCancelView.as_view(), name="pharmacy-rx-cancel"),
    path("prescriptions/<uuid:pk>/dispense/", views.PharmacyRxDispenseView.as_view(), name="pharmacy-rx-dispense"),
    path("dispense/queue/", views.PharmacyDispenseQueueView.as_view(), name="pharmacy-dispense-queue"),

    path("drug-safety-check/", views.DrugSafetyCheckView.as_view(), name="drug-safety-check"),

    path("formulary/", views.FormularyListView.as_view(), name="formulary-list"),
    path("formulary/create/", views.FormularyCreateView.as_view(), name="formulary-create"),
    path("formulary/<uuid:pk>/", views.FormularyDetailView.as_view(), name="formulary-detail"),
    path("formulary/<uuid:pk>/stock/", views.FormularyStockView.as_view(), name="formulary-stock"),

    path("interventions/", views.PharmacyInterventionListCreateView.as_view(), name="pharmacy-intervention-list-create"),
    path("interventions/<uuid:pk>/", views.PharmacyInterventionRespondView.as_view(), name="pharmacy-intervention-detail"),
    path("interventions/<uuid:pk>/respond/", views.PharmacyInterventionRespondView.as_view(), name="pharmacy-intervention-respond"),

    path("refills/", views.RefillListCreateView.as_view(), name="pharmacy-refill-list-create"),

    path("substitutions/", views.SubstitutionListCreateView.as_view(), name="pharmacy-substitution-list-create"),
    path("substitutions/<uuid:pk>/", views.SubstitutionDetailView.as_view(), name="pharmacy-substitution-detail"),

    path("patients/<uuid:patient_pk>/kg_safety/", views.PharmacyKGSafetyView.as_view(), name="pharmacy-kg-safety"),
    path("patients/<uuid:patient_pk>/ai_consult/", views.PharmacyPatientAIConsultView.as_view(), name="pharmacy-patient-ai-consult"),
    path("prescriptions/<uuid:pk>/ai_consult/", views.PharmacyRxAIConsultView.as_view(), name="pharmacy-rx-ai-consult"),
]

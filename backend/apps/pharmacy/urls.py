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

    # Rx workflow
    path("prescriptions/", views.PharmacyRxListView.as_view(), name="pharmacy-rx-list"),
    path("prescriptions/<uuid:pk>/", views.PharmacyRxDetailView.as_view(), name="pharmacy-rx-detail"),
    path("prescriptions/<uuid:pk>/verify/", views.PharmacyRxVerifyView.as_view(), name="pharmacy-rx-verify"),
    path("prescriptions/<uuid:pk>/reject/", views.PharmacyRxRejectView.as_view(), name="pharmacy-rx-reject"),
    path("prescriptions/<uuid:pk>/hold/", views.PharmacyRxHoldView.as_view(), name="pharmacy-rx-hold"),
    path("prescriptions/<uuid:pk>/cancel/", views.PharmacyRxCancelView.as_view(), name="pharmacy-rx-cancel"),
    path("prescriptions/<uuid:pk>/dispense/", views.PharmacyRxDispenseView.as_view(), name="pharmacy-rx-dispense"),
    path("dispense/queue/", views.PharmacyDispenseQueueView.as_view(), name="pharmacy-dispense-queue"),

    # Drug safety check
    path("drug-safety-check/", views.DrugSafetyCheckView.as_view(), name="drug-safety-check"),

    # Formulary
    path("formulary/", views.FormularyListView.as_view(), name="formulary-list"),
    path("formulary/create/", views.FormularyCreateView.as_view(), name="formulary-create"),
    path("formulary/<uuid:pk>/", views.FormularyDetailView.as_view(), name="formulary-detail"),
    path("formulary/<uuid:pk>/stock/", views.FormularyStockView.as_view(), name="formulary-stock"),

    # Interventions
    path("interventions/", views.PharmacyInterventionListCreateView.as_view(), name="pharmacy-intervention-list-create"),
    path("interventions/<uuid:pk>/", views.PharmacyInterventionRespondView.as_view(), name="pharmacy-intervention-detail"),
    path("interventions/<uuid:pk>/respond/", views.PharmacyInterventionRespondView.as_view(), name="pharmacy-intervention-respond"),

    # Refills
    path("refills/", views.RefillListCreateView.as_view(), name="pharmacy-refill-list-create"),

    # Substitutions
    path("substitutions/", views.SubstitutionListCreateView.as_view(), name="pharmacy-substitution-list-create"),
    path("substitutions/<uuid:pk>/", views.SubstitutionDetailView.as_view(), name="pharmacy-substitution-detail"),
]

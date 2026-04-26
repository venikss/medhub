"""
Billing module URL routing.
"""

from django.urls import path
from . import views

urlpatterns = [
    path("dashboard/", views.BillingDashboardView.as_view(), name="billing-dashboard"),
    # Patient accounts  (FIXED: added)
    path("accounts/", views.PatientAccountListView.as_view(), name="billing-accounts"),
    path("accounts/<uuid:patient_id>/", views.PatientAccountDetailView.as_view(), name="billing-account-detail"),
    path("accounts/<uuid:patient_id>/timeline/", views.PatientAccountTimelineView.as_view(), name="billing-account-timeline"),

    # Invoices
    path("invoices/", views.InvoiceListCreateView.as_view(), name="invoice-list-create"),
    path("invoices/<uuid:pk>/", views.InvoiceDetailView.as_view(), name="invoice-detail"),
    path("invoices/<uuid:pk>/send/", views.InvoiceSendView.as_view(), name="invoice-send"),  # FIXED: added
    path("invoices/<uuid:pk>/void/", views.InvoiceVoidView.as_view(), name="invoice-void"),

    # Claims
    path("claims/", views.ClaimListCreateView.as_view(), name="claim-list-create"),
    path("claims/<uuid:pk>/", views.ClaimDetailView.as_view(), name="claim-detail"),
    path("claims/<uuid:pk>/status/", views.ClaimStatusView.as_view(), name="claim-status"),  # FIXED: added
    path("claims/<uuid:pk>/submit/", views.ClaimSubmitView.as_view(), name="claim-submit"),
    path("claims/<uuid:pk>/resubmit/", views.ClaimResubmitView.as_view(), name="claim-resubmit"),  # FIXED: added

    # Payments
    path("payments/", views.PaymentListCreateView.as_view(), name="payment-list-create"),
    path("payments/<uuid:pk>/void/", views.PaymentVoidView.as_view(), name="payment-void"),  # FIXED: renamed from /refund/

    # Denials
    path("denials/", views.DenialListCreateView.as_view(), name="denial-list-create"),
    path("denials/<uuid:pk>/", views.DenialDetailView.as_view(), name="denial-detail"),  # FIXED: added
    path("denials/<uuid:pk>/appeal/", views.DenialAppealView.as_view(), name="denial-appeal"),

    # Stats
    path("stats/", views.BillingStatsView.as_view(), name="billing-stats"),
]

"""
Main URL configuration for VirtualHospital (MedHub).
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from apps.patients.views import ConsentSignView


def root_view(_request):
    return JsonResponse(
        {
            "service": "medhub-backend",
            "status": "ok",
            "admin": "/admin/",
            "health": "/healthz",
            "apiBase": "/api/v1/",
        }
    )


def health_view(_request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    # Django Admin
    path("", root_view),
    path("healthz", health_view),
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/auth/", include("apps.authentication.urls")),
    path("api/v1/admin/", include("apps.administration.urls")),
    path("api/v1/patients/", include("apps.patients.urls")),
    path("api/v1/patients", include("apps.patients.urls")),
    path("api/v1/consents/<uuid:consent_pk>/sign/", ConsentSignView.as_view()),
    path("api/v1/", include("config.spec_alias_urls")),
    path("api/v1/doctors/", include("apps.doctors.urls")),
    path("api/v1/nurses/", include("apps.nurses.urls")),
    path("api/v1/lab/", include("apps.laboratory.urls")),
    path("api/v1/radiology/", include("apps.radiology.urls")),
    path("api/v1/pharmacy/", include("apps.pharmacy.urls")),
    path("api/v1/billing/", include("apps.billing.urls")),
    path("api/v1/cdss/", include("apps.cdss.urls")),
    path("fhir/", include("apps.fhir.urls")),
]

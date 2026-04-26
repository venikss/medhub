from django.urls import path
from .views import (
    AdminUserListView, AdminUserDetailView, AdminUserStatusView,
    AdminUserResetPasswordView, AdminUserActivityView,
    DepartmentListView, DepartmentDetailView, DepartmentStatusView,
    WardListView, WardDetailView,
    AdminBedListView, AdminBedDetailView,
    LabCatalogView, LabCatalogDetailView,
    RadiologyCatalogView, RadiologyCatalogDetailView,
    ServiceCatalogView, ServiceCatalogDetailView,
    AuditLogView, SettingsView, PermissionsView, AdminStatsView,
)

urlpatterns = [
    # Users
    path("users", AdminUserListView.as_view(), name="admin-users"),
    path("users/", AdminUserListView.as_view(), name="admin-users-slash"),
    path("users/<uuid:user_id>", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("users/<uuid:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail-slash"),
    path("users/<uuid:user_id>/status", AdminUserStatusView.as_view(), name="admin-user-status"),
    path("users/<uuid:user_id>/status/", AdminUserStatusView.as_view(), name="admin-user-status-slash"),
    path("users/<uuid:user_id>/reset-password", AdminUserResetPasswordView.as_view(), name="admin-user-reset-password"),
    path("users/<uuid:user_id>/reset-password/", AdminUserResetPasswordView.as_view(), name="admin-user-reset-password-slash"),
    path("users/<uuid:user_id>/activity", AdminUserActivityView.as_view(), name="admin-user-activity"),
    path("users/<uuid:user_id>/activity/", AdminUserActivityView.as_view(), name="admin-user-activity-slash"),

    # Departments
    path("departments", DepartmentListView.as_view(), name="admin-departments"),
    path("departments/", DepartmentListView.as_view(), name="admin-departments-slash"),
    path("departments/<uuid:dept_id>", DepartmentDetailView.as_view(), name="admin-dept-detail"),
    path("departments/<uuid:dept_id>/", DepartmentDetailView.as_view(), name="admin-dept-detail-slash"),
    path("departments/<uuid:dept_id>/status", DepartmentStatusView.as_view(), name="admin-dept-status"),
    path("departments/<uuid:dept_id>/status/", DepartmentStatusView.as_view(), name="admin-dept-status-slash"),

    # Wards
    path("wards", WardListView.as_view(), name="admin-wards"),
    path("wards/", WardListView.as_view(), name="admin-wards-slash"),
    path("wards/<uuid:ward_id>", WardDetailView.as_view(), name="admin-ward-detail"),
    path("wards/<uuid:ward_id>/", WardDetailView.as_view(), name="admin-ward-detail-slash"),

    # Beds
    path("beds", AdminBedListView.as_view(), name="admin-beds"),
    path("beds/", AdminBedListView.as_view(), name="admin-beds-slash"),
    path("beds/<uuid:bed_id>", AdminBedDetailView.as_view(), name="admin-bed-detail"),
    path("beds/<uuid:bed_id>/", AdminBedDetailView.as_view(), name="admin-bed-detail-slash"),

    # Catalogs
    path("catalogs/lab", LabCatalogView.as_view(), name="admin-catalog-lab"),
    path("catalogs/lab/", LabCatalogView.as_view(), name="admin-catalog-lab-slash"),
    path("catalogs/lab/<uuid:item_id>", LabCatalogDetailView.as_view(), name="admin-catalog-lab-detail"),
    path("catalogs/lab/<uuid:item_id>/", LabCatalogDetailView.as_view(), name="admin-catalog-lab-detail-slash"),
    path("catalogs/radiology", RadiologyCatalogView.as_view(), name="admin-catalog-radiology"),
    path("catalogs/radiology/", RadiologyCatalogView.as_view(), name="admin-catalog-radiology-slash"),
    path("catalogs/radiology/<uuid:item_id>", RadiologyCatalogDetailView.as_view(), name="admin-catalog-radiology-detail"),
    path("catalogs/radiology/<uuid:item_id>/", RadiologyCatalogDetailView.as_view(), name="admin-catalog-radiology-detail-slash"),
    path("catalogs/services", ServiceCatalogView.as_view(), name="admin-catalog-services"),
    path("catalogs/services/", ServiceCatalogView.as_view(), name="admin-catalog-services-slash"),
    path("catalogs/services/<uuid:item_id>", ServiceCatalogDetailView.as_view(), name="admin-catalog-services-detail"),
    path("catalogs/services/<uuid:item_id>/", ServiceCatalogDetailView.as_view(), name="admin-catalog-services-detail-slash"),

    # Audit
    path("audit", AuditLogView.as_view(), name="admin-audit"),
    path("audit/", AuditLogView.as_view(), name="admin-audit-slash"),

    # Settings
    path("settings", SettingsView.as_view(), name="admin-settings"),
    path("settings/", SettingsView.as_view(), name="admin-settings-slash"),

    # Permissions
    path("permissions", PermissionsView.as_view(), name="admin-permissions"),
    path("permissions/", PermissionsView.as_view(), name="admin-permissions-slash"),

    # Stats
    path("stats", AdminStatsView.as_view(), name="admin-stats"),
    path("stats/", AdminStatsView.as_view(), name="admin-stats-slash"),
]

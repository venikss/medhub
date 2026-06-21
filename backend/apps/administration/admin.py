from django.contrib import admin
from .models import (
    Department, Ward, Bed, AuditLog, SystemSetting,
    RolePermission, LabCatalogItem, RadiologyCatalogItem, ServiceCatalogItem,
)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "type", "status", "created_at"]
    list_filter = ["type", "status"]
    search_fields = ["name", "code"]
    autocomplete_fields = ["head"]

@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "department", "type", "status", "floor_number", "total_beds"]
    list_filter = ["type", "status", "department"]
    search_fields = ["name", "code"]
    autocomplete_fields = ["department", "head_nurse"]

@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = ["number", "ward", "type", "status"]
    list_filter = ["type", "status", "ward"]
    search_fields = ["number"]
    readonly_fields = ["created_at", "updated_at"]
    autocomplete_fields = ["ward"]

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["user_name", "action", "resource", "resource_id", "timestamp"]
    list_filter = ["action"]
    search_fields = ["user_name", "user_id", "resource_id"]
    readonly_fields = ["timestamp", "user_id", "user_name", "user_role", "action", "resource", "resource_id", "details", "ip_address", "session_id", "severity", "outcome"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ["key", "updated_at"]
    search_fields = ["key"]
    readonly_fields = ["updated_at"]
    autocomplete_fields = ["updated_by"]

@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ["role", "resource", "action", "allowed"]
    list_filter = ["role", "allowed"]
    search_fields = ["role", "resource", "action"]

@admin.register(LabCatalogItem)
class LabCatalogItemAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category", "specimen", "turnaround_hours", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["code", "name", "cpt_code"]

@admin.register(RadiologyCatalogItem)
class RadiologyCatalogItemAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "modality", "body_part", "with_contrast", "is_active"]
    list_filter = ["modality", "with_contrast", "is_active"]
    search_fields = ["code", "name", "cpt_code", "body_part"]

@admin.register(ServiceCatalogItem)
class ServiceCatalogItemAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category", "department", "is_active"]
    list_filter = ["category", "is_active"]
    search_fields = ["code", "name"]
    autocomplete_fields = ["department"]

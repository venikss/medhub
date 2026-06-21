"""
Audit logging infrastructure adapter.
Every mutating API call writes an immutable AuditLogEntry.
HIPAA: retain >= 6 years.
"""

import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

class AuditAction:
    LOGIN = "login"
    LOGOUT = "logout"
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    APPROVE = "approve"
    EXPORT = "export"
    PRINT = "print"
    PERMISSION_CHANGE = "permission_change"
    PASSWORD_RESET = "password_reset"
    CDSS_OVERRIDE = "cdss_override"

class AuditSeverity:
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    HIGH = CRITICAL

class AuditOutcome:
    SUCCESS = "success"
    FAILURE = "failure"

def get_client_ip(request) -> str:
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")

def write_audit_log(
    request,
    action: str,
    resource: str,
    resource_id=None,
    details: dict = None,
    severity: str = AuditSeverity.INFO,
    outcome: str = AuditOutcome.SUCCESS,
):
    """
    Write an immutable audit log entry.
    Import inside function to avoid circular imports.
    """
    try:
        from apps.administration.models import AuditLog

        user = request.user if request and hasattr(request, "user") else None
        user_id = str(user.id) if user and user.is_authenticated else None
        user_name = (
            f"{user.first_name} {user.last_name}".strip()
            if user and user.is_authenticated
            else "anonymous"
        )
        user_role = getattr(user, "role", None) if user and user.is_authenticated else None
        session_id = request.session.session_key if request and hasattr(request, "session") else None

        AuditLog.objects.create(
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            action=action,
            resource=resource,
            resource_id=str(resource_id) if resource_id else None,
            details=details or {},
            ip_address=get_client_ip(request) if request else "",
            session_id=session_id,
            severity=severity,
            outcome=outcome,
            timestamp=timezone.now(),
        )
    except Exception as exc:
        logger.error("Audit log write failed: %s", exc)

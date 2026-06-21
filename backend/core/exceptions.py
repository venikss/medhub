"""
Global exception handler.
All errors: { error: { code, message, details? } }
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import PermissionDenied, ObjectDoesNotExist, ValidationError
from django.http import Http404

logger = logging.getLogger(__name__)

class AppError(Exception):
    """Base application error."""

    status_code = 400
    default_code = "APP_ERROR"
    default_message = "An error occurred."

    def __init__(self, message=None, code=None, details=None, status_code=None):
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.details = details
        if status_code:
            self.status_code = status_code
        super().__init__(self.message)

class NotFoundError(AppError):
    status_code = 404
    default_code = "NOT_FOUND"
    default_message = "Resource not found."

class ConflictError(AppError):
    status_code = 409
    default_code = "CONFLICT"
    default_message = "Resource conflict."

class ValidationAppError(AppError):
    status_code = 422
    default_code = "VALIDATION_ERROR"
    default_message = "Validation failed."

class ForbiddenError(AppError):
    status_code = 403
    default_code = "FORBIDDEN"
    default_message = "You do not have permission to perform this action."

class UnauthorizedError(AppError):
    status_code = 401
    default_code = "UNAUTHORIZED"
    default_message = "Authentication credentials were not provided."

def _error_response(code: str, message: str, details=None, status_code: int = 400):
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return Response(body, status=status_code)

def custom_exception_handler(exc, context):
    if isinstance(exc, AppError):
        return _error_response(exc.code, exc.message, exc.details, exc.status_code)

    if isinstance(exc, Http404):
        return _error_response("NOT_FOUND", str(exc) or "Not found.", status_code=404)

    if isinstance(exc, PermissionDenied):
        return _error_response("FORBIDDEN", "Permission denied.", status_code=403)

    if isinstance(exc, ObjectDoesNotExist):
        return _error_response("NOT_FOUND", str(exc), status_code=404)

    if isinstance(exc, ValidationError):
        return _error_response(
            "VALIDATION_ERROR", "Validation failed.", exc.message_dict if hasattr(exc, "message_dict") else str(exc), 422
        )

    response = exception_handler(exc, context)

    if response is not None:
        errors = response.data
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
            429: "RATE_LIMIT_EXCEEDED",
        }
        code = code_map.get(response.status_code, "ERROR")
        message = "An error occurred."

        if isinstance(errors, dict):
            if "detail" in errors:
                message = str(errors["detail"])
                details = None
            else:
                message = "Validation error."
                details = errors
        elif isinstance(errors, list):
            message = str(errors[0]) if errors else message
            details = errors
        else:
            message = str(errors)
            details = None

        new_data = {"error": {"code": code, "message": message}}
        if details:
            new_data["error"]["details"] = details

        response.data = new_data
        return response

    logger.exception("Unhandled exception: %s", exc)
    return _error_response(
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred.",
        status_code=500,
    )

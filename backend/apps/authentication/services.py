"""
Authentication application services - use cases.
"""

import logging
from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import ForbiddenError, UnauthorizedError
from .models import RefreshTokenRecord, User, UserStatus

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def _token_expiry(token) -> datetime:
        return datetime.fromtimestamp(int(token["exp"]), tz=dt_timezone.utc)

    @staticmethod
    def _record_refresh_token(user: User, refresh: RefreshToken):
        RefreshTokenRecord.objects.update_or_create(
            jti=str(refresh["jti"]),
            defaults={
                "user": user,
                "expires_at": AuthService._token_expiry(refresh),
                "revoked": False,
                "revoked_at": None,
            },
        )

    @staticmethod
    def _revoke_refresh_token(refresh: RefreshToken):
        RefreshTokenRecord.objects.filter(jti=str(refresh["jti"])).update(
            revoked=True,
            revoked_at=timezone.now(),
        )

    @staticmethod
    def login(email: str, password: str, role: str = None) -> dict:
        user = authenticate(username=email, password=password)
        if not user:
            raise UnauthorizedError("Invalid email or password.", code="INVALID_CREDENTIALS")

        if user.status != UserStatus.ACTIVE:
            raise ForbiddenError(
                f"Account is {user.status}. Contact administrator.",
                code="ACCOUNT_INACTIVE",
            )
        if not user.is_active or user.deleted_at:
            raise ForbiddenError("Account is inactive. Contact administrator.", code="ACCOUNT_INACTIVE")
        if role and user.role != role:
            raise ForbiddenError(f"You are not registered as '{role}'.", code="ROLE_MISMATCH")

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["sub"] = str(user.id)
        if user.department_id:
            refresh["departmentId"] = str(user.department_id)
        AuthService._record_refresh_token(user, refresh)

        return {
            "token": str(refresh.access_token),
            "refreshToken": str(refresh),
            "user": user,
        }

    @staticmethod
    def logout(refresh_token_str: str):
        try:
            token = RefreshToken(refresh_token_str)
            AuthService._revoke_refresh_token(token)
            token.blacklist()
        except TokenError as exc:
            raise UnauthorizedError(str(exc), code="INVALID_TOKEN")

    @staticmethod
    def refresh(refresh_token_str: str) -> dict:
        try:
            refresh = RefreshToken(refresh_token_str)
            user = User.objects.get(id=refresh["sub"])
            if user.status != UserStatus.ACTIVE or not user.is_active or user.deleted_at:
                raise ForbiddenError("Account is inactive. Contact administrator.", code="ACCOUNT_INACTIVE")

            record = RefreshTokenRecord.objects.filter(jti=str(refresh["jti"])).first()
            if not record:
                raise UnauthorizedError("Refresh token is not recognized.", code="INVALID_TOKEN")
            if record and record.revoked:
                raise UnauthorizedError("Refresh token has been revoked.", code="INVALID_TOKEN")

            AuthService._revoke_refresh_token(refresh)
            refresh.blacklist()

            new_refresh = RefreshToken.for_user(user)
            new_refresh["role"] = user.role
            new_refresh["sub"] = str(user.id)
            if user.department_id:
                new_refresh["departmentId"] = str(user.department_id)
            AuthService._record_refresh_token(user, new_refresh)

            return {
                "token": str(new_refresh.access_token),
                "refreshToken": str(new_refresh),
            }
        except User.DoesNotExist:
            raise UnauthorizedError("User not found.", code="INVALID_TOKEN")
        except TokenError as exc:
            raise UnauthorizedError(str(exc), code="INVALID_TOKEN")

    @staticmethod
    def change_password(user: User, current_password: str, new_password: str):
        if not user.check_password(current_password):
            raise UnauthorizedError("Current password is incorrect.", code="WRONG_PASSWORD")
        user.set_password(new_password)
        user.save(update_fields=["password"])

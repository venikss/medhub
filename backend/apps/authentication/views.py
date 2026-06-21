"""
Authentication interface layer - HTTP adapters (DRF views).
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me
PUT    /auth/me/password
"""

from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import AuditAction, AuditSeverity, write_audit_log
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    RefreshTokenSerializer,
    UserProfileSerializer,
)
from .services import AuthService

class LoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    @method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=True))
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = AuthService.login(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            role=serializer.validated_data.get("role"),
        )
        write_audit_log(
            request=request,
            action=AuditAction.LOGIN,
            resource="auth",
            details={"email": serializer.validated_data["email"]},
        )
        return Response(
            {
                "token": data["token"],
                "refreshToken": data["refreshToken"],
                "user": UserProfileSerializer(data["user"]).data,
            },
            status=status.HTTP_200_OK,
        )

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RefreshTokenSerializer

    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        AuthService.logout(serializer.validated_data["refreshToken"])
        write_audit_log(request=request, action=AuditAction.LOGOUT, resource="auth")
        return Response(status=status.HTTP_204_NO_CONTENT)

class RefreshView(APIView):
    permission_classes = [AllowAny]
    serializer_class = RefreshTokenSerializer

    @method_decorator(ratelimit(key="ip", rate="30/m", method="POST", block=True))
    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = AuthService.refresh(serializer.validated_data["refreshToken"])
        return Response(data, status=status.HTTP_200_OK)

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    def put(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        AuthService.change_password(
            user=request.user,
            current_password=serializer.validated_data["currentPassword"],
            new_password=serializer.validated_data["newPassword"],
        )
        write_audit_log(
            request=request,
            action=AuditAction.PASSWORD_RESET,
            resource="auth",
            resource_id=request.user.id,
            severity=AuditSeverity.WARNING,
        )
        return Response({"message": "Password updated successfully."})

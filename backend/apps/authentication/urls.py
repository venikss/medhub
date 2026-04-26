"""
Authentication URL routing.
"""

from django.urls import path
from .views import LoginView, LogoutView, RefreshView, MeView, ChangePasswordView

urlpatterns = [
    path("login", LoginView.as_view(), name="auth-login"),
    path("login/", LoginView.as_view(), name="auth-login-slash"),
    path("logout", LogoutView.as_view(), name="auth-logout"),
    path("logout/", LogoutView.as_view(), name="auth-logout-slash"),
    path("refresh", RefreshView.as_view(), name="auth-refresh"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh-slash"),
    path("me", MeView.as_view(), name="auth-me"),
    path("me/", MeView.as_view(), name="auth-me-slash"),
    path("me/password", ChangePasswordView.as_view(), name="auth-change-password"),
    path("me/password/", ChangePasswordView.as_view(), name="auth-change-password-slash"),
]

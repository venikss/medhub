"""WebSocket URL routing."""

from django.urls import re_path
from .consumers import HospitalConsumer

websocket_urlpatterns = [
    re_path(r"^ws$", HospitalConsumer.as_asgi()),
]

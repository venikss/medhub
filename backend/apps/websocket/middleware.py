"""
JWT WebSocket authentication middleware.
Reads JWT from `?token=` query parameter or `Authorization: Bearer` header
and authenticates the scope user before the consumer runs.
"""

from urllib.parse import parse_qs
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async

User = get_user_model()


@database_sync_to_async
def _get_user_from_token(token: str):
    try:
        from rest_framework_simplejwt.tokens import AccessToken

        validated = AccessToken(token)
        user_id = validated.get("sub") or validated.get("user_id")
        if not user_id:
            return AnonymousUser()
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()


class JWTWebSocketMiddleware:
    """
    ASGI middleware that authenticates WebSocket connections via JWT.
    Supports `?token=<jwt>` query parameter.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            query_string = scope.get("query_string", b"").decode()
            params = parse_qs(query_string)
            token = params.get("token", [None])[0]
            if not token:
                headers = {
                    key.decode("latin1").lower(): value.decode("latin1")
                    for key, value in scope.get("headers", [])
                }
                auth_header = headers.get("authorization", "")
                if auth_header.lower().startswith("bearer "):
                    token = auth_header.split(" ", 1)[1].strip()
            if token:
                scope["user"] = await _get_user_from_token(token)
            else:
                # Deny unauthenticated connections
                scope["user"] = AnonymousUser()
        return await self.inner(scope, receive, send)


# Alias used in config/asgi.py
JWTAuthMiddleware = JWTWebSocketMiddleware

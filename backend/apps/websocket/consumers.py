"""
Hospital WebSocket consumer.
Each authenticated user joins their role-based channel group and an optional
patient-specific group for real-time events.
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

ROLE_GROUP_MAP = {
    "admin":         "role_admin",
    "doctor":        "role_doctor",
    "nurse":         "role_nurse",
    "lab_tech":      "role_lab_tech",
    "radiologist":   "role_radiologist",
    "pharmacist":    "role_pharmacist",
    "billing_staff": "role_billing_staff",
    "front_desk":    "role_front_desk",
    "patient":       "role_patient",
}

class HospitalConsumer(AsyncWebsocketConsumer):
    """
    Single WebSocket consumer for all hospital real-time events.

    Groups joined per connection:
    - `role_{role}` — broadcasts to all users with the same role
    - `patient_{id}` — (optional) if `?patientId=<uuid>` query param is present
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user = user
        self.joined_groups = []

        role_group = ROLE_GROUP_MAP.get(getattr(user, "role", None))
        if role_group:
            await self.channel_layer.group_add(role_group, self.channel_name)
            self.joined_groups.append(role_group)

        user_group = f"user_{user.id}"
        await self.channel_layer.group_add(user_group, self.channel_name)
        self.joined_groups.append(user_group)

        query_string = self.scope.get("query_string", b"").decode()
        from urllib.parse import parse_qs
        params = parse_qs(query_string)
        patient_id = params.get("patientId", [None])[0]
        if patient_id:
            patient_group = f"patient_{patient_id}"
            await self.channel_layer.group_add(patient_group, self.channel_name)
            self.joined_groups.append(patient_group)
            self.patient_group = patient_group
        else:
            self.patient_group = None

        await self.accept()
        await self.send(json.dumps({
            "event": "connection.established",
            "payload": {
                "userId": str(user.id),
                "role": getattr(user, "role", None),
                "groups": self.joined_groups,
            }
        }))
        logger.info("WS connect: user=%s role=%s groups=%s", user.id, getattr(user, "role", None), self.joined_groups)

    async def disconnect(self, close_code):
        for group in getattr(self, "joined_groups", []):
            await self.channel_layer.group_discard(group, self.channel_name)
        logger.info("WS disconnect: code=%s", close_code)

    async def receive(self, text_data=None, bytes_data=None):
        """Handle messages from the client (ping/pong, subscriptions)."""
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            await self.send(json.dumps({"event": "error", "payload": {"detail": "Invalid JSON"}}))
            return

        event = data.get("event")
        if event == "ping":
            await self.send(json.dumps({"event": "pong", "payload": {}}))

    async def ws_message(self, message):
        """Relay any group broadcast to the individual WebSocket client."""
        await self.send(json.dumps({
            "event": message.get("event"),
            "payload": message.get("payload", {}),
            "timestamp": message.get("timestamp"),
        }))

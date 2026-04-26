"""
File storage utilities — S3 / MinIO / local adapter.
"""

import uuid
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings


def upload_file(file_obj, folder: str, original_name: str) -> dict:
    """
    Upload a file to the configured storage backend.
    Returns { fileUrl, fileId, uploadedAt }.
    """
    from django.utils import timezone

    ext = original_name.rsplit(".", 1)[-1].lower().strip() if "." in original_name else ""
    if ext and f".{ext}" not in ALLOWED_EXTENSIONS:
        raise ValueError(f"File extension '.{ext}' is not allowed.")
    file_id = str(uuid.uuid4())
    filename = f"{folder}/{file_id}.{ext}" if ext else f"{folder}/{file_id}"

    path = default_storage.save(filename, ContentFile(file_obj.read()))
    file_url = default_storage.url(path)

    return {
        "fileUrl": file_url,
        "fileId": file_id,
        "uploadedAt": timezone.now().isoformat(),
    }


def upload_response(upload_result: dict) -> dict:
    """Return the spec-standard upload response shape."""
    return {
        "fileUrl": upload_result["fileUrl"],
        "fileId": upload_result.get("fileId"),
        "uploadedAt": upload_result.get("uploadedAt"),
    }


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png"}
ALLOWED_PDF_TYPES = {"application/pdf"}
ALLOWED_DOCUMENT_TYPES = ALLOWED_PDF_TYPES | ALLOWED_IMAGE_TYPES

MAX_AVATAR_SIZE = 2 * 1024 * 1024     # 2 MB
MAX_CONSENT_SIZE = 10 * 1024 * 1024   # 10 MB
MAX_LAB_REPORT_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_INSURANCE_CARD_SIZE = 5 * 1024 * 1024  # 5 MB


# Map MIME types to their expected magic-byte signatures
_MAGIC_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "application/pdf": [b"%PDF"],
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}


def validate_file(file_obj, allowed_types: set, max_size: int | None = None):
    """Raise ValueError if file doesn't meet constraints."""
    if max_size is not None and file_obj.size > max_size:
        mb = max_size // (1024 * 1024)
        raise ValueError(f"File size exceeds {mb} MB limit.")
    content_type = getattr(file_obj, "content_type", "")
    if content_type not in allowed_types:
        raise ValueError(
            f"Invalid file type '{content_type}'. Allowed: {', '.join(allowed_types)}"
        )
    # Verify actual file content matches claimed type via magic bytes
    header = file_obj.read(8)
    file_obj.seek(0)
    signatures = _MAGIC_SIGNATURES.get(content_type)
    if signatures and not any(header.startswith(sig) for sig in signatures):
        raise ValueError("File content does not match the declared file type.")

"""
Shared domain utilities.
"""

import random
import secrets
import string
from datetime import date
from django.utils import timezone

def generate_mrn() -> str:
    """Auto-generate unique Medical Record Number: MRN-YYYYMMDD-XXXXXX"""
    today = timezone.now().strftime("%Y%m%d")
    suffix = "".join(random.choices(string.digits, k=6))
    return f"MRN-{today}-{suffix}"

def generate_accession_number(prefix: str = "ACC") -> str:
    """Generate accession number: PREFIX-YYYYMMDD-####"""
    today = timezone.now().strftime("%Y%m%d")
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{prefix}-{today}-{suffix}"

def generate_barcode(prefix: str = "BC") -> str:
    """Generate a generic barcode-like identifier."""
    today = timezone.now().strftime("%Y%m%d")
    suffix = "".join(random.choices(string.digits, k=6))
    return f"{prefix}-{today}-{suffix}"

def generate_queue_ticket(prefix: str = "Q") -> str:
    """Generate queue ticket number."""
    suffix = "".join(random.choices(string.digits, k=4))
    return f"{prefix}{suffix}"

def generate_employee_id(role: str) -> str:
    """Generate a human-readable employee identifier based on the staff role."""
    role_prefix_map = {
        "admin": "ADM",
        "doctor": "DOC",
        "nurse": "NUR",
        "lab_tech": "LAB",
        "radiologist": "RAD",
        "pharmacist": "PHA",
        "billing_staff": "BIL",
        "front_desk": "FD",
    }
    prefix = role_prefix_map.get(role, "EMP")
    suffix = "".join(random.choices(string.digits, k=6))
    return f"{prefix}-{suffix}"

def compute_age(dob: date) -> int:
    """Calculate age in years from date of birth."""
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

def calculate_news2_score(vitals: dict) -> int:
    """
    Calculate National Early Warning Score 2 (NEWS2).
    Returns an integer score (higher = more critical).
    """
    score = 0

    rr = vitals.get("respiratory_rate")
    if rr is not None:
        if rr <= 8:
            score += 3
        elif 9 <= rr <= 11:
            score += 1
        elif 12 <= rr <= 20:
            score += 0
        elif 21 <= rr <= 24:
            score += 2
        elif rr >= 25:
            score += 3

    spo2 = vitals.get("spo2")
    if spo2 is not None:
        if spo2 <= 91:
            score += 3
        elif 92 <= spo2 <= 93:
            score += 2
        elif 94 <= spo2 <= 95:
            score += 1
        elif spo2 >= 96:
            score += 0

    temp = vitals.get("temperature")
    if temp is not None:
        if temp <= 35.0:
            score += 3
        elif 35.1 <= temp <= 36.0:
            score += 1
        elif 36.1 <= temp <= 38.0:
            score += 0
        elif 38.1 <= temp <= 39.0:
            score += 1
        elif temp >= 39.1:
            score += 2

    sbp = vitals.get("systolic")
    if sbp is not None:
        if sbp <= 90:
            score += 3
        elif 91 <= sbp <= 100:
            score += 2
        elif 101 <= sbp <= 110:
            score += 1
        elif 111 <= sbp <= 219:
            score += 0
        elif sbp >= 220:
            score += 3

    hr = vitals.get("heart_rate")
    if hr is not None:
        if hr <= 40:
            score += 3
        elif 41 <= hr <= 50:
            score += 1
        elif 51 <= hr <= 90:
            score += 0
        elif 91 <= hr <= 110:
            score += 1
        elif 111 <= hr <= 130:
            score += 2
        elif hr >= 131:
            score += 3

    gcs = vitals.get("gcs")
    if gcs is not None and gcs < 15:
        score += 3

    return score

def generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password using cryptographic RNG."""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        password = "".join(secrets.choice(chars) for _ in range(length))
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*" for c in password)
        if all([has_upper, has_lower, has_digit, has_special]):
            return password

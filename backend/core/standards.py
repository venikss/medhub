"""
Validation helpers for standardized clinical and billing codes.
"""

import re


ICD10_RE = re.compile(r"^[A-TV-Z][0-9][0-9AB](?:\.[A-Z0-9]{1,4})?$", re.IGNORECASE)
LOINC_RE = re.compile(r"^\d{1,6}-\d$")
CPT_RE = re.compile(r"^\d{5}$")
RXNORM_RE = re.compile(r"^\d{1,8}$")
LOCAL_CODE_RE = re.compile(r"^[A-Z0-9][A-Z0-9._/-]{1,29}$", re.IGNORECASE)
NDC_RE = re.compile(r"^(?:\d{10}|\d{11}|\d{4}-\d{4}-\d{2}|\d{5}-\d{3}-\d{2}|\d{5}-\d{4}-\d{1}|\d{5}-\d{4}-\d{2})$")
SNOMED_RE = re.compile(r"^\d{6,18}$")


def is_valid_loinc(code: str) -> bool:
    return bool(code and LOINC_RE.match(code.strip()))


def is_valid_icd10(code: str) -> bool:
    return bool(code and ICD10_RE.match(code.strip()))


def is_valid_cpt(code: str) -> bool:
    return bool(code and CPT_RE.match(code.strip()))


def is_valid_local_code(code: str) -> bool:
    return bool(code and LOCAL_CODE_RE.match(code.strip()))


def is_valid_cpt_or_local(code: str) -> bool:
    return is_valid_cpt(code) or is_valid_local_code(code)


def is_valid_ndc(code: str) -> bool:
    normalized = code.strip() if code else ""
    return bool(normalized and NDC_RE.match(normalized))


def is_valid_rxnorm(code: str) -> bool:
    """RxNorm identifier (RxCUI). Typically 1-8 digits."""
    return bool(code and RXNORM_RE.match(code.strip()))


def is_valid_snomed(code: str) -> bool:
    """SNOMED CT concept identifier. 6–18 digit integer."""
    return bool(code and SNOMED_RE.match(code.strip()))

"""
FHIR R4 read-only export endpoints.

Supported resources:
  GET /fhir/Patient/:id              → FHIR Patient resource
  GET /fhir/Patient/:id/$everything  → FHIR Bundle (Patient + related resources)
  GET /fhir/Condition/:id            → FHIR Condition (from Diagnosis)
  GET /fhir/MedicationRequest/:id    → FHIR MedicationRequest (from Prescription)
  GET /fhir/Observation/:id          → FHIR Observation (from LabTestResult)
  GET /fhir/DiagnosticReport/:id     → FHIR DiagnosticReport (from LabReport)
  GET /fhir/ImagingStudy/:id         → FHIR ImagingStudy

FHIR R4 spec: https://hl7.org/fhir/R4/
"""

from datetime import datetime, timezone as dt_tz
from django.http import JsonResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.patients.models import Patient
from core.exceptions import NotFoundError

def _now_fhir() -> str:
    return datetime.now(tz=dt_tz.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def _date_fhir(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()[:10]
    return str(value)

def _datetime_fhir(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(value)

def _gender_fhir(gender: str) -> str:
    mapping = {
        "male": "male",
        "female": "female",
        "other": "other",
        "unknown": "unknown",
        "non_binary": "other",
    }
    return mapping.get((gender or "").lower(), "unknown")

def _uuid_ref(resource_type: str, obj_id) -> dict:
    return {"reference": f"{resource_type}/{obj_id}"}

def patient_to_fhir(patient: Patient) -> dict:
    """Map patients.Patient → FHIR R4 Patient resource."""
    address = patient.address or {}
    telecom = []
    if patient.phone:
        telecom.append({"system": "phone", "value": patient.phone, "use": "mobile"})
    if patient.email:
        telecom.append({"system": "email", "value": patient.email})

    resource = {
        "resourceType": "Patient",
        "id": str(patient.id),
        "meta": {
            "profile": ["http://hl7.org/fhir/StructureDefinition/Patient"],
            "lastUpdated": _datetime_fhir(patient.updated_at if hasattr(patient, "updated_at") else None),
        },
        "identifier": [
            {
                "use": "official",
                "system": "urn:medhub:mrn",
                "value": patient.mrn,
            }
        ],
        "active": patient.status == "active",
        "name": [
            {
                "use": "official",
                "family": patient.last_name,
                "given": [patient.first_name],
            }
        ],
        "telecom": telecom,
        "gender": _gender_fhir(patient.gender),
        "birthDate": _date_fhir(patient.date_of_birth),
    }

    if address:
        resource["address"] = [
            {
                "use": "home",
                "line": [address.get("street", "")],
                "city": address.get("city", ""),
                "state": address.get("state", ""),
                "postalCode": address.get("zip", ""),
                "country": address.get("country", ""),
            }
        ]

    if patient.blood_type:
        resource["extension"] = [
            {
                "url": "http://hl7.org/fhir/StructureDefinition/patient-bloodType",
                "valueString": patient.blood_type,
            }
        ]

    if patient.insurance_provider or patient.insurance_id:
        resource["generalPractitioner"] = []
        resource["managingOrganization"] = {
            "display": patient.insurance_provider or "",
        }

    emergency = patient.emergency_contact or {}
    if emergency:
        resource["contact"] = [
            {
                "relationship": [{"text": emergency.get("relationship", "Emergency Contact")}],
                "name": {"text": emergency.get("name", "")},
                "telecom": [{"system": "phone", "value": emergency.get("phone", "")}] if emergency.get("phone") else [],
            }
        ]

    return resource

def diagnosis_to_fhir(diag) -> dict:
    """Map doctors.Diagnosis → FHIR R4 Condition resource."""
    coding = [
        {
            "system": "http://hl7.org/fhir/sid/icd-10",
            "code": diag.code,
            "display": diag.description,
        }
    ]
    if getattr(diag, "snomed_code", None):
        coding.append({
            "system": "http://snomed.info/sct",
            "code": diag.snomed_code,
            "display": getattr(diag, "snomed_display", None) or diag.description,
        })

    status_map = {
        "active": "active",
        "resolved": "resolved",
        "inactive": "inactive",
        "in-remission": "remission",
    }
    return {
        "resourceType": "Condition",
        "id": str(diag.id),
        "clinicalStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": status_map.get(diag.status, "active"),
                }
            ]
        },
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                        "code": "encounter-diagnosis",
                    }
                ]
            }
        ],
        "code": {"coding": coding, "text": diag.description},
        "subject": _uuid_ref("Patient", diag.patient_id),
        "encounter": _uuid_ref("Encounter", diag.encounter_id) if diag.encounter_id else None,
        "recordedDate": _datetime_fhir(diag.created_at),
        "recorder": _uuid_ref("Practitioner", diag.diagnosed_by_id) if diag.diagnosed_by_id else None,
    }

def prescription_to_fhir(rx) -> dict:
    """Map doctors.Prescription → FHIR R4 MedicationRequest resource."""
    status_map = {
        "active": "active",
        "on-hold": "on-hold",
        "discontinued": "stopped",
        "expired": "completed",
    }
    route_map = {
        "oral": "26643006",
        "iv": "47625008",
        "im": "78421000",
        "sc": "34206005",
        "topical": "6064005",
        "inhaled": "18679011000001101",
        "sublingual": "37839007",
        "rectal": "37161004",
        "nasal": "46713006",
        "ophthalmic": "54485002",
        "otic": "10547007",
    }
    coding = [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "display": rx.medication}]
    if rx.rxnorm_code:
        coding[0]["code"] = rx.rxnorm_code

    dosage = {
        "text": f"{rx.dosage} {rx.frequency} via {rx.route}",
        "timing": {"code": {"text": rx.frequency}},
        "doseAndRate": [
            {
                "type": {
                    "coding": [
                        {"system": "http://terminology.hl7.org/CodeSystem/dose-rate-type", "code": "ordered"}
                    ]
                },
                "doseQuantity": {"value": rx.quantity, "unit": "tablet"},
            }
        ],
    }
    route_snomed = route_map.get((rx.route or "").lower())
    if route_snomed:
        dosage["route"] = {
            "coding": [
                {"system": "http://snomed.info/sct", "code": route_snomed, "display": rx.route}
            ]
        }

    resource = {
        "resourceType": "MedicationRequest",
        "id": str(rx.id),
        "status": status_map.get(rx.status, "active"),
        "intent": "order",
        "medicationCodeableConcept": {
            "coding": coding,
            "text": rx.medication,
        },
        "subject": _uuid_ref("Patient", rx.patient_id),
        "encounter": _uuid_ref("Encounter", rx.encounter_id) if rx.encounter_id else None,
        "authoredOn": _datetime_fhir(rx.created_at),
        "requester": _uuid_ref("Practitioner", rx.prescribed_by_id) if rx.prescribed_by_id else None,
        "dosageInstruction": [dosage],
        "dispenseRequest": {
            "numberOfRepeatsAllowed": rx.refills or 0,
            "quantity": {"value": rx.quantity},
            "validityPeriod": {
                "start": _date_fhir(rx.start_date),
                "end": _date_fhir(rx.end_date),
            },
        },
        "note": [{"text": rx.sig}] if rx.sig else [],
    }
    if rx.generic_name:
        resource["medicationCodeableConcept"]["coding"].append(
            {
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "display": rx.generic_name,
            }
        )
    return resource

def lab_result_to_fhir(result) -> dict:
    """Map laboratory.LabTestResult → FHIR R4 Observation resource."""
    status_fhir_map = {
        "pending": "registered",
        "in-progress": "preliminary",
        "verified": "final",
        "cancelled": "cancelled",
    }
    coding = [{"system": "http://loinc.org", "code": result.test_code, "display": result.test_name}]

    resource = {
        "resourceType": "Observation",
        "id": str(result.id),
        "status": status_fhir_map.get(result.status, "final"),
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        "code": {"coding": coding, "text": result.test_name},
        "subject": _uuid_ref("Patient", result.panel.patient_id) if result.panel_id else None,
        "valueString": result.value,
        "effectiveDateTime": _datetime_fhir(result.updated_at),
    }

    if result.unit:
        resource["valueQuantity"] = {
            "value": _try_float(result.value),
            "unit": result.unit,
            "system": "http://unitsofmeasure.org",
        }
        resource.pop("valueString", None)

    if result.is_critical:
        resource["interpretation"] = [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                        "code": result.flag or "AA",
                        "display": "Critical" if result.is_critical else result.flag,
                    }
                ]
            }
        ]

    return resource

def lab_report_to_fhir(report) -> dict:
    """Map laboratory.LabReport → FHIR R4 DiagnosticReport resource."""
    status_map = {
        "draft": "partial",
        "preliminary": "preliminary",
        "final": "final",
        "amended": "amended",
        "corrected": "corrected",
        "cancelled": "cancelled",
    }
    result_refs = []
    if report.panel_id:
        try:
            for r in report.panel.results.all():
                result_refs.append(_uuid_ref("Observation", r.id))
        except Exception:
            pass

    return {
        "resourceType": "DiagnosticReport",
        "id": str(report.id),
        "status": status_map.get(report.status, "final"),
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                        "code": "LAB",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        "code": {"text": getattr(report.panel, "name", "Lab Report") if report.panel_id else "Lab Report"},
        "subject": _uuid_ref("Patient", report.patient_id),
        "issued": _datetime_fhir(report.created_at),
        "result": result_refs,
        "conclusion": getattr(report, "notes", None) or "",
    }

def imaging_study_to_fhir(study) -> dict:
    """Map radiology.ImagingStudy → FHIR R4 ImagingStudy resource."""
    modality = getattr(getattr(study, "order", None), "modality", "") or ""
    return {
        "resourceType": "ImagingStudy",
        "id": str(study.id),
        "status": study.status,
        "modality": [
            {
                "system": "http://dicom.nema.org/resources/ontology/DCM",
                "code": modality.upper(),
            }
        ] if modality else [],
        "subject": _uuid_ref("Patient", study.patient_id),
        "started": _datetime_fhir(study.exam_date),
        "description": str(study),
        "numberOfSeries": study.series_count,
        "numberOfInstances": study.images_count,
        "endpoint": [{"reference": study.pacs_url}] if study.pacs_url else [],
    }

def _try_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def _bundle_entry(resource: dict, base_url: str) -> dict:
    rt = resource["resourceType"]
    rid = resource.get("id", "")
    return {
        "fullUrl": f"{base_url}/fhir/{rt}/{rid}",
        "resource": resource,
        "search": {"mode": "match"},
    }

def _base_url(request) -> str:
    return request.build_absolute_uri("/").rstrip("/")

class FhirPatientView(APIView):
    """GET /fhir/Patient/:id → FHIR R4 Patient resource"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            patient = Patient.objects.get(id=pk)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")
        return JsonResponse(patient_to_fhir(patient), content_type="application/fhir+json")

class FhirPatientEverythingView(APIView):
    """GET /fhir/Patient/:id/$everything → FHIR R4 Bundle"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            patient = Patient.objects.prefetch_related(
                "diagnoses__encounter",
                "prescriptions",
            ).get(id=pk)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")

        base = _base_url(request)
        entries = [_bundle_entry(patient_to_fhir(patient), base)]

        from apps.doctors.models import Diagnosis
        for diag in Diagnosis.objects.filter(patient=patient).select_related("encounter"):
            entries.append(_bundle_entry(diagnosis_to_fhir(diag), base))

        from apps.doctors.models import Prescription
        for rx in Prescription.objects.filter(patient=patient):
            entries.append(_bundle_entry(prescription_to_fhir(rx), base))

        from apps.laboratory.models import LabTestResult
        for result in LabTestResult.objects.filter(panel__patient=patient).select_related("panel"):
            entries.append(_bundle_entry(lab_result_to_fhir(result), base))

        from apps.laboratory.models import LabReport
        for report in LabReport.objects.filter(patient=patient).select_related("panel"):
            entries.append(_bundle_entry(lab_report_to_fhir(report), base))

        from apps.radiology.models import ImagingStudy
        for study in ImagingStudy.objects.filter(patient=patient).select_related("order"):
            entries.append(_bundle_entry(imaging_study_to_fhir(study), base))

        bundle = {
            "resourceType": "Bundle",
            "id": f"patient-{pk}-everything",
            "meta": {"lastUpdated": _now_fhir()},
            "type": "searchset",
            "total": len(entries),
            "link": [
                {
                    "relation": "self",
                    "url": f"{base}/fhir/Patient/{pk}/$everything",
                }
            ],
            "entry": entries,
        }
        return JsonResponse(bundle, content_type="application/fhir+json")

class FhirConditionView(APIView):
    """GET /fhir/Condition/:id → FHIR R4 Condition"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from apps.doctors.models import Diagnosis
        try:
            diag = Diagnosis.objects.get(id=pk)
        except Diagnosis.DoesNotExist:
            raise NotFoundError("Condition not found.")
        return JsonResponse(diagnosis_to_fhir(diag), content_type="application/fhir+json")

class FhirMedicationRequestView(APIView):
    """GET /fhir/MedicationRequest/:id → FHIR R4 MedicationRequest"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from apps.doctors.models import Prescription
        try:
            rx = Prescription.objects.get(id=pk)
        except Prescription.DoesNotExist:
            raise NotFoundError("MedicationRequest not found.")
        return JsonResponse(prescription_to_fhir(rx), content_type="application/fhir+json")

class FhirObservationView(APIView):
    """GET /fhir/Observation/:id → FHIR R4 Observation"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from apps.laboratory.models import LabTestResult
        try:
            result = LabTestResult.objects.select_related("panel").get(id=pk)
        except LabTestResult.DoesNotExist:
            raise NotFoundError("Observation not found.")
        return JsonResponse(lab_result_to_fhir(result), content_type="application/fhir+json")

class FhirDiagnosticReportView(APIView):
    """GET /fhir/DiagnosticReport/:id → FHIR R4 DiagnosticReport"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from apps.laboratory.models import LabReport
        try:
            report = LabReport.objects.select_related("panel").get(id=pk)
        except LabReport.DoesNotExist:
            raise NotFoundError("DiagnosticReport not found.")
        return JsonResponse(lab_report_to_fhir(report), content_type="application/fhir+json")

class FhirImagingStudyView(APIView):
    """GET /fhir/ImagingStudy/:id → FHIR R4 ImagingStudy"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from apps.radiology.models import ImagingStudy
        try:
            study = ImagingStudy.objects.select_related("order").get(id=pk)
        except ImagingStudy.DoesNotExist:
            raise NotFoundError("ImagingStudy not found.")
        return JsonResponse(imaging_study_to_fhir(study), content_type="application/fhir+json")

class FhirCapabilityStatementView(APIView):
    """GET /fhir/metadata → FHIR R4 CapabilityStatement"""

    def get(self, request):
        base = _base_url(request)
        statement = {
            "resourceType": "CapabilityStatement",
            "id": "medhub-fhir-r4",
            "status": "active",
            "date": _now_fhir(),
            "kind": "instance",
            "fhirVersion": "4.0.1",
            "format": ["application/fhir+json", "application/json"],
            "software": {"name": "MedHub", "version": "1.0"},
            "implementation": {
                "description": "MedHub FHIR R4 API",
                "url": f"{base}/fhir",
            },
            "rest": [
                {
                    "mode": "server",
                    "resource": [
                        {
                            "type": "Patient",
                            "interaction": [{"code": "read"}],
                            "operation": [{"name": "everything", "definition": "http://hl7.org/fhir/OperationDefinition/Patient-everything"}],
                        },
                        {"type": "Condition", "interaction": [{"code": "read"}]},
                        {"type": "MedicationRequest", "interaction": [{"code": "read"}]},
                        {"type": "Observation", "interaction": [{"code": "read"}]},
                        {"type": "DiagnosticReport", "interaction": [{"code": "read"}]},
                        {"type": "ImagingStudy", "interaction": [{"code": "read"}]},
                    ],
                }
            ],
        }
        return JsonResponse(statement, content_type="application/fhir+json")

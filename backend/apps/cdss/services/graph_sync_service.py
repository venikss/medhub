from __future__ import annotations

from django.utils import timezone
from neomodel import db

from apps.cdss.graph_models import (
    AllergyNode,
    DiseaseNode,
    EncounterNode,
    ICD10ConceptNode,
    LOINCConceptNode,
    LabResultNode,
    MedicationNode,
    PatientNode,
    RadiologyReportNode,
    RxNormConceptNode,
    SNOMEDConceptNode,
)
from apps.cdss.services.ontology_service import OntologyService


class GraphSyncService:
    @staticmethod
    def _patient_age(patient) -> int:
        if getattr(patient, "date_of_birth", None):
            return (timezone.now().date() - patient.date_of_birth).days // 365
        return 30

    @classmethod
    def ensure_patient_node(cls, patient):
        patient_node = PatientNode.nodes.get_or_none(uid=str(patient.id))
        full_name = (
            f"{getattr(patient, 'first_name', '') or ''} {getattr(patient, 'last_name', '') or ''}".strip()
            or str(patient.id)
        )
        if not patient_node:
            patient_node = PatientNode(
                uid=str(patient.id),
                full_name=full_name,
                age=cls._patient_age(patient),
                gender=getattr(patient, "gender", "unknown") or "unknown",
            ).save()
        else:
            patient_node.full_name = full_name
            patient_node.age = cls._patient_age(patient)
            patient_node.gender = getattr(patient, "gender", "unknown") or "unknown"
            patient_node.save()
        return patient_node

    @staticmethod
    def _normalize_allergy_entry(entry) -> dict[str, str]:
        if isinstance(entry, dict):
            substance = str(entry.get("substance") or entry.get("name") or entry.get("allergen") or "").strip()
            reaction = str(entry.get("reaction") or "").strip()
            severity = str(entry.get("severity") or "").strip()
            source_text = str(entry.get("sourceText") or entry.get("notes") or substance or reaction).strip()
        else:
            substance = str(entry or "").strip()
            reaction = ""
            severity = ""
            source_text = substance

        return {
            "substance": substance,
            "reaction": reaction,
            "severity": severity,
            "source_text": source_text,
        }

    @classmethod
    def sync_patient_profile(cls, patient):
        patient_node = cls.ensure_patient_node(patient)
        cls.sync_patient_allergies(patient_node, patient)
        return patient_node

    @classmethod
    def sync_patient_allergies(cls, patient_node, patient):
        db.cypher_query(
            """
            MATCH (p:PatientNode {uid: $uid})-[r:HAS_ALLERGY]->(:AllergyNode)
            DELETE r
            """,
            {"uid": str(patient.id)},
        )

        seen_entries = set()
        for entry in patient.allergies or []:
            normalized = cls._normalize_allergy_entry(entry)
            substance = normalized["substance"]
            if not substance:
                continue
            dedupe_key = (
                substance.lower(),
                normalized["reaction"].lower(),
                normalized["severity"].lower(),
            )
            if dedupe_key in seen_entries:
                continue
            seen_entries.add(dedupe_key)

            allergy_node = AllergyNode.nodes.get_or_none(name=substance)
            if not allergy_node:
                allergy_node = AllergyNode(name=substance).save()

            patient_node.allergies.connect(
                allergy_node,
                {
                    "reaction": normalized["reaction"],
                    "severity": normalized["severity"],
                    "source_text": normalized["source_text"],
                },
            )

    @classmethod
    def sync_encounter(cls, encounter):
        """Sync a doctor Encounter (SOAP note) to Neo4j EncounterNode."""
        patient_node = cls.ensure_patient_node(encounter.patient)

        encounter_uid = str(encounter.id)
        doctor_name = (
            encounter.doctor.get_full_name()
            or getattr(encounter.doctor, "email", "")
        )

        enc_node = EncounterNode.nodes.get_or_none(encounter_uid=encounter_uid)
        if not enc_node:
            enc_node = EncounterNode(
                encounter_uid=encounter_uid,
                visit_type=encounter.visit_type or "",
                status=encounter.status or "",
                subjective=(encounter.subjective or "")[:2000],
                objective=(encounter.objective or "")[:2000],
                assessment=(encounter.assessment or "")[:2000],
                plan=(encounter.plan or "")[:2000],
                doctor_name=doctor_name,
                created_at=encounter.created_at,
            ).save()
        else:
            enc_node.visit_type = encounter.visit_type or ""
            enc_node.status = encounter.status or ""
            enc_node.subjective = (encounter.subjective or "")[:2000]
            enc_node.objective = (encounter.objective or "")[:2000]
            enc_node.assessment = (encounter.assessment or "")[:2000]
            enc_node.plan = (encounter.plan or "")[:2000]
            enc_node.doctor_name = doctor_name
            enc_node.save()

        if not patient_node.encounters.is_connected(enc_node):
            patient_node.encounters.connect(
                enc_node,
                {
                    "created_at": encounter.created_at,
                    "status": encounter.status or "",
                    "visit_type": encounter.visit_type or "",
                },
            )

    @classmethod
    def sync_diagnosis(cls, diagnosis):
        OntologyService.sync_diagnosis_ontology(diagnosis)
        patient_node = cls.sync_patient_profile(diagnosis.patient)

        disease_name = diagnosis.snomed_display or diagnosis.description or diagnosis.code
        disease_node = DiseaseNode.nodes.get_or_none(name=disease_name)
        if not disease_node:
            disease_node = DiseaseNode(
                name=disease_name,
                icd_10=diagnosis.code,
                snomed_id=diagnosis.snomed_code,
            ).save()
        else:
            disease_node.icd_10 = diagnosis.code
            disease_node.snomed_id = diagnosis.snomed_code
            disease_node.save()

        if diagnosis.snomed_code:
            snomed_node = SNOMEDConceptNode.nodes.get_or_none(code=str(diagnosis.snomed_code))
            if not snomed_node:
                snomed_node = SNOMEDConceptNode(
                    code=str(diagnosis.snomed_code),
                    display=disease_name,
                ).save()
            db.cypher_query(
                """
                MATCH (d:DiseaseNode {name: $disease_name}), (s:SNOMEDConceptNode {code: $code})
                MERGE (d)-[:MAPS_TO_SNOMED]->(s)
                """,
                {"disease_name": disease_name, "code": str(diagnosis.snomed_code)},
            )

        if diagnosis.code:
            icd10_node = ICD10ConceptNode.nodes.get_or_none(code=str(diagnosis.code))
            if not icd10_node:
                icd10_node = ICD10ConceptNode(
                    code=str(diagnosis.code),
                    display=diagnosis.description or disease_name,
                ).save()
            db.cypher_query(
                """
                MATCH (d:DiseaseNode {name: $disease_name}), (i:ICD10ConceptNode {code: $code})
                MERGE (d)-[:MAPS_TO_ICD10]->(i)
                """,
                {"disease_name": disease_name, "code": str(diagnosis.code)},
            )

        if not patient_node.diagnoses.is_connected(disease_node):
            patient_node.diagnoses.connect(
                disease_node,
                {"date": timezone.now(), "status": diagnosis.status},
            )

    @classmethod
    def sync_prescription(cls, prescription):
        OntologyService.sync_prescription_ontology(prescription)
        cls.sync_patient_profile(prescription.patient)

        med_node = MedicationNode.nodes.get_or_none(name=prescription.medication)
        if not med_node:
            med_node = MedicationNode(
                name=prescription.medication,
                active_ingredient=prescription.generic_name or prescription.medication,
                rxnorm_code=prescription.rxnorm_code,
            ).save()
        else:
            med_node.active_ingredient = prescription.generic_name or prescription.medication
            med_node.rxnorm_code = prescription.rxnorm_code
            med_node.save()

        if prescription.rxnorm_code:
            rxnorm_node = RxNormConceptNode.nodes.get_or_none(code=str(prescription.rxnorm_code))
            if not rxnorm_node:
                rxnorm_node = RxNormConceptNode(
                    code=str(prescription.rxnorm_code),
                    display=prescription.generic_name or prescription.medication,
                ).save()
            db.cypher_query(
                """
                MATCH (m:MedicationNode {name: $med_name}), (r:RxNormConceptNode {code: $code})
                MERGE (m)-[:MAPS_TO_RXNORM]->(r)
                """,
                {"med_name": prescription.medication, "code": str(prescription.rxnorm_code)},
            )

        db.cypher_query(
            """
            MATCH (p:PatientNode {uid: $uid}), (m:MedicationNode {name: $med_name})
            MERGE (p)-[r:PRESCRIBED]->(m)
            SET r.dosage = $dosage,
                r.route = $route,
                r.frequency = $frequency,
                r.rxnorm_code = $rxnorm_code
            """,
            {
                "uid": str(prescription.patient.id),
                "med_name": prescription.medication,
                "dosage": prescription.dosage,
                "route": prescription.route,
                "frequency": prescription.frequency,
                "rxnorm_code": prescription.rxnorm_code or "",
            },
        )

    @classmethod
    def sync_lab_result(cls, result):
        OntologyService.sync_lab_result_ontology(result)
        patient_node = cls.sync_patient_profile(result.panel.patient)

        lab_node = LabResultNode.nodes.get_or_none(result_uid=str(result.id))
        if not lab_node:
            lab_node = LabResultNode(
                result_uid=str(result.id),
                test_name=result.test_name,
            ).save()

        lab_node.test_code = result.test_code
        lab_node.test_name = result.test_name
        lab_node.value = result.value
        lab_node.unit = result.unit
        lab_node.reference_range = result.reference_range
        lab_node.flag = result.flag or ""
        lab_node.status = result.status
        lab_node.delta = result.delta or ""
        lab_node.comment = result.comment or ""
        lab_node.panel_name = result.panel.name
        lab_node.is_critical = "true" if result.is_critical else "false"
        lab_node.save()

        if result.test_code:
            loinc_node = LOINCConceptNode.nodes.get_or_none(code=str(result.test_code))
            if not loinc_node:
                loinc_node = LOINCConceptNode(
                    code=str(result.test_code),
                    display=result.test_name,
                ).save()
            db.cypher_query(
                """
                MATCH (l:LabResultNode {result_uid: $result_uid}), (c:LOINCConceptNode {code: $code})
                MERGE (l)-[:MAPS_TO_LOINC]->(c)
                """,
                {"result_uid": str(result.id), "code": str(result.test_code)},
            )

        observed_at = result.verified_at or result.analyzed_at or result.created_at
        db.cypher_query(
            """
            MATCH (p:PatientNode {uid: $uid}), (l:LabResultNode {result_uid: $result_uid})
            MERGE (p)-[r:HAS_LAB_RESULT {result_uid: $result_uid}]->(l)
            SET r.observed_at = datetime($observed_at),
                r.status = $status,
                r.panel_name = $panel_name,
                r.flag = $flag
            """,
            {
                "uid": str(result.panel.patient.id),
                "result_uid": str(result.id),
                "observed_at": observed_at.isoformat(),
                "status": result.status,
                "panel_name": result.panel.name,
                "flag": result.flag or "",
            },
        )

    @classmethod
    def sync_radiology_report(cls, report):
        patient_node = cls.sync_patient_profile(report.patient)
        report_node = RadiologyReportNode.nodes.get_or_none(report_uid=str(report.id))
        if not report_node:
            report_node = RadiologyReportNode(report_uid=str(report.id)).save()

        order = report.study.order if getattr(report, "study_id", None) and getattr(report.study, "order_id", None) else None
        report_node.exam_code = getattr(order, "exam_code", "") or ""
        report_node.exam_name = getattr(order, "exam_name", "") or ""
        report_node.modality = getattr(order, "modality", "") or ""
        report_node.findings = report.findings
        report_node.impression = report.impression
        report_node.recommendations = report.recommendations or ""
        report_node.status = report.status
        report_node.save()

        reported_at = report.signed_at or report.updated_at or report.created_at
        db.cypher_query(
            """
            MATCH (p:PatientNode {uid: $uid}), (rpt:RadiologyReportNode {report_uid: $report_uid})
            MERGE (p)-[r:HAS_RAD_REPORT {report_uid: $report_uid}]->(rpt)
            SET r.reported_at = datetime($reported_at),
                r.status = $status,
                r.modality = $modality
            """,
            {
                "uid": str(report.patient.id),
                "report_uid": str(report.id),
                "reported_at": reported_at.isoformat(),
                "status": report.status,
                "modality": getattr(order, "modality", "") or "",
            },
        )

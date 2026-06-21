from __future__ import annotations

from django.utils import timezone
from neomodel import db

from apps.cdss.graph_models import (
    AllergyNode,
    DiseaseNode,
    EncounterNode,
    ICD10ConceptNode,
    ImagingOrderNode,
    LOINCConceptNode,
    LabResultNode,
    MedicationNode,
    PatientNode,
    RadiologyReportNode,
    RxNormConceptNode,
    SNOMEDConceptNode,
    VitalsNode,
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

        raw_allergies = patient.allergies or []
        if isinstance(raw_allergies, str):
            raw_allergies = [s.strip() for s in raw_allergies.split(",") if s.strip()]

        seen_entries = set()
        for entry in raw_allergies:
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

            db.cypher_query(
                """
                MATCH (a:AllergyNode {name: $name})
                MATCH (g:AllergyCrossReactivityGroupNode)
                WHERE g.trigger_substances IS NOT NULL
                  AND any(t IN split(g.trigger_substances, '|') WHERE
                      toLower($name) = toLower(t) OR
                      toLower($name) CONTAINS toLower(t) OR
                      toLower(t) CONTAINS toLower($name))
                MERGE (a)-[:BELONGS_TO_ALLERGEN_GROUP]->(g)
                """,
                {"name": substance},
            )

            patient_node.allergies.connect(
                allergy_node,
                {
                    "reaction": normalized["reaction"],
                    "severity": normalized["severity"],
                    "source_text": normalized["source_text"],
                },
            )

    @staticmethod
    def _populate_vitals_node(node, vitals):
        """Write all scalar fields from a Vitals ORM instance onto a VitalsNode."""
        node.systolic = vitals.systolic
        node.diastolic = vitals.diastolic
        node.heart_rate = vitals.heart_rate
        node.spo2 = vitals.spo2
        node.temperature = float(vitals.temperature) if vitals.temperature is not None else None
        node.respiratory_rate = vitals.respiratory_rate
        node.pain_score = vitals.pain_score
        node.gcs = vitals.gcs
        node.news2_score = vitals.news2_score
        node.recorded_at = vitals.recorded_at
        node.is_admission_vitals = bool(vitals.is_admission_vitals)
        node.notes = (vitals.notes or "")[:500]
        node.save()
        return node

    @classmethod
    def _connect_vitals(cls, patient_node, vitals_node, vitals):
        """Connect patient → vitals node if not already connected."""
        if not patient_node.vitals.is_connected(vitals_node):
            patient_node.vitals.connect(
                vitals_node,
                {
                    "recorded_at": vitals.recorded_at,
                    "is_admission_vitals": bool(vitals.is_admission_vitals),
                },
            )

    @classmethod
    def sync_vitals(cls, vitals):
        """Maintain at most 3 VitalsNodes per patient in Neo4j:

        1. ``admission_{patient_id}``  — baseline; written once on the first
           admission vitals record, never overwritten afterwards.
        2. ``latest_{patient_id}``     — always updated in-place with the most
           recent reading so the CDSS has current values without graph growth.
        3. ``critical_{vitals_id}``    — one node per critical episode
           (NEWS2 ≥ 5); preserved indefinitely for trend analysis.

        Full time-series history is stored in PostgreSQL and displayed via the
        VitalsFlowsheet — Neo4j only needs semantically meaningful snapshots.
        """
        patient_node = cls.ensure_patient_node(vitals.patient)
        patient_uid = str(vitals.patient_id)
        news2 = vitals.news2_score or 0

        if vitals.is_admission_vitals:
            admission_uid = f"admission_{patient_uid}"
            existing = VitalsNode.nodes.get_or_none(vitals_uid=admission_uid)
            if not existing:
                node = VitalsNode(vitals_uid=admission_uid)
                cls._populate_vitals_node(node, vitals)
                cls._connect_vitals(patient_node, node, vitals)

        latest_uid = f"latest_{patient_uid}"
        latest_node = VitalsNode.nodes.get_or_none(vitals_uid=latest_uid)
        if not latest_node:
            latest_node = VitalsNode(vitals_uid=latest_uid)
        cls._populate_vitals_node(latest_node, vitals)
        cls._connect_vitals(patient_node, latest_node, vitals)

        if news2 >= 5:
            critical_uid = f"critical_{vitals.id}"
            if not VitalsNode.nodes.get_or_none(vitals_uid=critical_uid):
                critical_node = VitalsNode(vitals_uid=critical_uid)
                cls._populate_vitals_node(critical_node, vitals)
                cls._connect_vitals(patient_node, critical_node, vitals)

    @classmethod
    def sync_encounter(cls, encounter):
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
        else:
            db.cypher_query(
                """
                MATCH (p:PatientNode {uid: $uid})-[r:DIAGNOSED_WITH]->(d:DiseaseNode {name: $name})
                SET r.status = $status
                """,
                {
                    "uid": str(diagnosis.patient_id),
                    "name": disease_name,
                    "status": diagnosis.status,
                },
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
    def sync_imaging_order(cls, order):
        """Mirror an ImagingOrder to Neo4j so the CDSS has awareness of in-flight
        studies (ordered but not yet reported). Updated on every status change.
        Duplicate-order detection and appropriateness context both benefit."""
        patient_node = cls.sync_patient_profile(order.patient)

        order_node = ImagingOrderNode.nodes.get_or_none(order_uid=str(order.id))
        if not order_node:
            order_node = ImagingOrderNode(order_uid=str(order.id))

        order_node.modality = order.modality or ""
        order_node.exam_code = order.exam_code or ""
        order_node.exam_name = order.exam_name or ""
        order_node.body_part = order.body_part or ""
        order_node.indication = (order.indication or "")[:500]
        order_node.clinical_history = (order.clinical_history or "")[:500]
        order_node.contrast_required = "true" if order.contrast_required else "false"
        order_node.priority = order.priority or "routine"
        order_node.status = order.status or ""
        order_node.accession_number = order.accession_number or ""
        order_node.save()

        ordered_at = order.created_at or timezone.now()
        db.cypher_query(
            """
            MATCH (p:PatientNode {uid: $uid}), (o:ImagingOrderNode {order_uid: $order_uid})
            MERGE (p)-[r:HAS_IMAGING_ORDER {order_uid: $order_uid}]->(o)
            SET r.ordered_at  = datetime($ordered_at),
                r.status      = $status,
                r.modality    = $modality,
                r.priority    = $priority
            """,
            {
                "uid": str(order.patient_id),
                "order_uid": str(order.id),
                "ordered_at": ordered_at.isoformat(),
                "status": order.status or "",
                "modality": order.modality or "",
                "priority": order.priority or "routine",
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

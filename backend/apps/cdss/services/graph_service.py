from neomodel import db
from django.db import models
from django.db.models import Count

from apps.cdss.models import CDSSRecommendation, CDSSSeverity, CDSSSourceModule, CDSSStatus


class GraphService:
    @staticmethod
    def _count_scalar(query: str, params: dict | None = None) -> int:
        results, _ = db.cypher_query(query, params or {})
        if not results:
            return 0
        value = results[0][0]
        return int(value or 0)

    @staticmethod
    def _list_rows(query: str, params: dict | None = None) -> list:
        results, _ = db.cypher_query(query, params or {})
        return results or []

    # ------------------------------------------------------------------
    # Drug safety graph queries (DDI, allergy cross-reactivity, risk groups)
    # ------------------------------------------------------------------
    @staticmethod
    def get_patient_ddi_alerts(patient_uuid: str) -> list[dict]:
        """Return pairwise DDI alerts for a patient's current prescriptions."""
        from apps.cdss.services.drug_knowledge_service import DrugKnowledgeService
        return DrugKnowledgeService.get_patient_ddi_alerts(patient_uuid)

    @staticmethod
    def get_patient_allergy_drug_alerts(patient_uuid: str) -> list[dict]:
        """Return allergen cross-reactivity alerts (allergy → prescribed drug group match)."""
        from apps.cdss.services.drug_knowledge_service import DrugKnowledgeService
        return DrugKnowledgeService.get_patient_allergy_drug_alerts(patient_uuid)

    @staticmethod
    def get_patient_risk_group_alerts(patient_uuid: str) -> list[dict]:
        """Return pharmacological risk-group alerts (e.g. two QT-prolonging drugs prescribed)."""
        from apps.cdss.services.drug_knowledge_service import DrugKnowledgeService
        return DrugKnowledgeService.get_patient_risk_group_alerts(patient_uuid)

    @staticmethod
    def get_drug_knowledge_graph_stats() -> dict:
        """Return counts of drug KG nodes and relationships for dashboards."""
        return {
            "drug_nodes": GraphService._count_scalar("MATCH (m:MedicationNode) RETURN count(m)"),
            "drug_class_nodes": GraphService._count_scalar("MATCH (c:DrugClassNode) RETURN count(c)"),
            "ddi_pairs": GraphService._count_scalar(
                "MATCH ()-[r:INTERACTS_WITH]->() RETURN count(r)"
            ) // 2,  # bi-directional, so halve for unique pairs
            "allergen_groups": GraphService._count_scalar("MATCH (g:AllergyCrossReactivityGroupNode) RETURN count(g)"),
            "risk_groups": GraphService._count_scalar("MATCH (g:DrugInteractionGroupNode) RETURN count(g)"),
        }

    @staticmethod
    def get_patient_structured_snapshot(patient_uuid: str) -> dict:
        query = """
        MATCH (p:PatientNode {uid: $uid})
        OPTIONAL MATCH (p)-[r]-(n)
        RETURN labels(n) AS type, properties(n) AS node_props, type(r) AS rel, properties(r) AS rel_props
        """
        results, _ = db.cypher_query(query, {"uid": str(patient_uuid)})

        snapshot = {
            "patientUid": str(patient_uuid),
            "diagnoses": [],
            "medications": [],
            "symptoms": [],
            "allergies": [],
            "labs": [],
            "radiologyReports": [],
        }

        for node_labels, node_props, rel_type, rel_props in results:
            node_labels = node_labels or []
            node_props = node_props or {}
            rel_props = rel_props or {}

            if not node_labels or not rel_type:
                continue

            if rel_type == "DIAGNOSED_WITH" and "DiseaseNode" in node_labels:
                snapshot["diagnoses"].append(
                    {
                        "name": node_props.get("name"),
                        "status": rel_props.get("status"),
                        "icd10": node_props.get("icd_10"),
                        "snomed": node_props.get("snomed_id"),
                    }
                )
            elif rel_type == "PRESCRIBED" and "MedicationNode" in node_labels:
                snapshot["medications"].append(
                    {
                        "name": node_props.get("name"),
                        "dosage": rel_props.get("dosage"),
                        "route": rel_props.get("route"),
                        "frequency": rel_props.get("frequency"),
                        "rxnorm": node_props.get("rxnorm_code"),
                        "activeIngredient": node_props.get("active_ingredient"),
                    }
                )
            elif rel_type == "HAS_SYMPTOM" and "SymptomNode" in node_labels:
                snapshot["symptoms"].append(
                    {
                        "name": node_props.get("name"),
                        "severity": rel_props.get("severity"),
                        "snomed": node_props.get("snomed_id"),
                    }
                )
            elif rel_type == "HAS_ALLERGY" and "AllergyNode" in node_labels:
                snapshot["allergies"].append(
                    {
                        "substance": node_props.get("name"),
                        "reaction": rel_props.get("reaction"),
                        "severity": rel_props.get("severity"),
                        "sourceText": rel_props.get("source_text"),
                    }
                )
            elif rel_type == "HAS_LAB_RESULT" and "LabResultNode" in node_labels:
                snapshot["labs"].append(
                    {
                        "id": node_props.get("result_uid"),
                        "testName": node_props.get("test_name"),
                        "testCode": node_props.get("test_code"),
                        "value": node_props.get("value"),
                        "unit": node_props.get("unit"),
                        "referenceRange": node_props.get("reference_range"),
                        "flag": node_props.get("flag"),
                        "status": node_props.get("status"),
                        "panelName": node_props.get("panel_name"),
                        "isCritical": node_props.get("is_critical"),
                        "observedAt": rel_props.get("observed_at"),
                    }
                )
            elif rel_type == "HAS_RAD_REPORT" and "RadiologyReportNode" in node_labels:
                snapshot["radiologyReports"].append(
                    {
                        "id": node_props.get("report_uid"),
                        "examCode": node_props.get("exam_code"),
                        "examName": node_props.get("exam_name"),
                        "modality": node_props.get("modality"),
                        "impression": node_props.get("impression"),
                        "recommendations": node_props.get("recommendations"),
                        "status": node_props.get("status"),
                        "reportedAt": rel_props.get("reported_at"),
                    }
                )

        return snapshot

    @staticmethod
    def get_patient_subgraph_context(patient_uuid: str) -> str:
        query = """
        MATCH (p:PatientNode {uid: $uid})
        OPTIONAL MATCH (p)-[r]-(n)
        RETURN labels(n) AS type, n, type(r) AS rel, properties(r) AS rel_props
        """
        results, _ = db.cypher_query(query, {"uid": str(patient_uuid)})

        if not results:
            return "No historical graph context found for this patient."

        context_sentences = []
        for row in results:
            if not row[1]:
                continue

            node_props = row[1]
            rel_type = row[2]
            rel_props = row[3] or {}

            if rel_type == "DIAGNOSED_WITH":
                status = rel_props.get("status", "unknown status")
                name = node_props.get("name", "Unknown Disease")
                icd_10 = node_props.get("icd_10")
                snomed_id = node_props.get("snomed_id")
                coded_bits = [f"Status: {status}"]
                if icd_10:
                    coded_bits.append(f"ICD-10: {icd_10}")
                if snomed_id:
                    coded_bits.append(f"SNOMED CT: {snomed_id}")
                context_sentences.append(f"Patient was diagnosed with {name} ({'; '.join(coded_bits)}).")
            elif rel_type == "HAS_SYMPTOM":
                severity = rel_props.get("severity", "unknown severity")
                name = node_props.get("name", "Unknown Symptom")
                context_sentences.append(f"Patient reported symptom {name} with {severity} severity.")
            elif rel_type == "PRESCRIBED":
                dosage = rel_props.get("dosage", "unknown dosage")
                name = node_props.get("name", "Unknown Medication")
                rxnorm_code = node_props.get("rxnorm_code")
                coded_bits = [dosage]
                if rxnorm_code:
                    coded_bits.append(f"RxNorm: {rxnorm_code}")
                context_sentences.append(f"Patient is currently prescribed {name} ({'; '.join(coded_bits)}).")
            elif rel_type == "HAS_ALLERGY":
                substance = node_props.get("name", "Unknown allergen")
                reaction = rel_props.get("reaction")
                severity = rel_props.get("severity")
                details = [item for item in [reaction, severity] if item]
                if details:
                    context_sentences.append(f"Patient has documented allergy to {substance} ({'; '.join(details)}).")
                else:
                    context_sentences.append(f"Patient has documented allergy to {substance}.")
            elif rel_type == "HAS_LAB_RESULT":
                test_name = node_props.get("test_name", "Unknown Test")
                value = node_props.get("value", "unknown value")
                unit = node_props.get("unit") or ""
                flag = node_props.get("flag")
                loinc = node_props.get("test_code")
                coded_bits = [f"Value: {value}{(' ' + unit) if unit else ''}".strip()]
                if flag:
                    coded_bits.append(f"Flag: {flag}")
                if loinc:
                    coded_bits.append(f"LOINC: {loinc}")
                context_sentences.append(f"Patient has lab result {test_name} ({'; '.join(coded_bits)}).")
            elif rel_type == "HAS_RAD_REPORT":
                exam_name = node_props.get("exam_name") or node_props.get("modality") or "Radiology study"
                impression = node_props.get("impression")
                recommendation = node_props.get("recommendations")
                details = []
                if impression:
                    details.append(f"Impression: {impression}")
                if recommendation:
                    details.append(f"Recommendation: {recommendation}")
                if details:
                    context_sentences.append(f"Patient has radiology report for {exam_name} ({'; '.join(details)}).")
                else:
                    context_sentences.append(f"Patient has radiology report for {exam_name}.")

        if not context_sentences:
            return "Patient exists in the knowledge graph but has no known medical relationships."

        context_sentences.extend(GraphService._get_vitals_context_sentences(patient_uuid))

        return "Knowledge Graph Extract:\n- " + "\n- ".join(dict.fromkeys(context_sentences))

    @staticmethod
    def _get_vitals_context_sentences(patient_uuid: str) -> list[str]:
        """
        Pull the latest vitals from the Django ORM and return them as
        clinical context sentences for LLM injection.
        """
        try:
            from apps.nurses.models import Vitals
            v = (
                Vitals.objects
                .filter(patient_id=patient_uuid)
                .order_by("-recorded_at")
                .first()
            )
            if not v:
                return []
            parts = []
            if v.systolic and v.diastolic:
                parts.append(f"BP {v.systolic}/{v.diastolic} mmHg")
            if v.heart_rate:
                parts.append(f"HR {v.heart_rate} bpm")
            if v.spo2:
                parts.append(f"SpO\u2082 {v.spo2}%")
            if v.temperature:
                parts.append(f"Temp {float(v.temperature):.1f}\u00b0C")
            if v.respiratory_rate:
                parts.append(f"RR {v.respiratory_rate}/min")
            if v.pain_score is not None:
                parts.append(f"Pain {v.pain_score}/10")
            if v.gcs:
                parts.append(f"GCS {v.gcs}/15")
            if v.news2_score is not None:
                parts.append(f"NEWS2 score {v.news2_score}")
            if not parts:
                return []
            label = "Admission baseline vitals" if v.is_admission_vitals else "Latest recorded vitals"
            recorded = v.recorded_at.strftime("%Y-%m-%d %H:%M") if v.recorded_at else "recently"
            return [f"{label} ({recorded}): {', '.join(parts)}."]
        except Exception:
            return []

    @staticmethod
    def get_patient_latest_vitals_dict(patient_uuid: str) -> dict | None:
        """Return the latest vitals as a dict for API / frontend display."""
        try:
            from apps.nurses.models import Vitals
            v = (
                Vitals.objects
                .filter(patient_id=patient_uuid)
                .order_by("-recorded_at")
                .first()
            )
            if not v:
                return None
            return {
                "recordedAt": v.recorded_at.isoformat() if v.recorded_at else None,
                "isAdmissionVitals": v.is_admission_vitals,
                "systolic": v.systolic,
                "diastolic": v.diastolic,
                "heartRate": v.heart_rate,
                "spo2": v.spo2,
                "temperature": float(v.temperature) if v.temperature else None,
                "respiratoryRate": v.respiratory_rate,
                "painScore": v.pain_score,
                "gcs": v.gcs,
                "news2Score": v.news2_score,
                "notes": v.notes,
            }
        except Exception:
            return None

    @staticmethod
    def get_patient_encounter_context(patient_uuid: str, max_encounters: int = 3) -> str:
        """
        Return the most recent SOAP encounters for a patient as a plain-text
        context block suitable for LLM injection.
        """
        query = """
        MATCH (p:PatientNode {uid: $uid})-[r:HAS_ENCOUNTER]->(e:EncounterNode)
        RETURN e.encounter_uid AS uid, e.visit_type AS vtype, e.status AS status,
               e.subjective AS s, e.objective AS o, e.assessment AS a, e.plan AS pl,
               e.doctor_name AS doctor, r.created_at AS created_at
        ORDER BY r.created_at DESC
        LIMIT $limit
        """
        results, _ = db.cypher_query(
            query, {"uid": patient_uuid, "limit": max_encounters}
        )

        if not results:
            return "No encounter notes found in the knowledge graph for this patient."

        lines = ["Recent Encounter Notes (SOAP):"]
        for row in results:
            uid, vtype, status, s, o, a, pl, doctor, created_at = row
            lines.append(f"\n--- Encounter ({vtype or 'visit'}, {status or 'unknown'}) by {doctor or 'physician'} ---")
            if s:
                lines.append(f"  Subjective: {s}")
            if o:
                lines.append(f"  Objective:  {o}")
            if a:
                lines.append(f"  Assessment: {a}")
            if pl:
                lines.append(f"  Plan:       {pl}")

        return "\n".join(lines)


        query = """
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN id(n) as source_id, labels(n)[0] as group, properties(n) as props,
               id(m) as target_id, labels(m)[0] as target_group, properties(m) as target_props, type(r) as label
        """
        results, _ = db.cypher_query(query)

        nodes_map = {}
        links = []

        for row in results:
            src_id, group, props, tgt_id, tgt_group, tgt_props, rel_label = row

            if src_id is not None and src_id not in nodes_map:
                nodes_map[src_id] = {
                    "id": str(src_id),
                    "label": props.get("name", props.get("uid", props.get("result_uid", props.get("report_uid", "Node")))),
                    "group": group,
                }

            if tgt_id is not None and tgt_id not in nodes_map:
                tgt_props = tgt_props or {}
                nodes_map[tgt_id] = {
                    "id": str(tgt_id),
                    "label": tgt_props.get("name", tgt_props.get("uid", tgt_props.get("result_uid", tgt_props.get("report_uid", "Node")))),
                    "group": tgt_group,
                }

            if tgt_id is not None:
                links.append(
                    {
                        "source": str(src_id),
                        "target": str(tgt_id),
                        "label": rel_label,
                    }
                )

        return {"nodes": list(nodes_map.values()), "links": links}

    @staticmethod
    def get_patient_graph_for_visualization(patient_uuid: str):
        query = """
        MATCH (p:PatientNode {uid: $uid})
        OPTIONAL MATCH (p)-[r1]-(n)
        OPTIONAL MATCH (n)-[r2]-(m)
        WHERE m IS NULL OR NOT m:PatientNode
        RETURN
            id(p) as patient_id,
            labels(p)[0] as patient_group,
            properties(p) as patient_props,
            id(n) as neighbor_id,
            labels(n) as neighbor_labels,
            properties(n) as neighbor_props,
            type(r1) as rel1_label,
            id(m) as secondary_id,
            labels(m) as secondary_labels,
            properties(m) as secondary_props,
            type(r2) as rel2_label
        """
        results, _ = db.cypher_query(query, {"uid": str(patient_uuid)})

        if not results:
            return {"nodes": [], "links": []}

        def build_label(group: str, props: dict) -> str:
            if group == "PatientNode":
                return props.get("full_name") or props.get("display_name") or props.get("uid", "Patient")
            if group == "DiseaseNode":
                return props.get("name", "Condition")
            if group == "MedicationNode":
                return props.get("name", "Medication")
            if group == "AllergyNode":
                return props.get("name", "Allergy")
            if group == "LabResultNode":
                test = props.get("test_name", "Lab")
                value = props.get("value")
                unit = props.get("unit")
                if value:
                    suffix = f": {value}{(' ' + unit) if unit else ''}"
                    return f"{test}{suffix}"
                return test
            if group == "RadiologyReportNode":
                return props.get("exam_name") or props.get("modality") or "Radiology Report"
            if group == "SNOMEDConceptNode":
                return f"SNOMED {props.get('code', '')}".strip()
            if group == "ICD10ConceptNode":
                return f"ICD-10 {props.get('code', '')}".strip()
            if group == "RxNormConceptNode":
                return f"RxNorm {props.get('code', '')}".strip()
            if group == "LOINCConceptNode":
                return f"LOINC {props.get('code', '')}".strip()
            return props.get("name", props.get("uid", "Node"))

        nodes_map = {}
        links_map = {}

        for row in results:
            (
                patient_id,
                patient_group,
                patient_props,
                neighbor_id,
                neighbor_labels,
                neighbor_props,
                rel1_label,
                secondary_id,
                secondary_labels,
                secondary_props,
                rel2_label,
            ) = row

            patient_props = patient_props or {}
            if patient_id is not None and patient_id not in nodes_map:
                nodes_map[patient_id] = {
                    "id": str(patient_id),
                    "label": build_label(patient_group, patient_props),
                    "group": patient_group,
                }

            if neighbor_id is not None:
                neighbor_group = (neighbor_labels or ["Node"])[0]
                neighbor_props = neighbor_props or {}
                if neighbor_id not in nodes_map:
                    nodes_map[neighbor_id] = {
                        "id": str(neighbor_id),
                        "label": build_label(neighbor_group, neighbor_props),
                        "group": neighbor_group,
                    }
                if rel1_label:
                    key = (str(patient_id), str(neighbor_id), rel1_label)
                    links_map[key] = {
                        "source": str(patient_id),
                        "target": str(neighbor_id),
                        "label": rel1_label,
                    }

            if secondary_id is not None:
                secondary_group = (secondary_labels or ["Node"])[0]
                secondary_props = secondary_props or {}
                if secondary_id not in nodes_map:
                    nodes_map[secondary_id] = {
                        "id": str(secondary_id),
                        "label": build_label(secondary_group, secondary_props),
                        "group": secondary_group,
                    }
                if neighbor_id is not None and rel2_label:
                    key = (str(neighbor_id), str(secondary_id), rel2_label)
                    links_map[key] = {
                        "source": str(neighbor_id),
                        "target": str(secondary_id),
                        "label": rel2_label,
                    }

        return {"nodes": list(nodes_map.values()), "links": list(links_map.values())}

    @staticmethod
    def get_hospital_graph_for_visualization(limit_per_group: int = 6):
        limit = max(3, min(int(limit_per_group or 6), 12))

        summary = {
            "scope": "hospital",
            "title": "Hospital Clinical Knowledge Graph",
            "patients": GraphService._count_scalar("MATCH (p:PatientNode) RETURN count(p)"),
            "diagnoses": GraphService._count_scalar("MATCH (:PatientNode)-[r:DIAGNOSED_WITH]->(:DiseaseNode) RETURN count(r)"),
            "medications": GraphService._count_scalar("MATCH (:PatientNode)-[r:PRESCRIBED]->(:MedicationNode) RETURN count(r)"),
            "allergies": GraphService._count_scalar("MATCH (:PatientNode)-[r:HAS_ALLERGY]->(:AllergyNode) RETURN count(r)"),
            "labs": GraphService._count_scalar("MATCH (:PatientNode)-[r:HAS_LAB_RESULT]->(:LabResultNode) RETURN count(r)"),
            "radiology": GraphService._count_scalar("MATCH (:PatientNode)-[r:HAS_RAD_REPORT]->(:RadiologyReportNode) RETURN count(r)"),
        }

        nodes = [
            {
                "id": "hospital-root",
                "label": "Virtual Hospital",
                "group": "HospitalNode",
                "details": {
                    "Scope": "All patients",
                    "Patients": summary["patients"],
                    "Diagnosis facts": summary["diagnoses"],
                    "Medication facts": summary["medications"],
                    "Allergy facts": summary["allergies"],
                    "Lab facts": summary["labs"],
                    "Radiology facts": summary["radiology"],
                },
            }
        ]
        links = []

        def add_ranked_nodes(rows, group: str, prefix: str, link_label: str, detail_builder):
            for index, row in enumerate(rows, start=1):
                label, occurrences, details = detail_builder(row)
                node_id = f"{group.lower()}-{index}"
                nodes.append(
                    {
                        "id": node_id,
                        "label": label,
                        "group": group,
                        "details": {
                            "Rank": index,
                            "Occurrences": occurrences,
                            **details,
                        },
                    }
                )
                links.append(
                    {
                        "source": "hospital-root",
                        "target": node_id,
                        "label": prefix,
                    }
                )

        diagnosis_rows = GraphService._list_rows(
            """
            MATCH (:PatientNode)-[:DIAGNOSED_WITH]->(d:DiseaseNode)
            WHERE coalesce(d.name, '') <> ''
            RETURN d.name, count(*) AS occurrences, coalesce(d.icd_10, ''), coalesce(d.snomed_id, '')
            ORDER BY occurrences DESC, d.name ASC
            LIMIT $limit
            """,
            {"limit": limit},
        )
        add_ranked_nodes(
            diagnosis_rows,
            "DiseaseNode",
            "TOP_DIAGNOSIS",
            "TOP_DIAGNOSIS",
            lambda row: (
                f"{row[0]} ({int(row[1])})",
                int(row[1]),
                {
                    "Name": row[0],
                    "ICD-10": row[2] or "Uncoded",
                    "SNOMED CT": row[3] or "Uncoded",
                },
            ),
        )

        medication_rows = GraphService._list_rows(
            """
            MATCH (:PatientNode)-[:PRESCRIBED]->(m:MedicationNode)
            WHERE coalesce(m.name, '') <> ''
            RETURN m.name, count(*) AS occurrences, coalesce(m.active_ingredient, ''), coalesce(m.rxnorm_code, '')
            ORDER BY occurrences DESC, m.name ASC
            LIMIT $limit
            """,
            {"limit": limit},
        )
        add_ranked_nodes(
            medication_rows,
            "MedicationNode",
            "TOP_MEDICATION",
            "TOP_MEDICATION",
            lambda row: (
                f"{row[0]} ({int(row[1])})",
                int(row[1]),
                {
                    "Medication": row[0],
                    "Active ingredient": row[2] or "Unspecified",
                    "RxNorm": row[3] or "Uncoded",
                },
            ),
        )

        allergy_rows = GraphService._list_rows(
            """
            MATCH (:PatientNode)-[:HAS_ALLERGY]->(a:AllergyNode)
            WHERE coalesce(a.name, '') <> ''
            RETURN a.name, count(*) AS occurrences
            ORDER BY occurrences DESC, a.name ASC
            LIMIT $limit
            """,
            {"limit": limit},
        )
        add_ranked_nodes(
            allergy_rows,
            "AllergyNode",
            "TOP_ALLERGY",
            "TOP_ALLERGY",
            lambda row: (
                f"{row[0]} ({int(row[1])})",
                int(row[1]),
                {"Allergen": row[0]},
            ),
        )

        lab_rows = GraphService._list_rows(
            """
            MATCH (:PatientNode)-[:HAS_LAB_RESULT]->(l:LabResultNode)
            WHERE coalesce(l.test_name, '') <> ''
            WITH
                l.test_name AS test_name,
                count(*) AS occurrences,
                sum(
                    CASE
                        WHEN coalesce(l.is_critical, false) = true
                             OR toLower(coalesce(l.flag, '')) IN ['critical', 'high', 'low', 'abnormal']
                        THEN 1
                        ELSE 0
                    END
                ) AS flagged_count
            RETURN test_name, occurrences, flagged_count
            ORDER BY flagged_count DESC, occurrences DESC, test_name ASC
            LIMIT $limit
            """,
            {"limit": limit},
        )
        add_ranked_nodes(
            lab_rows,
            "LabResultNode",
            "TOP_LAB_SIGNAL",
            "TOP_LAB_SIGNAL",
            lambda row: (
                f"{row[0]} ({int(row[2])} flagged)",
                int(row[1]),
                {
                    "Test": row[0],
                    "Flagged results": int(row[2]),
                    "Total results": int(row[1]),
                },
            ),
        )

        radiology_rows = GraphService._list_rows(
            """
            MATCH (:PatientNode)-[:HAS_RAD_REPORT]->(r:RadiologyReportNode)
            WITH
                coalesce(r.exam_name, r.modality, 'Radiology Study') AS exam_name,
                count(*) AS occurrences,
                sum(
                    CASE
                        WHEN toLower(coalesce(r.status, '')) IN ['critical', 'urgent', 'abnormal']
                        THEN 1
                        ELSE 0
                    END
                ) AS urgent_count
            RETURN exam_name, occurrences, urgent_count
            ORDER BY urgent_count DESC, occurrences DESC, exam_name ASC
            LIMIT $limit
            """,
            {"limit": limit},
        )
        add_ranked_nodes(
            radiology_rows,
            "RadiologyReportNode",
            "TOP_RAD_SIGNAL",
            "TOP_RAD_SIGNAL",
            lambda row: (
                f"{row[0]} ({int(row[2])} urgent)",
                int(row[1]),
                {
                    "Exam": row[0],
                    "Urgent reports": int(row[2]),
                    "Total reports": int(row[1]),
                },
            ),
        )

        return {
            "scope": "hospital",
            "summary": summary,
            "nodes": nodes,
            "links": links,
        }

    @staticmethod
    def get_hospital_cdss_summary(top_limit: int = 5):
        limit = max(3, min(int(top_limit or 5), 10))
        graph_summary = GraphService.get_hospital_graph_for_visualization(limit_per_group=limit)

        active_recommendations = CDSSRecommendation.objects.filter(status=CDSSStatus.ACTIVE)

        recommendations_by_module = {
            row["source_module"]: {
                "module": row["source_module"],
                "active": row["active"],
                "critical": row["critical"],
                "warning": row["warning"],
                "info": row["info"],
            }
            for row in active_recommendations.values("source_module").annotate(
                active=Count("id"),
                critical=Count("id", filter=models.Q(severity=CDSSSeverity.CRITICAL)),
                warning=Count("id", filter=models.Q(severity=CDSSSeverity.WARNING)),
                info=Count("id", filter=models.Q(severity=CDSSSeverity.INFO)),
            )
        }

        module_cards = []
        for module_value, module_label in CDSSSourceModule.choices:
            counts = recommendations_by_module.get(
                module_value,
                {
                    "module": module_value,
                    "active": 0,
                    "critical": 0,
                    "warning": 0,
                    "info": 0,
                },
            )
            module_cards.append(
                {
                    "module": module_value,
                    "label": module_label,
                    **counts,
                }
            )

        top_recommendation_types = list(
            active_recommendations.values("type").annotate(total=Count("id")).order_by("-total", "type")[:limit]
        )

        hotspot_patients = list(
            active_recommendations.values("patient_id", "patient__first_name", "patient__last_name", "patient__mrn")
            .annotate(
                total=Count("id"),
                critical=Count("id", filter=models.Q(severity=CDSSSeverity.CRITICAL)),
            )
            .order_by("-critical", "-total", "patient__last_name")[:limit]
        )

        top_graph_signals = []
        for node in graph_summary["nodes"]:
            if node["id"] == "hospital-root":
                continue
            details = node.get("details") or {}
            top_graph_signals.append(
                {
                    "label": node["label"],
                    "group": node["group"],
                    "occurrences": details.get("Occurrences", 0),
                    "rank": details.get("Rank", 0),
                }
            )
        top_graph_signals.sort(key=lambda item: (-int(item["occurrences"]), int(item["rank"])))

        return {
            "graphSummary": graph_summary["summary"],
            "recommendationSummary": {
                "active": active_recommendations.count(),
                "critical": active_recommendations.filter(severity=CDSSSeverity.CRITICAL).count(),
                "warning": active_recommendations.filter(severity=CDSSSeverity.WARNING).count(),
                "info": active_recommendations.filter(severity=CDSSSeverity.INFO).count(),
            },
            "moduleCards": module_cards,
            "topRecommendationTypes": top_recommendation_types,
            "topGraphSignals": top_graph_signals[:limit * 2],
            "hotspotPatients": [
                {
                    "patientId": str(row["patient_id"]),
                    "patientName": f"{row['patient__first_name']} {row['patient__last_name']}".strip() or "Unknown Patient",
                    "patientMRN": row["patient__mrn"] or "",
                    "active": row["total"],
                    "critical": row["critical"],
                }
                for row in hotspot_patients
            ],
        }

    @staticmethod
    def get_patient_module_graph_summary(patient_uuid: str, module: str) -> dict:
        snapshot = GraphService.get_patient_structured_snapshot(patient_uuid)
        module_key = (module or "").strip().lower()

        diagnoses = snapshot.get("diagnoses", [])
        medications = snapshot.get("medications", [])
        allergies = snapshot.get("allergies", [])
        labs = snapshot.get("labs", [])
        radiology_reports = snapshot.get("radiologyReports", [])

        def named(items: list[dict], key: str, fallback: str) -> list[str]:
            values = []
            for item in items:
                value = item.get(key)
                if value:
                    values.append(str(value))
            return values or [fallback]

        def format_diagnosis(item: dict) -> str:
            coded = []
            if item.get("icd10"):
                coded.append(f"ICD-10 {item['icd10']}")
            if item.get("snomed"):
                coded.append(f"SNOMED {item['snomed']}")
            suffix = f" [{', '.join(coded)}]" if coded else ""
            return f"{item.get('name', 'Diagnosis')}{suffix}"

        def format_medication(item: dict) -> str:
            details = []
            if item.get("dosage"):
                details.append(str(item["dosage"]))
            if item.get("route"):
                details.append(f"route {item['route']}")
            if item.get("frequency"):
                details.append(f"frequency {item['frequency']}")
            if item.get("activeIngredient"):
                details.append(f"ingredient {item['activeIngredient']}")
            if item.get("rxnorm"):
                details.append(f"RxNorm {item['rxnorm']}")
            suffix = f" ({'; '.join(details)})" if details else ""
            return f"{item.get('name', 'Medication')}{suffix}"

        def format_lab(item: dict) -> str:
            core = f"{item.get('testName', 'Lab')}: {item.get('value', 'n/a')}{(' ' + str(item.get('unit'))) if item.get('unit') else ''}".strip()
            extras = []
            if item.get("testCode"):
                extras.append(f"LOINC {item['testCode']}")
            if item.get("flag"):
                extras.append(str(item["flag"]))
            suffix = f" [{', '.join(extras)}]" if extras else ""
            return f"{core}{suffix}"

        def format_radiology(item: dict) -> str:
            label = item.get("examName") or item.get("modality") or "Radiology"
            extras = []
            if item.get("modality"):
                extras.append(str(item["modality"]))
            if item.get("examCode"):
                extras.append(f"Code {item['examCode']}")
            if item.get("impression"):
                extras.append(str(item["impression"]))
            suffix = f" [{'; '.join(extras)}]" if extras else ""
            return f"{label}{suffix}"

        base = {
            "patientId": snapshot.get("patientUid"),
            "module": module_key,
            "counts": {
                "diagnoses": len(diagnoses),
                "medications": len(medications),
                "allergies": len(allergies),
                "labs": len(labs),
                "radiology": len(radiology_reports),
            },
        }

        if module_key == "doctor":
            return {
                **base,
                "title": "Clinical problem graph",
                "summary": "Problem list, medications, labs, and imaging context connected around the patient.",
                "sections": [
                    {"label": "Diagnoses", "items": [format_diagnosis(item) for item in diagnoses] or ["No diagnoses linked yet"]},
                    {"label": "Medications", "items": [format_medication(item) for item in medications] or ["No active medications linked yet"]},
                    {"label": "Labs", "items": [format_lab(item) for item in labs[:4]] or ["No labs linked yet"]},
                    {"label": "Imaging", "items": [format_radiology(item) for item in radiology_reports[:4]] or ["No radiology linked yet"]},
                ],
            }

        if module_key == "pharmacy":
            return {
                **base,
                "title": "Medication safety graph",
                "summary": "Drug list connected to allergies, renal labs, and coded medication concepts.",
                "sections": [
                    {"label": "Active medications", "items": [format_medication(item) for item in medications] or ["No active medications linked yet"]},
                    {"label": "Allergies", "items": [f"{item.get('substance')} ({item.get('reaction') or 'reaction not recorded'})" for item in allergies] or ["No allergies linked yet"]},
                    {"label": "Renal and safety labs", "items": [format_lab(item) for item in labs if str(item.get('testName') or '').lower() in {'egfr', 'creatinine', 'potassium', 'inr'}][:4] or ["No renal safety labs linked yet"]},
                ],
            }

        if module_key == "lab":
            return {
                **base,
                "title": "Laboratory signal graph",
                "summary": "Result patterns, critical flags, and disease context connected to the patient.",
                "sections": [
                    {"label": "Recent lab results", "items": [format_lab(item) for item in labs[:6]] or ["No lab results linked yet"]},
                    {"label": "Critical or flagged", "items": [f"{format_lab(item)}; delta {item.get('delta') or item.get('delta_flag')}" for item in labs if item.get('isCritical') or item.get('flag')][:4] or ["No flagged lab signals linked yet"]},
                    {"label": "Relevant diagnoses", "items": [format_diagnosis(item) for item in diagnoses] or ["No diagnoses linked yet"]},
                ],
            }

        if module_key == "radiology":
            return {
                **base,
                "title": "Imaging follow-up graph",
                "summary": "Imaging findings, recommendations, and linked clinical context around the patient.",
                "sections": [
                    {"label": "Radiology reports", "items": [format_radiology(item) for item in radiology_reports[:4]] or ["No radiology reports linked yet"]},
                    {"label": "Follow-up notes", "items": [f"{item.get('examName') or item.get('modality')}: {item.get('recommendations')}" for item in radiology_reports if item.get('recommendations')][:4] or ["No follow-up recommendations linked yet"]},
                    {"label": "Clinical context", "items": [format_diagnosis(item) for item in diagnoses] or ["No linked diagnosis context yet"]},
                ],
            }

        if module_key == "nursing":
            return {
                **base,
                "title": "Bedside deterioration graph",
                "summary": "Patient conditions, medications, labs, and tasks that matter for bedside escalation.",
                "sections": [
                    {"label": "Conditions", "items": [format_diagnosis(item) for item in diagnoses] or ["No diagnoses linked yet"]},
                    {"label": "Bedside-relevant medications", "items": [format_medication(item) for item in medications[:4]] or ["No medications linked yet"]},
                    {"label": "Recent labs", "items": [format_lab(item) for item in labs[:4]] or ["No labs linked yet"]},
                ],
            }

        return {
            **base,
            "title": "Patient knowledge graph",
            "summary": "Connected patient data extracted from the EHR into Neo4j.",
            "sections": [
                {"label": "Diagnoses", "items": named(diagnoses, "name", "No diagnoses linked yet")},
                {"label": "Medications", "items": named(medications, "name", "No medications linked yet")},
                {"label": "Labs", "items": named(labs, "testName", "No labs linked yet")},
                {"label": "Radiology", "items": named(radiology_reports, "examName", "No radiology linked yet")},
            ],
        }

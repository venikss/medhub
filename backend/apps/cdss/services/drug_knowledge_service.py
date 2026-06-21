"""
DrugKnowledgeService
====================
Loads the standardized drug catalog from data/drug_catalog.py into the Neo4j
knowledge graph.

Nodes created / updated:
  - DrugClassNode           – pharmacological classes
  - MedicationNode          – individual drugs (enriched with ATC, class, OTC etc.)
  - DrugInteractionGroupNode – pharmacological risk groups (QT, serotonin, etc.)
  - AllergyCrossReactivityGroupNode – allergen cross-reactivity groups

Relationships created:
  - (:MedicationNode)-[:INTERACTS_WITH]->(:MedicationNode)
  - (:MedicationNode)-[:BELONGS_TO_CLASS]->(:DrugClassNode)
  - (:MedicationNode)-[:MEMBER_OF_RISK_GROUP]->(:DrugInteractionGroupNode)
  - (:MedicationNode)-[:MEMBER_OF_ALLERGEN_GROUP]->(:AllergyCrossReactivityGroupNode)
  - (:DrugClassNode)-[:CLASS_CROSS_REACTS_WITH]->(:DrugClassNode)
  - (:AllergyCrossReactivityGroupNode)-[:ALLERGEN_CROSS_REACTS_WITH]->(:AllergyCrossReactivityGroupNode)
"""
from __future__ import annotations

import logging

from neomodel import db

from apps.cdss.graph_models import (
    AllergyCrossReactivityGroupNode,
    DrugClassNode,
    DrugInteractionGroupNode,
    MedicationNode,
)

logger = logging.getLogger(__name__)

class DrugKnowledgeService:
    @staticmethod
    def ensure_drug_class(name: str, description: str = "", mechanism_of_action: str = "") -> DrugClassNode:
        node = DrugClassNode.nodes.get_or_none(name=name)
        if node:
            changed = False
            if description and node.description != description:
                node.description = description
                changed = True
            if mechanism_of_action and node.mechanism_of_action != mechanism_of_action:
                node.mechanism_of_action = mechanism_of_action
                changed = True
            if changed:
                node.save()
        else:
            node = DrugClassNode(
                name=name,
                description=description,
                mechanism_of_action=mechanism_of_action,
            ).save()
        return node

    @classmethod
    def load_drug_classes(cls, drug_classes: list[dict]) -> dict[str, DrugClassNode]:
        class_map: dict[str, DrugClassNode] = {}
        for entry in drug_classes:
            node = cls.ensure_drug_class(
                name=entry["name"],
                description=entry.get("description", ""),
                mechanism_of_action=entry.get("mechanism_of_action", ""),
            )
            class_map[entry["name"]] = node
        logger.info("Loaded %d drug classes into Neo4j.", len(class_map))
        return class_map

    @staticmethod
    def ensure_drug(entry: dict) -> MedicationNode:
        name = entry["name"]
        node = MedicationNode.nodes.get_or_none(name=name)
        fields = {
            "active_ingredient": entry.get("active_ingredient", ""),
            "rxnorm_code": entry.get("rxnorm_code", ""),
            "drug_class": entry.get("drug_class", ""),
            "atc_code": entry.get("atc_code", ""),
            "brand_names": entry.get("brand_names", ""),
            "is_otc": entry.get("is_otc", False),
            "route": entry.get("route", ""),
        }
        if node:
            changed = False
            for attr, val in fields.items():
                if val is not None and getattr(node, attr) != val:
                    setattr(node, attr, val)
                    changed = True
            if changed:
                node.save()
        else:
            node = MedicationNode(name=name, **fields).save()
        return node

    @classmethod
    def load_drugs(cls, drugs: list[dict], class_map: dict[str, DrugClassNode]) -> dict[str, MedicationNode]:
        drug_map: dict[str, MedicationNode] = {}
        for entry in drugs:
            node = cls.ensure_drug(entry)
            drug_map[entry["name"]] = node

            drug_class_name = entry.get("drug_class")
            if drug_class_name and drug_class_name in class_map:
                class_node = class_map[drug_class_name]
                if not node.drug_classes.is_connected(class_node):
                    node.drug_classes.connect(class_node)

        logger.info("Loaded %d drugs into Neo4j.", len(drug_map))
        return drug_map

    @classmethod
    def load_ddi_pairs(cls, ddi_pairs: list[dict], drug_map: dict[str, MedicationNode]) -> int:
        loaded = 0
        for pair in ddi_pairs:
            drug_a_name = pair["drug_a"]
            drug_b_name = pair["drug_b"]

            node_a = drug_map.get(drug_a_name) or MedicationNode.nodes.get_or_none(name=drug_a_name)
            node_b = drug_map.get(drug_b_name) or MedicationNode.nodes.get_or_none(name=drug_b_name)

            if not node_a or not node_b:
                logger.warning("DDI pair skipped — missing node: %s <-> %s", drug_a_name, drug_b_name)
                continue

            rel_props = {
                "severity": pair.get("severity", "moderate"),
                "mechanism": pair.get("mechanism", ""),
                "description": pair.get("description", ""),
                "management": pair.get("management", ""),
                "evidence_level": pair.get("evidence_level", "C"),
                "reference_source": pair.get("reference_source", ""),
            }

            db.cypher_query(
                """
                MATCH (a:MedicationNode {name: $a}), (b:MedicationNode {name: $b})
                MERGE (a)-[r:INTERACTS_WITH]->(b)
                SET r.severity = $severity,
                    r.mechanism = $mechanism,
                    r.description = $description,
                    r.management = $management,
                    r.evidence_level = $evidence_level,
                    r.reference_source = $reference_source
                """,
                {
                    "a": drug_a_name,
                    "b": drug_b_name,
                    **rel_props,
                },
            )
            db.cypher_query(
                """
                MATCH (a:MedicationNode {name: $a}), (b:MedicationNode {name: $b})
                MERGE (b)-[r:INTERACTS_WITH]->(a)
                SET r.severity = $severity,
                    r.mechanism = $mechanism,
                    r.description = $description,
                    r.management = $management,
                    r.evidence_level = $evidence_level,
                    r.reference_source = $reference_source
                """,
                {
                    "a": drug_a_name,
                    "b": drug_b_name,
                    **rel_props,
                },
            )
            loaded += 1

        logger.info("Loaded %d DDI pairs into Neo4j.", loaded)
        return loaded

    @classmethod
    def load_interaction_groups(
        cls, groups: list[dict], drug_map: dict[str, MedicationNode]
    ) -> dict[str, DrugInteractionGroupNode]:
        group_map: dict[str, DrugInteractionGroupNode] = {}
        for entry in groups:
            node = DrugInteractionGroupNode.nodes.get_or_none(name=entry["name"])
            if not node:
                node = DrugInteractionGroupNode(
                    name=entry["name"],
                    description=entry.get("description", ""),
                    severity=entry.get("severity", "moderate"),
                    mechanism=entry.get("mechanism", ""),
                    management=entry.get("management", ""),
                    interaction_type=entry.get("interaction_type", "within_group"),
                ).save()
            else:
                changed = False
                for field in ("description", "severity", "mechanism", "management", "interaction_type"):
                    val = entry.get(field)
                    if val and getattr(node, field) != val:
                        setattr(node, field, val)
                        changed = True
                if changed:
                    node.save()

            group_map[entry["name"]] = node

            for member_name in entry.get("members", []):
                med_node = drug_map.get(member_name) or MedicationNode.nodes.get_or_none(name=member_name)
                if med_node:
                    db.cypher_query(
                        """
                        MATCH (m:MedicationNode {name: $med}), (g:DrugInteractionGroupNode {name: $grp})
                        MERGE (m)-[:MEMBER_OF_RISK_GROUP]->(g)
                        """,
                        {"med": member_name, "grp": entry["name"]},
                    )

        logger.info("Loaded %d drug interaction groups.", len(group_map))
        return group_map

    @classmethod
    def load_allergen_groups(
        cls, allergen_groups: list[dict], drug_map: dict[str, MedicationNode]
    ) -> dict[str, AllergyCrossReactivityGroupNode]:
        group_map: dict[str, AllergyCrossReactivityGroupNode] = {}
        for entry in allergen_groups:
            triggers_str = "|".join(entry.get("trigger_substances", []))
            node = AllergyCrossReactivityGroupNode.nodes.get_or_none(name=entry["name"])
            if not node:
                node = AllergyCrossReactivityGroupNode(
                    name=entry["name"],
                    description=entry.get("description", ""),
                    reaction_types=entry.get("reaction_types", ""),
                    includes_classes=entry.get("includes_classes", ""),
                    trigger_substances=triggers_str,
                ).save()
            else:
                changed = False
                for field in ("description", "reaction_types", "includes_classes"):
                    val = entry.get(field)
                    if val and getattr(node, field) != val:
                        setattr(node, field, val)
                        changed = True
                if triggers_str and node.trigger_substances != triggers_str:
                    node.trigger_substances = triggers_str
                    changed = True
                if changed:
                    node.save()

            group_map[entry["name"]] = node

            for member_name in entry.get("members", []):
                med_node = drug_map.get(member_name) or MedicationNode.nodes.get_or_none(name=member_name)
                if med_node:
                    db.cypher_query(
                        """
                        MATCH (m:MedicationNode {name: $med}), (g:AllergyCrossReactivityGroupNode {name: $grp})
                        MERGE (m)-[:MEMBER_OF_ALLERGEN_GROUP]->(g)
                        """,
                        {"med": member_name, "grp": entry["name"]},
                    )

        for entry in allergen_groups:
            source_name = entry["name"]
            source_node = group_map.get(source_name)
            if not source_node:
                continue
            for target_name in entry.get("cross_reacts_with", []):
                target_node = group_map.get(target_name) or AllergyCrossReactivityGroupNode.nodes.get_or_none(name=target_name)
                if target_node:
                    db.cypher_query(
                        """
                        MATCH (a:AllergyCrossReactivityGroupNode {name: $src}),
                              (b:AllergyCrossReactivityGroupNode {name: $tgt})
                        MERGE (a)-[:ALLERGEN_CROSS_REACTS_WITH]->(b)
                        MERGE (b)-[:ALLERGEN_CROSS_REACTS_WITH]->(a)
                        """,
                        {"src": source_name, "tgt": target_name},
                    )

        for entry in allergen_groups:
            triggers = entry.get("trigger_substances", [])
            if not triggers:
                continue
            all_triggers = list(set(triggers + entry.get("members", [])))
            db.cypher_query(
                """
                MATCH (a:AllergyNode)
                WHERE any(t IN $triggers WHERE
                    toLower(a.name) = toLower(t) OR
                    toLower(a.name) CONTAINS toLower(t) OR
                    toLower(t) CONTAINS toLower(a.name))
                MATCH (g:AllergyCrossReactivityGroupNode {name: $grp})
                MERGE (a)-[:BELONGS_TO_ALLERGEN_GROUP]->(g)
                """,
                {"triggers": all_triggers, "grp": entry["name"]},
            )

        logger.info("Loaded %d allergen cross-reactivity groups.", len(group_map))
        return group_map

    @staticmethod
    def get_patient_ddi_alerts(patient_uuid: str) -> list[dict]:
        """
        Return all drug-drug interaction alerts for medications currently
        prescribed to the patient. Queries directly on the graph.
        """
        query = """
        MATCH (p:PatientNode {uid: $uid})-[:PRESCRIBED]->(m1:MedicationNode)
        MATCH (p)-[:PRESCRIBED]->(m2:MedicationNode)
        WHERE id(m1) < id(m2)
        MATCH (m1)-[r:INTERACTS_WITH]->(m2)
        RETURN
            m1.name AS drug_a,
            m2.name AS drug_b,
            r.severity AS severity,
            r.mechanism AS mechanism,
            r.description AS description,
            r.management AS management,
            r.evidence_level AS evidence_level,
            r.reference_source AS reference_source
        ORDER BY
            CASE r.severity
                WHEN 'contraindicated' THEN 1
                WHEN 'major' THEN 2
                WHEN 'moderate' THEN 3
                ELSE 4
            END
        """
        results, _ = db.cypher_query(query, {"uid": str(patient_uuid)})
        return [
            {
                "drug_a": row[0],
                "drug_b": row[1],
                "severity": row[2],
                "mechanism": row[3],
                "description": row[4],
                "management": row[5],
                "evidence_level": row[6],
                "reference_source": row[7],
            }
            for row in results
        ]

    @staticmethod
    def get_patient_allergy_drug_alerts(patient_uuid: str) -> list[dict]:
        """
        Return alerts for prescribed medications that belong to an allergen
        group containing a substance to which the patient is allergic.
        """
        query = """
        MATCH (p:PatientNode {uid: $uid})-[:HAS_ALLERGY]->(a:AllergyNode)
        MATCH (a)-[:BELONGS_TO_ALLERGEN_GROUP]->(g:AllergyCrossReactivityGroupNode)
        MATCH (m:MedicationNode)-[:MEMBER_OF_ALLERGEN_GROUP]->(g)
        MATCH (p)-[:PRESCRIBED]->(m)
        RETURN
            a.name AS allergen,
            g.name AS allergen_group,
            m.name AS medication,
            g.description AS group_description,
            g.reaction_types AS reaction_types
        """
        results, _ = db.cypher_query(query, {"uid": str(patient_uuid)})
        return [
            {
                "allergen": row[0],
                "allergen_group": row[1],
                "prescribed_medication": row[2],
                "description": row[3],
                "reaction_types": row[4],
            }
            for row in results
        ]

    @staticmethod
    def get_patient_risk_group_alerts(patient_uuid: str) -> list[dict]:
        """
        Return pharmacological risk-group alerts — when a patient is prescribed
        two or more drugs from the same interaction risk group (e.g. QT-prolongers).
        """
        query = """
        MATCH (p:PatientNode {uid: $uid})-[:PRESCRIBED]->(m1:MedicationNode)
        MATCH (p)-[:PRESCRIBED]->(m2:MedicationNode)
        WHERE id(m1) < id(m2)
        MATCH (m1)-[:MEMBER_OF_RISK_GROUP]->(g:DrugInteractionGroupNode)
        MATCH (m2)-[:MEMBER_OF_RISK_GROUP]->(g)
        RETURN
            g.name AS interaction_group,
            g.severity AS severity,
            g.description AS description,
            g.management AS management,
            collect(DISTINCT m1.name) + collect(DISTINCT m2.name) AS involved_drugs
        ORDER BY
            CASE g.severity
                WHEN 'contraindicated' THEN 1
                WHEN 'major' THEN 2
                ELSE 3
            END
        """
        results, _ = db.cypher_query(query, {"uid": str(patient_uuid)})
        return [
            {
                "interaction_group": row[0],
                "severity": row[1],
                "description": row[2],
                "management": row[3],
                "involved_drugs": list(set(row[4])),
            }
            for row in results
        ]

    @staticmethod
    def get_full_patient_drug_safety_context(patient_uuid: str) -> str:
        """
        Returns a structured text block suitable for injection into an LLM
        prompt. Summarises all DDI, allergy, and risk group alerts.
        """
        ddi = DrugKnowledgeService.get_patient_ddi_alerts(patient_uuid)
        allergy = DrugKnowledgeService.get_patient_allergy_drug_alerts(patient_uuid)
        risk_groups = DrugKnowledgeService.get_patient_risk_group_alerts(patient_uuid)

        lines: list[str] = ["Drug Safety Knowledge Graph Context:"]

        if ddi:
            lines.append("\n[Drug-Drug Interactions]")
            for alert in ddi:
                lines.append(
                    f"- {alert['drug_a']} + {alert['drug_b']}: "
                    f"[{alert['severity'].upper()}] {alert['description']} "
                    f"| Management: {alert['management']} "
                    f"(Evidence: {alert['evidence_level']}, Source: {alert['reference_source']})"
                )
        else:
            lines.append("\n[Drug-Drug Interactions] No known DDIs detected for current prescription list.")

        if allergy:
            lines.append("\n[Drug-Allergy Cross-Reactivity Alerts]")
            for alert in allergy:
                lines.append(
                    f"- Patient is allergic to {alert['allergen']} "
                    f"(group: {alert['allergen_group']}) and is prescribed "
                    f"{alert['prescribed_medication']} from the same allergen group. "
                    f"Possible reactions: {alert['reaction_types']}"
                )
        else:
            lines.append("\n[Drug-Allergy Alerts] No allergy-drug cross-reactivity alerts detected.")

        if risk_groups:
            lines.append("\n[Pharmacological Risk Group Alerts]")
            for alert in risk_groups:
                drugs = ", ".join(alert["involved_drugs"])
                lines.append(
                    f"- {alert['interaction_group']} [{alert['severity'].upper()}]: "
                    f"Patient is prescribed {drugs}. {alert['description']} "
                    f"| Management: {alert['management']}"
                )
        else:
            lines.append("\n[Risk Group Alerts] No pharmacological risk group alerts detected.")

        return "\n".join(lines)

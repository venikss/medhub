"""
Management command: load_drug_knowledge_graph

Loads the complete standardized drug knowledge base into Neo4j, including:
  - Pharmacological drug classes
  - Individual drugs with ATC, RxNorm, and route information
  - Drug–Drug Interaction (DDI) pairs with severity and management guidance
  - Pharmacological risk groups (e.g. QT-prolonging, serotonergic, CNS depressants)
  - Allergen cross-reactivity groups (e.g. beta-lactams, NSAIDs, fluoroquinolones)

Usage:
    python manage.py load_drug_knowledge_graph
    python manage.py load_drug_knowledge_graph --skip-ddi
"""
from django.core.management.base import BaseCommand
from neomodel import db

from apps.cdss.data.drug_catalog import (
    ALLERGEN_GROUPS,
    DDI_PAIRS,
    DRUG_CLASSES,
    DRUGS,
    INTERACTION_GROUPS,
)
from apps.cdss.services.drug_knowledge_service import DrugKnowledgeService


class Command(BaseCommand):
    help = "Load the standardized drug knowledge graph (DDI, allergen groups, risk groups) into Neo4j"

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-ddi",
            action="store_true",
            default=False,
            help="Skip loading drug-drug interaction pairs",
        )

    def handle(self, *args, **options):
        skip_ddi = options["skip_ddi"]

        self.stdout.write(self.style.NOTICE("=" * 60))
        self.stdout.write(self.style.NOTICE("Loading Drug Knowledge Graph into Neo4j..."))
        self.stdout.write(self.style.NOTICE("=" * 60))

        # 1. Drug classes
        self.stdout.write("\nStep 1/5 — Loading pharmacological drug classes...")
        with db.transaction:
            class_map = DrugKnowledgeService.load_drug_classes(DRUG_CLASSES)
        self.stdout.write(self.style.SUCCESS(f"  ✓ {len(class_map)} drug classes loaded."))

        # 2. Individual drugs
        self.stdout.write("\nStep 2/5 — Loading individual drugs...")
        with db.transaction:
            drug_map = DrugKnowledgeService.load_drugs(DRUGS, class_map)
        self.stdout.write(self.style.SUCCESS(f"  ✓ {len(drug_map)} drugs loaded."))

        # 3. DDI pairs
        if skip_ddi:
            self.stdout.write(self.style.WARNING("\nStep 3/5 — Skipping DDI pairs (--skip-ddi flag)."))
            ddi_count = 0
        else:
            self.stdout.write(f"\nStep 3/5 — Loading {len(DDI_PAIRS)} DDI pairs...")
            with db.transaction:
                ddi_count = DrugKnowledgeService.load_ddi_pairs(DDI_PAIRS, drug_map)
            self.stdout.write(self.style.SUCCESS(f"  ✓ {ddi_count} DDI pairs loaded (bi-directional edges in Neo4j)."))

        # 4. Pharmacological risk groups
        self.stdout.write(f"\nStep 4/5 — Loading {len(INTERACTION_GROUPS)} pharmacological risk groups...")
        with db.transaction:
            group_map = DrugKnowledgeService.load_interaction_groups(INTERACTION_GROUPS, drug_map)
        self.stdout.write(self.style.SUCCESS(f"  ✓ {len(group_map)} interaction groups loaded."))

        # 5. Allergen cross-reactivity groups
        self.stdout.write(f"\nStep 5/5 — Loading {len(ALLERGEN_GROUPS)} allergen cross-reactivity groups...")
        with db.transaction:
            allergen_map = DrugKnowledgeService.load_allergen_groups(ALLERGEN_GROUPS, drug_map)
        self.stdout.write(self.style.SUCCESS(f"  ✓ {len(allergen_map)} allergen groups loaded."))

        # Summary
        self.stdout.write(self.style.NOTICE("\n" + "=" * 60))
        self.stdout.write(self.style.SUCCESS("Drug Knowledge Graph load complete!"))
        self.stdout.write(self.style.NOTICE("=" * 60))
        self.stdout.write(
            f"\n  Drug classes:         {len(class_map)}\n"
            f"  Drugs (nodes):        {len(drug_map)}\n"
            f"  DDI pairs:            {ddi_count} ({ddi_count * 2} directed edges)\n"
            f"  Risk groups:          {len(group_map)}\n"
            f"  Allergen groups:      {len(allergen_map)}\n"
        )
        self.stdout.write(
            self.style.NOTICE(
                "\nVerify in Neo4j Browser (http://localhost:7474) with:\n"
                "  CALL db.schema.visualization()\n"
                "  MATCH (m:MedicationNode)-[r:INTERACTS_WITH]->(n:MedicationNode) RETURN m,r,n LIMIT 50\n"
                "  MATCH (m:MedicationNode)-[:MEMBER_OF_RISK_GROUP]->(g) RETURN m,g LIMIT 50\n"
            )
        )

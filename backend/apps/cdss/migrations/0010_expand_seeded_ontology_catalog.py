from django.db import migrations


SAMPLE_CONDITIONS = [
    {
        "label": "Atrial fibrillation",
        "icd10": ("I48.91", "Unspecified atrial fibrillation"),
        "snomed": ("49436004", "Atrial fibrillation"),
    },
    {
        "label": "Acute respiratory failure",
        "icd10": ("J96.00", "Acute respiratory failure, unspecified whether with hypoxia or hypercapnia"),
        "snomed": ("65710008", "Acute respiratory failure"),
    },
    {
        "label": "Iron deficiency anemia",
        "icd10": ("D50.9", "Iron deficiency anemia, unspecified"),
        "snomed": ("87522002", "Iron deficiency anemia"),
    },
]

SAMPLE_MEDICATIONS = [
    {"label": "Metformin 500 mg Tablet", "rxnorm": ("6809", "Metformin 500 mg Tablet")},
    {"label": "Lisinopril 10 mg Tablet", "rxnorm": ("29046", "Lisinopril 10 mg Tablet")},
    {"label": "Atorvastatin 40 mg Tablet", "rxnorm": ("617311", "Atorvastatin 40 mg Tablet")},
    {"label": "Warfarin 5 mg Tablet", "rxnorm": ("114194", "Warfarin 5 mg Tablet")},
    {"label": "Piperacillin-Tazobactam 4.5 g IV", "rxnorm": ("1743963", "Piperacillin / Tazobactam Injectable Product")},
]

SAMPLE_LABS = [
    {"label": "Hemoglobin", "loinc": ("718-7", "Hemoglobin [Mass/volume] in Blood")},
    {"label": "Creatinine", "loinc": ("2160-0", "Creatinine [Mass/volume] in Serum or Plasma")},
    {"label": "Potassium", "loinc": ("2823-3", "Potassium [Moles/volume] in Serum or Plasma")},
    {"label": "eGFR", "loinc": ("33914-3", "Glomerular filtration rate/1.73 sq M.predicted [Volume Rate/Area] in Serum or Plasma by Creatinine-based formula")},
    {"label": "Glucose", "loinc": ("2345-7", "Glucose [Mass/volume] in Serum or Plasma")},
]


def _upsert_concept(MedicalOntologyConcept, *, code_system, code, display, domain, metadata):
    concept, _ = MedicalOntologyConcept.objects.get_or_create(
        code_system=code_system,
        code=code,
        defaults={
            "display": display,
            "domain": domain,
            "normalized_display": display.strip().lower(),
            "metadata": metadata,
            "is_active": True,
        },
    )
    changed = False
    if concept.display != display:
        concept.display = display
        changed = True
    if concept.domain != domain:
        concept.domain = domain
        changed = True
    normalized_display = display.strip().lower()
    if concept.normalized_display != normalized_display:
        concept.normalized_display = normalized_display
        changed = True
    merged_metadata = {**(concept.metadata or {}), **metadata}
    if concept.metadata != merged_metadata:
        concept.metadata = merged_metadata
        changed = True
    if not concept.is_active:
        concept.is_active = True
        changed = True
    if changed:
        concept.save()
    return concept


def _upsert_mapping(MedicalOntologyMapping, *, source_module, domain, local_code, local_display, concept, metadata):
    mapping, _ = MedicalOntologyMapping.objects.get_or_create(
        source_module=source_module,
        domain=domain,
        local_code=local_code,
        concept=concept,
        defaults={
            "local_display": local_display,
            "normalized_local_display": local_display.strip().lower(),
            "is_primary": True,
            "metadata": metadata,
        },
    )
    changed = False
    if mapping.local_display != local_display:
        mapping.local_display = local_display
        changed = True
    normalized = local_display.strip().lower()
    if mapping.normalized_local_display != normalized:
        mapping.normalized_local_display = normalized
        changed = True
    merged_metadata = {**(mapping.metadata or {}), **metadata}
    if mapping.metadata != merged_metadata:
        mapping.metadata = merged_metadata
        changed = True
    if not mapping.is_primary:
        mapping.is_primary = True
        changed = True
    if changed:
        mapping.save()


def seed_expanded_ontology(apps, schema_editor):
    MedicalOntologyConcept = apps.get_model("cdss", "MedicalOntologyConcept")
    MedicalOntologyMapping = apps.get_model("cdss", "MedicalOntologyMapping")

    for item in SAMPLE_CONDITIONS:
        icd_code, icd_display = item["icd10"]
        snomed_code, snomed_display = item["snomed"]
        icd_concept = _upsert_concept(
            MedicalOntologyConcept,
            code_system="icd10",
            code=icd_code,
            display=icd_display,
            domain="condition",
            metadata={"seeded": True, "catalog_group": "conditions"},
        )
        snomed_concept = _upsert_concept(
            MedicalOntologyConcept,
            code_system="snomed_ct",
            code=snomed_code,
            display=snomed_display,
            domain="condition",
            metadata={"seeded": True, "catalog_group": "conditions"},
        )
        _upsert_mapping(
            MedicalOntologyMapping,
            source_module="doctor",
            domain="condition",
            local_code=icd_code,
            local_display=item["label"],
            concept=icd_concept,
            metadata={"seeded": True, "mapping_kind": "sample_icd10"},
        )
        _upsert_mapping(
            MedicalOntologyMapping,
            source_module="doctor",
            domain="condition",
            local_code=icd_code,
            local_display=item["label"],
            concept=snomed_concept,
            metadata={"seeded": True, "mapping_kind": "sample_snomed"},
        )

    for item in SAMPLE_MEDICATIONS:
        rx_code, rx_display = item["rxnorm"]
        concept = _upsert_concept(
            MedicalOntologyConcept,
            code_system="rxnorm",
            code=rx_code,
            display=rx_display,
            domain="medication",
            metadata={"seeded": True, "catalog_group": "medications"},
        )
        _upsert_mapping(
            MedicalOntologyMapping,
            source_module="pharmacy",
            domain="medication",
            local_code=rx_code,
            local_display=item["label"],
            concept=concept,
            metadata={"seeded": True, "mapping_kind": "sample_rxnorm"},
        )

    for item in SAMPLE_LABS:
        loinc_code, loinc_display = item["loinc"]
        concept = _upsert_concept(
            MedicalOntologyConcept,
            code_system="loinc",
            code=loinc_code,
            display=loinc_display,
            domain="lab_test",
            metadata={"seeded": True, "catalog_group": "labs"},
        )
        _upsert_mapping(
            MedicalOntologyMapping,
            source_module="lab",
            domain="lab_test",
            local_code=loinc_code,
            local_display=item["label"],
            concept=concept,
            metadata={"seeded": True, "mapping_kind": "sample_loinc"},
        )


def normalize_ontology_rows(apps, schema_editor):
    MedicalOntologyConcept = apps.get_model("cdss", "MedicalOntologyConcept")
    MedicalOntologyMapping = apps.get_model("cdss", "MedicalOntologyMapping")

    for concept in MedicalOntologyConcept.objects.all():
        code = (concept.code or "").strip()
        display = (concept.display or "").strip()
        if not code or not display:
            concept.delete()
            continue
        concept.code = code
        concept.display = display
        concept.normalized_display = display.lower()
        concept.save()

    seen_mapping_keys = set()
    for mapping in MedicalOntologyMapping.objects.select_related("concept").order_by("id"):
        local_display = (mapping.local_display or "").strip()
        if not local_display or not mapping.concept_id:
            mapping.delete()
            continue

        mapping.local_display = local_display
        mapping.normalized_local_display = local_display.lower()
        key = (
            mapping.source_module,
            mapping.domain,
            mapping.local_code or "",
            mapping.concept_id,
            mapping.normalized_local_display,
        )
        if key in seen_mapping_keys:
            mapping.delete()
            continue
        seen_mapping_keys.add(key)
        mapping.save()


def reverse_expanded_ontology(apps, schema_editor):
    MedicalOntologyMapping = apps.get_model("cdss", "MedicalOntologyMapping")
    MedicalOntologyConcept = apps.get_model("cdss", "MedicalOntologyConcept")

    codes = []
    for item in SAMPLE_CONDITIONS:
        codes.append(item["icd10"][0])
        codes.append(item["snomed"][0])
    for item in SAMPLE_MEDICATIONS:
        codes.append(item["rxnorm"][0])
    for item in SAMPLE_LABS:
        codes.append(item["loinc"][0])

    MedicalOntologyMapping.objects.filter(metadata__seeded=True, concept__code__in=codes).delete()
    MedicalOntologyConcept.objects.filter(metadata__seeded=True, code__in=codes).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("cdss", "0009_alter_medicalontologyconcept_id_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_expanded_ontology, reverse_expanded_ontology),
        migrations.RunPython(normalize_ontology_rows, migrations.RunPython.noop),
    ]

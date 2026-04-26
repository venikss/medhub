from django.db import migrations


SAMPLE_CONCEPTS = [
    {
        "label": "Type 2 diabetes mellitus",
        "icd10": ("E11.9", "Type 2 diabetes mellitus without complications"),
        "snomed": ("44054006", "Type 2 diabetes mellitus"),
    },
    {
        "label": "Essential hypertension",
        "icd10": ("I10", "Essential (primary) hypertension"),
        "snomed": ("38341003", "Hypertensive disorder, systemic arterial"),
    },
    {
        "label": "Acute myocardial infarction",
        "icd10": ("I21.9", "Acute myocardial infarction, unspecified"),
        "snomed": ("57054005", "Acute myocardial infarction"),
    },
    {
        "label": "Chronic obstructive pulmonary disease with acute exacerbation",
        "icd10": ("J44.1", "Chronic obstructive pulmonary disease with (acute) exacerbation"),
        "snomed": ("195951007", "Acute exacerbation of chronic obstructive airways disease"),
    },
    {
        "label": "Pneumonia, unspecified organism",
        "icd10": ("J18.9", "Pneumonia, unspecified organism"),
        "snomed": ("233604007", "Pneumonia"),
    },
    {
        "label": "Chronic kidney disease stage 3",
        "icd10": ("N18.30", "Chronic kidney disease, stage 3 unspecified"),
        "snomed": ("433144002", "Chronic kidney disease stage 3"),
    },
]


def seed_sample_ontology(apps, schema_editor):
    MedicalOntologyConcept = apps.get_model("cdss", "MedicalOntologyConcept")
    MedicalOntologyMapping = apps.get_model("cdss", "MedicalOntologyMapping")

    for item in SAMPLE_CONCEPTS:
        icd_code, icd_display = item["icd10"]
        snomed_code, snomed_display = item["snomed"]

        icd_concept, _ = MedicalOntologyConcept.objects.get_or_create(
            code_system="icd10",
            code=icd_code,
            defaults={
                "display": icd_display,
                "domain": "condition",
                "normalized_display": icd_display.lower(),
                "metadata": {"seeded": True},
                "is_active": True,
            },
        )
        snomed_concept, _ = MedicalOntologyConcept.objects.get_or_create(
            code_system="snomed_ct",
            code=snomed_code,
            defaults={
                "display": snomed_display,
                "domain": "condition",
                "normalized_display": snomed_display.lower(),
                "metadata": {"seeded": True},
                "is_active": True,
            },
        )

        MedicalOntologyMapping.objects.get_or_create(
            source_module="doctor",
            domain="condition",
            local_code=icd_code,
            local_display=item["label"],
            concept=icd_concept,
            defaults={
                "normalized_local_display": item["label"].lower(),
                "is_primary": True,
                "metadata": {"seeded": True, "mapping_kind": "sample_icd10"},
            },
        )
        MedicalOntologyMapping.objects.get_or_create(
            source_module="doctor",
            domain="condition",
            local_code=icd_code,
            local_display=item["label"],
            concept=snomed_concept,
            defaults={
                "normalized_local_display": item["label"].lower(),
                "is_primary": True,
                "metadata": {"seeded": True, "mapping_kind": "sample_snomed"},
            },
        )


def reverse_seed_sample_ontology(apps, schema_editor):
    MedicalOntologyMapping = apps.get_model("cdss", "MedicalOntologyMapping")
    MedicalOntologyConcept = apps.get_model("cdss", "MedicalOntologyConcept")

    codes = []
    for item in SAMPLE_CONCEPTS:
        codes.append(item["icd10"][0])
        codes.append(item["snomed"][0])

    MedicalOntologyMapping.objects.filter(metadata__seeded=True, local_code__in=[item["icd10"][0] for item in SAMPLE_CONCEPTS]).delete()
    MedicalOntologyConcept.objects.filter(metadata__seeded=True, code__in=codes).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("cdss", "0006_medicalontologyconcept_medicalontologymapping"),
    ]

    operations = [
        migrations.RunPython(seed_sample_ontology, reverse_seed_sample_ontology),
    ]

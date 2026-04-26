# Generated manually for ontology foundation

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cdss", "0005_add_snomed_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="MedicalOntologyConcept",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("code_system", models.CharField(choices=[("icd10", "ICD-10"), ("snomed_ct", "SNOMED CT"), ("rxnorm", "RxNorm"), ("loinc", "LOINC")], max_length=20)),
                ("code", models.CharField(max_length=64)),
                ("display", models.CharField(max_length=300)),
                ("domain", models.CharField(choices=[("condition", "Condition"), ("symptom", "Symptom"), ("medication", "Medication"), ("lab_test", "Lab Test"), ("procedure", "Procedure"), ("allergy", "Allergy")], max_length=30)),
                ("normalized_display", models.CharField(blank=True, max_length=300)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "db_table": "medical_ontology_concepts",
            },
        ),
        migrations.CreateModel(
            name="MedicalOntologyMapping",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("source_module", models.CharField(choices=[("doctor", "Doctor"), ("nursing", "Nursing"), ("lab", "Lab"), ("pharmacy", "Pharmacy"), ("radiology", "Radiology"), ("emergency", "Emergency"), ("surgery", "Surgery"), ("system", "System")], max_length=30)),
                ("domain", models.CharField(choices=[("condition", "Condition"), ("symptom", "Symptom"), ("medication", "Medication"), ("lab_test", "Lab Test"), ("procedure", "Procedure"), ("allergy", "Allergy")], max_length=30)),
                ("local_code", models.CharField(blank=True, max_length=64, null=True)),
                ("local_display", models.CharField(max_length=300)),
                ("normalized_local_display", models.CharField(blank=True, max_length=300)),
                ("is_primary", models.BooleanField(default=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("concept", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mappings", to="cdss.medicalontologyconcept")),
            ],
            options={
                "db_table": "medical_ontology_mappings",
            },
        ),
        migrations.AddIndex(
            model_name="medicalontologyconcept",
            index=models.Index(fields=["code_system", "domain"], name="medical_ont_code_sy_7bf7b3_idx"),
        ),
        migrations.AddIndex(
            model_name="medicalontologyconcept",
            index=models.Index(fields=["domain", "display"], name="medical_ont_domain_8d19ab_idx"),
        ),
        migrations.AddConstraint(
            model_name="medicalontologyconcept",
            constraint=models.UniqueConstraint(fields=("code_system", "code"), name="uniq_medical_ontology_code_system_code"),
        ),
        migrations.AddIndex(
            model_name="medicalontologymapping",
            index=models.Index(fields=["source_module", "domain"], name="medical_ont_source__fdb18b_idx"),
        ),
        migrations.AddIndex(
            model_name="medicalontologymapping",
            index=models.Index(fields=["domain", "local_code"], name="medical_ont_domain_7087d6_idx"),
        ),
        migrations.AddConstraint(
            model_name="medicalontologymapping",
            constraint=models.UniqueConstraint(fields=("source_module", "domain", "local_code", "concept"), name="uniq_ontology_mapping_local_code_concept"),
        ),
    ]

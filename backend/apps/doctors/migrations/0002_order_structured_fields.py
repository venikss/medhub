from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("doctors", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="body_part",
            field=models.CharField(
                blank=True,
                choices=[
                    ("head", "Head"),
                    ("neck", "Neck"),
                    ("chest", "Chest"),
                    ("abdomen", "Abdomen"),
                    ("pelvis", "Pelvis"),
                    ("spine", "Spine"),
                    ("upper-extremity", "Upper Extremity"),
                    ("lower-extremity", "Lower Extremity"),
                    ("breast", "Breast"),
                    ("whole-body", "Whole Body"),
                    ("other", "Other"),
                ],
                max_length=30,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="clinical_history",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="contrast_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="order",
            name="exam_code",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="fasting_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="order",
            name="indication",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="laterality",
            field=models.CharField(
                blank=True,
                choices=[
                    ("left", "Left"),
                    ("right", "Right"),
                    ("bilateral", "Bilateral"),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="specimen_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("blood", "Blood"),
                    ("urine", "Urine"),
                    ("stool", "Stool"),
                    ("sputum", "Sputum"),
                    ("swab", "Swab"),
                    ("tissue", "Tissue"),
                    ("saliva", "Saliva"),
                    ("other", "Other"),
                ],
                max_length=30,
                null=True,
            ),
        ),
    ]

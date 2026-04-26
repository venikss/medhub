from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("administration", "0002_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="department",
            name="type",
            field=models.CharField(
                choices=[
                    ("clinical", "Clinical"),
                    ("diagnostic", "Diagnostic"),
                    ("surgical", "Surgical"),
                    ("emergency", "Emergency"),
                    ("administrative", "Administrative"),
                    ("support", "Support"),
                    ("pharmacy", "Pharmacy"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="ward",
            name="type",
            field=models.CharField(
                choices=[
                    ("general", "General"),
                    ("icu", "ICU"),
                    ("nicu", "NICU"),
                    ("picu", "PICU"),
                    ("icu-cardiac", "ICU Cardiac"),
                    ("pediatric", "Pediatric"),
                    ("maternity", "Maternity"),
                    ("surgery", "Surgery"),
                    ("emergency", "Emergency"),
                    ("step-down", "Step Down"),
                    ("observation", "Observation"),
                    ("isolation", "Isolation"),
                ],
                max_length=20,
            ),
        ),
    ]

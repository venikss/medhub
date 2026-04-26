from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("administration", "0003_expand_master_data_choices"),
    ]

    operations = [
        migrations.AlterField(
            model_name="bed",
            name="type",
            field=models.CharField(
                choices=[
                    ("standard", "Standard"),
                    ("general", "General"),
                    ("icu", "ICU"),
                    ("nicu", "NICU"),
                    ("isolation", "Isolation"),
                    ("bariatric", "Bariatric"),
                    ("pediatric", "Pediatric"),
                    ("labor_delivery", "Labor & Delivery"),
                    ("semi-private", "Semi Private"),
                    ("private", "Private"),
                    ("day-surgery", "Day Surgery"),
                    ("recovery", "Recovery"),
                ],
                default="standard",
                max_length=20,
            ),
        ),
    ]

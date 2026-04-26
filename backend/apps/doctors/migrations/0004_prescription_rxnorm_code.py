from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("doctors", "0003_alter_encounter_visit_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="prescription",
            name="rxnorm_code",
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
    ]


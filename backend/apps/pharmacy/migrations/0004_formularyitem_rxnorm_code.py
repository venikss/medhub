from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pharmacy", "0003_drop_legacy_pharmacist_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="formularyitem",
            name="rxnorm_code",
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
    ]


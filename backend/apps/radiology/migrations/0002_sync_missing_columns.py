# Generated manually to sync live database schema with current radiology models.
# All fields already exist in 0001_initial — no SQL executed on fresh DB.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("radiology", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(model_name="imagingorder", name="exam_code", field=models.CharField(blank=True, max_length=50, null=True)),
                migrations.AlterField(model_name="imagingorder", name="exam_name", field=models.CharField(blank=True, max_length=200, null=True)),
                migrations.AlterField(model_name="imagingorder", name="clinical_history", field=models.TextField(blank=True, null=True)),
                migrations.AlterField(model_name="imagingorder", name="laterality", field=models.CharField(blank=True, max_length=30, null=True)),
                migrations.AlterField(model_name="imagingorder", name="contrast_required", field=models.BooleanField(default=False)),
            ],
        ),
    ]

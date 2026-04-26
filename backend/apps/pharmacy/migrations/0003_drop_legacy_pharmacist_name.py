from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("pharmacy", "0002_sync_missing_columns"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE pharmacy_interventions DROP COLUMN IF EXISTS pharmacist_name;",
            reverse_sql="ALTER TABLE pharmacy_interventions ADD COLUMN pharmacist_name varchar(200);",
        ),
    ]

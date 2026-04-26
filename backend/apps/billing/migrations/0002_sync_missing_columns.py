# Generated manually to sync live database schema with current billing models.
# primary_diagnosis is already defined in 0001_initial; this migration is kept
# for history continuity but performs no database operation.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Column already exists in 0001_initial — no-op to preserve history.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="invoice",
                    name="primary_diagnosis",
                    field=models.CharField(blank=True, max_length=500, null=True),
                ),
            ],
        ),
    ]

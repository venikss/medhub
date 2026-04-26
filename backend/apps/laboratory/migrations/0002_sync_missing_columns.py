# Generated manually to sync live database schema with current laboratory models.
# All fields listed below already exist in 0001_initial.
# SeparateDatabaseAndState is used so no SQL is executed on a fresh DB,
# while the Django migration state stays consistent.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def _no_op_add(model, name, field):
    """Return a SeparateDatabaseAndState that updates state only (no SQL)."""
    return migrations.SeparateDatabaseAndState(
        database_operations=[],
        state_operations=[migrations.AlterField(model_name=model, name=name, field=field)],
    )


class Migration(migrations.Migration):

    dependencies = [
        ("laboratory", "0001_initial"),
        ("doctors", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        _no_op_add("analyzerqueue", "error_message", models.TextField(blank=True, null=True)),
        _no_op_add("criticalvalue", "test_name", models.CharField(default="", max_length=200)),
        _no_op_add("criticalvalue", "value", models.CharField(default="", max_length=200)),
        _no_op_add("criticalvalue", "unit", models.CharField(blank=True, default="", max_length=50)),
        _no_op_add("criticalvalue", "notification_method", models.CharField(blank=True, max_length=50, null=True)),
        _no_op_add("criticalvalue", "readback_provided", models.BooleanField(default=False)),
        _no_op_add("labpanel", "order", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lab_panels", to="doctors.order")),
        _no_op_add("labpanel", "priority", models.CharField(default="routine", max_length=20)),
        _no_op_add("labreport", "notes", models.TextField(blank=True, null=True)),
        _no_op_add("labreport", "corrected_at", models.DateTimeField(blank=True, null=True)),
        _no_op_add("labreport", "correction_note", models.TextField(blank=True, null=True)),
        _no_op_add("labtestresult", "is_critical", models.BooleanField(default=False)),
        _no_op_add("labtestresult", "delta_flag", models.CharField(blank=True, max_length=20, null=True)),
        _no_op_add("labtestresult", "comment", models.TextField(blank=True, null=True)),
        _no_op_add("specimen", "collected_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="collected_specimens", to=settings.AUTH_USER_MODEL)),
        _no_op_add("specimen", "tube_type", models.CharField(blank=True, max_length=100, null=True)),
        _no_op_add("specimen", "volume", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
        _no_op_add("specimen", "barcode", models.CharField(blank=True, max_length=100, null=True, unique=True)),
        _no_op_add("specimen", "storage_location", models.CharField(blank=True, max_length=200, null=True)),
        _no_op_add("specimen", "recollect_reason", models.TextField(blank=True, null=True)),
    ]

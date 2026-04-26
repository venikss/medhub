from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("doctors", "0001_initial"),
        ("radiology", "0002_sync_missing_columns"),
    ]

    operations = [
        migrations.AddField(
            model_name="imagingorder",
            name="doctor_order",
            field=models.OneToOneField(blank=True, null=True, on_delete=models.SET_NULL, related_name="radiology_order", to="doctors.order"),
        ),
    ]

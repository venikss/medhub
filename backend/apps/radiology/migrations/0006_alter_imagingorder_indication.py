from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("radiology", "0005_restore_imagingorder_doctor_order"),
    ]

    operations = [
        migrations.AlterField(
            model_name="imagingorder",
            name="indication",
            field=models.TextField(blank=True, null=True),
        ),
    ]

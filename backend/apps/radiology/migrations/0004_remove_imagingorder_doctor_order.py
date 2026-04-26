from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("radiology", "0003_imagingorder_doctor_order"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="imagingorder",
            name="doctor_order",
        ),
    ]

from django.apps import AppConfig

class CdssConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.cdss"

    def ready(self):
        import apps.cdss.signals

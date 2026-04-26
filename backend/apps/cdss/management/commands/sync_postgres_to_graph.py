from django.core.management.base import BaseCommand
from neomodel import db

from apps.cdss.services.graph_sync_service import GraphSyncService
from apps.doctors.models import Diagnosis, Prescription
from apps.laboratory.models import LabTestResult
from apps.patients.models import Patient
from apps.radiology.models import RadiologyReport


class Command(BaseCommand):
    help = "Sync historical PostgreSQL data into the Neo4j Knowledge Graph"

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.NOTICE("Initializing synchronization from PostgreSQL to Neo4j..."))

        patients = Patient.objects.all()
        synced_patients = 0
        with db.transaction:
            for patient in patients:
                GraphSyncService.sync_patient_profile(patient)
                synced_patients += 1

        self.stdout.write(self.style.SUCCESS(f"Synced {synced_patients} patient profiles to Graph."))

        diagnoses = Diagnosis.objects.select_related("patient").all()
        synced_diagnoses = 0
        with db.transaction:
            for diagnosis in diagnoses:
                if diagnosis.status != "active":
                    continue
                GraphSyncService.sync_diagnosis(diagnosis)
                synced_diagnoses += 1

        self.stdout.write(self.style.SUCCESS(f"Synced {synced_diagnoses} diagnoses to Graph."))

        prescriptions = Prescription.objects.select_related("patient").all()
        synced_prescriptions = 0
        with db.transaction:
            for prescription in prescriptions:
                GraphSyncService.sync_prescription(prescription)
                synced_prescriptions += 1

        self.stdout.write(self.style.SUCCESS(f"Synced {synced_prescriptions} prescriptions to Graph."))

        lab_results = LabTestResult.objects.select_related("panel__patient").all()
        synced_labs = 0
        with db.transaction:
            for result in lab_results:
                GraphSyncService.sync_lab_result(result)
                synced_labs += 1

        self.stdout.write(self.style.SUCCESS(f"Synced {synced_labs} lab results to Graph."))

        reports = RadiologyReport.objects.select_related("patient", "study__order").all()
        synced_reports = 0
        with db.transaction:
            for report in reports:
                GraphSyncService.sync_radiology_report(report)
                synced_reports += 1

        self.stdout.write(self.style.SUCCESS(f"Synced {synced_reports} radiology reports to Graph."))
        self.stdout.write(self.style.SUCCESS("Graph Sync complete!"))

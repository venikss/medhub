from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from neomodel import db

from apps.cdss.services.graph_sync_service import GraphSyncService
from apps.cdss.services.rule_engine_service import GraphRuleEngineService
from apps.doctors.models import Diagnosis, Encounter, Prescription
from apps.laboratory.models import CriticalValue, LabTestResult
from apps.nurses.models import Task, Vitals
from apps.patients.models import Patient
from apps.pharmacy.models import DrugWarning, PharmacyPrescription
from apps.radiology.models import ImagingOrder, RadCriticalFinding, RadiologyReport

def _schedule_rule_refresh(patient_id):
    if not patient_id:
        return

    def _run():
        try:
            GraphRuleEngineService.run_for_patient(patient_id, persist=True)
        except Exception:
            pass

    transaction.on_commit(_run)

@receiver(post_save, sender=Patient)
def sync_patient_profile_to_graph(sender, instance, **kwargs):
    with db.transaction:
        GraphSyncService.sync_patient_profile(instance)
    _schedule_rule_refresh(instance.id)

@receiver(post_save, sender=Diagnosis)
def sync_diagnosis_to_graph(sender, instance, created, **kwargs):
    if not created and instance.status != "active":
        return

    from apps.cdss.services.ontology_service import OntologyService
    try:
        OntologyService.sync_diagnosis_ontology(instance)
    except Exception:
        pass

    try:
        with db.transaction:
            GraphSyncService.sync_diagnosis(instance)
    except Exception:
        pass

    _schedule_rule_refresh(instance.patient_id)

@receiver(post_save, sender=Encounter)
def sync_encounter_to_graph(sender, instance, **kwargs):
    """Sync encounter SOAP notes to Neo4j so the AI has current context."""
    try:
        with db.transaction:
            GraphSyncService.sync_encounter(instance)
    except Exception:
        pass

@receiver(post_save, sender=Prescription)
def sync_prescription_to_graph(sender, instance, created, **kwargs):
    if not created:
        return

    with db.transaction:
        GraphSyncService.sync_prescription(instance)
    _schedule_rule_refresh(instance.patient_id)

@receiver(post_save, sender=LabTestResult)
def sync_lab_result_to_graph(sender, instance, **kwargs):
    with db.transaction:
        GraphSyncService.sync_lab_result(instance)
    _schedule_rule_refresh(instance.panel.patient_id)

@receiver(post_save, sender=RadiologyReport)
def sync_radiology_report_to_graph(sender, instance, **kwargs):
    with db.transaction:
        GraphSyncService.sync_radiology_report(instance)
    _schedule_rule_refresh(instance.patient_id)

@receiver(post_save, sender=ImagingOrder)
def sync_imaging_order_to_graph(sender, instance, **kwargs):
    """Mirror every ImagingOrder status change to Neo4j — enables duplicate-order
    detection and appropriateness context for in-flight studies."""
    try:
        with db.transaction:
            GraphSyncService.sync_imaging_order(instance)
    except Exception:
        pass

@receiver(post_save, sender=PharmacyPrescription)
def refresh_rules_on_pharmacy_prescription_change(sender, instance, **kwargs):
    _schedule_rule_refresh(instance.patient_id)

@receiver(post_save, sender=DrugWarning)
def refresh_rules_on_drug_warning_change(sender, instance, **kwargs):
    _schedule_rule_refresh(instance.patient_id)

@receiver(post_save, sender=CriticalValue)
def refresh_rules_on_critical_value_change(sender, instance, **kwargs):
    _schedule_rule_refresh(instance.patient_id)

@receiver(post_save, sender=Vitals)
def refresh_rules_on_vitals_change(sender, instance, **kwargs):
    try:
        with db.transaction:
            GraphSyncService.sync_vitals(instance)
    except Exception:
        pass
    _schedule_rule_refresh(instance.patient_id)

@receiver(post_save, sender=Task)
def refresh_rules_on_task_change(sender, instance, **kwargs):
    _schedule_rule_refresh(instance.patient_id)

@receiver(post_save, sender=RadCriticalFinding)
def refresh_rules_on_radiology_critical_change(sender, instance, **kwargs):
    _schedule_rule_refresh(instance.patient_id)

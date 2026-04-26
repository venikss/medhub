from apps.cdss.models import (
    CDSSSourceModule,
    MedicalOntologyConcept,
    MedicalOntologyMapping,
    OntologyCodeSystem,
    OntologyDomain,
)


class OntologyService:
    @staticmethod
    def ensure_concept(*, code_system: str, code: str, display: str, domain: str, metadata=None):
        if not code or not display:
            return None

        concept, created = MedicalOntologyConcept.objects.get_or_create(
            code_system=code_system,
            code=str(code).strip(),
            defaults={
                "display": display.strip(),
                "domain": domain,
                "metadata": metadata or {},
            },
        )
        changed = False
        if concept.display != display.strip():
            concept.display = display.strip()
            changed = True
        if concept.domain != domain:
            concept.domain = domain
            changed = True
        if metadata:
            merged = {**concept.metadata, **metadata}
            if merged != concept.metadata:
                concept.metadata = merged
                changed = True
        if changed:
            concept.save(update_fields=["display", "domain", "metadata", "normalized_display", "updated_at"])
        return concept

    @staticmethod
    def ensure_mapping(*, source_module: str, domain: str, concept, local_display: str, local_code: str | None = None, metadata=None):
        if not concept or not local_display:
            return None

        mapping, created = MedicalOntologyMapping.objects.get_or_create(
            source_module=source_module,
            domain=domain,
            local_code=local_code or None,
            concept=concept,
            defaults={
                "local_display": local_display.strip(),
                "metadata": metadata or {},
            },
        )
        changed = False
        if mapping.local_display != local_display.strip():
            mapping.local_display = local_display.strip()
            changed = True
        if metadata:
            merged = {**mapping.metadata, **metadata}
            if merged != mapping.metadata:
                mapping.metadata = merged
                changed = True
        if changed:
            mapping.save(update_fields=["local_display", "metadata", "normalized_local_display", "updated_at"])
        return mapping

    @classmethod
    def sync_diagnosis_ontology(cls, diagnosis):
        condition_label = diagnosis.snomed_display or diagnosis.description or diagnosis.code
        metadata = {
            "source_model": "doctors.Diagnosis",
            "diagnosis_type": diagnosis.type,
            "status": diagnosis.status,
        }
        if diagnosis.snomed_code:
            concept = cls.ensure_concept(
                code_system=OntologyCodeSystem.SNOMED_CT,
                code=diagnosis.snomed_code,
                display=condition_label,
                domain=OntologyDomain.CONDITION,
                metadata=metadata,
            )
            cls.ensure_mapping(
                source_module=CDSSSourceModule.DOCTOR,
                domain=OntologyDomain.CONDITION,
                concept=concept,
                local_display=condition_label,
                local_code=diagnosis.code,
                metadata={"mapping_kind": "diagnosis_snomed"},
            )
        if diagnosis.code:
            concept = cls.ensure_concept(
                code_system=OntologyCodeSystem.ICD10,
                code=diagnosis.code,
                display=diagnosis.description or condition_label,
                domain=OntologyDomain.CONDITION,
                metadata=metadata,
            )
            cls.ensure_mapping(
                source_module=CDSSSourceModule.DOCTOR,
                domain=OntologyDomain.CONDITION,
                concept=concept,
                local_display=condition_label,
                local_code=diagnosis.code,
                metadata={"mapping_kind": "diagnosis_icd10"},
            )

    @classmethod
    def sync_prescription_ontology(cls, prescription):
        medication_label = prescription.generic_name or prescription.medication
        if not prescription.rxnorm_code:
            return
        concept = cls.ensure_concept(
            code_system=OntologyCodeSystem.RXNORM,
            code=prescription.rxnorm_code,
            display=medication_label,
            domain=OntologyDomain.MEDICATION,
            metadata={
                "source_model": "doctors.Prescription",
                "route": prescription.route,
                "frequency": prescription.frequency,
            },
        )
        cls.ensure_mapping(
            source_module=CDSSSourceModule.PHARMACY,
            domain=OntologyDomain.MEDICATION,
            concept=concept,
            local_display=prescription.medication,
            local_code=prescription.rxnorm_code,
            metadata={"mapping_kind": "prescription_rxnorm"},
        )

    @classmethod
    def sync_lab_result_ontology(cls, result):
        if not result.test_code:
            return

        concept = cls.ensure_concept(
            code_system=OntologyCodeSystem.LOINC,
            code=result.test_code,
            display=result.test_name,
            domain=OntologyDomain.LAB_TEST,
            metadata={
                "source_model": "laboratory.LabTestResult",
                "unit": result.unit,
                "reference_range": result.reference_range,
            },
        )
        cls.ensure_mapping(
            source_module=CDSSSourceModule.LAB,
            domain=OntologyDomain.LAB_TEST,
            concept=concept,
            local_display=result.test_name,
            local_code=result.test_code,
            metadata={"mapping_kind": "lab_result_loinc"},
        )

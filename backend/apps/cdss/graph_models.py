from neomodel import (
    DateTimeProperty,
    IntegerProperty,
    RelationshipTo,
    StringProperty,
    StructuredNode,
    StructuredRel,
)


class HasSymptomRel(StructuredRel):
    onset_date = DateTimeProperty()
    severity = StringProperty()


class DiagnosedWithRel(StructuredRel):
    date = DateTimeProperty()
    status = StringProperty()


class TreatedByRel(StructuredRel):
    efficacy = StringProperty()
    dosage = StringProperty()


class HasAllergyRel(StructuredRel):
    reaction = StringProperty()
    severity = StringProperty()
    source_text = StringProperty()


class HasLabResultRel(StructuredRel):
    observed_at = DateTimeProperty()
    status = StringProperty()
    panel_name = StringProperty()
    flag = StringProperty()


class HasRadiologyReportRel(StructuredRel):
    reported_at = DateTimeProperty()
    status = StringProperty()
    modality = StringProperty()


class SymptomNode(StructuredNode):
    name = StringProperty(unique_index=True, required=True)
    snomed_id = StringProperty()


class DiseaseNode(StructuredNode):
    name = StringProperty(unique_index=True, required=True)
    icd_10 = StringProperty()
    snomed_id = StringProperty()


class MedicationNode(StructuredNode):
    name = StringProperty(unique_index=True, required=True)
    active_ingredient = StringProperty()
    rxnorm_code = StringProperty()


class AllergyNode(StructuredNode):
    name = StringProperty(unique_index=True, required=True)


class LabResultNode(StructuredNode):
    result_uid = StringProperty(unique_index=True, required=True)
    test_name = StringProperty(required=True)
    test_code = StringProperty()
    value = StringProperty()
    unit = StringProperty()
    reference_range = StringProperty()
    flag = StringProperty()
    status = StringProperty()
    delta = StringProperty()
    comment = StringProperty()
    panel_name = StringProperty()
    is_critical = StringProperty()


class RadiologyReportNode(StructuredNode):
    report_uid = StringProperty(unique_index=True, required=True)
    exam_code = StringProperty()
    exam_name = StringProperty()
    modality = StringProperty()
    findings = StringProperty()
    impression = StringProperty()
    recommendations = StringProperty()
    status = StringProperty()


class SNOMEDConceptNode(StructuredNode):
    code = StringProperty(unique_index=True, required=True)
    display = StringProperty(required=True)


class ICD10ConceptNode(StructuredNode):
    code = StringProperty(unique_index=True, required=True)
    display = StringProperty(required=True)


class RxNormConceptNode(StructuredNode):
    code = StringProperty(unique_index=True, required=True)
    display = StringProperty(required=True)


class LOINCConceptNode(StructuredNode):
    code = StringProperty(unique_index=True, required=True)
    display = StringProperty(required=True)


class PatientNode(StructuredNode):
    uid = StringProperty(unique_index=True, required=True)
    age = IntegerProperty()
    gender = StringProperty()

    symptoms = RelationshipTo("SymptomNode", "HAS_SYMPTOM", model=HasSymptomRel)
    diagnoses = RelationshipTo("DiseaseNode", "DIAGNOSED_WITH", model=DiagnosedWithRel)
    allergies = RelationshipTo("AllergyNode", "HAS_ALLERGY", model=HasAllergyRel)
    lab_results = RelationshipTo("LabResultNode", "HAS_LAB_RESULT", model=HasLabResultRel)
    radiology_reports = RelationshipTo(
        "RadiologyReportNode",
        "HAS_RAD_REPORT",
        model=HasRadiologyReportRel,
    )


DiseaseNode.treatments = RelationshipTo("MedicationNode", "TREATED_BY", model=TreatedByRel)
DiseaseNode.snomed_concepts = RelationshipTo("SNOMEDConceptNode", "MAPS_TO_SNOMED")
DiseaseNode.icd10_concepts = RelationshipTo("ICD10ConceptNode", "MAPS_TO_ICD10")
MedicationNode.rxnorm_concepts = RelationshipTo("RxNormConceptNode", "MAPS_TO_RXNORM")
LabResultNode.loinc_concepts = RelationshipTo("LOINCConceptNode", "MAPS_TO_LOINC")

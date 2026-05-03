from neomodel import (
    BooleanProperty,
    DateTimeProperty,
    IntegerProperty,
    RelationshipFrom,
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


class InteractsWithRel(StructuredRel):
    """Drug–Drug Interaction relationship."""
    severity = StringProperty()       # contraindicated | major | moderate | minor
    mechanism = StringProperty()      # e.g. pharmacokinetic_cyp3a4_inhibition
    description = StringProperty()    # clinical effect narrative
    management = StringProperty()     # clinical management recommendation
    evidence_level = StringProperty() # A | B | C | D
    reference_source = StringProperty()  # FDA | WHO | literature


class CrossReactsWithRel(StructuredRel):
    rate = StringProperty()           # e.g. "1–10%"
    description = StringProperty()
    severity = StringProperty()       # always_avoid | use_with_caution


# ---------------------------------------------------------------------------
# Drug taxonomy nodes
# ---------------------------------------------------------------------------

class DrugClassNode(StructuredNode):
    """Pharmacological drug class (e.g. 'Beta-blockers', 'SSRIs')."""
    name = StringProperty(unique_index=True, required=True)
    description = StringProperty()
    mechanism_of_action = StringProperty()

    cross_reacts_with = RelationshipTo(
        "DrugClassNode", "CLASS_CROSS_REACTS_WITH", model=CrossReactsWithRel
    )


class DrugInteractionGroupNode(StructuredNode):
    """Pharmacological risk group (e.g. 'QT-Prolonging Drugs').
    Any patient taking two members of the same group has a group-level DDI risk."""
    name = StringProperty(unique_index=True, required=True)
    description = StringProperty()
    severity = StringProperty()         # contraindicated | major | moderate
    mechanism = StringProperty()
    management = StringProperty()
    interaction_type = StringProperty() # within_group | class_based


class AllergyCrossReactivityGroupNode(StructuredNode):
    """Groups substances with known cross-reactivity (e.g. 'Beta-lactam Antibiotics')."""
    name = StringProperty(unique_index=True, required=True)
    description = StringProperty()
    reaction_types = StringProperty()   # comma-separated list
    includes_classes = StringProperty() # comma-separated drug class names

    cross_reacts_with = RelationshipTo(
        "AllergyCrossReactivityGroupNode",
        "ALLERGEN_CROSS_REACTS_WITH",
        model=CrossReactsWithRel,
    )


# ---------------------------------------------------------------------------
# Updated MedicationNode — backward-compatible additions
# ---------------------------------------------------------------------------

class MedicationNode(StructuredNode):
    name = StringProperty(unique_index=True, required=True)
    active_ingredient = StringProperty()
    rxnorm_code = StringProperty()
    # New standardized fields
    drug_class = StringProperty()
    atc_code = StringProperty()
    brand_names = StringProperty()   # comma-separated brand names
    is_otc = BooleanProperty(default=False)
    route = StringProperty()         # oral | IV | topical | inhaled | etc.

    # Knowledge graph relationships
    interactions = RelationshipTo("MedicationNode", "INTERACTS_WITH", model=InteractsWithRel)
    drug_classes = RelationshipTo("DrugClassNode", "BELONGS_TO_CLASS")
    risk_groups = RelationshipTo("DrugInteractionGroupNode", "MEMBER_OF_RISK_GROUP")
    allergen_groups = RelationshipTo("AllergyCrossReactivityGroupNode", "MEMBER_OF_ALLERGEN_GROUP")


class AllergyNode(StructuredNode):
    name = StringProperty(unique_index=True, required=True)

    allergen_group = RelationshipTo(
        "AllergyCrossReactivityGroupNode", "BELONGS_TO_ALLERGEN_GROUP"
    )


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


class HasEncounterRel(StructuredRel):
    created_at = DateTimeProperty()
    status = StringProperty()
    visit_type = StringProperty()


class EncounterNode(StructuredNode):
    """SOAP encounter note synced from PostgreSQL encounters table."""
    encounter_uid = StringProperty(unique_index=True, required=True)
    visit_type = StringProperty()        # inpatient | outpatient
    status = StringProperty()            # in-progress | completed | signed
    subjective = StringProperty()        # Chief complaint / HPI
    objective = StringProperty()         # Vitals / exam findings
    assessment = StringProperty()        # Diagnoses / clinical impression
    plan = StringProperty()              # Treatment plan
    doctor_name = StringProperty()
    created_at = DateTimeProperty()


class PatientNode(StructuredNode):
    uid = StringProperty(unique_index=True, required=True)
    full_name = StringProperty()
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
    encounters = RelationshipTo("EncounterNode", "HAS_ENCOUNTER", model=HasEncounterRel)


DiseaseNode.treatments = RelationshipTo("MedicationNode", "TREATED_BY", model=TreatedByRel)
DiseaseNode.snomed_concepts = RelationshipTo("SNOMEDConceptNode", "MAPS_TO_SNOMED")
DiseaseNode.icd10_concepts = RelationshipTo("ICD10ConceptNode", "MAPS_TO_ICD10")
MedicationNode.rxnorm_concepts = RelationshipTo("RxNormConceptNode", "MAPS_TO_RXNORM")
LabResultNode.loinc_concepts = RelationshipTo("LOINCConceptNode", "MAPS_TO_LOINC")

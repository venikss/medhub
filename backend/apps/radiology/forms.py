from django import forms

from apps.administration.models import RadiologyCatalogItem
from apps.authentication.models import UserRole
from .models import ImagingOrder


BODY_PART_CHOICES = [
    ("", "---------"),
    ("head", "Head"),
    ("neck", "Neck"),
    ("chest", "Chest"),
    ("abdomen", "Abdomen"),
    ("pelvis", "Pelvis"),
    ("spine", "Spine"),
    ("upper-extremity", "Upper Extremity"),
    ("lower-extremity", "Lower Extremity"),
    ("breast", "Breast"),
    ("whole-body", "Whole Body"),
    ("other", "Other"),
]

PRIORITY_CHOICES = [
    ("routine", "Routine"),
    ("urgent", "Urgent"),
    ("stat", "STAT"),
]

LATERALITY_CHOICES = [
    ("", "---------"),
    ("left", "Left"),
    ("right", "Right"),
    ("bilateral", "Bilateral"),
]


def build_patient_clinical_summary(patient):
    if not patient:
        return ""
    summary_parts = []
    latest_encounter = patient.encounters.order_by("-created_at").first()
    if latest_encounter:
        if latest_encounter.assessment:
            summary_parts.append(latest_encounter.assessment.strip())
        elif latest_encounter.subjective:
            summary_parts.append(latest_encounter.subjective.strip())
    diagnoses = list(patient.diagnoses.order_by("-created_at").values_list("description", flat=True)[:3])
    diagnoses = [item.strip() for item in diagnoses if item]
    if diagnoses:
        summary_parts.append("Diagnoses: " + ", ".join(diagnoses))
    return " | ".join(summary_parts)


class ImagingOrderAdminForm(forms.ModelForm):
    body_part = forms.ChoiceField(required=False, choices=BODY_PART_CHOICES, label="Body part")
    priority = forms.ChoiceField(required=False, choices=PRIORITY_CHOICES)
    laterality = forms.ChoiceField(required=False, choices=LATERALITY_CHOICES)
    indication = forms.CharField(widget=forms.Textarea(attrs={"rows": 3}), required=False)
    clinical_history = forms.CharField(widget=forms.Textarea(attrs={"rows": 4}), required=False)


    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "doctor_order" in self.fields:
            self.fields["doctor_order"].required = False
            self.fields["doctor_order"].help_text = "Optional linked doctor imaging order. If selected, patient and ordering doctor are derived automatically."
        if "exam_code" in self.fields:
            self.fields["exam_code"].help_text = "Catalog or CPT code for the imaging exam. Example: CT-HEAD."
        if "exam_name" in self.fields:
            self.fields["exam_name"].help_text = "Human-readable exam title. Usually auto-filled from the selected exam code."
        if "ordered_by" in self.fields:
            self.fields["ordered_by"].help_text = "Must be a doctor."
            self.fields["ordered_by"].queryset = self.fields["ordered_by"].queryset.filter(role=UserRole.DOCTOR)
        if "protocoled_by" in self.fields:
            self.fields["protocoled_by"].queryset = self.fields["protocoled_by"].queryset.filter(role=UserRole.RADIOLOGIST)
        if "assigned_radiologist" in self.fields:
            self.fields["assigned_radiologist"].queryset = self.fields["assigned_radiologist"].queryset.filter(role=UserRole.RADIOLOGIST)
        if "technologist" in self.fields:
            self.fields["technologist"].queryset = self.fields["technologist"].queryset.filter(role=UserRole.RADIOLOGIST)
        if "cancelled_by" in self.fields:
            self.fields["cancelled_by"].queryset = self.fields["cancelled_by"].queryset.filter(role__in=[UserRole.DOCTOR, UserRole.RADIOLOGIST])

    class Meta:
        model = ImagingOrder
        fields = "__all__"
        widgets = {
            "scheduled_at": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "protocol_notes": forms.Textarea(attrs={"rows": 3}),
        }

    def clean(self):
        cleaned = super().clean()
        exam_code = (cleaned.get("exam_code") or "").strip().upper()
        patient = cleaned.get("patient")
        doctor_order = cleaned.get("doctor_order")
        if doctor_order:
            cleaned["patient"] = doctor_order.patient
            cleaned["ordered_by"] = doctor_order.ordered_by
            cleaned["exam_name"] = cleaned.get("exam_name") or doctor_order.name
            cleaned["indication"] = cleaned.get("indication") or doctor_order.notes or doctor_order.name
            cleaned["clinical_history"] = cleaned.get("clinical_history") or doctor_order.notes or doctor_order.name
            cleaned["priority"] = cleaned.get("priority") or doctor_order.priority
            patient = doctor_order.patient
        if exam_code:
            catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, code__iexact=exam_code).first()
            if not catalog_item:
                catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, cpt_code__iexact=exam_code).first()
            if catalog_item:
                cleaned["exam_name"] = cleaned.get("exam_name") or catalog_item.name
                cleaned["body_part"] = cleaned.get("body_part") or catalog_item.body_part
                cleaned["contrast_required"] = cleaned.get("contrast_required") if cleaned.get("contrast_required") is not None else catalog_item.with_contrast
                cleaned["modality"] = cleaned.get("modality") or catalog_item.modality
        summary = build_patient_clinical_summary(patient)
        if summary:
            cleaned["clinical_history"] = cleaned.get("clinical_history") or summary
            cleaned["indication"] = cleaned.get("indication") or summary[:500]
        if not cleaned.get("body_part"):
            self.add_error("body_part", "Choose a body part or select an exam code that fills it automatically.")
        if not cleaned.get("indication"):
            self.add_error("indication", "Indication is required unless it can be derived from patient context.")
        return cleaned










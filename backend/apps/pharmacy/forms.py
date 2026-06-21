from django import forms

from apps.authentication.models import UserRole
from .models import FormularyItem, PharmacyPrescription, DispenseRecord, PharmacyIntervention, Refill, Substitution

PRIORITY_CHOICES = [
    ("routine", "Routine"),
    ("urgent", "Urgent"),
    ("stat", "STAT"),
]

def build_formulary_medication_choices():
    items = FormularyItem.objects.order_by("name", "generic_name")
    choices = [("", "---------")]
    for item in items:
        label = item.name
        if item.generic_name:
            label = f"{item.name} ({item.generic_name})"
        choices.append((item.name, label))
    return choices

class PharmacyPrescriptionAdminForm(forms.ModelForm):
    priority = forms.ChoiceField(required=False, choices=PRIORITY_CHOICES)

    class Meta:
        model = PharmacyPrescription
        fields = "__all__"
        widgets = {
            "verification_notes": forms.Textarea(attrs={"rows": 3}),
            "hold_reason": forms.Textarea(attrs={"rows": 3}),
        }

    def clean(self):
        cleaned = super().clean()
        original_prescription = cleaned.get("original_prescription")
        if original_prescription and not cleaned.get("patient"):
            cleaned["patient"] = original_prescription.patient
        if original_prescription and not cleaned.get("priority"):
            cleaned["priority"] = getattr(original_prescription, "priority", "routine") or "routine"
        return cleaned

class DispenseRecordAdminForm(forms.ModelForm):
    class Meta:
        model = DispenseRecord
        fields = "__all__"
        widgets = {
            "expiration_date": forms.DateInput(attrs={"type": "date"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["patient"].required = False
        self.fields["patient"].help_text = "Derived automatically from the selected pharmacy prescription."
        if "pharmacist" in self.fields:
            self.fields["pharmacist"].queryset = self.fields["pharmacist"].queryset.filter(role=UserRole.PHARMACIST)
        if "dispensed_by" in self.fields:
            self.fields["dispensed_by"].queryset = self.fields["dispensed_by"].queryset.filter(role=UserRole.PHARMACIST)

    def clean(self):
        cleaned = super().clean()
        prescription = cleaned.get("prescription")
        if prescription and not cleaned.get("patient"):
            cleaned["patient"] = prescription.patient
        return cleaned

class PharmacyInterventionAdminForm(forms.ModelForm):
    class Meta:
        model = PharmacyIntervention
        fields = "__all__"
        widgets = {
            "reason": forms.Textarea(attrs={"rows": 3}),
            "recommendation": forms.Textarea(attrs={"rows": 3}),
            "outcome": forms.Textarea(attrs={"rows": 2}),
            "prescriber_response": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["prescriber_contact"].help_text = "Auto-filled from the prescribing doctor when possible."
        if "pharmacist" in self.fields:
            self.fields["pharmacist"].queryset = self.fields["pharmacist"].queryset.filter(role=UserRole.PHARMACIST)

    def clean(self):
        cleaned = super().clean()
        prescription = cleaned.get("prescription")
        if prescription and not cleaned.get("prescriber_contact"):
            doctor = getattr(getattr(prescription, "original_prescription", None), "prescribed_by", None)
            if doctor:
                cleaned["prescriber_contact"] = doctor.full_name or doctor.email
        return cleaned

class RefillAdminForm(forms.ModelForm):
    class Meta:
        model = Refill
        fields = "__all__"
        widgets = {
            "dispensed_date": forms.DateInput(attrs={"type": "date"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["patient"].required = False
        self.fields["patient"].help_text = "Derived automatically from the selected pharmacy prescription."
        if "pharmacist" in self.fields:
            self.fields["pharmacist"].queryset = self.fields["pharmacist"].queryset.filter(role=UserRole.PHARMACIST)
        if "dispensed_by" in self.fields:
            self.fields["dispensed_by"].queryset = self.fields["dispensed_by"].queryset.filter(role=UserRole.PHARMACIST)

    def clean(self):
        cleaned = super().clean()
        prescription = cleaned.get("prescription")
        if prescription and not cleaned.get("patient"):
            cleaned["patient"] = prescription.patient
        return cleaned

class SubstitutionAdminForm(forms.ModelForm):
    substitute_medication = forms.ChoiceField(required=False, choices=())

    class Meta:
        model = Substitution
        exclude = ("approved_by", "requested_by")
        widgets = {
            "reason": forms.Textarea(attrs={"rows": 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["substitute_medication"].choices = build_formulary_medication_choices()
        self.fields["substitute_medication"].help_text = "Choose a medication from the formulary list."
        if "status" in self.fields:
            self.fields["status"].help_text = "Managed by pharmacy only. No doctor approval is required."

    def clean(self):
        cleaned = super().clean()
        cleaned["approved_by"] = None
        cleaned["requested_by"] = None
        return cleaned


from django import forms

from apps.administration.models import RadiologyCatalogItem
from apps.pharmacy.models import FormularyItem
from .models import Encounter, ImagingBodyPart, Laterality, Order, Prescription, SpecimenType


MEDICATION_ROUTE_CHOICES = [
    ("oral", "Oral"),
    ("iv", "IV"),
    ("im", "IM"),
    ("subcutaneous", "Subcutaneous"),
    ("topical", "Topical"),
    ("inhalation", "Inhalation"),
    ("ophthalmic", "Ophthalmic"),
    ("otic", "Otic"),
    ("rectal", "Rectal"),
    ("other", "Other"),
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


class OrderAdminForm(forms.ModelForm):
    encounter_patient_name = forms.CharField(
        required=False,
        label="Patient from encounter",
        disabled=True,
    )
    body_part = forms.ChoiceField(
        required=False,
        choices=[("", "---------"), *ImagingBodyPart.choices],
        label="Body part",
    )
    laterality = forms.ChoiceField(
        required=False,
        choices=[("", "---------"), *Laterality.choices],
    )
    specimen_type = forms.ChoiceField(
        required=False,
        choices=[("", "---------"), *SpecimenType.choices],
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        encounter = None
        encounter_value = self.data.get("encounter") or self.initial.get("encounter") or getattr(self.instance, "encounter_id", None)
        if encounter_value:
            try:
                encounter = Encounter.objects.select_related("patient").get(pk=encounter_value)
            except (Encounter.DoesNotExist, ValueError, TypeError):
                encounter = None
        if encounter:
            self.fields["encounter_patient_name"].initial = encounter.patient.full_name
        elif getattr(self.instance, "patient_id", None):
            self.fields["encounter_patient_name"].initial = self.instance.patient.full_name
        if "ordered_by" in self.fields:
            self.fields["ordered_by"].queryset = self.fields["ordered_by"].queryset.filter(role="doctor")
            self.fields["ordered_by"].help_text = "Only doctors can be selected as the ordering clinician."
        if "name" in self.fields:
            self.fields["name"].required = False
            self.fields["name"].help_text = (
                "General requested item. For imaging, this can be auto-filled from the selected exam code."
            )
        if "indication" in self.fields:
            self.fields["indication"].help_text = "Why this order is needed."
            self.fields["indication"].widget = forms.Textarea(attrs={"rows": 3})
        if "clinical_history" in self.fields:
            self.fields["clinical_history"].help_text = "Imaging-focused clinical history."
            self.fields["clinical_history"].widget = forms.Textarea(attrs={"rows": 3})
        if "notes" in self.fields:
            self.fields["notes"].help_text = "Extra internal notes."

    class Meta:
        model = Order
        exclude = ("patient",)
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 3}),
            "results": forms.Textarea(attrs={"rows": 4}),
        }

    class Media:
        js = ("doctors/js/order_admin.js",)

    def clean(self):
        cleaned = super().clean()
        encounter = cleaned.get("encounter")
        category = cleaned.get("category")
        order_name = (cleaned.get("name") or "").strip()
        exam_code = (cleaned.get("exam_code") or "").strip().upper()
        indication = (cleaned.get("indication") or "").strip()

        if encounter and not cleaned.get("patient"):
            cleaned["patient"] = encounter.patient
        if not encounter:
            self.add_error("encounter", "Please choose an encounter first.")

        if category == "imaging":
            catalog_item = None
            if exam_code:
                catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, code__iexact=exam_code).first()
                if not catalog_item:
                    catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, cpt_code__iexact=exam_code).first()
            if not catalog_item and order_name:
                catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, code__iexact=order_name).first()
                if not catalog_item:
                    catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, cpt_code__iexact=order_name).first()
                if not catalog_item:
                    catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, name__iexact=order_name).first()

            if catalog_item:
                cleaned["name"] = catalog_item.name
                cleaned["exam_code"] = cleaned.get("exam_code") or catalog_item.code
                cleaned["body_part"] = cleaned.get("body_part") or catalog_item.body_part
                cleaned["contrast_required"] = bool(cleaned.get("contrast_required") or catalog_item.with_contrast)
            elif not order_name and not exam_code:
                self.add_error("exam_code", "Choose an exam code for imaging orders.")

            if not cleaned.get("body_part"):
                self.add_error("body_part", "Choose the body part for imaging orders.")

        if category == "lab" and not order_name:
            self.add_error("name", "Lab orders still need a test name.")

        return cleaned


class PrescriptionAdminForm(forms.ModelForm):
    encounter_patient_name = forms.CharField(
        required=False,
        label="Patient from encounter",
        disabled=True,
    )
    medication = forms.ChoiceField(required=False, choices=())
    route = forms.ChoiceField(choices=MEDICATION_ROUTE_CHOICES)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        encounter = None
        encounter_value = self.data.get("encounter") or self.initial.get("encounter") or getattr(self.instance, "encounter_id", None)
        if encounter_value:
            try:
                encounter = Encounter.objects.select_related("patient").get(pk=encounter_value)
            except (Encounter.DoesNotExist, ValueError, TypeError):
                encounter = None
        if encounter:
            self.fields["encounter_patient_name"].initial = encounter.patient.full_name
        elif getattr(self.instance, "patient_id", None):
            self.fields["encounter_patient_name"].initial = self.instance.patient.full_name
        if "prescribed_by" in self.fields:
            self.fields["prescribed_by"].queryset = self.fields["prescribed_by"].queryset.filter(role="doctor")
            self.fields["prescribed_by"].help_text = "Only doctors can be selected as the prescribing clinician."
        if "medication" in self.fields:
            self.fields["medication"].choices = build_formulary_medication_choices()
            self.fields["medication"].help_text = "Brand or medication name to dispense."
        if "generic_name" in self.fields:
            self.fields["generic_name"].required = False
            self.fields["generic_name"].help_text = "Optional generic name."
        if "dosage" in self.fields:
            self.fields["dosage"].help_text = "Examples: 500 mg, 1 tablet, 10 mL."
        if "frequency" in self.fields:
            self.fields["frequency"].help_text = "Examples: BID, every 8 hours, once daily."
        if "quantity" in self.fields:
            self.fields["quantity"].help_text = "Total quantity to dispense."
        if "refills" in self.fields:
            self.fields["refills"].help_text = "How many refills are allowed."
        if "sig" in self.fields:
            self.fields["sig"].help_text = "Clear patient instructions."
        if "end_date" in self.fields:
            self.fields["end_date"].required = False

    class Meta:
        model = Prescription
        exclude = ("patient",)
        widgets = {
            "sig": forms.Textarea(attrs={"rows": 3}),
            "start_date": forms.DateInput(attrs={"type": "date"}),
            "end_date": forms.DateInput(attrs={"type": "date"}),
        }

    class Media:
        js = ("doctors/js/order_admin.js",)

    def clean(self):
        cleaned = super().clean()
        encounter = cleaned.get("encounter")
        if not encounter:
            self.add_error("encounter", "Please choose an encounter first.")
        if encounter and not cleaned.get("patient"):
            cleaned["patient"] = encounter.patient
        start_date = cleaned.get("start_date")
        end_date = cleaned.get("end_date")
        if start_date and end_date and end_date < start_date:
            self.add_error("end_date", "End date cannot be before start date.")
        return cleaned

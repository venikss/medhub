import json

from django import forms

from .models import Invoice


class InvoiceAdminForm(forms.ModelForm):
    insurance_provider = forms.CharField(required=False, label="Insurance provider")
    insurance_plan_name = forms.CharField(required=False, label="Insurance plan name")
    insurance_policy_number = forms.CharField(required=False, label="Insurance policy number")
    insurance_member_id = forms.CharField(required=False, label="Insurance member ID")
    insurance_group_number = forms.CharField(required=False, label="Insurance group number")
    insurance_coverage_type = forms.CharField(required=False, label="Insurance coverage type")
    charge_items_text = forms.CharField(
        required=False,
        label="Charge items",
        help_text="Enter a JSON list of charge items.",
        widget=forms.Textarea(attrs={"rows": 8}),
    )

    class Meta:
        model = Invoice
        fields = [
            "patient",
            "encounter_type",
            "status",
            "primary_diagnosis",
            "total_amount",
            "insurance_paid",
            "patient_paid",
            "adjustments",
            "balance",
            "sent_at",
            "void_at",
            "void_by",
        ]
        widgets = {
            "sent_at": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "void_at": forms.DateTimeInput(attrs={"type": "datetime-local"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        instance = self.instance
        if instance and instance.pk:
            insurance = instance.insurance_plan or {}
            self.fields["insurance_provider"].initial = insurance.get("provider")
            self.fields["insurance_plan_name"].initial = insurance.get("planName")
            self.fields["insurance_policy_number"].initial = insurance.get("policyNumber")
            self.fields["insurance_member_id"].initial = insurance.get("memberId")
            self.fields["insurance_group_number"].initial = insurance.get("groupNumber")
            self.fields["insurance_coverage_type"].initial = insurance.get("coverageType")
            self.fields["charge_items_text"].initial = json.dumps(
                instance.charge_items or [],
                indent=2,
            )

    def clean_charge_items_text(self):
        raw_value = self.cleaned_data.get("charge_items_text", "").strip()
        if not raw_value:
            return []
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            raise forms.ValidationError(f"Charge items must be valid JSON: {exc.msg}.")
        if not isinstance(parsed, list):
            raise forms.ValidationError("Charge items must be a JSON list.")
        return parsed

    def clean(self):
        cleaned = super().clean()
        insurance_provider = (cleaned.get("insurance_provider") or "").strip()
        policy_number = (cleaned.get("insurance_policy_number") or "").strip()
        if insurance_provider and not policy_number:
            self.add_error(
                "insurance_policy_number",
                "Policy number is required when insurance provider is set.",
            )
        return cleaned

    def save(self, commit=True):
        instance = super().save(commit=False)

        insurance_provider = (self.cleaned_data.get("insurance_provider") or "").strip()
        if insurance_provider:
            instance.insurance_plan = {
                "provider": insurance_provider,
                "planName": (self.cleaned_data.get("insurance_plan_name") or "").strip(),
                "policyNumber": (self.cleaned_data.get("insurance_policy_number") or "").strip(),
                "memberId": (self.cleaned_data.get("insurance_member_id") or "").strip(),
                "groupNumber": (self.cleaned_data.get("insurance_group_number") or "").strip(),
                "coverageType": (self.cleaned_data.get("insurance_coverage_type") or "").strip(),
            }
        else:
            instance.insurance_plan = {}

        instance.charge_items = self.cleaned_data.get("charge_items_text", [])

        if commit:
            instance.save()
            self.save_m2m()
        return instance

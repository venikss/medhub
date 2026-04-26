from django import forms

from .models import Patient


class PatientAdminForm(forms.ModelForm):
    address_line1 = forms.CharField(required=False, label="Address line 1")
    address_line2 = forms.CharField(required=False, label="Address line 2")
    city = forms.CharField(required=False)
    state = forms.CharField(required=False)
    postal_code = forms.CharField(required=False, label="Postal code")
    country = forms.CharField(required=False)

    allergies_text = forms.CharField(
        required=False,
        label="Allergies",
        help_text="Comma-separated allergy list.",
        widget=forms.Textarea(attrs={"rows": 2}),
    )

    emergency_contact_name = forms.CharField(required=False, label="Emergency contact name")
    emergency_contact_relationship = forms.CharField(required=False, label="Emergency contact relationship")
    emergency_contact_phone = forms.CharField(required=False, label="Emergency contact phone")

    insurance_policy_number = forms.CharField(required=False, label="Insurance policy number")
    insurance_group_number = forms.CharField(required=False, label="Insurance group number")
    insurance_valid_from = forms.DateField(
        required=False,
        label="Insurance valid from",
        widget=forms.DateInput(attrs={"type": "date"}),
    )
    insurance_valid_to = forms.DateField(
        required=False,
        label="Insurance valid to",
        widget=forms.DateInput(attrs={"type": "date"}),
    )
    insurance_copay = forms.DecimalField(required=False, label="Insurance copay", min_value=0, decimal_places=2)
    insurance_coverage_type = forms.CharField(required=False, label="Insurance coverage type")

    class Meta:
        model = Patient
        fields = [
            "mrn",
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
            "phone",
            "email",
            "blood_type",
            "status",
            "avatar",
            "insurance_provider",
            "insurance_id",
            "admission_date",
            "assigned_doctor",
            "ward",
            "room_number",
            "nationality",
            "marital_status",
            "preferred_language",
            "consent_signed",
        ]
        widgets = {
            "date_of_birth": forms.DateInput(attrs={"type": "date"}),
            "admission_date": forms.DateTimeInput(attrs={"type": "datetime-local"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        instance = self.instance
        if instance and instance.pk:
            address = instance.address or {}
            self.fields["address_line1"].initial = address.get("line1") or address.get("street")
            self.fields["address_line2"].initial = address.get("line2")
            self.fields["city"].initial = address.get("city")
            self.fields["state"].initial = address.get("state")
            self.fields["postal_code"].initial = address.get("postalCode") or address.get("zipCode")
            self.fields["country"].initial = address.get("country")

            allergies = instance.allergies or []
            self.fields["allergies_text"].initial = ", ".join(allergies)

            emergency = instance.emergency_contact or {}
            self.fields["emergency_contact_name"].initial = emergency.get("name")
            self.fields["emergency_contact_relationship"].initial = emergency.get("relationship")
            self.fields["emergency_contact_phone"].initial = emergency.get("phone")

            insurance = instance.insurance_details or {}
            self.fields["insurance_policy_number"].initial = insurance.get("policyNumber")
            self.fields["insurance_group_number"].initial = insurance.get("groupNumber")
            self.fields["insurance_valid_from"].initial = insurance.get("validFrom")
            self.fields["insurance_valid_to"].initial = insurance.get("validTo")
            self.fields["insurance_copay"].initial = insurance.get("copay")
            self.fields["insurance_coverage_type"].initial = insurance.get("coverageType")

    def clean(self):
        cleaned = super().clean()

        emergency_parts = [
            cleaned.get("emergency_contact_name"),
            cleaned.get("emergency_contact_relationship"),
            cleaned.get("emergency_contact_phone"),
        ]
        if any(emergency_parts) and not all(emergency_parts):
            raise forms.ValidationError("Emergency contact needs name, relationship, and phone together.")

        insurance_provider = cleaned.get("insurance_provider")
        insurance_policy_number = cleaned.get("insurance_policy_number")
        if insurance_provider and not insurance_policy_number:
            self.add_error("insurance_policy_number", "Policy number is required when insurance provider is set.")

        return cleaned

    def save(self, commit=True):
        instance = super().save(commit=False)

        instance.address = {
            "line1": self.cleaned_data.get("address_line1", "").strip(),
            "line2": self.cleaned_data.get("address_line2", "").strip(),
            "city": self.cleaned_data.get("city", "").strip(),
            "state": self.cleaned_data.get("state", "").strip(),
            "postalCode": self.cleaned_data.get("postal_code", "").strip(),
            "country": self.cleaned_data.get("country", "").strip(),
        }

        allergies_text = self.cleaned_data.get("allergies_text", "")
        instance.allergies = [item.strip() for item in allergies_text.split(",") if item.strip()]

        if self.cleaned_data.get("emergency_contact_name"):
            instance.emergency_contact = {
                "name": self.cleaned_data["emergency_contact_name"].strip(),
                "relationship": self.cleaned_data["emergency_contact_relationship"].strip(),
                "phone": self.cleaned_data["emergency_contact_phone"].strip(),
            }
        else:
            instance.emergency_contact = {}

        insurance_details = {}
        if self.cleaned_data.get("insurance_provider"):
            insurance_details = {
                "provider": self.cleaned_data["insurance_provider"].strip(),
                "policyNumber": (self.cleaned_data.get("insurance_policy_number") or "").strip(),
                "groupNumber": (self.cleaned_data.get("insurance_group_number") or "").strip(),
                "validFrom": self.cleaned_data["insurance_valid_from"].isoformat() if self.cleaned_data.get("insurance_valid_from") else None,
                "validTo": self.cleaned_data["insurance_valid_to"].isoformat() if self.cleaned_data.get("insurance_valid_to") else None,
                "copay": float(self.cleaned_data["insurance_copay"]) if self.cleaned_data.get("insurance_copay") is not None else None,
                "coverageType": (self.cleaned_data.get("insurance_coverage_type") or "").strip(),
            }
        instance.insurance_details = insurance_details

        if commit:
            instance.save()
            self.save_m2m()
        return instance

from apps.doctors import views as doctor_views
from apps.nurses import views as nurse_views
from apps.pharmacy import views as pharmacy_views
from apps.patients import views as patient_views


class PatientQueryAliasMixin:
    query_key = "patientId"

    def _inject_query(self, request, value):
        request._request.GET = request._request.GET.copy()
        request._request.GET[self.query_key] = str(value)


class WardPatientListAliasView(PatientQueryAliasMixin, patient_views.PatientListCreateView):
    query_key = "ward"

    def get(self, request, ward_id):
        self._inject_query(request, ward_id)
        return super().get(request)


class PatientEncounterListAliasView(PatientQueryAliasMixin, doctor_views.EncounterListCreateView):
    def get(self, request, patient_pk):
        self._inject_query(request, patient_pk)
        return super().get(request)


class PatientOrderListAliasView(PatientQueryAliasMixin, doctor_views.OrderListCreateView):
    def get(self, request, patient_pk):
        self._inject_query(request, patient_pk)
        return super().get(request)


class PatientPrescriptionListAliasView(PatientQueryAliasMixin, doctor_views.PrescriptionListCreateView):
    def get(self, request, patient_pk):
        self._inject_query(request, patient_pk)
        return super().get(request)


class PatientDiagnosisListAliasView(PatientQueryAliasMixin, doctor_views.DiagnosisListCreateView):
    def get(self, request, patient_pk):
        self._inject_query(request, patient_pk)
        return super().get(request)


class PatientReferralListAliasView(PatientQueryAliasMixin, doctor_views.ReferralListCreateView):
    def get(self, request, patient_pk):
        self._inject_query(request, patient_pk)
        return super().get(request)


class PatientVitalsAliasView(PatientQueryAliasMixin, nurse_views.VitalsListCreateView):
    def get(self, request, patient_id):
        self._inject_query(request, patient_id)
        return super().get(request)


class PatientIOAliasView(PatientQueryAliasMixin, nurse_views.IntakeOutputListCreateView):
    def get(self, request, patient_id):
        self._inject_query(request, patient_id)
        return super().get(request)


class PatientPainAliasView(PatientQueryAliasMixin, nurse_views.PainAssessmentListCreateView):
    def get(self, request, patient_id):
        self._inject_query(request, patient_id)
        return super().get(request)


class PatientMARAliasView(PatientQueryAliasMixin, nurse_views.MARListView):
    def get(self, request, patient_id):
        self._inject_query(request, patient_id)
        return super().get(request)


class PatientNursingNotesAliasView(PatientQueryAliasMixin, nurse_views.NursingNoteListCreateView):
    def get(self, request, patient_id):
        self._inject_query(request, patient_id)
        return super().get(request)


class PatientWoundsAliasView(PatientQueryAliasMixin, nurse_views.WoundListCreateView):
    def get(self, request, patient_id):
        self._inject_query(request, patient_id)
        return super().get(request)


class NurseTaskListAliasView(nurse_views.TaskListCreateView):
    def get(self, request, pk):
        request._request.GET = request._request.GET.copy()
        request._request.GET["assignedTo"] = str(pk)
        return super().get(request)


class PatientMedicationProfileAliasView(PatientQueryAliasMixin, pharmacy_views.PharmacyRxListView):
    def get(self, request, patient_id):
        self._inject_query(request, patient_id)
        return super().get(request)

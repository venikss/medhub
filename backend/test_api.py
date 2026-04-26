import os, sys, django, json, urllib.request

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken
from apps.authentication.models import User
from apps.patients.models import Admission, Appointment

u = User.objects.get(email="dr.ahmed.samy@hospital.eg")
tok = str(RefreshToken.for_user(u).access_token)
headers = {"Authorization": f"Bearer {tok}"}

print(f"Doctor: {u.first_name} {u.last_name} | id={u.id}")
print(f"DB admissions for this doctor: {Admission.objects.filter(admitting_doctor=u).count()}")
print(f"DB appointments for this doctor: {Appointment.objects.filter(doctor=u).count()}")

def get(path):
    req = urllib.request.Request(f"http://localhost:8000/api/v1{path}", headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=5)
        return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

# Admissions
print("\n=== GET /patients/admissions/?status=admitted ===")
d = get("/patients/admissions/?status=admitted")
if "error" in d:
    print("ERROR:", d["error"])
else:
    print(f"total: {d.get('total')}")
    for r in d.get("data", d.get("results", [])):
        mine = r.get("admittingDoctorId") == str(u.id)
        print(f"  {'[MINE]' if mine else '[ -- ]'} {r['patientName']} -> {r.get('admittingDoctorId')}")

# Appointments
print(f"\n=== GET /patients/appointments/?doctorId={u.id} ===")
d2 = get(f"/patients/appointments/?doctorId={u.id}")
if "error" in d2:
    print("ERROR:", d2["error"])
else:
    print(f"total: {d2.get('total')}")
    for r in d2.get("data", d2.get("results", [])):
        print(f"  {r['patientName']} | date={r.get('date')} | time={r.get('time')}")

# Today's appointments with date filter
from datetime import date
today = date.today().isoformat()
print(f"\n=== GET /patients/appointments/?doctorId={u.id}&date={today} ===")
d3 = get(f"/patients/appointments/?doctorId={u.id}&date={today}")
if "error" in d3:
    print("ERROR:", d3["error"])
else:
    print(f"total: {d3.get('total')}")
    for r in d3.get("data", d3.get("results", [])):
        print(f"  {r['patientName']} | date={r.get('date')}")

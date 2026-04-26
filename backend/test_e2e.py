import os, sys, django, json, urllib.request

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

BASE = "http://127.0.0.1:8000/api/v1"

# Step 1 – login directly against Django
login_data = json.dumps({"email": "dr.ahmed.samy@hospital.eg", "password": "Demo@1234", "role": "doctor"}).encode()
req = urllib.request.Request(BASE + "/auth/login/", data=login_data, headers={"Content-Type": "application/json"}, method="POST")
resp = urllib.request.urlopen(req, timeout=10)
d = json.loads(resp.read())
tok = d.get("token", "")
user = d.get("user", {})
my_id = user.get("id", "")
print(f"[1] LOGIN:  {'OK' if tok else 'FAILED'}")
print(f"    user.id = {my_id}")
print(f"    role    = {user.get('role')}")

def get(path):
    r = urllib.request.Request(BASE + path, headers={"Authorization": f"Bearer {tok}"})
    return json.loads(urllib.request.urlopen(r, timeout=10).read())

# Step 2 – /auth/me
me = get("/auth/me/")
print(f"\n[2] /auth/me: {me.get('firstName')} {me.get('lastName')} | role={me.get('role')}")

# Step 3 – admissions (all + mine)
adm = get("/patients/admissions/?status=admitted")
mine_adm = [r for r in adm.get("data", []) if r.get("admittingDoctorId") == my_id]
print(f"\n[3] Admissions (total={adm.get('total')}, mine={len(mine_adm)}):")
for r in mine_adm:
    print(f"    - {r['patientName']} | ward={r.get('ward')} | bed={r.get('bed')}")

# Step 4 – appointments for this doctor
appts = get(f"/patients/appointments/?doctorId={my_id}")
print(f"\n[4] Appointments (total={appts.get('total')}):")
for r in appts.get("data", []):
    print(f"    - {r['patientName']} | date={r.get('date')} | time={r.get('time')}")

# Step 5 – today's appointments
from datetime import date
today = date.today().isoformat()
appts_today = get(f"/patients/appointments/?doctorId={my_id}&date={today}")
print(f"\n[5] Today ({today}) appointments (total={appts_today.get('total')}):")
for r in appts_today.get("data", []):
    print(f"    - {r['patientName']}")

print("\n=== ALL CHECKS PASSED ===")

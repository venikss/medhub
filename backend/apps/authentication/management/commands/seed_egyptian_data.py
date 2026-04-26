"""
Seed command: python manage.py seed_egyptian_data [--clear]

Populates the database with rich, realistic Egyptian hospital sample data
covering all major modules: patients, staff, departments, wards, encounters,
diagnoses, prescriptions, lab, radiology, pharmacy, CDSS, and nursing vitals.
"""

from datetime import date, time, timedelta

from django.core.management.base import BaseCommand
from django.db import OperationalError, ProgrammingError
from django.utils import timezone


SEED_PASSWORD = "Demo@1234"

# ─── Reference data ───────────────────────────────────────────────────────────

DEPARTMENTS = [
    {"name": "Internal Medicine",      "code": "IM",   "type": "clinical"},
    {"name": "Cardiology",             "code": "CARD", "type": "clinical"},
    {"name": "Pediatrics",             "code": "PED",  "type": "clinical"},
    {"name": "Obstetrics & Gynecology","code": "OBG",  "type": "clinical"},
    {"name": "Surgery",                "code": "SURG", "type": "surgical"},
    {"name": "Emergency",              "code": "ER",   "type": "emergency"},
    {"name": "Radiology",              "code": "RAD",  "type": "diagnostic"},
    {"name": "Laboratory",             "code": "LAB",  "type": "diagnostic"},
    {"name": "Pharmacy",               "code": "PHA",  "type": "pharmacy"},
    {"name": "Administration",         "code": "ADM",  "type": "administrative"},
    {"name": "Billing",                "code": "BIL",  "type": "administrative"},
    {"name": "Front Desk",             "code": "FD",   "type": "administrative"},
]

WARDS = [
    {"name": "General Ward – Internal Medicine", "code": "GW-IM",  "type": "general",   "floor": 2, "beds": 20, "dept": "IM"},
    {"name": "Cardiac Care Unit",                "code": "CCU",     "type": "icu-cardiac","floor": 3, "beds": 8,  "dept": "CARD"},
    {"name": "Pediatric Ward",                   "code": "PED-W",   "type": "pediatric", "floor": 4, "beds": 12, "dept": "PED"},
    {"name": "Maternity Ward",                   "code": "MAT-W",   "type": "maternity", "floor": 5, "beds": 10, "dept": "OBG"},
    {"name": "ICU",                              "code": "ICU",     "type": "icu",       "floor": 1, "beds": 6,  "dept": "IM"},
    {"name": "Emergency Ward",                   "code": "ER-W",    "type": "emergency", "floor": 0, "beds": 10, "dept": "ER"},
]

STAFF = [
    # Doctors
    {"email": "dr.ahmed.samy@hospital.eg",     "first_name": "Ahmed",    "last_name": "Samy",     "role": "doctor",        "specialization": "Internal Medicine",  "dept": "IM"},
    {"email": "dr.fatima.ali@hospital.eg",     "first_name": "Fatima",   "last_name": "Ali",      "role": "doctor",        "specialization": "Cardiology",         "dept": "CARD"},
    {"email": "dr.omar.hassan@hospital.eg",    "first_name": "Omar",     "last_name": "Hassan",   "role": "doctor",        "specialization": "Pediatrics",         "dept": "PED"},
    {"email": "dr.mona.ibrahim@hospital.eg",   "first_name": "Mona",     "last_name": "Ibrahim",  "role": "doctor",        "specialization": "Obstetrics & Gyn",   "dept": "OBG"},
    # Nurses
    {"email": "nurse.hana.khalil@hospital.eg", "first_name": "Hana",     "last_name": "Khalil",   "role": "nurse",         "specialization": "Inpatient Nursing",  "dept": "IM"},
    {"email": "nurse.dalia.nour@hospital.eg",  "first_name": "Dalia",    "last_name": "Nour",     "role": "nurse",         "specialization": "Neonatal Nursing",   "dept": "PED"},
    # Lab
    {"email": "lab.youssef@hospital.eg",       "first_name": "Youssef",  "last_name": "Abdullah", "role": "lab_tech",      "specialization": "Clinical Chemistry", "dept": "LAB"},
    {"email": "lab.nadia.farouk@hospital.eg",  "first_name": "Nadia",    "last_name": "Farouk",   "role": "lab_tech",      "specialization": "Hematology",         "dept": "LAB"},
    # Radiology
    {"email": "rad.khaled.fawzi@hospital.eg",  "first_name": "Khaled",   "last_name": "Fawzi",    "role": "radiologist",   "specialization": "Diagnostic Radiology","dept": "RAD"},
    # Pharmacy
    {"email": "pharm.rania.said@hospital.eg",  "first_name": "Rania",    "last_name": "Said",     "role": "pharmacist",    "specialization": "Clinical Pharmacy",  "dept": "PHA"},
    # Admin / billing / front-desk
    {"email": "admin@hospital.eg",             "first_name": "Mohamed",  "last_name": "Hossam",   "role": "admin",         "specialization": None,                 "dept": "ADM"},
    {"email": "billing.sara@hospital.eg",      "first_name": "Sara",     "last_name": "Mahmoud",  "role": "billing_staff", "specialization": None,                 "dept": "BIL"},
    {"email": "frontdesk.layla@hospital.eg",   "first_name": "Layla",    "last_name": "Amin",     "role": "front_desk",    "specialization": None,                 "dept": "FD"},
]

PATIENTS_DATA = [
    {
        "first_name": "Mohamed",   "last_name": "Abdelaziz",
        "dob": date(1967, 4, 12), "gender": "male",   "phone": "+201001112201",
        "blood_type": "A+",  "marital": "married",
        "city": "Cairo",     "district": "Nasr City",
        "insurance": "National Health Insurance Organization", "insurance_id": "NHIO-100221",
        "allergies": [{"substance": "Penicillin", "reaction": "Anaphylaxis", "severity": "severe"}],
        "emergency_contact": {"name": "Aliaa Abdelaziz", "relation": "wife", "phone": "+201001112202"},
        "ward": "GW-IM",
    },
    {
        "first_name": "Fatima",  "last_name": "El-Shimy",
        "dob": date(1982, 9, 3),  "gender": "female", "phone": "+201002223301",
        "blood_type": "O+",  "marital": "married",
        "city": "Giza",      "district": "Dokki",
        "insurance": "Misr Insurance", "insurance_id": "MISR-200445",
        "allergies": [],
        "emergency_contact": {"name": "Ahmed El-Shimy", "relation": "husband", "phone": "+201002223302"},
        "ward": "CCU",
    },
    {
        "first_name": "Ahmed",   "last_name": "Tawfik",
        "dob": date(1955, 11, 20), "gender": "male", "phone": "+201003334401",
        "blood_type": "B+",  "marital": "married",
        "city": "Alexandria",  "district": "El-Manshia",
        "insurance": "AXA Egypt", "insurance_id": "AXA-300551",
        "allergies": [{"substance": "Aspirin", "reaction": "Gastric bleeding", "severity": "moderate"}],
        "emergency_contact": {"name": "Nour Tawfik", "relation": "daughter", "phone": "+201003334402"},
        "ward": "CCU",
    },
    {
        "first_name": "Nour",     "last_name": "Salem",
        "dob": date(1995, 7, 8),  "gender": "female", "phone": "+201004445501",
        "blood_type": "AB-", "marital": "single",
        "city": "Cairo",     "district": "Fifth Settlement",
        "insurance": "National Health Insurance Organization", "insurance_id": "NHIO-400662",
        "allergies": [],
        "emergency_contact": {"name": "Samy Salem", "relation": "father", "phone": "+201004445502"},
        "ward": None,
    },
    {
        "first_name": "Ibrahim","last_name": "Mostafa",
        "dob": date(1945, 1, 5),  "gender": "male",   "phone": "+201005556601",
        "blood_type": "O-",  "marital": "widowed",
        "city": "Cairo",     "district": "Abbasiya",
        "insurance": "National Health Insurance Organization", "insurance_id": "NHIO-500773",
        "allergies": [{"substance": "Sulfonamides", "reaction": "Rash", "severity": "mild"}],
        "emergency_contact": {"name": "Youssef Ibrahim", "relation": "son", "phone": "+201005556602"},
        "ward": "GW-IM",
    },
    {
        "first_name": "Mona",    "last_name": "Eissa",
        "dob": date(1972, 3, 25), "gender": "female", "phone": "+201006667701",
        "blood_type": "A-",  "marital": "divorced",
        "city": "Mansoura",   "district": "Downtown",
        "insurance": "Metlife Egypt", "insurance_id": "MET-600884",
        "allergies": [],
        "emergency_contact": {"name": "Reda Eissa", "relation": "brother", "phone": "+201006667702"},
        "ward": "PED-W",
    },
    {
        "first_name": "Omar",     "last_name": "Awad",
        "dob": date(2010, 6, 15), "gender": "male",   "phone": "+201007778801",
        "blood_type": "B-",  "marital": "single",
        "city": "Luxor",      "district": "El-Bayadiya",
        "insurance": "SEHA", "insurance_id": "SEHA-700995",
        "allergies": [],
        "emergency_contact": {"name": "Hossam Awad", "relation": "father", "phone": "+201007778802"},
        "ward": "PED-W",
    },
    {
        "first_name": "Rana",     "last_name": "Haddad",
        "dob": date(1989, 12, 30), "gender": "female","phone": "+201008889901",
        "blood_type": "O+",  "marital": "married",
        "city": "Cairo",     "district": "Heliopolis",
        "insurance": "AXA Egypt", "insurance_id": "AXA-800116",
        "allergies": [{"substance": "Codeine", "reaction": "Nausea/vomiting", "severity": "mild"}],
        "emergency_contact": {"name": "Tarek Haddad", "relation": "husband", "phone": "+201008889902"},
        "ward": "MAT-W",
    },
    {
        "first_name": "Hassan",    "last_name": "Gad",
        "dob": date(1960, 8, 18), "gender": "male",   "phone": "+201009990001",
        "blood_type": "AB+", "marital": "married",
        "city": "Aswan",       "district": "Aswan Corniche",
        "insurance": "National Health Insurance Organization", "insurance_id": "NHIO-900227",
        "allergies": [],
        "emergency_contact": {"name": "Layla Gad", "relation": "wife", "phone": "+201009990002"},
        "ward": "ICU",
    },
    {
        "first_name": "Amira",  "last_name": "Abou Seif",
        "dob": date(2001, 4, 22), "gender": "female", "phone": "+201011101101",
        "blood_type": "A+",  "marital": "single",
        "city": "Ismailia","district": "Sheikh Zayed",
        "insurance": "Misr Insurance", "insurance_id": "MISR-101228",
        "allergies": [],
        "emergency_contact": {"name": "Samar Abou Seif", "relation": "mother", "phone": "+201011101102"},
        "ward": None,
    },
    {
        "first_name": "Youssef",   "last_name": "El-Deeb",
        "dob": date(1978, 2, 7),  "gender": "male",   "phone": "+201012202201",
        "blood_type": "B+",  "marital": "married",
        "city": "Hurghada",     "district": "El-Dahar",
        "insurance": "MetLife Egypt", "insurance_id": "MET-111339",
        "allergies": [{"substance": "NSAIDs", "reaction": "Bronchoconstriction", "severity": "severe"}],
        "emergency_contact": {"name": "Hoda El-Deeb", "relation": "wife", "phone": "+201012202202"},
        "ward": "ER-W",
    },
    {
        "first_name": "Dalia",  "last_name": "Salama",
        "dob": date(1936, 5, 14), "gender": "female", "phone": "+201013303301",
        "blood_type": "O-",  "marital": "widowed",
        "city": "Cairo",     "district": "Helwan",
        "insurance": "National Health Insurance Organization", "insurance_id": "NHIO-121440",
        "allergies": [],
        "emergency_contact": {"name": "Karim Salama", "relation": "son", "phone": "+201013303302"},
        "ward": "GW-IM",
    },
]

FORMULARY = [
    {"name": "Paracetamol 500 mg Tablet", "generic": "Paracetamol", "class": "Analgesic/Antipyretic", "rxnorm": "161", "status": "formulary", "stock": 500, "unit": "tablet", "cost": 0.50},
    {"name": "Amoxicillin 500 mg Capsule", "generic": "Amoxicillin", "class": "Antibiotic – Penicillin", "rxnorm": "723", "status": "formulary", "stock": 200, "unit": "capsule", "cost": 1.20},
    {"name": "Metformin 500 mg Tablet", "generic": "Metformin", "class": "Biguanide Antidiabetic", "rxnorm": "6809", "status": "formulary", "stock": 300, "unit": "tablet", "cost": 0.80},
    {"name": "Amlodipine 5 mg Tablet", "generic": "Amlodipine Besylate", "class": "Calcium Channel Blocker", "rxnorm": "17767", "status": "formulary", "stock": 250, "unit": "tablet", "cost": 1.50},
    {"name": "Atorvastatin 20 mg Tablet", "generic": "Atorvastatin Calcium", "class": "HMG-CoA Reductase Inhibitor", "rxnorm": "83367", "status": "formulary", "stock": 180, "unit": "tablet", "cost": 2.00},
    {"name": "Omeprazole 20 mg Capsule", "generic": "Omeprazole", "class": "Proton Pump Inhibitor", "rxnorm": "7646", "status": "formulary", "stock": 220, "unit": "capsule", "cost": 1.00},
    {"name": "Furosemide 40 mg Tablet", "generic": "Furosemide", "class": "Loop Diuretic", "rxnorm": "4603", "status": "formulary", "stock": 150, "unit": "tablet", "cost": 0.60},
    {"name": "Bisoprolol 5 mg Tablet", "generic": "Bisoprolol Fumarate", "class": "Beta-1 Selective Blocker", "rxnorm": "19484", "status": "formulary", "stock": 120, "unit": "tablet", "cost": 1.80},
    {"name": "Ramipril 5 mg Capsule", "generic": "Ramipril", "class": "ACE Inhibitor", "rxnorm": "35208", "status": "formulary", "stock": 100, "unit": "capsule", "cost": 2.20},
    {"name": "Azithromycin 500 mg Tablet", "generic": "Azithromycin", "class": "Macrolide Antibiotic", "rxnorm": "308460", "status": "formulary", "stock": 80, "unit": "tablet", "cost": 3.50},
    {"name": "Enoxaparin 40 mg Injection", "generic": "Enoxaparin Sodium", "class": "Low Molecular Weight Heparin", "rxnorm": "67108", "status": "formulary", "stock": 60, "unit": "vial", "cost": 18.00},
    {"name": "Insulin Glargine 100 IU/mL", "generic": "Insulin Glargine", "class": "Long-Acting Insulin", "rxnorm": "274783", "status": "formulary", "stock": 45, "unit": "pen", "cost": 55.00},
    {"name": "Salbutamol 100 mcg Inhaler", "generic": "Salbutamol Sulfate", "class": "Short-Acting Beta-2 Agonist", "rxnorm": "435", "status": "formulary", "stock": 90, "unit": "inhaler", "cost": 12.00},
    {"name": "Prednisolone 5 mg Tablet", "generic": "Prednisolone", "class": "Glucocorticoid", "rxnorm": "8638", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 0.70},
    {"name": "Warfarin 5 mg Tablet", "generic": "Warfarin Sodium", "class": "Vitamin K Antagonist", "rxnorm": "114194", "status": "restricted", "stock": 50, "unit": "tablet", "cost": 1.10},
    {"name": "Clopidogrel 75 mg Tablet", "generic": "Clopidogrel Bisulfate", "class": "P2Y12 Inhibitor", "rxnorm": "174742", "status": "formulary", "stock": 110, "unit": "tablet", "cost": 4.00},
    {"name": "Lisinopril 10 mg Tablet", "generic": "Lisinopril", "class": "ACE Inhibitor", "rxnorm": "29046", "status": "formulary", "stock": 130, "unit": "tablet", "cost": 1.60},
    {"name": "Ciprofloxacin 500 mg Tablet", "generic": "Ciprofloxacin HCl", "class": "Fluoroquinolone Antibiotic", "rxnorm": "2551", "status": "formulary", "stock": 75, "unit": "tablet", "cost": 2.80},
    {"name": "Digoxin 0.25 mg Tablet", "generic": "Digoxin", "class": "Cardiac Glycoside", "rxnorm": "3407", "status": "restricted", "stock": 40, "unit": "tablet", "cost": 1.90},
    {"name": "Spironolactone 25 mg Tablet", "generic": "Spironolactone", "class": "Potassium-Sparing Diuretic", "rxnorm": "9997", "status": "formulary", "stock": 95, "unit": "tablet", "cost": 1.40},
    {"name": "Hydroxychloroquine 200 mg Tablet", "generic": "Hydroxychloroquine Sulfate", "class": "Antimalarial/DMARD", "rxnorm": "5521", "status": "non-formulary", "stock": 20, "unit": "tablet", "cost": 6.00},
    {"name": "Omeprazole 20 mg Capsule", "generic": "Omeprazole", "class": "Proton Pump Inhibitor", "rxnorm": "7646", "status": "formulary", "stock": 220, "unit": "capsule", "cost": 1.00},
    {"name": "Furosemide 40 mg Tablet", "generic": "Furosemide", "class": "Loop Diuretic", "rxnorm": "4603", "status": "formulary", "stock": 150, "unit": "tablet", "cost": 0.60},
    {"name": "Bisoprolol 5 mg Tablet", "generic": "Bisoprolol Fumarate", "class": "Beta-1 Selective Blocker", "rxnorm": "19484", "status": "formulary", "stock": 120, "unit": "tablet", "cost": 1.80},
    {"name": "Ramipril 5 mg Capsule", "generic": "Ramipril", "class": "ACE Inhibitor", "rxnorm": "35208", "status": "formulary", "stock": 100, "unit": "capsule", "cost": 2.20},
    {"name": "Azithromycin 500 mg Tablet", "generic": "Azithromycin", "class": "Macrolide Antibiotic", "rxnorm": "308460", "status": "formulary", "stock": 80, "unit": "tablet", "cost": 3.50},
    {"name": "Enoxaparin 40 mg Injection", "generic": "Enoxaparin Sodium", "class": "Low Molecular Weight Heparin", "rxnorm": "67108", "status": "formulary", "stock": 60, "unit": "vial", "cost": 18.00},
    {"name": "Insulin Glargine 100 IU/mL", "generic": "Insulin Glargine", "class": "Long-Acting Insulin", "rxnorm": "274783", "status": "formulary", "stock": 45, "unit": "pen", "cost": 55.00},
    {"name": "Salbutamol 100 mcg Inhaler", "generic": "Salbutamol Sulfate", "class": "Short-Acting Beta-2 Agonist", "rxnorm": "435", "status": "formulary", "stock": 90, "unit": "inhaler", "cost": 12.00},
    {"name": "Prednisolone 5 mg Tablet", "generic": "Prednisolone", "class": "Glucocorticoid", "rxnorm": "8638", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 0.70},
    {"name": "Warfarin 5 mg Tablet", "generic": "Warfarin Sodium", "class": "Vitamin K Antagonist", "rxnorm": "114194", "status": "restricted", "stock": 50, "unit": "tablet", "cost": 1.10},
    {"name": "Clopidogrel 75 mg Tablet", "generic": "Clopidogrel Bisulfate", "class": "P2Y12 Inhibitor", "rxnorm": "174742", "status": "formulary", "stock": 110, "unit": "tablet", "cost": 4.00},
    {"name": "Lisinopril 10 mg Tablet", "generic": "Lisinopril", "class": "ACE Inhibitor", "rxnorm": "29046", "status": "formulary", "stock": 130, "unit": "tablet", "cost": 1.60},
    {"name": "Ciprofloxacin 500 mg Tablet", "generic": "Ciprofloxacin HCl", "class": "Fluoroquinolone Antibiotic", "rxnorm": "2551", "status": "formulary", "stock": 75, "unit": "tablet", "cost": 2.80},
    {"name": "Digoxin 0.25 mg Tablet", "generic": "Digoxin", "class": "Cardiac Glycoside", "rxnorm": "3407", "status": "restricted", "stock": 40, "unit": "tablet", "cost": 1.90},
    {"name": "Spironolactone 25 mg Tablet", "generic": "Spironolactone", "class": "Potassium-Sparing Diuretic", "rxnorm": "9997", "status": "formulary", "stock": 95, "unit": "tablet", "cost": 1.40},
    {"name": "Hydroxychloroquine 200 mg Tablet", "generic": "Hydroxychloroquine Sulfate", "class": "Antimalarial/DMARD", "rxnorm": "5521", "status": "non-formulary", "stock": 20, "unit": "tablet", "cost": 6.00},
    {"name": "Pantoprazole 40 mg IV", "generic": "Pantoprazole Sodium", "class": "Proton Pump Inhibitor", "rxnorm": "40790", "status": "formulary", "stock": 55, "unit": "vial", "cost": 8.00},

    # ── Antibiotics ──────────────────────────────────────────────────────────
    {"name": "Piperacillin-Tazobactam 4.5 g IV", "generic": "Piperacillin/Tazobactam", "class": "Beta-lactam/Beta-lactamase Inhibitor", "rxnorm": "1743963", "status": "restricted", "stock": 60, "unit": "vial", "cost": 35.00},
    {"name": "Meropenem 1 g IV", "generic": "Meropenem", "class": "Carbapenem Antibiotic", "rxnorm": "29561", "status": "restricted", "stock": 40, "unit": "vial", "cost": 55.00},
    {"name": "Vancomycin 500 mg IV", "generic": "Vancomycin HCl", "class": "Glycopeptide Antibiotic", "rxnorm": "11124", "status": "restricted", "stock": 50, "unit": "vial", "cost": 22.00},
    {"name": "Ceftriaxone 1 g IV", "generic": "Ceftriaxone Sodium", "class": "3rd Generation Cephalosporin", "rxnorm": "2193", "status": "formulary", "stock": 100, "unit": "vial", "cost": 12.00},
    {"name": "Cefazolin 1 g IV", "generic": "Cefazolin Sodium", "class": "1st Generation Cephalosporin", "rxnorm": "2180", "status": "formulary", "stock": 80, "unit": "vial", "cost": 8.00},
    {"name": "Metronidazole 500 mg Tablet", "generic": "Metronidazole", "class": "Nitroimidazole Antibiotic", "rxnorm": "6922", "status": "formulary", "stock": 150, "unit": "tablet", "cost": 0.50},
    {"name": "Metronidazole 500 mg IV", "generic": "Metronidazole", "class": "Nitroimidazole Antibiotic", "rxnorm": "6922", "status": "formulary", "stock": 70, "unit": "vial", "cost": 6.00},
    {"name": "Doxycycline 100 mg Capsule", "generic": "Doxycycline Hyclate", "class": "Tetracycline Antibiotic", "rxnorm": "3640", "status": "formulary", "stock": 90, "unit": "capsule", "cost": 1.50},
    {"name": "Trimethoprim-Sulfamethoxazole 960 mg Tablet", "generic": "Co-trimoxazole", "class": "Sulfonamide Antibiotic", "rxnorm": "10829", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 0.80},
    {"name": "Fluconazole 150 mg Capsule", "generic": "Fluconazole", "class": "Azole Antifungal", "rxnorm": "4450", "status": "formulary", "stock": 60, "unit": "capsule", "cost": 4.50},
    {"name": "Levofloxacin 500 mg Tablet", "generic": "Levofloxacin", "class": "Fluoroquinolone Antibiotic", "rxnorm": "82122", "status": "formulary", "stock": 70, "unit": "tablet", "cost": 3.20},
    {"name": "Clarithromycin 500 mg Tablet", "generic": "Clarithromycin", "class": "Macrolide Antibiotic", "rxnorm": "2580", "status": "formulary", "stock": 60, "unit": "tablet", "cost": 4.00},

    # ── Cardiovascular ────────────────────────────────────────────────────────
    {"name": "Atorvastatin 40 mg Tablet", "generic": "Atorvastatin Calcium", "class": "HMG-CoA Reductase Inhibitor", "rxnorm": "617311", "status": "formulary", "stock": 160, "unit": "tablet", "cost": 2.50},
    {"name": "Rosuvastatin 10 mg Tablet", "generic": "Rosuvastatin Calcium", "class": "HMG-CoA Reductase Inhibitor", "rxnorm": "301542", "status": "formulary", "stock": 120, "unit": "tablet", "cost": 3.00},
    {"name": "Amlodipine 10 mg Tablet", "generic": "Amlodipine Besylate", "class": "Calcium Channel Blocker", "rxnorm": "329526", "status": "formulary", "stock": 180, "unit": "tablet", "cost": 2.00},
    {"name": "Valsartan 80 mg Tablet", "generic": "Valsartan", "class": "Angiotensin Receptor Blocker", "rxnorm": "69749", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 3.50},
    {"name": "Losartan 50 mg Tablet", "generic": "Losartan Potassium", "class": "Angiotensin Receptor Blocker", "rxnorm": "52175", "status": "formulary", "stock": 110, "unit": "tablet", "cost": 2.80},
    {"name": "Carvedilol 25 mg Tablet", "generic": "Carvedilol", "class": "Alpha/Beta Blocker", "rxnorm": "20352", "status": "formulary", "stock": 80, "unit": "tablet", "cost": 2.20},
    {"name": "Nitroglycerin 0.5 mg Sublingual", "generic": "Glyceryl Trinitrate", "class": "Nitrate", "rxnorm": "7454", "status": "formulary", "stock": 50, "unit": "tablet", "cost": 1.00},
    {"name": "Isosorbide Mononitrate 60 mg Tablet", "generic": "Isosorbide Mononitrate", "class": "Organic Nitrate", "rxnorm": "41493", "status": "formulary", "stock": 70, "unit": "tablet", "cost": 1.60},
    {"name": "Amiodarone 200 mg Tablet", "generic": "Amiodarone HCl", "class": "Class III Antiarrhythmic", "rxnorm": "703", "status": "restricted", "stock": 40, "unit": "tablet", "cost": 5.00},
    {"name": "Amiodarone 150 mg IV", "generic": "Amiodarone HCl", "class": "Class III Antiarrhythmic", "rxnorm": "703", "status": "restricted", "stock": 25, "unit": "vial", "cost": 18.00},
    {"name": "Heparin 5000 IU/mL IV", "generic": "Unfractionated Heparin", "class": "Anticoagulant", "rxnorm": "5224", "status": "restricted", "stock": 60, "unit": "vial", "cost": 10.00},
    {"name": "Aspirin 75 mg Tablet", "generic": "Acetylsalicylic Acid", "class": "Antiplatelet/NSAID", "rxnorm": "1191", "status": "formulary", "stock": 300, "unit": "tablet", "cost": 0.20},
    {"name": "Aspirin 300 mg Tablet", "generic": "Acetylsalicylic Acid", "class": "Antiplatelet/NSAID", "rxnorm": "1191", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 0.30},
    {"name": "Rivaroxaban 20 mg Tablet", "generic": "Rivaroxaban", "class": "Direct Factor Xa Inhibitor", "rxnorm": "1037045", "status": "formulary", "stock": 60, "unit": "tablet", "cost": 12.00},
    {"name": "Apixaban 5 mg Tablet", "generic": "Apixaban", "class": "Direct Factor Xa Inhibitor", "rxnorm": "1364430", "status": "formulary", "stock": 50, "unit": "tablet", "cost": 14.00},
    {"name": "Dopamine 200 mg IV", "generic": "Dopamine HCl", "class": "Vasopressor/Inotrope", "rxnorm": "3628", "status": "restricted", "stock": 30, "unit": "vial", "cost": 20.00},
    {"name": "Norepinephrine 4 mg IV", "generic": "Norepinephrine Bitartrate", "class": "Vasopressor", "rxnorm": "7801", "status": "restricted", "stock": 30, "unit": "vial", "cost": 25.00},

    # ── Diabetes & Endocrine ──────────────────────────────────────────────────
    {"name": "Metformin 1000 mg Tablet", "generic": "Metformin HCl", "class": "Biguanide Antidiabetic", "rxnorm": "861007", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 1.20},
    {"name": "Glibenclamide 5 mg Tablet", "generic": "Glibenclamide", "class": "Sulfonylurea Antidiabetic", "rxnorm": "4815", "status": "formulary", "stock": 150, "unit": "tablet", "cost": 0.60},
    {"name": "Glimepiride 2 mg Tablet", "generic": "Glimepiride", "class": "Sulfonylurea Antidiabetic", "rxnorm": "25789", "status": "formulary", "stock": 120, "unit": "tablet", "cost": 1.00},
    {"name": "Sitagliptin 100 mg Tablet", "generic": "Sitagliptin Phosphate", "class": "DPP-4 Inhibitor", "rxnorm": "593411", "status": "formulary", "stock": 80, "unit": "tablet", "cost": 8.00},
    {"name": "Empagliflozin 10 mg Tablet", "generic": "Empagliflozin", "class": "SGLT-2 Inhibitor", "rxnorm": "1545653", "status": "formulary", "stock": 60, "unit": "tablet", "cost": 15.00},
    {"name": "Insulin Regular 100 IU/mL", "generic": "Insulin Regular", "class": "Short-Acting Insulin", "rxnorm": "253182", "status": "formulary", "stock": 50, "unit": "vial", "cost": 30.00},
    {"name": "Insulin NPH 100 IU/mL", "generic": "Insulin Isophane", "class": "Intermediate-Acting Insulin", "rxnorm": "92074", "status": "formulary", "stock": 40, "unit": "vial", "cost": 28.00},
    {"name": "Levothyroxine 50 mcg Tablet", "generic": "Levothyroxine Sodium", "class": "Thyroid Hormone", "rxnorm": "10582", "status": "formulary", "stock": 150, "unit": "tablet", "cost": 0.80},
    {"name": "Levothyroxine 100 mcg Tablet", "generic": "Levothyroxine Sodium", "class": "Thyroid Hormone", "rxnorm": "10582", "status": "formulary", "stock": 120, "unit": "tablet", "cost": 1.00},
    {"name": "Propylthiouracil 50 mg Tablet", "generic": "Propylthiouracil", "class": "Antithyroid Agent", "rxnorm": "8987", "status": "restricted", "stock": 40, "unit": "tablet", "cost": 1.50},
    {"name": "Hydrocortisone 100 mg IV", "generic": "Hydrocortisone Sodium Succinate", "class": "Glucocorticoid", "rxnorm": "5489", "status": "formulary", "stock": 50, "unit": "vial", "cost": 8.00},

    # ── Respiratory ───────────────────────────────────────────────────────────
    {"name": "Budesonide/Formoterol 160/4.5 mcg Inhaler", "generic": "Budesonide/Formoterol", "class": "ICS/LABA Combination", "rxnorm": "896209", "status": "formulary", "stock": 60, "unit": "inhaler", "cost": 28.00},
    {"name": "Tiotropium 18 mcg Inhaler", "generic": "Tiotropium Bromide", "class": "LAMA Bronchodilator", "rxnorm": "274783", "status": "formulary", "stock": 40, "unit": "inhaler", "cost": 35.00},
    {"name": "Ipratropium 20 mcg Inhaler", "generic": "Ipratropium Bromide", "class": "SAMA Bronchodilator", "rxnorm": "7213", "status": "formulary", "stock": 50, "unit": "inhaler", "cost": 10.00},
    {"name": "Montelukast 10 mg Tablet", "generic": "Montelukast Sodium", "class": "Leukotriene Receptor Antagonist", "rxnorm": "41493", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 3.50},
    {"name": "Dexamethasone 4 mg IV", "generic": "Dexamethasone Sodium Phosphate", "class": "Glucocorticoid", "rxnorm": "3264", "status": "formulary", "stock": 80, "unit": "vial", "cost": 3.00},
    {"name": "N-Acetylcysteine 600 mg Sachet", "generic": "Acetylcysteine", "class": "Mucolytic Agent", "rxnorm": "26306", "status": "formulary", "stock": 120, "unit": "sachet", "cost": 1.50},

    # ── Gastroenterology ──────────────────────────────────────────────────────
    {"name": "Esomeprazole 40 mg Capsule", "generic": "Esomeprazole Magnesium", "class": "Proton Pump Inhibitor", "rxnorm": "283921", "status": "formulary", "stock": 150, "unit": "capsule", "cost": 2.50},
    {"name": "Ranitidine 150 mg Tablet", "generic": "Ranitidine HCl", "class": "H2 Receptor Antagonist", "rxnorm": "9143", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 0.70},
    {"name": "Ondansetron 4 mg Tablet", "generic": "Ondansetron HCl", "class": "5-HT3 Receptor Antagonist (Antiemetic)", "rxnorm": "312086", "status": "formulary", "stock": 150, "unit": "tablet", "cost": 2.00},
    {"name": "Ondansetron 8 mg IV", "generic": "Ondansetron HCl", "class": "5-HT3 Receptor Antagonist (Antiemetic)", "rxnorm": "312087", "status": "formulary", "stock": 80, "unit": "vial", "cost": 5.00},
    {"name": "Metoclopramide 10 mg Tablet", "generic": "Metoclopramide HCl", "class": "Prokinetic/Antiemetic", "rxnorm": "6956", "status": "formulary", "stock": 120, "unit": "tablet", "cost": 0.50},
    {"name": "Domperidone 10 mg Tablet", "generic": "Domperidone", "class": "Prokinetic Agent", "rxnorm": "3638", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 0.60},
    {"name": "Loperamide 2 mg Capsule", "generic": "Loperamide HCl", "class": "Antidiarrheal", "rxnorm": "41493", "status": "formulary", "stock": 80, "unit": "capsule", "cost": 0.80},
    {"name": "Lactulose 10 g/15 mL Syrup", "generic": "Lactulose", "class": "Osmotic Laxative", "rxnorm": "6432", "status": "formulary", "stock": 60, "unit": "bottle", "cost": 5.00},
    {"name": "Bisacodyl 5 mg Tablet", "generic": "Bisacodyl", "class": "Stimulant Laxative", "rxnorm": "1440", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 0.30},

    # ── Neurology & Psychiatry ────────────────────────────────────────────────
    {"name": "Amlodipine 5 mg Tablet", "generic": "Amlodipine Besylate", "class": "Calcium Channel Blocker", "rxnorm": "17767", "status": "formulary", "stock": 250, "unit": "tablet", "cost": 1.50},
    {"name": "Phenytoin 100 mg Capsule", "generic": "Phenytoin Sodium", "class": "Antiepileptic – Hydantoin", "rxnorm": "8124", "status": "restricted", "stock": 60, "unit": "capsule", "cost": 1.20},
    {"name": "Valproate 500 mg Tablet", "generic": "Valproic Acid", "class": "Antiepileptic", "rxnorm": "11118", "status": "formulary", "stock": 80, "unit": "tablet", "cost": 1.80},
    {"name": "Carbamazepine 200 mg Tablet", "generic": "Carbamazepine", "class": "Antiepileptic", "rxnorm": "2002", "status": "formulary", "stock": 70, "unit": "tablet", "cost": 1.00},
    {"name": "Levetiracetam 500 mg Tablet", "generic": "Levetiracetam", "class": "Antiepileptic", "rxnorm": "285522", "status": "formulary", "stock": 60, "unit": "tablet", "cost": 4.00},
    {"name": "Diazepam 5 mg Tablet", "generic": "Diazepam", "class": "Benzodiazepine", "rxnorm": "3322", "status": "restricted", "stock": 50, "unit": "tablet", "cost": 0.40},
    {"name": "Diazepam 10 mg IV", "generic": "Diazepam", "class": "Benzodiazepine", "rxnorm": "3322", "status": "restricted", "stock": 30, "unit": "vial", "cost": 3.00},
    {"name": "Lorazepam 1 mg Tablet", "generic": "Lorazepam", "class": "Benzodiazepine", "rxnorm": "6470", "status": "restricted", "stock": 40, "unit": "tablet", "cost": 0.80},
    {"name": "Haloperidol 5 mg Tablet", "generic": "Haloperidol", "class": "Typical Antipsychotic", "rxnorm": "5093", "status": "restricted", "stock": 30, "unit": "tablet", "cost": 0.60},
    {"name": "Sertraline 50 mg Tablet", "generic": "Sertraline HCl", "class": "SSRI Antidepressant", "rxnorm": "36437", "status": "formulary", "stock": 80, "unit": "tablet", "cost": 1.50},
    {"name": "Amitriptyline 25 mg Tablet", "generic": "Amitriptyline HCl", "class": "Tricyclic Antidepressant", "rxnorm": "704", "status": "formulary", "stock": 70, "unit": "tablet", "cost": 0.50},
    {"name": "Donepezil 5 mg Tablet", "generic": "Donepezil HCl", "class": "Cholinesterase Inhibitor", "rxnorm": "135447", "status": "formulary", "stock": 40, "unit": "tablet", "cost": 5.00},

    # ── Pain & Anaesthesia ────────────────────────────────────────────────────
    {"name": "Ibuprofen 400 mg Tablet", "generic": "Ibuprofen", "class": "NSAID", "rxnorm": "5640", "status": "formulary", "stock": 250, "unit": "tablet", "cost": 0.40},
    {"name": "Diclofenac 50 mg Tablet", "generic": "Diclofenac Sodium", "class": "NSAID", "rxnorm": "3355", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 0.50},
    {"name": "Tramadol 50 mg Capsule", "generic": "Tramadol HCl", "class": "Opioid Analgesic", "rxnorm": "10689", "status": "restricted", "stock": 80, "unit": "capsule", "cost": 1.20},
    {"name": "Morphine 10 mg IV", "generic": "Morphine Sulfate", "class": "Opioid Analgesic", "rxnorm": "7052", "status": "restricted", "stock": 30, "unit": "vial", "cost": 8.00},
    {"name": "Ketamine 200 mg IV", "generic": "Ketamine HCl", "class": "Dissociative Anaesthetic", "rxnorm": "6130", "status": "restricted", "stock": 20, "unit": "vial", "cost": 15.00},
    {"name": "Lidocaine 2% Injection", "generic": "Lidocaine HCl", "class": "Local Anaesthetic", "rxnorm": "6387", "status": "formulary", "stock": 60, "unit": "vial", "cost": 4.00},
    {"name": "Paracetamol 1 g IV", "generic": "Acetaminophen", "class": "Analgesic/Antipyretic", "rxnorm": "1148477", "status": "formulary", "stock": 100, "unit": "vial", "cost": 6.00},
    {"name": "Celecoxib 200 mg Capsule", "generic": "Celecoxib", "class": "COX-2 Inhibitor", "rxnorm": "140587", "status": "formulary", "stock": 70, "unit": "capsule", "cost": 4.50},

    # ── Renal & Electrolytes ──────────────────────────────────────────────────
    {"name": "Potassium Chloride 600 mg Tablet", "generic": "Potassium Chloride", "class": "Electrolyte Replacement", "rxnorm": "8591", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 0.40},
    {"name": "Calcium Carbonate 500 mg Tablet", "generic": "Calcium Carbonate", "class": "Calcium Supplement/Antacid", "rxnorm": "41493", "status": "formulary", "stock": 180, "unit": "tablet", "cost": 0.30},
    {"name": "Sodium Bicarbonate 8.4% IV", "generic": "Sodium Bicarbonate", "class": "Alkalinizing Agent", "rxnorm": "9848", "status": "formulary", "stock": 40, "unit": "vial", "cost": 5.00},
    {"name": "Hydrochlorothiazide 25 mg Tablet", "generic": "Hydrochlorothiazide", "class": "Thiazide Diuretic", "rxnorm": "5487", "status": "formulary", "stock": 120, "unit": "tablet", "cost": 0.40},
    {"name": "Torsemide 10 mg Tablet", "generic": "Torsemide", "class": "Loop Diuretic", "rxnorm": "38413", "status": "formulary", "stock": 80, "unit": "tablet", "cost": 1.20},
    {"name": "Sevelamer 800 mg Tablet", "generic": "Sevelamer Carbonate", "class": "Phosphate Binder", "rxnorm": "41493", "status": "formulary", "stock": 60, "unit": "tablet", "cost": 4.00},

    # ── Haematology & Oncology support ───────────────────────────────────────
    {"name": "Ferrous Sulfate 200 mg Tablet", "generic": "Ferrous Sulfate", "class": "Iron Supplement", "rxnorm": "4452", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 0.30},
    {"name": "Iron Sucrose 100 mg IV", "generic": "Iron Sucrose", "class": "Parenteral Iron", "rxnorm": "41493", "status": "formulary", "stock": 40, "unit": "vial", "cost": 20.00},
    {"name": "Folic Acid 5 mg Tablet", "generic": "Folic Acid", "class": "Vitamin B9 Supplement", "rxnorm": "4582", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 0.20},
    {"name": "Vitamin B12 1000 mcg Injection", "generic": "Cyanocobalamin", "class": "Vitamin B12 Supplement", "rxnorm": "2309", "status": "formulary", "stock": 80, "unit": "vial", "cost": 2.50},
    {"name": "Erythropoietin 4000 IU Injection", "generic": "Epoetin Alfa", "class": "Erythropoiesis Stimulating Agent", "rxnorm": "217964", "status": "restricted", "stock": 20, "unit": "vial", "cost": 60.00},
    {"name": "Dexamethasone 8 mg IV", "generic": "Dexamethasone Sodium Phosphate", "class": "Glucocorticoid", "rxnorm": "3264", "status": "formulary", "stock": 60, "unit": "vial", "cost": 5.00},
    {"name": "Ondansetron 8 mg Tablet", "generic": "Ondansetron HCl", "class": "5-HT3 Receptor Antagonist (Antiemetic)", "rxnorm": "319864", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 3.00},

    # ── Obstetrics & Gynaecology ──────────────────────────────────────────────
    {"name": "Oxytocin 10 IU IV", "generic": "Oxytocin", "class": "Uterotonic Agent", "rxnorm": "7809", "status": "restricted", "stock": 40, "unit": "vial", "cost": 5.00},
    {"name": "Magnesium Sulfate 50% IV", "generic": "Magnesium Sulfate", "class": "Anticonvulsant/Tocolytic", "rxnorm": "6950", "status": "restricted", "stock": 30, "unit": "vial", "cost": 4.00},
    {"name": "Progesterone 200 mg Capsule", "generic": "Progesterone", "class": "Progestogen", "rxnorm": "9209", "status": "formulary", "stock": 60, "unit": "capsule", "cost": 3.00},
    {"name": "Nifedipine 10 mg Capsule", "generic": "Nifedipine", "class": "Calcium Channel Blocker/Tocolytic", "rxnorm": "7417", "status": "formulary", "stock": 80, "unit": "capsule", "cost": 1.00},

    # ── Paediatrics ───────────────────────────────────────────────────────────
    {"name": "Amoxicillin 250 mg/5 mL Suspension", "generic": "Amoxicillin", "class": "Antibiotic – Penicillin", "rxnorm": "723", "status": "formulary", "stock": 60, "unit": "bottle", "cost": 5.00},
    {"name": "Paracetamol 120 mg/5 mL Syrup", "generic": "Acetaminophen", "class": "Analgesic/Antipyretic", "rxnorm": "161", "status": "formulary", "stock": 80, "unit": "bottle", "cost": 3.00},
    {"name": "Ibuprofen 100 mg/5 mL Suspension", "generic": "Ibuprofen", "class": "NSAID", "rxnorm": "5640", "status": "formulary", "stock": 60, "unit": "bottle", "cost": 4.00},
    {"name": "Zinc Sulfate 10 mg/5 mL Syrup", "generic": "Zinc Sulfate", "class": "Zinc Supplement", "rxnorm": "11192", "status": "formulary", "stock": 50, "unit": "bottle", "cost": 3.50},
    {"name": "Oral Rehydration Salts Sachet", "generic": "ORS", "class": "Electrolyte Replacement", "rxnorm": "41493", "status": "formulary", "stock": 200, "unit": "sachet", "cost": 0.50},

    # ── IV Fluids ─────────────────────────────────────────────────────────────
    {"name": "Normal Saline 0.9% 500 mL", "generic": "Sodium Chloride 0.9%", "class": "IV Fluid", "rxnorm": "9863", "status": "formulary", "stock": 200, "unit": "bag", "cost": 3.00},
    {"name": "Normal Saline 0.9% 1000 mL", "generic": "Sodium Chloride 0.9%", "class": "IV Fluid", "rxnorm": "9863", "status": "formulary", "stock": 200, "unit": "bag", "cost": 4.50},
    {"name": "Dextrose 5% 500 mL", "generic": "Glucose 5%", "class": "IV Fluid", "rxnorm": "4189", "status": "formulary", "stock": 150, "unit": "bag", "cost": 3.50},
    {"name": "Dextrose 5% in 0.9% Saline 1000 mL", "generic": "Glucose/Sodium Chloride", "class": "IV Fluid", "rxnorm": "41493", "status": "formulary", "stock": 120, "unit": "bag", "cost": 5.00},
    {"name": "Ringer's Lactate 500 mL", "generic": "Lactated Ringer's Solution", "class": "IV Fluid", "rxnorm": "41493", "status": "formulary", "stock": 150, "unit": "bag", "cost": 4.00},
    {"name": "Albumin 20% 100 mL IV", "generic": "Human Albumin", "class": "Plasma Expander", "rxnorm": "252884", "status": "restricted", "stock": 20, "unit": "vial", "cost": 80.00},

    # ── Miscellaneous / Vitamins ──────────────────────────────────────────────
    {"name": "Vitamin D3 50000 IU Capsule", "generic": "Cholecalciferol", "class": "Vitamin D Supplement", "rxnorm": "316004", "status": "formulary", "stock": 100, "unit": "capsule", "cost": 2.00},
    {"name": "Multivitamin Tablet", "generic": "Multivitamin", "class": "Vitamin Supplement", "rxnorm": "41493", "status": "formulary", "stock": 200, "unit": "tablet", "cost": 0.50},
    {"name": "Zinc Sulfate 50 mg Tablet", "generic": "Zinc Sulfate", "class": "Zinc Supplement", "rxnorm": "11192", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 0.40},
    {"name": "Omega-3 1000 mg Capsule", "generic": "Omega-3 Fatty Acids", "class": "Lipid-Modifying Agent", "rxnorm": "41493", "status": "formulary", "stock": 80, "unit": "capsule", "cost": 1.50},
    {"name": "Sodium Valproate 200 mg/5 mL Syrup", "generic": "Valproic Acid", "class": "Antiepileptic", "rxnorm": "11118", "status": "formulary", "stock": 40, "unit": "bottle", "cost": 8.00},
    {"name": "Allopurinol 300 mg Tablet", "generic": "Allopurinol", "class": "Xanthine Oxidase Inhibitor", "rxnorm": "519", "status": "formulary", "stock": 100, "unit": "tablet", "cost": 0.80},
    {"name": "Colchicine 0.5 mg Tablet", "generic": "Colchicine", "class": "Anti-gout Agent", "rxnorm": "2823", "status": "formulary", "stock": 80, "unit": "tablet", "cost": 1.20},
]

CLINICAL_SCENARIOS = [
    {
        "patient_phone": "+201001112201",
        "doctor_email": "dr.ahmed.samy@hospital.eg",
        "visit_type": "inpatient",
        "reason": "Acute chest infection with difficulty breathing",
        "subjective": "Patient complains of fever for 3 days, productive cough, and exertional dyspnea.",
        "objective": "Temp 38.8°C, SpO2 93%, bilateral basal crackles on auscultation.",
        "assessment": "Community-acquired pneumonia with mild hypoxia.",
        "plan": "Admit for IV antibiotics and chest imaging.",
        "diagnoses": [
            {"code": "J18.9", "desc": "Pneumonia, unspecified", "type": "primary", "status": "active",
             "snomed_code": "233604007", "snomed_display": "Pneumonia"},
        ],
        "prescriptions": [
            ("Azithromycin 500 mg Tablet", "500 mg", "oral", "once daily", 5, "Take one tablet daily after meals", "Azithromycin", "308460"),
        ],
        "lab_orders": [
            ("Complete Blood Count", "LAB-CBC", "blood"),
            ("C-Reactive Protein", "LAB-CRP", "blood"),
        ],
        "imaging_orders": [
            ("CT Chest Without Contrast", "CT", "CHEST-CT", "Chest", False),
        ],
    },
    {
        "patient_phone": "+201002223301",
        "doctor_email": "dr.fatima.ali@hospital.eg",
        "visit_type": "inpatient",
        "reason": "Acute-on-chronic congestive heart failure",
        "subjective": "Severe orthopnea, bilateral leg swelling, and exercise intolerance.",
        "objective": "Elevated JVP, pedal edema, bilateral basal crackles.",
        "assessment": "Acute-on-chronic congestive heart failure with reduced ejection fraction.",
        "plan": "IV diuretics, strict fluid balance monitoring, echocardiogram.",
        "diagnoses": [
            {"code": "I50.23", "desc": "Acute-on-chronic systolic heart failure", "type": "primary", "status": "active",
             "snomed_code": "195111005", "snomed_display": "Cardiac failure"},
            {"code": "I10", "desc": "Essential hypertension", "type": "secondary", "status": "chronic",
             "snomed_code": "59621000", "snomed_display": "Hypertensive disorder"},
        ],
        "prescriptions": [
            ("Furosemide 40 mg Tablet", "40 mg", "iv", "twice daily", 6, "40 mg IV twice daily with urine output monitoring", "Furosemide", "4603"),
            ("Spironolactone 25 mg Tablet", "25 mg", "oral", "once daily", 30, "One tablet in the morning", "Spironolactone", "9997"),
        ],
        "lab_orders": [
            ("BMP – Renal Profile", "LAB-BMP", "blood"),
            ("BNP / NT-proBNP", "LAB-BNP", "blood"),
        ],
        "imaging_orders": [
            ("Echocardiogram", "US", "ECHO-CARD", "Heart", False),
            ("Chest X-Ray", "XR", "XR-CHEST-PA", "Chest", False),
        ],
    },
    {
        "patient_phone": "+201003334401",
        "doctor_email": "dr.fatima.ali@hospital.eg",
        "visit_type": "inpatient",
        "reason": "Unstable angina",
        "subjective": "Severe chest pain radiating to the left arm, mild fever, cold sweats.",
        "objective": "BP 170/100 mmHg, HR 94 bpm, ECG showing ST-segment changes.",
        "assessment": "Unstable angina – rule out myocardial infarction.",
        "plan": "ICU monitoring, serial troponin, cardiac imaging.",
        "diagnoses": [
            {"code": "I20.0", "desc": "Unstable angina", "type": "primary", "status": "active",
             "snomed_code": "4557003", "snomed_display": "Preinfarction syndrome"},
        ],
        "prescriptions": [
            ("Bisoprolol 5 mg Tablet", "5 mg", "oral", "once daily", 30, "One tablet every morning", "Bisoprolol", "19484"),
            ("Clopidogrel 75 mg Tablet", "75 mg", "oral", "once daily", 30, "One tablet daily with food", "Clopidogrel Bisulfate", "174742"),
        ],
        "lab_orders": [
            ("Troponin I (Serial)", "LAB-TROP", "blood"),
            ("Lipid Profile", "LAB-LIPID", "blood"),
        ],
        "imaging_orders": [
            ("CT Coronary Angiography", "CT", "CT-CORON", "Heart", True),
        ],
    },
    {
        "patient_phone": "+201004445501",
        "doctor_email": "dr.ahmed.samy@hospital.eg",
        "visit_type": "outpatient",
        "reason": "Type 2 diabetes mellitus follow-up",
        "subjective": "Polyuria and polydipsia, poor compliance with diet and diabetes medications.",
        "objective": "Random blood sugar 310 mg/dL, no acute distress, stable vitals.",
        "assessment": "Uncontrolled type 2 diabetes mellitus.",
        "plan": "Dose adjustment, HbA1c and renal profile, patient education.",
        "diagnoses": [
            {"code": "E11.65", "desc": "Type 2 diabetes mellitus with hyperglycemia", "type": "primary", "status": "chronic",
             "snomed_code": "44054006", "snomed_display": "Diabetes mellitus type 2"},
        ],
        "prescriptions": [
            ("Metformin 500 mg Tablet", "1000 mg", "oral", "twice daily", 60, "One tablet twice daily with meals", "Metformin", "6809"),
        ],
        "lab_orders": [
            ("HbA1c", "LAB-HBA1C", "blood"),
            ("Urine Microalbumin", "LAB-MICROALB", "urine"),
        ],
        "imaging_orders": [],
    },
    {
        "patient_phone": "+201005556601",
        "doctor_email": "dr.ahmed.samy@hospital.eg",
        "visit_type": "inpatient",
        "reason": "Irregular heartbeat and palpitations",
        "subjective": "Intermittent palpitations with dizziness and shortness of breath, pallor and general fatigue.",
        "objective": "HR 140 bpm irregular, ECG showing atrial fibrillation.",
        "assessment": "New-onset atrial fibrillation.",
        "plan": "Rate control, anticoagulation, echocardiogram, cardioversion consultation.",
        "diagnoses": [
            {"code": "I48.91", "desc": "Unspecified atrial fibrillation", "type": "primary", "status": "active",
             "snomed_code": "49436004", "snomed_display": "Atrial fibrillation"},
        ],
        "prescriptions": [
            ("Bisoprolol 5 mg Tablet", "2.5 mg", "oral", "once daily", 30, "Half tablet in the morning", "Bisoprolol", "19484"),
            ("Warfarin 5 mg Tablet", "5 mg", "oral", "once daily", 30, "One tablet daily with PT/INR monitoring", "Warfarin Sodium", "114194"),
        ],
        "lab_orders": [
            ("PT/INR", "LAB-PT", "blood"),
            ("Thyroid Function Tests", "LAB-TFT", "blood"),
        ],
        "imaging_orders": [
            ("Echocardiogram", "US", "ECHO-CARD", "Heart", False),
        ],
    },
    {
        "patient_phone": "+201007778801",
        "doctor_email": "dr.omar.hassan@hospital.eg",
        "visit_type": "inpatient",
        "reason": "Acute tonsillitis in a child",
        "subjective": "Severe sore throat and fever for two days, difficulty swallowing.",
        "objective": "Temp 39.2°C, enlarged tonsils with purulent exudate, positive otoscopy.",
        "assessment": "Streptococcal pharyngitis with otitis media.",
        "plan": "Antibiotic therapy, antipyretics, fluids and rest.",
        "diagnoses": [
            {"code": "J03.91", "desc": "Acute streptococcal tonsillitis", "type": "primary", "status": "active",
             "snomed_code": "43878008", "snomed_display": "Streptococcal tonsillitis"},
        ],
        "prescriptions": [
            ("Amoxicillin 500 mg Capsule", "250 mg", "oral", "three times daily", 10, "Take quarter capsule (solution) three times daily", "Amoxicillin", "723"),
            ("Paracetamol 500 mg Tablet", "250 mg", "oral", "every 6 hours", 40, "Quarter tablet every 6 hours as needed", "Paracetamol", "161"),
        ],
        "lab_orders": [
            ("Complete Blood Count", "LAB-CBC", "blood"),
            ("Throat Swab Culture", "LAB-SWAB", "swab"),
        ],
        "imaging_orders": [],
    },
    {
        "patient_phone": "+201009990001",
        "doctor_email": "dr.ahmed.samy@hospital.eg",
        "visit_type": "inpatient",
        "reason": "Acute respiratory distress with decreased consciousness",
        "subjective": "Patient is semi-conscious with severe respiratory distress.",
        "objective": "SpO2 88%, ABG showing respiratory acidosis.",
        "assessment": "Acute respiratory failure – suspected pulmonary embolism.",
        "plan": "Supplemental oxygen, chest imaging, urgent D-dimer and CBC.",
        "diagnoses": [
            {"code": "J96.00", "desc": "Acute respiratory failure, unspecified", "type": "primary", "status": "active",
             "snomed_code": "65710008", "snomed_display": "Acute respiratory failure"},
        ],
        "prescriptions": [
            ("Enoxaparin 40 mg Injection", "40 mg", "subcutaneous", "once daily", 7, "Subcutaneous injection once daily", "Enoxaparin Sodium", "67108"),
        ],
        "lab_orders": [
            ("ABG / Blood Gases", "LAB-ABG", "blood"),
            ("D-Dimer", "LAB-DDIMER", "blood"),
        ],
        "imaging_orders": [
            ("CT Pulmonary Angiography", "CT", "CTPA", "Chest", True),
        ],
    },
    {
        "patient_phone": "+201011101101",
        "doctor_email": "dr.ahmed.samy@hospital.eg",
        "visit_type": "outpatient",
        "reason": "Anemia and general fatigue",
        "subjective": "Pallor, generalized weakness, and dyspnea on minimal exertion for two weeks.",
        "objective": "Hemoglobin 7.2 g/dL, hematocrit 21%, microcytic red blood cells.",
        "assessment": "Iron deficiency anemia.",
        "plan": "Iron supplements, identify cause of iron deficiency, follow-up in 4 weeks.",
        "diagnoses": [
            {"code": "D50.9", "desc": "Iron deficiency anemia, unspecified", "type": "primary", "status": "active",
             "snomed_code": "87522002", "snomed_display": "Iron deficiency anemia"},
        ],
        "prescriptions": [
            ("Paracetamol 500 mg Tablet", "500 mg", "oral", "as needed", 20, "One tablet for pain only as needed", "Paracetamol", "161"),
        ],
        "lab_orders": [
            ("Iron Studies", "LAB-IRON", "blood"),
            ("Complete Blood Count", "LAB-CBC", "blood"),
        ],
        "imaging_orders": [],
    },
]

# CDSS recommendations to seed
CDSS_SCENARIOS = [
    {
        "patient_phone": "+201001112201",
        "type": "appropriateness_check",
        "severity": "warning",
        "title": "Allergy Alert: Penicillin-class antibiotic ordered",
        "summary": "Patient has documented Penicillin allergy. Azithromycin is not a penicillin but verify cross-reactivity risk.",
        "triggered_by": "prescription:Azithromycin",
        "snomed_code": "372687004",
        "snomed_display": "Amoxicillin allergy",
        "target_roles": ["doctor", "pharmacist"],
        "suggested_actions": ["Confirm allergy severity", "Review alternative antibiotics if needed"],
    },
    {
        "patient_phone": "+201002223301",
        "type": "dosage_warning",
        "severity": "warning",
        "title": "Renal Function Check Required Before Spironolactone",
        "summary": "Spironolactone in heart failure patients requires baseline creatinine and potassium monitoring.",
        "triggered_by": "prescription:Spironolactone",
        "snomed_code": "372722000",
        "snomed_display": "Spironolactone adverse reaction",
        "target_roles": ["doctor", "pharmacist", "nurse"],
        "suggested_actions": ["Order serum K+ before and 1 week after starting", "Monitor renal function"],
    },
    {
        "patient_phone": "+201003334401",
        "type": "drug_interaction",
        "severity": "critical",
        "title": "Bisoprolol + Clopidogrel: Monitor Platelet Effect",
        "summary": "Concurrent beta-blocker and antiplatelet therapy – ensure adequate antithrombotic coverage in ACS.",
        "triggered_by": "prescription:Clopidogrel + Bisoprolol",
        "snomed_code": "79640008",
        "snomed_display": "Drug interaction",
        "target_roles": ["doctor", "pharmacist"],
        "suggested_actions": ["Confirm dual antiplatelet loading dose", "Monitor ECG for bradycardia"],
    },
    {
        "patient_phone": "+201005556601",
        "type": "drug_interaction",
        "severity": "critical",
        "title": "Warfarin Therapy Initiated – Mandatory INR Monitoring",
        "summary": "Warfarin is a restricted drug. INR must be checked within 3 days of initiation and then weekly.",
        "triggered_by": "prescription:Warfarin",
        "snomed_code": "372807001",
        "snomed_display": "Warfarin adverse reaction",
        "target_roles": ["doctor", "nurse", "pharmacist"],
        "suggested_actions": ["Baseline PT/INR before first dose", "Weekly INR for 4 weeks", "Patient education on diet"],
    },
    {
        "patient_phone": "+201009990001",
        "type": "deterioration_alert",
        "severity": "critical",
        "title": "Critical SpO2 – Immediate Intervention Required",
        "summary": "SpO2 88% recorded in ICU patient. Initiate supplemental oxygen and consider mechanical ventilation.",
        "triggered_by": "vitals:SpO2=88",
        "snomed_code": "238156004",
        "snomed_display": "Hypoxia",
        "target_roles": ["doctor", "nurse"],
        "suggested_actions": ["Apply high-flow O2", "Arrange ABG", "Prepare for intubation if no improvement"],
    },
]

# Reference lab results for seeded panels
LAB_RESULTS = {
    "Complete Blood Count": [
        ("WBC",        "58410-2", "9.2",  "10^3/uL", "4.0-11.0",  "normal"),
        ("RBC",        "789-8",   "4.1",  "10^6/uL", "4.0-5.5",   "normal"),
        ("Hemoglobin", "718-7",   "7.2",  "g/dL",    "12.0-16.0", "low"),
        ("Hematocrit", "4544-3",  "21",   "%",       "36-47",     "low"),
        ("Platelets",  "777-3",   "280",  "10^3/uL", "150-400",   "normal"),
    ],
    "HbA1c": [
        ("HbA1c", "4548-4", "9.2", "%", "< 5.7 (Normal) / < 7.0 (Target DM)", "high"),
    ],
    "BMP – Renal Profile": [
        ("Sodium",     "2951-2",  "138", "mEq/L", "135-145", "normal"),
        ("Potassium",  "2823-3",  "3.3", "mEq/L", "3.5-5.1", "low"),
        ("Creatinine", "2160-0",  "1.4", "mg/dL", "0.6-1.2", "high"),
        ("BUN",        "3094-0",  "28",  "mg/dL", "7-20",    "high"),
    ],
    "Troponin I (Serial)": [
        ("Troponin I hs", "89579-7", "2.4", "ng/L", "< 52 (male)", "high"),
    ],
    "Lipid Profile": [
        ("Total Cholesterol", "2093-3", "240", "mg/dL", "< 200", "high"),
        ("LDL",               "13457-7","155", "mg/dL", "< 100", "high"),
        ("HDL",               "2085-9", "38",  "mg/dL", "> 40",  "low"),
        ("Triglycerides",     "2571-8", "245", "mg/dL", "< 150", "high"),
    ],
    "BNP / NT-proBNP": [
        ("NT-proBNP", "33762-6", "4200", "pg/mL", "< 900", "critical-high"),
    ],
    "PT/INR": [
        ("PT",  "5902-2", "18",  "sec", "11-13.5", "high"),
        ("INR", "34714-6","1.4", "",    "0.9-1.2",  "high"),
    ],
    "Thyroid Function Tests": [
        ("TSH",  "3016-3", "0.08", "mIU/L", "0.4-4.5", "low"),
        ("Free T4","3024-7","1.8", "ng/dL",  "0.8-1.8", "normal"),
    ],
    "Iron Studies": [
        ("Serum Iron",    "2498-4",  "30",  "ug/dL",  "60-170",   "low"),
        ("TIBC",          "2500-7",  "480", "ug/dL",  "250-370",  "high"),
        ("Ferritin",      "2276-4",  "4",   "ng/mL",  "12-300",   "low"),
        ("Transferrin Sat","14801-9","6",   "%",      "20-50",    "low"),
    ],
    "D-Dimer": [
        ("D-Dimer", "48065-7", "5.8", "mg/L FEU", "< 0.5", "critical-high"),
    ],
    "ABG / Blood Gases": [
        ("pH",   "11558-4", "7.26", "",       "7.35-7.45", "low"),
        ("PaCO2","2019-8",  "58",   "mmHg",   "35-45",     "critical-high"),
        ("PaO2", "2703-7",  "52",   "mmHg",   "75-100",    "critical-low"),
    ],
    "C-Reactive Protein": [
        ("CRP (high-sensitivity)", "30522-7", "48", "mg/L", "< 10", "critical-high"),
    ],
    "Urine Microalbumin": [
        ("Microalbumin (urine)", "14957-5", "85", "mg/L", "< 30", "high"),
        ("Creatinine (urine)", "2161-8", "120", "mg/dL", "20-275", "normal"),
        ("Albumin/Creatinine Ratio", "14959-1", "70.8", "mg/g", "< 30", "high"),
    ],
    "Throat Swab Culture": [
        ("Throat Culture", "626-2", "Group A Streptococcus – Growth detected", "", "No growth", "high"),
    ],
}


class Command(BaseCommand):
    help = "Seed the database with realistic Egyptian hospital demo data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all seeded data before re-seeding (patients, users, departments, etc.).",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self._clear_data()

        self._seed_formulary()
        self._seed_departments()
        self._seed_wards()
        self._seed_beds()
        self._seed_staff()
        self._seed_patients()
        Command._imaging_counter = 0
        self._seed_clinical_scenarios()
        self._safe_seed(self._seed_admissions, "admissions")
        self._safe_seed(self._seed_appointments, "appointments")
        self._safe_seed(self._seed_cdss_recommendations, "CDSS recommendations")
        self._safe_seed(self._seed_nursing_vitals, "nursing vitals")
        self._safe_seed(self._seed_mar_entries, "MAR entries")
        self._safe_seed(self._seed_nursing_tasks, "nursing tasks")
        self._safe_seed(self._seed_nursing_handoffs, "nursing handoffs")
        self._safe_seed(self._seed_nursing_notes, "nursing notes")
        self._safe_seed(self._seed_discharge_checklists, "discharge checklists")
        self._safe_seed(self._seed_billing_records, "billing records")
        self._safe_seed(self._seed_pharmacy_dispense, "pharmacy dispense records")
        self._safe_seed(self._seed_pharmacy_interventions, "pharmacy interventions")
        self._safe_seed(self._seed_modality_schedules, "modality schedules")

        self.stdout.write(self.style.SUCCESS("\n✅  Egyptian sample data seeded successfully."))
        self.stdout.write(self.style.WARNING(f"   Demo password for all seeded staff: {SEED_PASSWORD}"))

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _safe_seed(self, fn, label):
        try:
            fn()
        except (ProgrammingError, OperationalError) as exc:
            self.stdout.write(self.style.WARNING(f"Skipped {label}: {exc}"))

    def _clear_data(self):
        """Remove clinical data created by previous seed runs.
        Staff user accounts are preserved so their UUIDs (and any stored JWT tokens)
        remain valid across re-seeds.
        """
        self.stdout.write(self.style.WARNING("Clearing previous Egyptian seed data…"))
        from apps.patients.models import (
            Patient, Admission, Appointment, Queue, Consent,
        )
        from apps.authentication.models import User
        from apps.radiology.models import ModalitySchedule

        # Delete clinical records that cascade from patients
        Admission.objects.filter(patient__phone__startswith="+2010").delete()
        Appointment.objects.filter(patient__phone__startswith="+2010").delete()
        Queue.objects.filter(patient__phone__startswith="+2010").delete()
        Consent.objects.filter(patient__phone__startswith="+2010").delete()

        # Clear modality schedules (seeded data, not patient-owned)
        ModalitySchedule.objects.all().delete()

        # Delete patients (cascades remaining related objects)
        Patient.objects.filter(phone__startswith="+2010").delete()

        # Do NOT delete staff users – preserving their UUIDs keeps stored JWT tokens valid.
        # Just ensure passwords are still correct (handled by get_or_create in _seed_staff).
        self.stdout.write("  Cleared patients and clinical records (+2010 phones).")
        self.stdout.write("  Staff accounts preserved (UUIDs unchanged).")

    # ─── Formulary ────────────────────────────────────────────────────────────

    def _seed_formulary(self):
        from apps.pharmacy.models import FormularyItem

        for item in FORMULARY:
            obj, created = FormularyItem.objects.get_or_create(
                name=item["name"],
                defaults={
                    "generic_name": item["generic"],
                    "drug_class": item["class"],
                    "rxnorm_code": item["rxnorm"],
                    "formulary_status": item["status"],
                    "stock_level": item["stock"],
                    "reorder_level": 20,
                    "unit_cost": item["cost"],
                    "unit": item["unit"],
                },
            )
            if created:
                self.stdout.write(f"  [Formulary] {obj.name}")

    # ─── Departments ──────────────────────────────────────────────────────────

    def _seed_departments(self):
        from apps.administration.models import Department

        for item in DEPARTMENTS:
            obj, created = Department.objects.get_or_create(
                code=item["code"],
                defaults={"name": item["name"], "type": item["type"], "status": "active"},
            )
            if created:
                self.stdout.write(f"  [Dept] {obj.name}")

    # ─── Wards ────────────────────────────────────────────────────────────────

    def _seed_wards(self):
        from apps.administration.models import Department, Ward

        for item in WARDS:
            dept = Department.objects.filter(code=item["dept"]).first()
            if not dept:
                continue
            obj, created = Ward.objects.get_or_create(
                code=item["code"],
                defaults={
                    "name": item["name"],
                    "type": item["type"],
                    "floor_number": item["floor"],
                    "total_beds": item["beds"],
                    "department": dept,
                    "status": "active",
                },
            )
            if created:
                self.stdout.write(f"  [Ward] {obj.name}")

    # ─── Beds ─────────────────────────────────────────────────────────────────

    def _seed_beds(self):
        from apps.administration.models import Bed, Ward

        for ward in Ward.objects.filter(code__in=[w["code"] for w in WARDS]):
            for idx in range(1, 5):
                number = f"{ward.code}-{idx:02d}"
                obj, created = Bed.objects.get_or_create(
                    ward=ward,
                    number=number,
                    defaults={"type": "standard", "status": "available"},
                )
                if created:
                    self.stdout.write(f"  [Bed] {obj.number}")

    # ─── Staff ────────────────────────────────────────────────────────────────

    def _seed_staff(self):
        from apps.administration.models import Department
        from apps.authentication.models import User

        dept_map = {d.code: d for d in Department.objects.all()}
        for item in STAFF:
            dept = dept_map.get(item["dept"])
            obj, created = User.objects.get_or_create(
                email=item["email"],
                defaults={
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                    "role": item["role"],
                    "status": "active",
                    "specialization": item.get("specialization"),
                    "department": dept,
                    "is_staff": item["role"] == "admin",
                    "is_superuser": item["role"] == "admin",
                },
            )
            if created or not obj.check_password(SEED_PASSWORD):
                obj.set_password(SEED_PASSWORD)
                obj.save(update_fields=["password"])
            if created:
                self.stdout.write(f"  [Staff] {obj.first_name} {obj.last_name} <{obj.email}> [{obj.role}]")

    # ─── Patients ─────────────────────────────────────────────────────────────

    def _seed_patients(self):
        from apps.administration.models import Ward
        from apps.authentication.models import User
        from apps.patients.models import Patient

        doctor_map = {u.email: u for u in User.objects.filter(role="doctor")}
        ward_map = {w.code: w for w in Ward.objects.all()}

        doctor_email_cycle = [
            "dr.ahmed.samy@hospital.eg",
            "dr.fatima.ali@hospital.eg",
            "dr.omar.hassan@hospital.eg",
            "dr.mona.ibrahim@hospital.eg",
        ]

        for idx, item in enumerate(PATIENTS_DATA):
            ward = ward_map.get(item["ward"]) if item.get("ward") else None
            assigned_doctor = doctor_map.get(doctor_email_cycle[idx % len(doctor_email_cycle)])

            obj, created = Patient.objects.get_or_create(
                phone=item["phone"],
                defaults={
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                    "date_of_birth": item["dob"],
                    "gender": item["gender"],
                    "blood_type": item["blood_type"],
                    "status": "admitted" if ward else "active",
                    "email": f"patient{idx + 1}@hospital.eg",
                    "address": {
                        "street": "123 Street",
                        "district": item["district"],
                        "city": item["city"],
                        "country": "Egypt",
                    },
                    "nationality": "Egyptian",
                    "marital_status": item["marital"],
                    "preferred_language": "english",
                    "insurance_provider": item["insurance"],
                    "insurance_id": item["insurance_id"],
                    "allergies": item["allergies"],
                    "emergency_contact": item["emergency_contact"],
                    "insurance_details": {
                        "provider": item["insurance"],
                        "policyNumber": item["insurance_id"],
                        "coverageType": "standard",
                    },
                    "consent_signed": True,
                    "assigned_doctor": assigned_doctor,
                    "ward": ward,
                },
            )
            if created:
                self.stdout.write(f"  [Patient] {obj.first_name} {obj.last_name} [{obj.mrn}]")

    # ─── Clinical scenarios ───────────────────────────────────────────────────

    def _seed_clinical_scenarios(self):
        from apps.authentication.models import User
        from apps.doctors.models import (
            Diagnosis, Encounter, Order, Prescription,
            OrderCategory, Priority,
        )
        from apps.patients.models import Patient

        for scenario in CLINICAL_SCENARIOS:
            patient = Patient.objects.filter(phone=scenario["patient_phone"]).first()
            doctor = User.objects.filter(email=scenario["doctor_email"]).first()
            if not patient or not doctor:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Skipping scenario: patient {scenario['patient_phone']} or doctor {scenario['doctor_email']} not found."
                    )
                )
                continue

            encounter, _ = Encounter.objects.get_or_create(
                patient=patient,
                doctor=doctor,
                visit_type=scenario["visit_type"],
                defaults={
                    "subjective": scenario["subjective"],
                    "objective": scenario["objective"],
                    "assessment": scenario["assessment"],
                    "plan": scenario["plan"],
                    "status": "in-progress",
                },
            )

            # Diagnoses
            for diag in scenario["diagnoses"]:
                Diagnosis.objects.get_or_create(
                    patient=patient,
                    encounter=encounter,
                    code=diag["code"],
                    defaults={
                        "description": diag["desc"],
                        "type": diag["type"],
                        "status": diag["status"],
                        "diagnosed_by": doctor,
                        "snomed_code": diag.get("snomed_code", ""),
                        "snomed_display": diag.get("snomed_display", ""),
                    },
                )

            # Prescriptions
            for rx in scenario["prescriptions"]:
                med, dosage, route, freq, qty, sig, generic, rxnorm = rx
                Prescription.objects.get_or_create(
                    patient=patient,
                    encounter=encounter,
                    medication=med,
                    defaults={
                        "prescribed_by": doctor,
                        "generic_name": generic,
                        "rxnorm_code": rxnorm,
                        "dosage": dosage,
                        "route": route,
                        "frequency": freq,
                        "quantity": qty,
                        "refills": 0,
                        "sig": sig,
                        "start_date": timezone.now().date(),
                        "status": "active",
                    },
                )

            # Lab orders
            for lab_name, exam_code, spec_type in scenario.get("lab_orders", []):
                order, _ = Order.objects.get_or_create(
                    patient=patient,
                    encounter=encounter,
                    ordered_by=doctor,
                    category=OrderCategory.LAB,
                    name=lab_name,
                    defaults={
                        "exam_code": exam_code,
                        "specimen_type": spec_type,
                        "indication": scenario["reason"],
                        "priority": Priority.URGENT if scenario["visit_type"] == "inpatient" else Priority.ROUTINE,
                        "status": "resulted",
                    },
                )
                self._safe_seed(
                    lambda o=order, p=patient, d=doctor, ln=lab_name: self._seed_lab_for_order(o, p, d, ln),
                    f"lab results for {lab_name}",
                )

            # Imaging orders
            for img_name, modality, exam_code, body_part, contrast in scenario.get("imaging_orders", []):
                order, _ = Order.objects.get_or_create(
                    patient=patient,
                    encounter=encounter,
                    ordered_by=doctor,
                    category=OrderCategory.IMAGING,
                    name=img_name,
                    defaults={
                        "exam_code": exam_code,
                        "body_part": body_part,
                        "contrast_required": contrast,
                        "indication": scenario["reason"],
                        "priority": Priority.URGENT,
                        "status": "resulted",
                    },
                )
                self._safe_seed(
                    lambda o=order, p=patient, d=doctor, mn=modality, in_=img_name, bp=body_part, c=contrast: self._seed_imaging_for_order(o, p, d, mn, in_, bp, c),
                    f"imaging for {img_name}",
                )

            self.stdout.write(f"  [Encounter] {patient.first_name} {patient.last_name} – {scenario['reason'][:50]}")

    # ─── Lab results ──────────────────────────────────────────────────────────

    _lab_counter = 0

    def _seed_lab_for_order(self, order, patient, doctor, lab_name):
        from apps.laboratory.models import (
            LabPanel, LabPanelStatus, LabReport, LabReportStatus,
            LabResultFlag, LabTestResult, LabResultStatus,
            Specimen, SpecimenStatus, SpecimenType,
            Accession, AnalyzerQueue, AnalyzerQueueStatus,
            CriticalValue,
        )

        Command._lab_counter += 1
        counter = Command._lab_counter

        # Assign varied statuses based on counter:
        # 1-6: released (complete pipeline)
        # 7-8: resulted (awaiting verification)
        # 9-10: in-progress (pending result entry)
        # 11-12: collected (awaiting accessioning)
        # 13+: ordered (new orders)
        if counter <= 6:
            specimen_status = SpecimenStatus.RESULTED
            panel_status = LabPanelStatus.RELEASED
            result_status = LabResultStatus.VERIFIED
        elif counter <= 8:
            specimen_status = SpecimenStatus.ANALYZED
            panel_status = LabPanelStatus.RESULTED
            result_status = LabResultStatus.PRELIMINARY
        elif counter <= 10:
            specimen_status = SpecimenStatus.PROCESSING
            panel_status = LabPanelStatus.IN_PROGRESS
            result_status = None  # no results yet
        elif counter <= 12:
            specimen_status = SpecimenStatus.RECEIVED
            panel_status = LabPanelStatus.PENDING
            result_status = None
        else:
            specimen_status = SpecimenStatus.ORDERED
            panel_status = LabPanelStatus.PENDING
            result_status = None

        # Specimen
        spec_type_map = {"blood": SpecimenType.BLOOD, "urine": SpecimenType.URINE, "swab": SpecimenType.SWAB}
        raw_type = order.specimen_type or "blood"
        specimen_type = spec_type_map.get(raw_type, SpecimenType.BLOOD)

        lab_tech = None
        try:
            from apps.authentication.models import User
            lab_tech = User.objects.filter(role="lab_tech").first()
        except Exception:
            pass

        specimen, _ = Specimen.objects.get_or_create(
            order=order,
            patient=patient,
            defaults={
                "collected_by": lab_tech or doctor,
                "type": specimen_type,
                "tube_type": "EDTA" if specimen_type == SpecimenType.BLOOD else "",
                "volume": 5 if specimen_type == SpecimenType.BLOOD else 10,
                "status": specimen_status,
                "collected_at": timezone.now() - timedelta(hours=6) if specimen_status != SpecimenStatus.ORDERED else None,
                "received_at": timezone.now() - timedelta(hours=5) if specimen_status not in (SpecimenStatus.ORDERED, SpecimenStatus.COLLECTED) else None,
                "received_by": lab_tech or doctor if specimen_status not in (SpecimenStatus.ORDERED, SpecimenStatus.COLLECTED) else None,
            },
        )

        # Accession — create for received+ specimens
        if specimen_status not in (SpecimenStatus.ORDERED, SpecimenStatus.COLLECTED):
            results_template = LAB_RESULTS.get(lab_name, [])
            test_names = [t[0] for t in results_template] if results_template else [lab_name]
            Accession.objects.get_or_create(
                specimen=specimen,
                defaults={
                    "received_by": lab_tech or doctor,
                    "condition": "acceptable",
                    "test_names": test_names,
                },
            )

        # AnalyzerQueue — create for received+ specimens
        if specimen_status in (SpecimenStatus.RECEIVED, SpecimenStatus.PROCESSING, SpecimenStatus.ANALYZED, SpecimenStatus.RESULTED):
            aq_status = {
                SpecimenStatus.RECEIVED: AnalyzerQueueStatus.PENDING,
                SpecimenStatus.PROCESSING: AnalyzerQueueStatus.IN_PROGRESS,
                SpecimenStatus.ANALYZED: AnalyzerQueueStatus.COMPLETED,
                SpecimenStatus.RESULTED: AnalyzerQueueStatus.COMPLETED,
            }.get(specimen_status, AnalyzerQueueStatus.PENDING)
            instruments = ["Cobas 8000", "Sysmex XN-1000", "Beckman AU5800", "Abbott Alinity ci"]
            # Estimated analysis durations per instrument (minutes)
            est_minutes = {"Cobas 8000": 45, "Sysmex XN-1000": 30, "Beckman AU5800": 60, "Abbott Alinity ci": 35}
            instr = instruments[counter % len(instruments)]
            AnalyzerQueue.objects.get_or_create(
                specimen=specimen,
                defaults={
                    "instrument": instr,
                    "status": aq_status,
                    "estimated_minutes": est_minutes.get(instr, 30),
                    "started_at": timezone.now() - timedelta(minutes=10) if aq_status == AnalyzerQueueStatus.IN_PROGRESS else (timezone.now() - timedelta(hours=4) if aq_status == AnalyzerQueueStatus.COMPLETED else None),
                    "completed_at": timezone.now() - timedelta(hours=3) if aq_status == AnalyzerQueueStatus.COMPLETED else None,
                },
            )

        panel, panel_created = LabPanel.objects.get_or_create(
            patient=patient,
            order=order,
            name=lab_name,
            defaults={
                "specimen": specimen,
                "status": panel_status,
                "priority": "urgent" if counter <= 4 else "routine",
                "verified_by": (lab_tech or doctor) if panel_status in (LabPanelStatus.VERIFIED, LabPanelStatus.RELEASED) else None,
                "verified_at": timezone.now() - timedelta(hours=2) if panel_status in (LabPanelStatus.VERIFIED, LabPanelStatus.RELEASED) else None,
            },
        )

        if not panel_created:
            return  # don't duplicate results

        flag_map = {
            "normal": LabResultFlag.NORMAL,
            "high": LabResultFlag.HIGH,
            "low": LabResultFlag.LOW,
            "critical-high": LabResultFlag.CRITICAL_HIGH,
            "critical-low": LabResultFlag.CRITICAL_LOW,
        }

        results_template = LAB_RESULTS.get(lab_name, [])

        # Only create results for panels that have reached result entry stage
        if result_status is not None and results_template:
            has_critical = False
            for test_name, loinc, value, unit, ref_range, flag_str in results_template:
                flag = flag_map.get(flag_str)
                result = LabTestResult.objects.create(
                    panel=panel,
                    specimen=specimen,
                    test_code=loinc,
                    test_name=test_name,
                    value=value,
                    unit=unit,
                    reference_range=ref_range,
                    flag=flag,
                    analyzed_at=timezone.now() - timedelta(hours=3),
                    verified_by=(lab_tech or doctor) if result_status == LabResultStatus.VERIFIED else None,
                    verified_at=timezone.now() - timedelta(hours=2) if result_status == LabResultStatus.VERIFIED else None,
                    status=result_status,
                )
                if result.is_critical:
                    has_critical = True

            if has_critical:
                panel.has_critical = True
                panel.save(update_fields=["has_critical"])

            # Create report for released panels
            if panel_status == LabPanelStatus.RELEASED:
                LabReport.objects.get_or_create(
                    panel=panel,
                    defaults={
                        "patient": patient,
                        "has_critical": has_critical,
                        "status": LabReportStatus.RELEASED,
                        "released_by": lab_tech or doctor,
                        "released_at": timezone.now() - timedelta(hours=1),
                    },
                )

            # Create CriticalValue records for critical results
            if has_critical:
                critical_results = LabTestResult.objects.filter(panel=panel, is_critical=True)
                for cr in critical_results:
                    CriticalValue.objects.get_or_create(
                        result=cr,
                        defaults={
                            "patient": patient,
                            "test_name": cr.test_name,
                            "value": cr.value,
                            "unit": cr.unit or "",
                            "status": "notified" if panel_status == LabPanelStatus.RELEASED else "pending",
                            "notified_to": doctor.get_full_name() if panel_status == LabPanelStatus.RELEASED else None,
                            "notified_at": timezone.now() - timedelta(minutes=30) if panel_status == LabPanelStatus.RELEASED else None,
                            "notification_method": "phone" if panel_status == LabPanelStatus.RELEASED else "",
                        },
                    )
        elif panel_status in (LabPanelStatus.PENDING, LabPanelStatus.IN_PROGRESS) and results_template:
            # Create empty result placeholders for pending panels so the UI shows template rows
            for test_name, loinc, _, unit, ref_range, _ in results_template:
                LabTestResult.objects.create(
                    panel=panel,
                    specimen=specimen,
                    test_code=loinc,
                    test_name=test_name,
                    value="",
                    unit=unit,
                    reference_range=ref_range,
                    status=LabResultStatus.PENDING,
                )

    # ─── Imaging results ──────────────────────────────────────────────────────

    # Keep a counter so we can assign different statuses to different imaging orders
    _imaging_counter = 0

    def _seed_imaging_for_order(self, order, patient, doctor, modality, exam_name, body_part, contrast):
        from apps.radiology.models import (
            ImagingModality, ImagingOrder, ImagingStudy,
            ImagingStudyStatus, RadiologyReport, RadReportStatus,
        )
        from apps.authentication.models import User

        radiologist = User.objects.filter(role="radiologist").first()
        Command._imaging_counter += 1
        idx = Command._imaging_counter

        # Vary statuses across different imaging orders for a realistic worklist
        # 1: signed (full pipeline), 2: acquired (awaiting read), 3: signed,
        # 4: ordered (new), 5: scheduled, 6: reading (in progress)
        STATUS_PLAN = {
            1: "signed",
            2: "acquired",
            3: "signed",
            4: "ordered",
            5: "scheduled",
            6: "reading",
        }
        plan = STATUS_PLAN.get(idx, "signed")

        if plan == "ordered":
            order_status = ImagingStudyStatus.ORDERED
        elif plan == "scheduled":
            order_status = ImagingStudyStatus.SCHEDULED
        elif plan in ("acquired", "reading"):
            order_status = ImagingStudyStatus(plan)
        else:
            order_status = ImagingStudyStatus.SIGNED

        order_defaults = {
            "patient": patient,
            "ordered_by": doctor,
            "modality": modality,
            "exam_code": order.exam_code or "",
            "exam_name": exam_name,
            "body_part": body_part,
            "contrast_required": contrast,
            "indication": order.indication or "",
            "priority": "stat" if idx in (2, 6) else "urgent",
            "status": order_status,
            "assigned_radiologist": radiologist if plan not in ("ordered",) else None,
        }
        if plan in ("scheduled", "acquired", "reading", "signed"):
            order_defaults["scheduled_at"] = timezone.now() + timedelta(hours=2 * idx)
            order_defaults["scheduled_room"] = f"RAD-{idx}"

        imaging_order, _ = ImagingOrder.objects.get_or_create(
            doctor_order=order,
            defaults=order_defaults,
        )

        # Only create study for orders that have progressed past scheduling
        if plan in ("ordered", "scheduled"):
            return

        study_defaults = {
            "patient": patient,
            "exam_date": timezone.now() - timedelta(hours=8),
            "status": ImagingStudyStatus(plan),
            "started_at": timezone.now() - timedelta(hours=8),
            "images_count": 48,
            "series_count": 4,
        }
        if plan == "signed":
            study_defaults["completed_at"] = timezone.now() - timedelta(hours=7)

        study, study_created = ImagingStudy.objects.get_or_create(
            order=imaging_order,
            defaults=study_defaults,
        )

        if not study_created:
            return

        # Only create reports for signed studies and draft for reading
        REPORT_TEMPLATES = {
            "CT": {
                "technique": "Multi-detector CT of the {part} with/without IV contrast, 3 mm slice thickness.",
                "findings": "CT of the {part} demonstrates consolidation in the lower lobes bilaterally compatible with pneumonia. No pleural effusion.",
                "impression": "Bilateral lower lobe consolidation consistent with community-acquired pneumonia.",
            },
            "US": {
                "technique": "B-mode and Doppler ultrasound of the {part} performed.",
                "findings": "Echocardiogram demonstrates reduced LV ejection fraction estimated at 35-40%. Elevated filling pressures.",
                "impression": "Moderately reduced systolic function (EF 35-40%). Recommend clinical correlation and cardiology follow-up.",
            },
            "XR": {
                "technique": "Standard PA and lateral chest radiograph obtained.",
                "findings": "Cardiomegaly with bilateral hilar vascular prominence. Mild pulmonary vascular congestion.",
                "impression": "Findings consistent with heart failure. Recommend clinical correlation.",
            },
            "MRI": {
                "technique": "MRI of the {part} performed with standard cardiac protocol.",
                "findings": "Cardiac MRI stress imaging demonstrates reversible perfusion defect in the anterior wall.",
                "impression": "Reversible anterior wall ischemia – consider revascularization.",
            },
        }

        tmpl = REPORT_TEMPLATES.get(modality, REPORT_TEMPLATES["XR"])

        if plan == "signed":
            RadiologyReport.objects.get_or_create(
                study=study,
                defaults={
                    "patient": patient,
                    "indication": order.indication or exam_name,
                    "technique": tmpl["technique"].format(part=body_part.lower()),
                    "findings": tmpl["findings"].format(part=body_part.lower()),
                    "impression": tmpl["impression"],
                    "status": RadReportStatus.FINAL,
                    "signed_by": radiologist,
                    "signed_at": timezone.now() - timedelta(hours=2),
                },
            )
        elif plan == "reading":
            RadiologyReport.objects.get_or_create(
                study=study,
                defaults={
                    "patient": patient,
                    "indication": order.indication or exam_name,
                    "technique": tmpl["technique"].format(part=body_part.lower()),
                    "findings": "",
                    "impression": "",
                    "status": RadReportStatus.DRAFT,
                },
            )

    # ─── CDSS Recommendations ─────────────────────────────────────────────────

    def _seed_cdss_recommendations(self):
        from apps.cdss.models import (
            CDSSRecommendation, CDSSSourceModule,
            CDSSSeverity, CDSSOutputKind, CDSSStatus, CDSSRecommendationType,
        )
        from apps.patients.models import Patient

        for item in CDSS_SCENARIOS:
            patient = Patient.objects.filter(phone=item["patient_phone"]).first()
            if not patient:
                continue

            CDSSRecommendation.objects.get_or_create(
                patient=patient,
                type=item["type"],
                triggered_by=item["triggered_by"],
                defaults={
                    "source_module": CDSSSourceModule.PHARMACY
                    if "prescription" in item["triggered_by"]
                    else CDSSSourceModule.NURSING,
                    "target_roles": item["target_roles"],
                    "output_kind": CDSSOutputKind.ALERT,
                    "severity": item["severity"],
                    "status": CDSSStatus.ACTIVE,
                    "title": item["title"],
                    "summary": item["summary"],
                    "snomed_code": item.get("snomed_code", ""),
                    "snomed_display": item.get("snomed_display", ""),
                    "affected_medications": [],
                    "suggested_actions": item["suggested_actions"],
                    "explanation": {
                        "summary": item["summary"],
                        "reasoning": item["suggested_actions"],
                        "confidence": "high",
                    },
                    "evidence_sources": [],
                    "expires_at": timezone.now() + timedelta(days=7),
                },
            )
            self.stdout.write(f"  [CDSS] {item['title'][:60]}")

    # ─── Nursing vitals ───────────────────────────────────────────────────────

    def _seed_nursing_vitals(self):
        from apps.nurses.models import Vitals
        from apps.authentication.models import User
        from apps.patients.models import Patient

        nurse = User.objects.filter(role="nurse").first()
        if not nurse:
            return

        vitals_data = [
            # (phone, systolic, diastolic, hr, temp, spo2, rr, pain)
            ("+201001112201", 120, 78,  88,  38.2, 93, 22, 4),
            ("+201002223301", 148, 94, 102,  37.1, 91, 24, 5),
            ("+201003334401", 170, 100, 94,  36.9, 96, 18, 7),
            ("+201005556601", 135, 86, 140,  36.8, 97, 16, 3),
            ("+201009990001", 100, 66,  98,  37.4, 88, 28, 6),
            ("+201007778801",  98, 62,  96,  39.2, 98, 20, 8),
        ]

        for phone, sys, dia, hr, temp, spo2, rr, pain in vitals_data:
            patient = Patient.objects.filter(phone=phone).first()
            if not patient:
                continue
            if not Vitals.objects.filter(patient=patient).exists():
                Vitals.objects.create(
                    patient=patient,
                    systolic=sys,
                    diastolic=dia,
                    heart_rate=hr,
                    temperature=temp,
                    spo2=spo2,
                    respiratory_rate=rr,
                    pain_score=pain,
                    recorded_by=nurse,
                    notes="Initial nursing assessment at admission.",
                )
                self.stdout.write(f"  [Vitals] {patient.first_name} {patient.last_name}")

    # ─── MAR entries from existing prescriptions ──────────────────────────────

    def _seed_mar_entries(self):
        from datetime import datetime as dt
        from apps.doctors.models import Prescription
        from apps.nurses.models import MAREntry, MARStatus

        FREQUENCY_MAP = {
            "once daily": 1, "daily": 1,
            "twice daily": 2, "bid": 2,
            "three times daily": 3, "tid": 3,
            "four times daily": 4, "qid": 4,
            "every 4 hours": 6,
            "every 6 hours": 4,
            "every 8 hours": 3,
            "every 12 hours": 2,
            "as needed": 0, "prn": 0,
        }
        ADMIN_TIMES = {
            1: [(8, 0)],
            2: [(8, 0), (20, 0)],
            3: [(8, 0), (14, 0), (20, 0)],
            4: [(6, 0), (12, 0), (18, 0), (22, 0)],
            6: [(0, 0), (4, 0), (8, 0), (12, 0), (16, 0), (20, 0)],
        }

        prescriptions = Prescription.objects.filter(
            patient__phone__startswith="+2010",
            status="active",
        )
        total = 0
        for rx in prescriptions:
            freq = (rx.frequency or "").strip().lower()
            times_per_day = FREQUENCY_MAP.get(freq, 1)
            if times_per_day == 0:
                continue
            start = rx.start_date or timezone.now().date()
            end = rx.end_date or (start + timedelta(days=2))
            admin_times = ADMIN_TIMES.get(times_per_day, [(8, 0)])
            current = start
            while current <= end:
                for hour, minute in admin_times:
                    scheduled = timezone.make_aware(
                        dt.combine(current, dt.min.time().replace(hour=hour, minute=minute))
                    )
                    _, created = MAREntry.objects.get_or_create(
                        prescription=rx,
                        scheduled_time=scheduled,
                        defaults={
                            "patient": rx.patient,
                            "status": MARStatus.SCHEDULED,
                        },
                    )
                    if created:
                        total += 1
                current += timedelta(days=1)
        self.stdout.write(f"  [MAR] Created {total} MAR entries from {prescriptions.count()} prescriptions")

    # ─── Nursing tasks from existing orders ───────────────────────────────────

    def _seed_nursing_tasks(self):
        from apps.nurses.models import Task, TaskStatus as NurseTaskStatus
        from apps.patients.models import Patient

        nurse = None
        from apps.authentication.models import User
        nurse = User.objects.filter(role="nurse").first()

        TASKS = [
            ("+201001112201", "Medication Administration", "Administer Azithromycin 500mg PO as scheduled", "high", "pending", "101"),
            ("+201001112201", "Lab Collection", "Collect blood sample for repeat CBC", "normal", "pending", "101"),
            ("+201001112201", "Vital Signs", "Record vital signs Q4H – febrile patient", "high", "pending", "101"),
            ("+201002223301", "Medication Administration", "Administer Furosemide 40mg IV push", "urgent", "pending", "CCU-1"),
            ("+201002223301", "I&O Monitoring", "Strict intake/output monitoring – hourly urine output", "high", "pending", "CCU-1"),
            ("+201002223301", "Weight Check", "Daily weight measurement before breakfast", "normal", "pending", "CCU-1"),
            ("+201003334401", "ECG Monitoring", "Continuous cardiac monitoring – report ST changes", "urgent", "pending", "CCU-2"),
            ("+201003334401", "Lab Collection", "Serial Troponin I collection – 6-hour interval", "high", "pending", "CCU-2"),
            ("+201005556601", "Medication Administration", "Administer Warfarin 5mg PO with INR check", "high", "pending", "203"),
            ("+201005556601", "Patient Education", "Warfarin diet education – vitamin K foods", "normal", "pending", "203"),
            ("+201007778801", "Medication Administration", "Administer Amoxicillin 250mg PO TID", "normal", "pending", "PED-3"),
            ("+201007778801", "Temperature Check", "Monitor temperature Q2H – fever management", "high", "pending", "PED-3"),
            ("+201009990001", "Respiratory Care", "SpO2 monitoring continuous – O2 titration", "urgent", "in-progress", "ICU-1"),
            ("+201009990001", "Positioning", "Elevate HOB 30-45 degrees – respiratory precaution", "high", "completed", "ICU-1"),
            ("+201009990001", "Lab Collection", "ABG collection per physician order", "urgent", "pending", "ICU-1"),
            ("+201004445501", "Patient Education", "Diabetes self-management education", "normal", "pending", ""),
            ("+201004445501", "Blood Glucose", "Check fasting blood glucose – pre-meal and bedtime", "high", "pending", ""),
        ]

        total = 0
        for phone, task_type, desc, priority, status_val, room in TASKS:
            patient = Patient.objects.filter(phone=phone).first()
            if not patient:
                continue
            _, created = Task.objects.get_or_create(
                patient=patient,
                type=task_type,
                description=desc,
                defaults={
                    "room": room,
                    "priority": priority,
                    "status": status_val,
                    "due_time": timezone.now() + timedelta(hours=1),
                    "assigned_to": nurse,
                    "shift": "day",
                },
            )
            if created:
                total += 1
        self.stdout.write(f"  [Tasks] Created {total} nursing tasks")

    # ─── Nursing handoffs ─────────────────────────────────────────────────────

    def _seed_nursing_handoffs(self):
        from apps.nurses.models import Handoff, ShiftType
        from apps.patients.models import Patient
        from apps.administration.models import Ward
        from apps.authentication.models import User

        nurses = list(User.objects.filter(role="nurse")[:2])
        if not nurses:
            return
        today = timezone.now().date()

        gen_ward = Ward.objects.filter(code="GW-IM").first() or Ward.objects.first()
        ccu_ward = Ward.objects.filter(code="CCU").first() or gen_ward
        icu_ward = Ward.objects.filter(code="ICU").first() or gen_ward

        HANDOFFS = [
            ("+201001112201", gen_ward, "101", ShiftType.DAY,
             "Patient admitted with community-acquired pneumonia. On IV Azithromycin.",
             "3-day fever history, productive cough. No known allergies. SpO2 93% on room air.",
             "Improving. Temp trending down. Still requires O2 supplementation.",
             "Continue antibiotics. Repeat CRP tomorrow. Consider step-down to PO if afebrile 24h."),
            ("+201002223301", ccu_ward, "CCU-1", ShiftType.DAY,
             "Acute-on-chronic CHF exacerbation. IV Furosemide running.",
             "Known CHF with reduced EF. Bilateral crackles. Pedal edema 2+. BNP elevated at 4200.",
             "Net negative 800ml since admission. JVP decreased. Still dyspneic on exertion.",
             "Strict I&O. Daily weights. Target 1-2L negative per day. Watch K+ levels."),
            ("+201003334401", ccu_ward, "CCU-2", ShiftType.EVENING,
             "Unstable angina rule-out MI. On dual antiplatelet therapy.",
             "Chest pain onset 6h ago. ECG shows ST changes in V3-V5. First troponin mildly elevated.",
             "Pain 4/10 after nitro. Hemodynamically stable. Awaiting serial troponin and CT angio.",
             "Serial troponins Q6H. Continuous telemetry. Call cardiology if pain recurs or ST changes."),
            ("+201009990001", icu_ward, "ICU-1", ShiftType.NIGHT,
             "Acute respiratory failure. Suspected PE. On Enoxaparin. SpO2 88%.",
             "Semi-conscious on arrival. ABG showing respiratory acidosis. D-dimer critically elevated.",
             "Intubated 2h ago. On mechanical ventilation FiO2 60%. Hemodynamically stable on pressors.",
             "Continue anticoagulation. CT PA done – awaiting report. Call attending if any hemodynamic instability."),
            ("+201005556601", gen_ward, "203", ShiftType.DAY,
             "New-onset atrial fibrillation. Started on Warfarin and Bisoprolol.",
             "HR 140 irregular on admission, now rate-controlled at 82. No prior AF history.",
             "Rate controlled. First INR 1.4 – subtherapeutic. No bleeding signs.",
             "Daily INR monitoring. Target INR 2-3. Warfarin diet education needed. Echo scheduled."),
            ("+201007778801", gen_ward, "PED-3", ShiftType.EVENING,
             "Pediatric patient – streptococcal tonsillitis with otitis media.",
             "6-year-old. Temp 39.2°C at admission. Enlarged tonsils with exudate. Parents at bedside.",
             "Temp now 37.8°C after antipyretics. Tolerating oral fluids. Mother educated on med schedule.",
             "Continue Amoxicillin TID. Paracetamol PRN Q6H. Push oral fluids. Reassess in AM."),
        ]

        total = 0
        for idx, (phone, ward, room, shift_type, situation, background, assessment, recommendation) in enumerate(HANDOFFS):
            patient = Patient.objects.filter(phone=phone).first()
            if not patient:
                continue
            # Alternate from_nurse between nurses so each can acknowledge the other's handoffs
            from_nurse = nurses[idx % len(nurses)]
            _, created = Handoff.objects.get_or_create(
                patient=patient,
                shift_date=today,
                shift_type=shift_type,
                defaults={
                    "ward": ward,
                    "room": room,
                    "situation": situation,
                    "background": background,
                    "assessment": assessment,
                    "recommendation": recommendation,
                    "from_nurse": from_nurse,
                },
            )
            if created:
                total += 1
        self.stdout.write(f"  [Handoffs] Created {total} shift handoffs")

    # ─── Nursing notes ────────────────────────────────────────────────────────

    def _seed_nursing_notes(self):
        from apps.nurses.models import NursingNote, NoteCategory
        from apps.patients.models import Patient
        from apps.authentication.models import User

        nurse = User.objects.filter(role="nurse").first()
        if not nurse:
            return

        NOTES = [
            ("+201001112201", NoteCategory.ASSESSMENT,
             "Patient alert and oriented x3. Temp 38.2°C. Productive cough with yellow sputum. "
             "Bilateral basal crackles on auscultation. SpO2 93% on 2L NC. IV access patent in left antecubital fossa."),
            ("+201001112201", NoteCategory.INTERVENTION,
             "Administered Azithromycin 500mg PO at 0800 as scheduled. Patient tolerated well. "
             "Incentive spirometry education provided – patient demonstrating 10 reps/hour."),
            ("+201002223301", NoteCategory.ASSESSMENT,
             "Patient in moderate distress with orthopnea. Using 3 pillows. Bilateral 2+ pedal edema. "
             "JVP elevated. Crackles bilateral bases. Strict I&O in place. Foley catheter draining clear urine."),
            ("+201002223301", NoteCategory.COMMUNICATION,
             "Notified Dr. Ali of K+ result 3.3 mEq/L. Order received for KCl 20mEq IV x1 dose. "
             "Pharmacy notified. Will recheck K+ in 4 hours."),
            ("+201003334401", NoteCategory.ASSESSMENT,
             "Chest pain currently 4/10 after sublingual nitro x1. Continuous telemetry – sinus rhythm with occasional PVCs. "
             "BP 145/88. HR 78. Patient anxious about diagnosis. Emotional support provided."),
            ("+201005556601", NoteCategory.EDUCATION,
             "Warfarin education provided to patient and spouse. Discussed: consistent vitamin K intake, "
             "avoid NSAIDs, signs of bleeding (bruising, hematuria, melena), importance of regular INR monitoring. "
             "Patient verbalizes understanding. Written materials provided in Arabic."),
            ("+201007778801", NoteCategory.ASSESSMENT,
             "Pediatric assessment: Child sleeping comfortably. Temp 37.8°C (down from 39.2°C). "
             "Tonsils still enlarged but less erythematous. Taking sips of water and juice. "
             "Mother at bedside, educated on medication schedule."),
            ("+201009990001", NoteCategory.INTERVENTION,
             "Endotracheal suctioning performed – moderate yellow secretions obtained. SpO2 improved to 94% post-suction. "
             "Repositioned to left lateral. Skin assessment: no pressure injuries noted. "
             "Enoxaparin 40mg SC administered in right abdomen. Mouth care provided."),
            ("+201009990001", NoteCategory.COMMUNICATION,
             "Rapid response called at 1430 for acute desaturation to 82%. Attending Dr. Samy at bedside within 5 min. "
             "FiO2 increased to 80%. ABG drawn stat. CT PA results pending with radiology."),
            ("+201004445501", NoteCategory.EDUCATION,
             "Diabetes self-management education session completed: blood glucose monitoring technique, "
             "insulin injection sites rotation, hypoglycemia recognition and treatment, sick day rules. "
             "Patient performed return demonstration of glucometer use successfully."),
        ]

        total = 0
        for phone, category, content in NOTES:
            patient = Patient.objects.filter(phone=phone).first()
            if not patient:
                continue
            _, created = NursingNote.objects.get_or_create(
                patient=patient,
                nurse=nurse,
                category=category,
                content=content,
                defaults={
                    "edit_deadline": timezone.now() + timedelta(hours=4),
                },
            )
            if created:
                total += 1
        self.stdout.write(f"  [Notes] Created {total} nursing notes")

    # ─── Discharge checklist items ────────────────────────────────────────────

    def _seed_discharge_checklists(self):
        from apps.nurses.models import DischargeChecklistItem
        from apps.patients.models import Patient

        # Seed checklist for outpatient / near-discharge patients
        DISCHARGE_PATIENTS = [
            "+201004445501",  # Nour Salem - outpatient diabetes
            "+201011101101",  # Amira - outpatient anemia
        ]

        STANDARD_ITEMS = [
            ("Medications", "Verify discharge medication list with pharmacy"),
            ("Medications", "Provide medication reconciliation to patient"),
            ("Medications", "Patient/family medication education completed"),
            ("Follow-up", "Schedule follow-up appointment"),
            ("Follow-up", "Provide follow-up care instructions"),
            ("Documentation", "Discharge summary signed by physician"),
            ("Documentation", "Nursing discharge assessment completed"),
            ("Documentation", "Patient education materials provided"),
            ("Patient Care", "Remove IV lines and catheters"),
            ("Patient Care", "Final vital signs recorded"),
            ("Patient Care", "Wound care instructions given (if applicable)"),
            ("Administrative", "Patient belongings returned"),
            ("Administrative", "Insurance/billing clearance confirmed"),
            ("Administrative", "Transport arranged"),
        ]

        total = 0
        for phone in DISCHARGE_PATIENTS:
            patient = Patient.objects.filter(phone=phone).first()
            if not patient:
                continue
            if DischargeChecklistItem.objects.filter(patient=patient).exists():
                continue
            items = [
                DischargeChecklistItem(patient=patient, category=cat, item=item)
                for cat, item in STANDARD_ITEMS
            ]
            DischargeChecklistItem.objects.bulk_create(items)
            total += len(items)
        self.stdout.write(f"  [Discharge] Created {total} checklist items")

    # ─── Billing records ──────────────────────────────────────────────────────

    def _seed_billing_records(self):
        from apps.billing.models import Invoice, Claim
        from apps.patients.models import Patient

        BILLING = [
            {
                "phone": "+201001112201",
                "diag": "J18.9 – Community-acquired Pneumonia",
                "items": [
                    {"code": "ROOM-GEN", "description": "General room - daily", "quantity": 3, "amount": 1200},
                    {"code": "CONSULT", "description": "Internal medicine consultation", "quantity": 1, "amount": 400},
                    {"code": "CT-CHEST", "description": "CT chest with contrast", "quantity": 1, "amount": 1800},
                    {"code": "LAB-CBC", "description": "Complete blood count CBC", "quantity": 1, "amount": 150},
                ],
                "total": 3550, "payer": "National Health Insurance Organization",
            },
            {
                "phone": "+201002223301",
                "diag": "I50.23 – Acute-on-chronic Heart Failure",
                "items": [
                    {"code": "ROOM-CCU", "description": "Cardiac care unit room - daily", "quantity": 4, "amount": 2400},
                    {"code": "ECHO", "description": "Echocardiogram", "quantity": 1, "amount": 900},
                    {"code": "XR-CHEST", "description": "Chest X-ray", "quantity": 1, "amount": 200},
                ],
                "total": 3500, "payer": "Misr Insurance",
            },
            {
                "phone": "+201003334401",
                "diag": "I20.0 – Unstable Angina",
                "items": [
                    {"code": "ROOM-CCU", "description": "Cardiac care unit room - daily", "quantity": 2, "amount": 1200},
                    {"code": "CT-CORON", "description": "CT coronary angiography with contrast", "quantity": 1, "amount": 2500},
                    {"code": "TROP", "description": "Serial troponin", "quantity": 3, "amount": 450},
                ],
                "total": 4150, "payer": "AXA Egypt",
            },
        ]

        for rec in BILLING:
            patient = Patient.objects.filter(phone=rec["phone"]).first()
            if not patient:
                continue
            invoice, created = Invoice.objects.get_or_create(
                patient=patient,
                primary_diagnosis=rec["diag"],
                defaults={
                    "encounter_type": "inpatient",
                    "status": "draft",
                    "insurance_plan": {
                        "provider": rec["payer"],
                        "policyNumber": patient.insurance_id or "N/A",
                    },
                    "charge_items": rec["items"],
                    "total_amount": rec["total"],
                    "balance": rec["total"],
                },
            )
            if created:
                Claim.objects.get_or_create(
                    invoice=invoice,
                    patient=patient,
                    payer_id=rec["payer"],
                    claim_type="medical",
                    defaults={"status": "draft"},
                )
                self.stdout.write(f"  [Billing] Invoice for {patient.first_name} {patient.last_name} – EGP {rec['total']}")

    # ─── Pharmacy dispense ────────────────────────────────────────────────────

    def _seed_pharmacy_dispense(self):
        from django.db import models
        from apps.authentication.models import User
        from apps.doctors.models import Prescription
        from apps.pharmacy.models import (
            PharmacyPrescription, DispenseRecord,
            FormularyItem, RxStatus, RxSetting,
        )

        pharmacist = User.objects.filter(role="pharmacist").first()
        if not pharmacist:
            self.stdout.write(self.style.WARNING("  No pharmacist found – skipping pharmacy dispense."))
            return

        # Outpatient prescriptions are dispensed; inpatient ones are verified only
        # (nurses administer them on the ward).
        inpatient_wards = {"GW-IM", "CCU", "PED-W", "MAT-W", "ICU", "ER-W"}

        for rx in Prescription.objects.select_related("patient", "patient__ward").all():
            # Skip if already has a pharmacy record
            if hasattr(rx, "pharmacy_record"):
                continue

            is_inpatient = (
                rx.patient.ward is not None
                and getattr(rx.patient.ward, "code", None) in inpatient_wards
            )
            setting = RxSetting.INPATIENT if is_inpatient else RxSetting.OUTPATIENT

            # Create the pharmacy prescription record (verified + dispensed)
            pharm_rx, created = PharmacyPrescription.objects.get_or_create(
                original_prescription=rx,
                defaults={
                    "patient": rx.patient,
                    "status": RxStatus.DISPENSED,
                    "setting": setting,
                    "priority": "routine",
                    "verified_by": pharmacist,
                    "verified_at": timezone.now() - timedelta(hours=3),
                    "verification_notes": "Verified by pharmacist – no contraindications noted.",
                    "dispensed_by": pharmacist,
                    "dispensed_at": timezone.now() - timedelta(hours=2),
                    "lot_number": f"LOT-{rx.rxnorm_code or '000'}-2026",
                    "expiration_date": (timezone.now() + timedelta(days=365)).date(),
                    "quantity_dispensed": rx.quantity,
                    "drug_warnings": [],
                },
            )

            if created:
                # Deduct from formulary stock (only if sufficient stock)
                deduct = min(rx.quantity, 10)
                FormularyItem.objects.filter(
                    name=rx.medication, stock_level__gte=deduct
                ).update(stock_level=models.F("stock_level") - deduct)

                # Create a dispense record
                DispenseRecord.objects.create(
                    prescription=pharm_rx,
                    patient=rx.patient,
                    dispensed_by=pharmacist,
                    lot_number=pharm_rx.lot_number,
                    expiration_date=pharm_rx.expiration_date,
                    quantity=rx.quantity,
                    days_supply=rx.quantity if setting == RxSetting.OUTPATIENT else None,
                )

                self.stdout.write(
                    f"  [Pharmacy] Dispensed: {rx.medication} → {rx.patient.first_name} {rx.patient.last_name}"
                )

    # ─── Pharmacy interventions ───────────────────────────────────────────────

    def _seed_pharmacy_interventions(self):
        from apps.authentication.models import User
        from apps.pharmacy.models import (
            PharmacyIntervention, PharmacyPrescription, DrugWarning, InterventionType,
        )

        pharmacist = User.objects.filter(role="pharmacist").first()
        if not pharmacist:
            self.stdout.write(self.style.WARNING("  No pharmacist found – skipping interventions."))
            return

        # Pick up to 3 dispensed pharmacy prescriptions to attach warnings/interventions to
        rxs = list(PharmacyPrescription.objects.select_related("patient").all()[:3])
        if not rxs:
            return

        intervention_scenarios = [
            {
                "type": InterventionType.DOSE_ADJUSTMENT,
                "reason": "Prescribed dose exceeds recommended maximum for patient weight and renal function.",
                "recommendation": "Reduce dose by 25% and recheck renal function in 48 hours.",
                "warning_type": "dose-range",
                "warning_severity": "severe",
                "warning_message": "Dose exceeds maximum recommended limit for this patient's renal profile.",
            },
            {
                "type": InterventionType.ALLERGY_CLARIFICATION,
                "reason": "Patient allergy list includes a documented reaction to a drug in the same class.",
                "recommendation": "Confirm with prescriber whether allergy was considered; consider alternative agent.",
                "warning_type": "allergy",
                "warning_severity": "contraindicated",
                "warning_message": "Potential allergy cross-reactivity noted.",
            },
            {
                "type": InterventionType.FORMULARY_SUBSTITUTION,
                "reason": "Prescribed brand-name drug has a therapeutically equivalent formulary generic available at significantly lower cost.",
                "recommendation": "Switch to formulary generic equivalent pending prescriber approval.",
                "warning_type": "duplication",
                "warning_severity": "moderate",
                "warning_message": "Drug duplication detected – patient already on a similar agent.",
            },
        ]

        for pharm_rx, scenario in zip(rxs, intervention_scenarios):
            # Add a drug warning to the prescription
            DrugWarning.objects.get_or_create(
                prescription=pharm_rx,
                type=scenario["warning_type"],
                defaults={
                    "patient": pharm_rx.patient,
                    "severity": scenario["warning_severity"],
                    "message": scenario["warning_message"],
                    "medications_involved": [pharm_rx.original_prescription.medication
                                             if pharm_rx.original_prescription else "Unknown"],
                },
            )
            # Create the intervention
            PharmacyIntervention.objects.get_or_create(
                prescription=pharm_rx,
                type=scenario["type"],
                defaults={
                    "reason": scenario["reason"],
                    "recommendation": scenario["recommendation"],
                    "prescriber_contact": pharm_rx.original_prescription.prescribed_by.get_full_name()
                        if pharm_rx.original_prescription and pharm_rx.original_prescription.prescribed_by
                        else "Prescriber",
                    "pharmacist": pharmacist,
                    "outcome": "pending",
                },
            )
            self.stdout.write(
                f"  [Intervention] {scenario['type']} → {pharm_rx.patient.first_name} {pharm_rx.patient.last_name}"
            )

    # ─── Modality schedules ──────────────────────────────────────────────────

    def _seed_modality_schedules(self):
        from apps.radiology.models import ModalitySchedule, ModalitySlotStatus, ImagingOrder
        from apps.patients.models import Patient

        today = timezone.now().date()

        SLOTS = [
            # (modality, room, start, end, duration, status, patient_phone, exam_name)
            ("CT", "CT-Room-1", "08:00", "08:30", 30, "completed", "+201001112201", "CT Chest Without Contrast"),
            ("CT", "CT-Room-1", "08:30", "09:00", 30, "completed", "+201009990001", "CT Pulmonary Angiography"),
            ("CT", "CT-Room-1", "09:00", "09:45", 45, "in-progress", "+201003334401", "CT Coronary Angiography"),
            ("CT", "CT-Room-1", "09:45", "10:15", 30, "scheduled", None, None),
            ("CT", "CT-Room-1", "10:15", "10:45", 30, "available", None, None),
            ("CT", "CT-Room-1", "10:45", "11:15", 30, "available", None, None),
            ("XR", "XR-Room-1", "08:00", "08:15", 15, "completed", "+201002223301", "Chest X-Ray"),
            ("XR", "XR-Room-1", "08:15", "08:30", 15, "available", None, None),
            ("XR", "XR-Room-1", "08:30", "08:45", 15, "available", None, None),
            ("XR", "XR-Room-1", "08:45", "09:00", 15, "available", None, None),
            ("US", "US-Room-1", "08:00", "08:45", 45, "completed", "+201002223301", "Echocardiogram"),
            ("US", "US-Room-1", "08:45", "09:30", 45, "scheduled", "+201005556601", "Echocardiogram"),
            ("US", "US-Room-1", "09:30", "10:15", 45, "available", None, None),
            ("US", "US-Room-1", "10:15", "11:00", 45, "available", None, None),
            ("MRI", "MRI-Room-1", "08:00", "09:00", 60, "blocked", None, "Maintenance"),
            ("MRI", "MRI-Room-1", "09:00", "10:00", 60, "available", None, None),
            ("MRI", "MRI-Room-1", "10:00", "11:00", 60, "available", None, None),
        ]

        total = 0
        for modality, room, start, end, duration, slot_status, phone, exam_name in SLOTS:
            patient = Patient.objects.filter(phone=phone).first() if phone else None
            slot_status_value = slot_status
            if slot_status_value == "in-progress":
                slot_status_value = "booked"
            elif slot_status_value in ("completed", "scheduled"):
                slot_status_value = "booked"
            elif slot_status_value == "blocked":
                slot_status_value = "blocked"
            else:
                slot_status_value = "available"

            _, created = ModalitySchedule.objects.get_or_create(
                modality=modality,
                room=room,
                date=today,
                start_time=start,
                defaults={
                    "end_time": end,
                    "duration_minutes": duration,
                    "status": slot_status_value,
                    "patient": patient,
                    "exam_name": exam_name or "",
                },
            )
            if created:
                total += 1
        self.stdout.write(f"  [Schedule] Created {total} modality schedule slots")

    # ─── Admissions ───────────────────────────────────────────────────────────

    def _seed_admissions(self):
        from apps.administration.models import Bed, Department, Ward
        from apps.patients.models import Admission, AdmissionStatus, AdmissionType, Patient

        # Ward code → admission reason for each patient
        WARD_REASONS = {
            "GW-IM":  "Admitted for monitoring and management",
            "CCU":    "Admitted for cardiac monitoring and Management",
            "PED-W":  "Admitted for paediatric treatment",
            "MAT-W":  "Admitted for obstetric management",
            "ICU":    "Admitted to ICU for critical care",
            "ER-W":   "Admitted via Emergency for acute management",
        }

        ward_map = {w.code: w for w in Ward.objects.all()}
        dept_map = {d.code: d for d in Department.objects.all()}
        # ward_code → dept_code (matches WARDS constant)
        ward_dept = {w["code"]: w["dept"] for w in WARDS}

        # pre-load first available bed per ward
        bed_map: dict = {}
        for ward_obj in ward_map.values():
            bed = Bed.objects.filter(ward=ward_obj).first()
            if bed:
                bed_map[ward_obj.code] = bed

        doctor_email_cycle = [
            "dr.ahmed.samy@hospital.eg",
            "dr.fatima.ali@hospital.eg",
            "dr.omar.hassan@hospital.eg",
            "dr.mona.ibrahim@hospital.eg",
        ]
        from apps.authentication.models import User
        doctor_map = {u.email: u for u in User.objects.filter(role="doctor")}

        for idx, item in enumerate(PATIENTS_DATA):
            if not item.get("ward"):
                continue  # outpatients handled separately
            patient = Patient.objects.filter(phone=item["phone"]).first()
            if not patient:
                continue

            ward = ward_map.get(item["ward"])
            if not ward:
                continue

            dept_code = ward_dept.get(item["ward"])
            dept = dept_map.get(dept_code) if dept_code else None
            bed = bed_map.get(item["ward"])
            doctor = doctor_map.get(doctor_email_cycle[idx % len(doctor_email_cycle)])
            reason = WARD_REASONS.get(item["ward"], "Admitted for treatment")

            _, created = Admission.objects.get_or_create(
                patient=patient,
                status=AdmissionStatus.ACTIVE,
                defaults={
                    "type": AdmissionType.INPATIENT,
                    "admitting_doctor": doctor,
                    "department": dept,
                    "ward": ward,
                    "bed": bed,
                    "reason_for_admission": reason,
                },
            )
            if created:
                self.stdout.write(f"  [Admission] {patient.first_name} {patient.last_name} → {ward.name}")

    # ─── Appointments ─────────────────────────────────────────────────────────

    def _seed_appointments(self):
        from datetime import date, time as dtime, timedelta

        from apps.administration.models import Department
        from apps.patients.models import Appointment, AppointmentStatus, Patient

        from apps.authentication.models import User

        dept_map = {d.code: d for d in Department.objects.all()}
        doctor_email_cycle = [
            "dr.ahmed.samy@hospital.eg",
            "dr.fatima.ali@hospital.eg",
            "dr.omar.hassan@hospital.eg",
            "dr.mona.ibrahim@hospital.eg",
        ]
        doctor_map = {u.email: u for u in User.objects.filter(role="doctor")}

        # Doctor email → department code
        doctor_dept = {
            "dr.ahmed.samy@hospital.eg":   "IM",
            "dr.fatima.ali@hospital.eg":   "CARD",
            "dr.omar.hassan@hospital.eg":  "PED",
            "dr.mona.ibrahim@hospital.eg": "OBG",
        }

        today = date.today()
        for idx, item in enumerate(PATIENTS_DATA):
            patient = Patient.objects.filter(phone=item["phone"]).first()
            if not patient:
                continue

            doctor_email = doctor_email_cycle[idx % len(doctor_email_cycle)]
            doctor = doctor_map.get(doctor_email)
            dept_code = doctor_dept.get(doctor_email, "IM")
            dept = dept_map.get(dept_code)

            appt_date = today + timedelta(days=(idx % 7))
            appt_time = dtime(9 + (idx % 6), 0)

            if item.get("ward"):
                appt_type = "follow-up"
                status = AppointmentStatus.SCHEDULED
                notes = "Post-admission follow-up appointment"
            else:
                appt_type = "outpatient"
                status = AppointmentStatus.SCHEDULED
                notes = "Routine outpatient consultation"

            _, created = Appointment.objects.get_or_create(
                patient=patient,
                doctor=doctor,
                date=appt_date,
                defaults={
                    "department": dept,
                    "type": appt_type,
                    "status": status,
                    "time": appt_time,
                    "duration": 30,
                    "notes": notes,
                },
            )
            if created:
                self.stdout.write(f"  [Appointment] {patient.first_name} {patient.last_name} → Dr {doctor.last_name if doctor else '?'} on {appt_date}")

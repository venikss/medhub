# VirtualHospital (MedHub) Backend

Production-ready REST API + WebSocket server for a multi-role hospital management system built with Django 5, Django Channels, and PostgreSQL.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Django 5.0.6 + Django REST Framework 3.15 |
| ASGI Server | Daphne 4.1 |
| WebSockets | Django Channels 4.1 + Redis pub/sub |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT (djangorestframework-simplejwt) |
| Storage | MinIO / AWS S3 (django-storages) |
| API Docs | Removed from runtime configuration |
| Clinical | simple-icd-10, RapidFuzz |
| Architecture | Hexagonal + Modular Monolith + DDD |

---

## Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/your-org/medhub-backend.git
cd medhub-backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Variables

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start Infrastructure (Docker)

```bash
docker-compose up -d db redis minio
```

### 4. Run Migrations & Seed

```bash
python manage.py migrate
python manage.py seed
```

Seed creates one user per role with password **`Seed@1234`**:

| Role | Email |
|---|---|
| Admin | admin@medhub.io |
| Doctor | doctor@medhub.io |
| Nurse | nurse@medhub.io |
| Lab Tech | labtech@medhub.io |
| Radiologist | radiologist@medhub.io |
| Pharmacist | pharmacist@medhub.io |
| Billing Staff | billing@medhub.io |
| Front Desk | frontdesk@medhub.io |

### 5. Run Development Server

```bash
python manage.py runserver
```

Or via Daphne (ASGI with WebSocket support):

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

---

## Docker Deployment

```bash
docker-compose up --build
```

Services started: `app` (Daphne), `db` (PostgreSQL 16), `redis` (Redis 7), `minio` (object storage).

---

## Remote LLM Setup

The CDSS GraphRAG integration already supports a model server running on a different machine. Configure these values in `backend/.env`:

```bash
LLM_API_URL=http://192.168.1.50:11434/api/generate
LLM_MODEL_NAME=medllama2
LLM_API_TIMEOUT_SECONDS=30
```

Notes:

- `LLM_API_URL` must be reachable from the Django backend host or Docker container, not just from your browser.
- If the LLM runs on another PC in your LAN, start that inference server bound to `0.0.0.0` or the machine's LAN IP.
- Open the model server port in that machine's firewall.
- If you're using Ollama remotely, the backend should target the remote machine IP rather than `host.docker.internal`.

---

## Ontology Foundation

The CDSS app now includes a reusable ontology layer for:

- `ICD-10`
- `SNOMED CT`
- `RxNorm`
- `LOINC` (model support added; source sync can be added next for labs)

What it does now:

- stores canonical medical concepts in `medical_ontology_concepts`
- stores local-to-canonical mappings in `medical_ontology_mappings`
- syncs doctor diagnoses into ontology-backed ICD-10 and SNOMED entries
- syncs prescriptions into ontology-backed RxNorm entries
- pushes those codes into the Neo4j patient graph so GraphRAG can use them

After pulling these changes:

```bash
python manage.py migrate
python manage.py sync_postgres_to_graph
```

That will backfill ontology-linked conditions and medications from existing PostgreSQL data.
It will also load a starter diagnosis catalog with real examples such as:

- Type 2 diabetes mellitus
- Essential hypertension
- Acute myocardial infarction
- COPD with acute exacerbation
- Pneumonia
- Chronic kidney disease stage 3

---

## API Reference

| Base Path | Module | Roles |
|---|---|---|
| `/api/v1/auth/` | Authentication | All |
| `/api/v1/admin/` | Administration | Admin |
| `/api/v1/patients/` | Patient ADT | Doctor, Nurse, Front Desk |
| `/api/v1/doctors/` | Doctor Portal | Doctor |
| `/api/v1/nurses/` | Nursing | Nurse |
| `/api/v1/lab/` | Laboratory (LIS) | Lab Tech, Doctor |
| `/api/v1/radiology/` | Radiology (RIS) | Radiologist, Doctor |
| `/api/v1/pharmacy/` | Pharmacy | Pharmacist, Doctor, Nurse |
| `/api/v1/billing/` | Billing / RCM | Billing Staff, Admin |
| `/api/v1/cdss/` | CDSS Alerts | Doctor, Nurse, Pharmacist |

## Authentication

All endpoints require a JWT Bearer token except `/api/v1/auth/login/`.

```bash
# Login
POST /api/v1/auth/login/
{ "email": "doctor@medhub.io", "password": "Seed@1234" }

# Response
{ "accessToken": "...", "refreshToken": "...", "user": { ... } }

# Refresh
POST /api/v1/auth/refresh/
{ "refresh": "<refreshToken>" }
```

Access tokens expire in **8 hours**. Refresh tokens expire in **30 days** (rotation enabled).

---

## WebSocket

Connect with your JWT token:

```
ws://localhost:8000/ws?token=<accessToken>
```

On connect, the server joins you to your role-based channel group and returns:

```json
{
  "event": "connection.established",
  "payload": { "userId": "...", "role": "doctor", "groups": ["role_doctor"] }
}
```

### Events

| Event | Triggered By | Target Roles |
|---|---|---|
| `cdss.new_recommendation` | NEWS2≥5, critical lab, critical radiology, drug safety | Doctor, Nurse, Pharmacist |
| `lab.critical_result` | Lab report released with critical values | Doctor, Nurse, Lab Tech |
| `lab.result_released` | Lab report finalized | Doctor |
| `radiology.critical_finding` | Radiologist flags critical finding | Doctor, Nurse, Radiologist |
| `radiology.report_signed` | Radiologist signs report | Doctor |
| `adt.admission` | Patient admitted | Doctor, Nurse, Front Desk |
| `adt.discharge` | Patient discharged | Doctor, Nurse, Front Desk |
| `adt.bed_available` | Bed freed after discharge/transfer | Front Desk, Nurse |
| `queue.ticket_called` | Queue ticket called | Front Desk, Patient |
| `pharmacy.rx_verified` | Prescription verified | Doctor, Nurse |
| `pharmacy.rx_dispensed` | Medication dispensed | Nurse |

---

## CDSS Auto-Triggers

The system automatically creates CDSS recommendations when:

| Trigger | Condition | Recommendation Type |
|---|---|---|
| Vitals recorded (Nursing) | NEWS2 score ≥ 5 | `deterioration_alert` |
| Lab report released | Any result flagged `is_critical=True` | `panic_value` |
| Radiology critical finding | Radiologist creates critical finding | `urgent_finding` |
| Drug safety check | Patient allergy match or severe interaction | `allergy` / `drug_interaction` |

---

## Role Matrix

| Endpoint | Admin | Doctor | Nurse | Lab | Radiology | Pharmacy | Billing | Front Desk |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Patients (read) | ✓ | ✓ | ✓ | | | | | ✓ |
| Patients (write) | ✓ | ✓ | | | | | | ✓ |
| Encounters | ✓ | ✓ | | | | | | |
| Vitals / MAR | ✓ | | ✓ | | | | | |
| Lab orders/results | ✓ | ✓ | | ✓ | | | | |
| Radiology | ✓ | ✓ | | | ✓ | | | |
| Pharmacy | ✓ | ✓ | ✓ | | | ✓ | | |
| Billing | ✓ | | | | | | ✓ | |
| CDSS | ✓ | ✓ | ✓ | | | ✓ | | |
| Administration | ✓ | | | | | | | |

---

## Project Structure

```
backend/
├── apps/
│   ├── authentication/     # JWT auth, User model, 9 roles
│   ├── administration/     # Departments, Wards, Beds, Audit
│   ├── patients/           # ADT, Patient, Appointments, Queue
│   ├── doctors/            # Encounters, SOAP, Orders, Prescriptions
│   ├── nurses/             # Vitals (NEWS2), MAR, Handoff, Wound care
│   ├── laboratory/         # LIS: Specimens, Accessions, Reports, Critical values
│   ├── radiology/          # RIS-PACS: Imaging Orders, Studies, Reports
│   ├── pharmacy/           # Rx verification, Dispense, Drug safety checks
│   ├── billing/            # Invoices, Claims, Payments, Denials
│   ├── cdss/               # Clinical Decision Support recommendations
│   └── websocket/          # Channels consumer, JWT middleware, routing
├── config/
│   ├── settings/base.py    # All settings (env-driven)
│   ├── urls.py             # Main URL router
│   └── asgi.py             # ASGI + Channels routing
├── core/
│   ├── models.py           # TimeStampedModel, SoftDeleteModel
│   ├── permissions.py      # Role-based permission classes
│   ├── pagination.py       # StandardPagination
│   ├── exceptions.py       # Custom exception handlers
│   ├── audit.py            # Audit log writer
│   ├── websockets.py       # Broadcast helpers (all 11 event types)
│   └── utils.py            # Helpers (NEWS2 calculator, etc.)
├── tests/
│   ├── test_auth.py
│   ├── test_cdss_triggers.py
│   └── test_critical_values.py
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── pytest.ini
└── .env.example
```

---

## Running Tests

```bash
pytest tests/ -v
```

With coverage:

```bash
pytest tests/ --cov=apps --cov-report=term-missing
```

---

## License

MIT

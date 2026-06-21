# Virtual Hospital — MedHub

> **MedHub** is a full-stack, AI-augmented hospital information system built as a graduation project. It covers every clinical department — admissions, doctors, nursing, laboratory, radiology, pharmacy, billing, and a real-time Clinical Decision Support System (CDSS) powered by a local MedGemma LLM and a Neo4j knowledge graph.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [1 — Clone the Repository](#1--clone-the-repository)
4. [2 — Local AI Model Setup (MedGemma)](#2--local-ai-model-setup-medgemma)
5. [3 — Backend Setup](#3--backend-setup)
6. [4 — Frontend Setup](#4--frontend-setup)
7. [5 — Running the Full Stack](#5--running-the-full-stack)
8. [Test Accounts](#test-accounts)
9. [Module Guide](#module-guide)
10. [Environment Variables Reference](#environment-variables-reference)
11. [API Quick Reference](#api-quick-reference)
12. [WebSocket](#websocket)
13. [Running Tests](#running-tests)
14. [Docker (Full Stack)](#docker-full-stack)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Client                     │
│          Next.js 16 · React 19 · TypeScript             │
│          Tailwind CSS · shadcn/ui · Zustand             │
└───────────────────────┬─────────────────────────────────┘
                        │  HTTP / WebSocket
┌───────────────────────▼─────────────────────────────────┐
│                   Django 5 Backend                      │
│      Django REST Framework · Daphne (ASGI) · JWT        │
│      Modular Monolith · Hexagonal Architecture · DDD    │
│                                                         │
│  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ patients │ │doctors │ │  nurses  │ │  pharmacy    │  │
│  ├──────────┤ ├────────┤ ├──────────┤ ├──────────────┤  │
│  │   lab    │ │radiol. │ │ billing  │ │   admin      │  │
│  ├──────────┴─┴────────┴─┴──────────┴─┴──────────────┤  │
│  │              CDSS (GraphRAG + Rules)              │  │
│  └───────────────────────────────────────────────────┘  │
└───────────┬──────────────┬──────────────┬───────────────┘
            │              │              │
     ┌──────▼──────┐ ┌─────▼──────┐ ┌───▼──────────────┐
     │ PostgreSQL  │ │   Redis    │ │     MinIO (S3)   │
     │ (data)      │ │(cache + WS)│ │  (DICOM / files) │
     └─────────────┘ └────────────┘ └──────────────────┘
            │
     ┌──────▼──────────────────────────────────────┐
     │            Neo4j Knowledge Graph            │
     │   Patient graph · Ontology (ICD-10, RxNorm) │
     └──────────────┬──────────────────────────────┘
                    │  HTTP (OpenAI-compatible)
     ┌──────────────▼──────────────────────────────┐
     │    MedGemma LLM  (mlx_vlm  ·  port 8081)    │
     │    medgemma-1_5-4b-it-4bit                  │
     └─────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Backend runtime |
| Node.js | 20+ | Frontend runtime |
| npm | 10+ | Frontend package manager |
| Docker + Docker Compose | Latest | PostgreSQL, Redis, MinIO, Neo4j |
| macOS + Apple Silicon | M1/M2/M3/M4 | Required for local MedGemma model |

> **Windows / Linux users**: The MedGemma model uses `mlx_vlm` which is **Apple Silicon only**. On other platforms you can skip the model setup; the CDSS will fall back gracefully, or you can point `LLM_API_URL` to any OpenAI-compatible inference server.

---

## 1 — Clone the Repository

```bash
git clone <your-repo-url>
cd <repo-folder>/Virtual Hospital
```

---

## 2 — Local AI Model Setup (MedGemma)

The CDSS module uses a quantised MedGemma model served locally via `mlx_vlm`. Because model weights are too large for GitHub, they are hosted on Google Drive.

### 2a — Download the model

**Download link:** [medgemma-1_5-4b-it-4bit (Google Drive)](https://drive.google.com/file/d/1IXRaWDrQKxBZYKSaXH5iOweMB7EL3dQG/view?usp=drive_link)

After downloading, extract / place the folder so your directory looks like:

```
Virtual Hospital/
└── .models/
    └── medgemma-1_5-4b-it-4bit/
        ├── config.json
        ├── tokenizer.json
        ├── *.safetensors
        └── ...
```

> The `.models/` folder sits **next to** `backend/` and `frontend/`, at the root of `Virtual Hospital/`.

### 2b — Install mlx_vlm

```bash
pip install mlx-vlm
```

### 2c — Start the model server

Run this from the `Virtual Hospital/` directory (or use an absolute path):

```bash
python3 -m mlx_vlm.server \
  --model ".models/medgemma-1_5-4b-it-4bit" \
  --port 8081
```

The server exposes an OpenAI-compatible endpoint at `http://localhost:8081/v1/chat/completions`. Keep this terminal open while using the CDSS.

---

## 3 — Backend Setup

### 3a — Infrastructure services (Docker)

From `Virtual Hospital/backend/`:

```bash
docker-compose up -d db redis minio neo4j
```

This starts:
| Container | Port | Purpose |
|---|---|---|
| PostgreSQL 16 | 5434 → 5432 | Primary relational database |
| Redis 7 | 6380 → 6379 | Cache + WebSocket channel layer |
| MinIO | 9000 / 9001 | S3-compatible object storage (DICOM, uploads) |
| Neo4j 5.20 | 7474 / 7687 | Patient knowledge graph |

### 3b — Python virtual environment

```bash
cd Virtual Hospital/backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3c — Environment file

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```env
SECRET_KEY=any-long-random-string-here
DEBUG=True
LLM_API_URL=http://localhost:8081/v1/chat/completions
```

Everything else has safe defaults matching the Docker Compose configuration.

### 3d — Database migrations & seed

```bash
python manage.py migrate
python manage.py seed
```

`seed` creates one user per role (see [Test Accounts](#test-accounts) below).

### 3e — Load the knowledge graph (optional but recommended for CDSS)

```bash
python manage.py sync_postgres_to_graph
```

This pushes existing clinical data into Neo4j and back-fills the ontology catalog (ICD-10, SNOMED CT, RxNorm).

### 3f — Start the backend

**Development (Django dev server):**

```bash
python manage.py runserver
```

**Production-grade (Daphne ASGI — required for WebSockets):**

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Backend will be available at `http://localhost:8000`.

---

## 4 — Frontend Setup

```bash
cd Virtual Hospital/frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:3000`.

---

## 5 — Running the Full Stack

Open **five** terminals (or use tmux/screen):

| Terminal | Command | Directory |
|---|---|---|
| 1 — Model server | `python3 -m mlx_vlm.server --model ".models/medgemma-1_5-4b-it-4bit" --port 8081` | `Virtual Hospital/` |
| 2 — Docker infra | `docker-compose up -d db redis minio neo4j` | `Virtual Hospital/backend/` |
| 3 — Backend | `source venv/bin/activate && python manage.py runserver` | `Virtual Hospital/backend/` |
| 4 — Frontend | `npm run dev` | `Virtual Hospital/frontend/` |
| 5 — (optional) Knowledge graph sync | `python manage.py sync_postgres_to_graph` | `Virtual Hospital/backend/` |

Open `http://localhost:3000` in your browser.

---

## Test Accounts

All seeded accounts use the password **`Seed@1234`**.

| Role | Email | Portal Path | Access |
|---|---|---|---|
| **Admin** | `admin@medhub.io` | `/admin` | Full system administration, user management |
| **Doctor** | `doctor@medhub.io` | `/doctor` | Patient charts, orders, prescriptions, CDSS |
| **Nurse** | `nurse@medhub.io` | `/nurse` | Vitals, tasks, MAR, handoff notes |
| **Lab Technician** | `labtech@medhub.io` | `/lab` | Specimen processing, result entry & verification |
| **Radiologist** | `radiologist@medhub.io` | `/radiology` | DICOM viewer, radiology reports |
| **Pharmacist** | `pharmacist@medhub.io` | `/pharmacy` | Rx verification, dispensing, formulary |
| **Billing Staff** | `billing@medhub.io` | `/billing` | Claims, invoices, revenue cycle |
| **Front Desk** | `frontdesk@medhub.io` | `/frontdesk` | Patient ADT, bed management, queues |

---

## Module Guide

### Admin (`/admin`)
- Manage staff accounts (create / edit / suspend)
- Assign roles and departments
- System-wide audit trail

### Doctor (`/doctor`)
- Patient charts and encounter notes
- Order composer (labs, radiology, prescriptions)
- AI-powered CDSS alerts (drug interactions, diagnosis suggestions, critical values)
- FHIR-compatible data export

### Nurse (`/nurse`)
- Bedside summary and acuity indicators
- Vital signs flowsheet
- Medication Administration Record (MAR) timeline
- Task checklist and shift handoff cards

### Lab (`/lab`)
- Specimen tracking and result entry
- Abnormal value highlighting
- Report verification and release
- Critical value notifications (real-time via WebSocket)

### Radiology (`/radiology`)
- DICOM image viewer (CornerstoneJS)
- Study status pipeline (ordered → in-progress → read → signed)
- Structured radiology report editor
- AI-assisted report generation

### Pharmacy (`/pharmacy`)
- Prescription verification workflow
- Dispensing panel
- Formulary search
- Patient medication profile

### Billing (`/billing`)
- Insurance claim management
- Invoice generation
- Revenue cycle management

### Front Desk (`/frontdesk`)
- Patient registration and ADT (Admit / Discharge / Transfer)
- Bed map
- Queue ticket management
- Duplicate patient detection

### CDSS — Clinical Decision Support
- Rule-based alerts (drug interactions, dosing, contraindications)
- GraphRAG — queries the Neo4j patient graph and sends context to MedGemma for AI-generated clinical insights
- Ontology backbone: ICD-10, SNOMED CT, RxNorm, LOINC

---

## Environment Variables Reference

File: `Virtual Hospital/backend/.env` (copy from `.env.example`)

```env
# Django Core
SECRET_KEY=<long-random-string>
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# PostgreSQL
DB_NAME=medhub
DB_USER=medhub
DB_PASSWORD=medhub_secret
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_ACCESS_TOKEN_LIFETIME_HOURS=8
JWT_REFRESH_TOKEN_LIFETIME_DAYS=30

# MinIO / S3
USE_S3=False
AWS_ACCESS_KEY_ID=medhub_access
AWS_SECRET_ACCESS_KEY=medhub_secret_key
AWS_STORAGE_BUCKET_NAME=medhub-media
AWS_S3_ENDPOINT_URL=http://localhost:9000

# CORS (allow the Next.js dev server)
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Neo4j Knowledge Graph
NEOMODEL_NEO4J_BOLT_URL=bolt://neo4j:medhub_secret@localhost:7687

# Local MedGemma LLM
LLM_API_URL=http://localhost:8081/v1/chat/completions
LLM_MODEL_NAME=medgemma
LLM_API_TIMEOUT_SECONDS=120
```

> **Remote LLM**: If your model server runs on a different machine (e.g., another laptop on the same network), set `LLM_API_URL=http://<that-machine-ip>:8081/v1/chat/completions`.

---

## API Quick Reference

All endpoints require a JWT `Authorization: Bearer <token>` header except `/api/v1/auth/login/`.

```bash
# Login
POST http://localhost:8000/api/v1/auth/login/
Content-Type: application/json
{ "email": "doctor@medhub.io", "password": "Seed@1234" }

# Response
{ "accessToken": "...", "refreshToken": "...", "user": { ... } }

# Refresh token
POST http://localhost:8000/api/v1/auth/refresh/
{ "refresh": "<refreshToken>" }
```

| Base Path | Module | Allowed Roles |
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
| `/api/v1/cdss/` | CDSS | Doctor, Nurse, Pharmacist |
| `/api/v1/fhir/` | FHIR Export | Doctor, Admin |

---

## WebSocket

Connect using your JWT access token:

```
ws://localhost:8000/ws?token=<accessToken>
```

On connect the server returns:

```json
{
  "event": "connection.established",
  "payload": { "userId": "...", "role": "doctor", "groups": ["role_doctor"] }
}
```

Real-time events include: critical lab value alerts, CDSS notifications, order status updates, and bed management changes.

---

## Running Tests

```bash
cd Virtual Hospital/backend
source venv/bin/activate
pytest --cov=apps tests/
```

Key test files:

| File | Coverage |
|---|---|
| `tests/test_auth.py` | JWT auth flows, role enforcement |
| `tests/test_cdss_triggers.py` | CDSS rule engine triggers |
| `tests/test_cdss_metrics.py` | CDSS response metrics |
| `tests/test_critical_values.py` | Critical value detection |
| `tests/test_evaluation_criteria.py` | Clinical evaluation criteria |

---

## Docker (Full Stack)

To run everything (backend + all services) in Docker:

```bash
cd Virtual Hospital/backend
docker-compose up --build
```

This starts: Django app (Daphne), PostgreSQL, Redis, MinIO, Neo4j.

> The MedGemma model server **cannot** run inside Docker (requires Apple Silicon bare-metal MLX). Run it separately on the host machine and ensure `LLM_API_URL` in the container environment points to `host.docker.internal:8081` (macOS) or the host IP.

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend Framework | Next.js 16 + React 19 |
| Frontend Language | TypeScript |
| UI Components | shadcn/ui + Tailwind CSS v4 |
| State Management | Zustand + TanStack Query |
| DICOM Viewer | CornerstoneJS 5 |
| Backend Framework | Django 5.0 + DRF 3.15 |
| ASGI Server | Daphne 4.1 |
| WebSockets | Django Channels 4.1 |
| Auth | JWT (simplejwt) |
| Primary Database | PostgreSQL 16 |
| Cache / Channels | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| Knowledge Graph | Neo4j 5.20 + neomodel |
| Clinical Ontology | ICD-10, SNOMED CT, RxNorm, LOINC |
| AI Model | MedGemma 1.5 4B (4-bit quantised) |
| Inference Runtime | mlx_vlm (Apple Silicon) |

---

*MedHub Virtual Hospital © 2026 — Graduation Project*

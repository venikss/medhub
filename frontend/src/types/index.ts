export enum UserRole {
  ADMIN = "admin",
  DOCTOR = "doctor",
  PATIENT = "patient",
  NURSE = "nurse",
  LAB_TECH = "lab_tech",
  RADIOLOGIST = "radiologist",
  PHARMACIST = "pharmacist",
  BILLING_STAFF = "billing_staff",
  FRONT_DESK = "front_desk",
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  department?: string;
}

export type AppointmentStatus = "scheduled" | "in-progress" | "completed" | "cancelled" | "no-show";
export type PatientStatus = "active" | "discharged" | "critical" | "stable" | "admitted";
export type OrderStatus = "pending" | "in-progress" | "completed" | "cancelled";
export type Priority = "low" | "normal" | "high" | "urgent" | "stat";

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  phone: string;
  email: string;
  address: string | Record<string, string>;
  bloodType?: string;
  allergies?: string[];
  status: PatientStatus;
  insuranceProvider?: string;
  insuranceId?: string;
  admissionDate?: string;
  assignedDoctor?: string;
  assignedDoctorName?: string;
  ward?: string;
  roomNumber?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  duration: number;
  status: AppointmentStatus;
  type: "consultation" | "follow-up" | "procedure" | "telemedicine";
  notes?: string;
}

export interface Vital {
  id: string;
  patientId: string;
  timestamp: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  temperature: number;
  oxygenSaturation: number;
  respiratoryRate: number;
  recordedBy: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  status: "active" | "discontinued" | "completed";
}

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  orderedBy: string;
  testName: string;
  priority: Priority;
  status: OrderStatus;
  orderedAt: string;
  completedAt?: string;
  results?: string;
}

export interface Department {
  id: string;
  name: string;
  head: string;
  staffCount: number;
  activePatients: number;
  description?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Insurance {
  id: string;
  provider: string;
  policyNumber: string;
  groupNumber?: string;
  validFrom: string;
  validTo: string;
  copay?: number;
  coverageType: "full" | "partial" | "none";
}

export interface ADTPatient extends Patient {
  emergencyContact?: EmergencyContact;
  nationality?: string;
  maritalStatus?: "single" | "married" | "divorced" | "widowed";
  preferredLanguage?: string;
  consentSigned: boolean;
  registeredAt: string;
  insurance?: Insurance;
  insuranceDetails?: Insurance | Record<string, unknown>;
}

export type BedStatus = "available" | "occupied" | "reserved" | "maintenance" | "cleaning";
export type BedType = "standard" | "icu" | "nicu" | "isolation" | "bariatric" | "pediatric" | "labor_delivery" | "general" | "semi-private" | "private";

export interface BedInfo {
  bedId: string;
  wardId?: string;
  ward: string;
  wardName?: string;
  roomNumber: string;
  bedNumber: string;
  type: BedType;
  status: BedStatus;
  patientId?: string;
  patientName?: string;
}

export type AdmissionType = "inpatient" | "outpatient" | "emergency" | "observation";
export type AdmissionStatus = "admitted" | "transferred" | "discharged" | "pending";

export interface Admission {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  type: AdmissionType;
  admittingDoctor: string;
  admittingDoctorId?: string;
  admittingDoctorName?: string;
  department: string;
  departmentId?: string;
  wardId?: string;
  bedId?: string;
  ward?: string;
  bed?: string;
  reasonForAdmission: string;
  admittedAt: string;
  status: AdmissionStatus;
  expectedDischarge?: string;
}

export type DischargeType = "home" | "transfer" | "ama" | "expired";

export interface Discharge {
  id: string;
  admissionId: string;
  patientId: string;
  patientName: string;
  dischargeType: DischargeType;
  summary: string;
  followUpDate?: string;
  dischargedBy: string;
  dischargedAt: string;
}

export interface Transfer {
  id: string;
  admissionId: string;
  patientId: string;
  patientName: string;
  fromWard: string;
  fromBed: string;
  toWard: string;
  toBed: string;
  reason: string;
  approvedBy: string;
  transferredAt: string;
}

export type ServiceType = "registration" | "insurance" | "lab" | "radiology" | "pharmacy" | "consultation" | "billing";
export type QueueStatus = "waiting" | "serving" | "called" | "completed" | "no-show";

export interface QueueEntry {
  id: string;
  ticketNo: string;
  patientId: string;
  patientName: string;
  service: ServiceType;
  priority: Priority;
  status: QueueStatus;
  waitingSince: string;
  window?: string;
  estimatedWait?: number;
}

export interface ConsentDocument {
  id: string;
  patientId: string;
  type: "general" | "surgery" | "anesthesia" | "hipaa" | "financial";
  signedAt?: string;
  signedBy?: string;
  fileUrl?: string;
  status: "pending" | "signed" | "declined";
}

export interface DuplicateCandidate {
  patientA: Pick<Patient, "id" | "mrn" | "firstName" | "lastName" | "dateOfBirth" | "phone">;
  patientB: Pick<Patient, "id" | "mrn" | "firstName" | "lastName" | "dateOfBirth" | "phone">;
  matchScore: number;
  matchReasons: string[];
}

export type DiagnosisType = "primary" | "secondary" | "admitting" | "differential";

export interface Diagnosis {
  id: string;
  patientId: string;
  code: string;
  description: string;
  type: DiagnosisType;
  diagnosedAt: string;
  diagnosedBy: string;
  status: "active" | "resolved" | "chronic" | "suspected";
}

export type EncounterStatus = "in-progress" | "completed" | "signed" | "amended";

export interface Encounter {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  status: EncounterStatus;
  authorId: string;
  authorName: string;
  signedAt?: string;
  visitType: "inpatient" | "outpatient" | "emergency" | "telemedicine";
}

export type ProcedureStatus = "scheduled" | "in-progress" | "completed" | "cancelled";

export interface Procedure {
  id: string;
  patientId: string;
  code: string;
  name: string;
  scheduledDate: string;
  performedDate?: string;
  status: ProcedureStatus;
  performer: string;
  notes?: string;
}

export type OrderCategory = "lab" | "imaging" | "consult" | "procedure";

export interface OrderItem {
  id: string;
  patientId: string;
  patientName: string;
  category: OrderCategory;
  name: string;
  orderedBy: string;
  orderedAt: string;
  priority: Priority;
  status: OrderStatus;
  notes?: string;
  results?: string;
  completedAt?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  medication: string;
  dosage: string;
  route: "oral" | "iv" | "im" | "topical" | "inhaled" | "sublingual";
  frequency: string;
  quantity: number;
  refills: number;
  sig: string;
  prescribedBy: string;
  prescribedAt: string;
  startDate: string;
  endDate?: string;
  status: "active" | "discontinued" | "completed" | "on-hold";
}

export type ReferralUrgency = "routine" | "urgent" | "stat";

export interface Referral {
  id: string;
  patientId: string;
  patientName: string;
  fromDoctor: string;
  toDoctor: string;
  toDepartment: string;
  reason: string;
  urgency: ReferralUrgency;
  status: "pending" | "accepted" | "completed" | "declined";
  createdAt: string;
}

export type ResultFlag = "normal" | "high" | "low" | "critical";

export interface ResultItem {
  id: string;
  patientId: string;
  patientName: string;
  orderId: string;
  category: "lab" | "imaging";
  testName: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
  flag: ResultFlag;
  reportedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface VitalEntry {
  id: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  temperature: number;
  spo2: number;
  respiratoryRate: number;
  news2Score?: number;
  painScore?: number;
  gcs?: number;
  recordedBy: string;
  notes?: string;
}

export type IOType = "oral" | "iv" | "blood" | "urine" | "drain" | "emesis" | "stool" | "ng";
export type IODirection = "intake" | "output";

export interface IntakeOutput {
  id: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  direction: IODirection;
  type: IOType;
  amount: number;
  recordedBy: string;
  notes?: string;
}

export interface PainEntry {
  id: string;
  patientId: string;
  timestamp: string;
  score: number;
  location: string;
  quality: "sharp" | "dull" | "burning" | "throbbing" | "aching" | "stabbing";
  intervention?: string;
  reassessScore?: number;
  reassessTime?: string;
  recordedBy: string;
}

export type WoundType = "surgical" | "pressure" | "laceration" | "burn" | "iv-site" | "drain" | "catheter";

export interface WoundNote {
  id: string;
  patientId: string;
  patientName: string;
  type: WoundType;
  location: string;
  stage?: string;
  size?: string;
  description: string;
  care: string;
  timestamp: string;
  recordedBy: string;
}

export type MARStatus = "scheduled" | "given" | "missed" | "held" | "refused" | "overdue";

export interface MAREntry {
  id: string;
  patientId: string;
  patientName: string;
  medication: string;
  dosage: string;
  route: string;
  scheduledTime: string;
  administeredTime?: string;
  administeredBy?: string;
  status: MARStatus;
  barcode?: string;
  notes?: string;
}

export type NursingTaskType = "vitals" | "medication" | "assessment" | "wound-care" | "io-check" | "ambulation" | "education" | "discharge" | "other";
export type NursingTaskStatus = "pending" | "in-progress" | "completed" | "overdue" | "cancelled";

export interface NursingTask {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  type: NursingTaskType;
  description: string;
  priority: Priority;
  dueTime: string;
  completedTime?: string;
  completedBy?: string;
  status: NursingTaskStatus;
  isOverdue: boolean;
}

export type NursingNoteCategory = "assessment" | "care" | "education" | "communication" | "safety" | "procedure";

export interface NursingNote {
  id: string;
  patientId: string;
  patientName: string;
  category: NursingNoteCategory;
  content: string;
  timestamp: string;
  authorName: string;
}

export interface HandoffEntry {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  fromNurse: string;
  toNurse: string | null;
  shiftDate: string;
  shiftType: "day" | "evening" | "night";
  acknowledged: boolean;
}

export interface DischargeChecklistItem {
  id: string;
  patientId: string;
  category: "medical" | "nursing" | "pharmacy" | "education" | "social" | "transport";
  description: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

export type SpecimenType = "blood" | "serum" | "plasma" | "urine" | "csf" | "stool" | "swab" | "tissue" | "other";
export type SpecimenStatus = "ordered" | "collected" | "in-transit" | "received" | "processing" | "analyzed" | "resulted" | "rejected";
export type SpecimenCondition = "acceptable" | "hemolyzed" | "lipemic" | "icteric" | "clotted" | "insufficient" | "wrong-tube";

export interface Specimen {
  id: string;
  barcode: string;
  patientId: string;
  patientName: string;
  type: SpecimenType;
  collectionTime?: string;
  collectedBy?: string;
  receivedAt?: string;
  status: SpecimenStatus;
  condition: SpecimenCondition;
  orderId: string;
  testNames: string[];
  notes?: string;
}

export type LabResultFlag = "normal" | "high" | "low" | "critical-high" | "critical-low";

export interface LabTestResult {
  id: string;
  specimenId: string;
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: LabResultFlag;
  previousValue?: string;
  delta?: string;
  method?: string;
  analyzedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  comment?: string;
  status: "pending" | "preliminary" | "final" | "corrected" | "cancelled";
}

export interface LabPanel {
  id: string;
  name: string;
  code: string;
  specimenId: string;
  patientId: string;
  patientName: string;
  orderedBy: string;
  orderedAt: string;
  priority?: Priority;
  results: LabTestResult[];
  status: "pending" | "partial" | "complete" | "verified" | "released";
  turnaroundMinutes?: number;
}

export interface AccessionRecord {
  id: string;
  accessionNumber: string;
  specimenId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  specimenType: SpecimenType;
  receivedBy: string;
  receivedAt: string;
  condition: SpecimenCondition;
  testNames: string[];
  status: "accessioned" | "rejected" | "recollect-requested";
  notes?: string;
}

export interface AnalyzerQueueItem {
  id: string;
  instrument: string;
  specimenBarcode: string;
  specimenId: string;
  patientName: string;
  testName: string;
  priority: Priority;
  queuePosition: number;
  estimatedMinutes?: number;
  status: "queued" | "loading" | "running" | "completed" | "error";
  startedAt?: string;
  completedAt?: string;
}

export interface RecollectionRequest {
  id: string;
  originalSpecimenId: string;
  patientId: string;
  patientName: string;
  reason: "hemolyzed" | "clotted" | "insufficient" | "wrong-tube" | "contaminated" | "expired" | "other";
  requestedBy: string;
  requestedAt: string;
  notes?: string;
  resolved: boolean;
  newSpecimenId?: string;
}

export type LabReportStatus = "draft" | "preliminary" | "final" | "amended" | "cancelled";

export interface LabReport {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  panelId: string;
  panelName: string;
  results: LabTestResult[];
  status: LabReportStatus;
  orderedBy: string;
  orderedAt: string;
  authorizedBy?: string;
  authorizedAt?: string;
  releasedAt?: string;
  hasCritical: boolean;
  criticalNotifiedTo?: string;
  criticalNotifiedAt?: string;
}

export type RxStatus = "ordered" | "pending-verification" | "verified" | "dispensing" | "dispensed" | "on-hold" | "cancelled" | "returned";
export type RxSetting = "inpatient" | "outpatient" | "discharge";
export type WarningSeverity = "info" | "moderate" | "severe" | "contraindicated";
export type WarningType = "interaction" | "allergy" | "duplication" | "dose-range" | "renal" | "pregnancy" | "pediatric";

export interface PharmacyPrescription {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  medication: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  quantity: number;
  refillsAllowed: number;
  refillsRemaining: number;
  setting: RxSetting;
  priority: Priority;
  status: RxStatus;
  prescribedBy: string;
  prescribedAt: string;
  encounterId?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  dispensedBy?: string;
  dispensedAt?: string;
  lotNumber?: string;
  warnings: DrugWarning[];
  allergies: string[];
  notes?: string;
}

export interface DrugWarning {
  id: string;
  type: WarningType;
  severity: WarningSeverity;
  title: string;
  description: string;
  interactingDrug?: string;
  overridable: boolean;
  overriddenBy?: string;
  overriddenAt?: string;
}

export type FormularyStatus = "formulary" | "non-formulary" | "restricted" | "investigational";

export interface FormularyItem {
  id: string;
  displayName?: string;
  genericName: string;
  canonicalName?: string;
  brandNames: string[];
  drugClass: string;
  form: string;
  strengths: string[];
  formularyStatus: FormularyStatus;
  stockLevel: number;
  reorderPoint: number;
  unitCost: number;
  requiresPriorAuth: boolean;
  controlledSchedule?: string;
  rxnormCode?: string;
  notes?: string;
}

export interface DispenseRecord {
  id: string;
  prescriptionId: string;
  patientName: string;
  medication: string;
  dosage: string;
  quantityDispensed: number;
  lotNumber: string;
  expirationDate: string;
  dispensedBy: string;
  dispensedAt: string;
  setting: RxSetting;
  verifiedBy: string;
  labelPrinted: boolean;
  barcodeScan: boolean;
}

export type InterventionType = "dose-adjustment" | "drug-change" | "frequency-change" | "discontinue" | "clarification" | "therapeutic-substitution" | "monitoring";
export type InterventionOutcome = "accepted" | "rejected" | "modified" | "pending";

export interface InterventionRecord {
  id: string;
  prescriptionId: string;
  patientName: string;
  medication: string;
  type: InterventionType;
  reason: string;
  recommendation: string;
  prescriberContact: string;
  outcome: InterventionOutcome;
  pharmacistName: string;
  createdAt: string;
  resolvedAt?: string;
  prescriberResponse?: string;
}

export interface RefillRecord {
  id: string;
  prescriptionId: string;
  patientName: string;
  medication: string;
  dosage: string;
  refillNumber: number;
  totalRefills: number;
  dispensedDate: string;
  quantity: number;
  pharmacist: string;
  daysSupply: number;
  nextRefillDate?: string;
}

export type SubstitutionStatus = "pending" | "approved" | "rejected";

export interface SubstitutionRequest {
  id: string;
  prescriptionId: string;
  patientName: string;
  originalMedication: string;
  substituteMedication: string;
  reason: "generic-available" | "formulary-preference" | "cost-savings" | "shortage" | "therapeutic-equivalent";
  status: SubstitutionStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  costSavings?: number;
}

export type ImagingModality = "XR" | "CT" | "MRI" | "US" | "NM" | "PET" | "DEXA" | "FLUORO" | "MAMMO";

export type ImagingStudyStatus =
  | "ordered"
  | "protocoled"
  | "scheduled"
  | "arrived"
  | "in-progress"
  | "acquired"
  | "reading"
  | "reported"
  | "signed"
  | "amended"
  | "cancelled";

export type RadReportStatus = "draft" | "preliminary" | "final" | "amended" | "addendum";
export type CriticalFindingSeverity = "critical" | "urgent";
export type CriticalFindingStatus = "pending" | "notified" | "acknowledged";

export interface ImagingOrder {
  id: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  requestedBy: string;
  requestedAt: string;
  department: string;
  clinicalHistory: string;
  modality: ImagingModality;
  examCode: string;
  examName: string;
  bodyRegion: string;
  laterality?: "left" | "right" | "bilateral";
  contrastRequired: boolean;
  priority: Priority;
  status: ImagingStudyStatus;
  protocoledBy?: string;
  protocoledAt?: string;
  scheduledAt?: string;
  scheduledRoom?: string;
  assignedTechnologist?: string;
  assignedRadiologist?: string;
  reportId?: string;
  notes?: string;
}

export interface ImagingStudy {
  id: string;
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  modality: ImagingModality;
  examName: string;
  examDate: string;
  examTime: string;
  status: ImagingStudyStatus;
  technologist?: string;
  radiologist?: string;
  room?: string;
  startedAt?: string;
  completedAt?: string;
  imagesCount?: number;
  seriesCount?: number;
  pacsUrl?: string;
  reportId?: string;
  priority: Priority;
  clinicalHistory: string;
  priorStudyIds?: string[];
  hasCritical?: boolean;
}

export interface RadiologyReport {
  id: string;
  studyId: string;
  orderId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  modality: ImagingModality;
  examName: string;
  examDate: string;
  indication: string;
  technique: string;
  comparison?: string;
  findings: string;
  impression: string;
  recommendations?: string;
  status: RadReportStatus;
  radiologist: string;
  createdAt: string;
  updatedAt?: string;
  signedAt?: string;
  hasCritical: boolean;
  criticalFindingId?: string;
  addendum?: string;
  addendumBy?: string;
  addendumAt?: string;
}

export interface CriticalFinding {
  id: string;
  studyId: string;
  reportId?: string;
  patientId: string;
  patientName: string;
  mrn: string;
  modality: ImagingModality;
  examName: string;
  finding: string;
  severity: CriticalFindingSeverity;
  identifiedBy: string;
  identifiedAt: string;
  notifiedTo?: string;
  notifiedAt?: string;
  callbackNumber?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  status: CriticalFindingStatus;
  notes?: string;
}

export interface ModalitySlot {
  id: string;
  modality: ImagingModality;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: "available" | "scheduled" | "in-progress" | "completed" | "blocked" | "cancelled";
  patientId?: string;
  patientName?: string;
  examName?: string;
  orderId?: string;
  technologist?: string;
}

export interface PriorStudy {
  id: string;
  patientId: string;
  modality: ImagingModality;
  examName: string;
  examDate: string;
  reportStatus: RadReportStatus;
  radiologist: string;
  impression?: string;
  pacsUrl?: string;
}

export interface DicomFile {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  instanceNumber?: number;
}

export interface DicomSeries {
  id: string;
  studyId: string;
  seriesNumber: number;
  seriesUid?: string;
  description?: string;
  modality?: string;
  bodyPart?: string;
  sliceCount: number;
  uploadedAt: string;
  uploadedByName?: string;
  files: DicomFile[];
}

export interface RadiologyStats {
  pendingOrders: number;
  protocoled: number;
  scheduled: number;
  inProgress: number;
  awaitingRead: number;
  pendingSign: number;
  signedToday: number;
  pendingCritical: number;
  statOrders: number;
}

export type BillingInvoiceStatus =
  | "draft"
  | "sent"
  | "billed_insurance"
  | "partial"
  | "unpaid"
  | "overdue"
  | "cleared"
  | "void";

export type ClaimStatus =
  | "draft"
  | "submitted"
  | "acknowledged"
  | "pending"
  | "partially_paid"
  | "paid"
  | "denied"
  | "appealed"
  | "void";

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "check"
  | "eft"
  | "insurance_eft"
  | "wire";

export type DenialReasonCode =
  | "CO-4"
  | "CO-11"
  | "CO-15"
  | "CO-18"
  | "CO-22"
  | "CO-29"
  | "CO-45"
  | "CO-50"
  | "CO-97"
  | "PR-1"
  | "PR-2"
  | "PR-3";

export type DenialStatus = "pending_appeal" | "appealed" | "upheld" | "overturned" | "resubmitted" | "written_off";

export type FinancialEventType =
  | "admission"
  | "discharge"
  | "charge_posted"
  | "insurance_verified"
  | "claim_submitted"
  | "eob_received"
  | "payment_posted"
  | "denial_received"
  | "appeal_submitted"
  | "invoice_sent"
  | "patient_payment"
  | "adjustment"
  | "refund"
  | "collection";

export interface InsurancePlan {
  payerId: string;
  payerName: string;
  planName: string;
  memberId: string;
  groupNumber?: string;
  copay?: number;
  deductible?: number;
  deductibleMet?: number;
  outOfPocketMax?: number;
  outOfPocketMet?: number;
  requiresAuth: boolean;
  phone?: string;
}

export interface ChargeItem {
  id: string;
  cptCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalCharge: number;
  diagnosisCodes: string[];
  serviceDate: string;
  department: string;
  provider: string;
  modifier?: string;
  allowedAmount?: number;
  adjustmentAmount?: number;
  patientResponsibility?: number;
}

export interface Invoice {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  dateOfBirth: string;
  admissionDate?: string;
  dischargeDate?: string;
  encounterType: "inpatient" | "outpatient" | "emergency" | "observation";
  primaryDiagnosis: string;
  primaryDiagnosisCode: string;
  attendingPhysician: string;
  department: string;
  insurancePlan?: InsurancePlan;
  chargeItems: ChargeItem[];
  totalCharges: number;
  insuranceBilled: number;
  insurancePaid: number;
  adjustments: number;
  patientBalance: number;
  status: BillingInvoiceStatus;
  claimIds: string[];
  createdAt: string;
  sentAt?: string;
  dueDate?: string;
  notes?: string;
}

export interface InsuranceClaim {
  id: string;
  invoiceId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  payerId: string;
  payerName: string;
  memberId: string;
  groupNumber?: string;
  claimType: "professional" | "institutional" | "dental";
  totalBilled: number;
  allowedAmount?: number;
  paidAmount?: number;
  patientResponsibility?: number;
  adjustmentAmount?: number;
  status: ClaimStatus;
  submittedAt?: string;
  acknowledgedAt?: string;
  processedAt?: string;
  eobReceivedAt?: string;
  denialIds?: string[];
  paymentIds?: string[];
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  claimId?: string;
  patientId: string;
  patientName: string;
  amount: number;
  method: PaymentMethod;
  payer: string;
  referenceNumber?: string;
  checkNumber?: string;
  eobDate?: string;
  postedAt: string;
  postedBy: string;
  notes?: string;
  isVoid?: boolean;
}

export interface Denial {
  id: string;
  claimId: string;
  invoiceId: string;
  patientId: string;
  patientName: string;
  payerName: string;
  reasonCode: DenialReasonCode;
  reasonDescription: string;
  deniedAmount: number;
  serviceDate: string;
  receivedAt: string;
  status: DenialStatus;
  appealDeadline?: string;
  appealSubmittedAt?: string;
  resolutionNotes?: string;
  assignedTo?: string;
}

export interface FinancialEvent {
  id: string;
  patientId: string;
  type: FinancialEventType;
  title: string;
  description: string;
  amount?: number;
  referenceId?: string;
  performedBy?: string;
  postedBy?: string;
  timestamp: string;
}

export interface PatientAccount {
  patientId: string;
  patientName: string;
  mrn: string;
  dateOfBirth: string;
  insurance?: InsurancePlan;
  secondaryInsurance?: InsurancePlan;
  totalBilled: number;
  insurancePaid: number;
  adjustments: number;
  patientPaid: number;
  patientBalance: number;
  overdueBalance: number;
  creditBalance: number;
  invoiceIds: string[];
  lastActivityAt: string;
}

export interface BillingStats {
  totalBilledToday: number;
  collectedToday: number;
  pendingInsurance: number;
  patientBalanceDue: number;
  pendingClaims: number;
  deniedClaims: number;
  overdue30Days: number;
  collectionRate: number;
}

export type AdminUserStatus = "active" | "inactive" | "suspended" | "pending";
export type AdminUserRole =
  | "admin" | "doctor" | "nurse" | "lab_tech" | "radiologist"
  | "pharmacist" | "billing_staff" | "front_desk" | "patient";

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: AdminUserRole;
  departmentId?: string;
  departmentName?: string;
  status: AdminUserStatus;
  lastLogin?: string;
  createdAt: string;
  avatarInitials: string;
  employeeId?: string;
  specialization?: string;
  licenseNumber?: string;
  activePatientCount?: number;
}

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";
export type PermissionResource =
  | "patients" | "encounters" | "orders" | "prescriptions" | "lab_results"
  | "radiology_reports" | "invoices" | "claims" | "payments" | "users"
  | "departments" | "beds" | "catalogs" | "audit_logs" | "settings"
  | "nursing" | "pharmacy" | "cdss" | "admissions" | "appointments";

export interface RolePermission {
  role: AdminUserRole;
  resource: PermissionResource;
  actions: PermissionAction[];
}

export type DepartmentStatus = "active" | "inactive";
export type DepartmentType =
  | "clinical" | "diagnostic" | "surgical" | "administrative"
  | "support" | "emergency" | "pharmacy";

export interface AdminDepartment {
  id: string;
  name: string;
  code: string;
  type: DepartmentType;
  status: DepartmentStatus;
  headId?: string;
  headName?: string;
  floorNumber?: number;
  building?: string;
  phone?: string;
  staffCount: number;
  activePatients: number;
  bedCount: number;
  description?: string;
  parentDepartmentId?: string;
}

export type WardType = "general" | "icu" | "nicu" | "picu" | "surgical" | "observation" | "isolation";

export interface Ward {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  departmentName: string;
  type: WardType;
  floorNumber: number;
  building: string;
  totalBeds: number;
  occupiedBeds: number;
  status: "active" | "inactive" | "under_maintenance";
  headNurseId?: string;
  headNurseName?: string;
}

export interface Bed {
  id: string;
  number: string;
  wardId: string;
  wardName: string;
  departmentId: string;
  departmentName: string;
  type: BedType;
  status: BedStatus;
  roomNumber?: string;
  floorNumber: number;
  patientId?: string;
  patientName?: string;
  admittedAt?: string;
  features?: string[];
}

export type CatalogItemStatus = "active" | "inactive" | "discontinued";

export interface LabCatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  specimen: string;
  turnaroundHours: number;
  normalRange?: string;
  unit?: string;
  price: number;
  requiresAuth: boolean;
  status: CatalogItemStatus;
  cptCode?: string;
}

export interface RadiologyCatalogItem {
  id: string;
  code: string;
  name: string;
  modality: string;
  bodyPart: string;
  withContrast: boolean;
  durationMinutes: number;
  price: number;
  requiresAuth: boolean;
  status: CatalogItemStatus;
  cptCode?: string;
  preparation?: string;
}

export interface ServiceCatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  department: string;
  price: number;
  unit: string;
  status: CatalogItemStatus;
  cptCode?: string;
  description?: string;
}

export type AuditAction =
  | "login" | "logout" | "create" | "read" | "update" | "delete"
  | "approve" | "reject" | "export" | "print" | "bulk_action"
  | "permission_change" | "password_reset" | "status_change";

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: AdminUserRole;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: string;
  ipAddress: string;
  severity: AuditSeverity;
  outcome: "success" | "failure";
  sessionId?: string;
}

export interface SystemSetting {
  key: string;
  label: string;
  description: string;
  category: "general" | "security" | "notifications" | "integrations" | "appearance";
  type: "text" | "number" | "boolean" | "select" | "textarea";
  value: string | number | boolean;
  options?: string[];
  requiresRestart?: boolean;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalDepartments: number;
  totalBeds: number;
  occupiedBeds: number;
  totalLabTests: number;
  totalRadiologyStudies: number;
  auditLogsToday: number;
  systemUptime: number;
}

/** Which clinical department originated this recommendation */
export type CDSSSourceModule =
  | "doctor"
  | "nursing"
  | "lab"
  | "pharmacy"
  | "radiology"
  | "emergency"
  | "surgery"
  | "system";

export type CDSSAlertSeverity = "critical" | "warning" | "info";

export type CDSSRecommendationType =
  | "drug_interaction" | "allergy" | "dosage_warning" | "duplicate_therapy" | "contraindication"
  | "guideline" | "order_set" | "appropriateness_check"
  | "diagnostic" | "abnormal_result" | "panic_value" | "delta_check" | "critical_result"
  | "preventive" | "care_gap" | "follow_up_reminder"
  | "deterioration_alert" | "overdue_task" | "risk_score"
  | "urgent_finding"
  | "triage_support" | "sepsis_alert" | "trauma_alert"
  | "perioperative_warning" | "checklist_gap"
  | "care_plan_deviation";

export type CDSSAlertStatus = "active" | "acknowledged" | "overridden" | "dismissed" | "expired" | "followed";
export type CDSSConfidenceLevel = "high" | "moderate" | "low";
export type CDSSEvidenceSourceType = "guideline" | "drug_database" | "literature" | "ai_model" | "ehr_pattern";
export type CDSSOverrideAction = "override" | "acknowledge" | "dismiss" | "follow";
export type CDSSOverrideReasonCategory =
  | "clinical_judgment" | "patient_preference" | "contraindication_present"
  | "already_ordered" | "not_applicable" | "other";

export interface CDSSEvidenceSource {
  id: string;
  title: string;
  shortName: string;
  sourceType: CDSSEvidenceSourceType;
  url?: string;
  publishedYear?: number;
  evidenceGrade?: string;
  excerpt?: string;
}

export interface CDSSClinicalInput {
  label: string;
  value: string;
  flag?: "high" | "low" | "critical" | "normal";
}

export interface CDSSExplanation {
  summary: string;
  reasoning: string[];
  clinicalInputs: CDSSClinicalInput[];
  limitations: string[];
  confidence: CDSSConfidenceLevel;
  confidenceScore: number;
  modelVersion?: string;
}

export interface CDSSRecommendation {
  id: string;
  patientId: string;
  patientName: string;
  patientMRN: string;
  encounterId?: string;
  outputKind?: "alert" | "recommendation";
  /** Which clinical module generated this recommendation */
  sourceModule?: CDSSSourceModule;
  /** Which user roles should be shown this recommendation */
  targetRoles?: UserRole[];
  type: CDSSRecommendationType;
  severity: CDSSAlertSeverity;
  status: CDSSAlertStatus;
  title: string;
  summary: string;
  explanation: CDSSExplanation;
  evidenceSources: CDSSEvidenceSource[];
  generatedAt: string;
  expiresAt?: string;
  triggeredBy: string;
  affectedMedications?: string[];
  suggestedActions: string[];
  overrideReason?: string;
  overrideReasonCategory?: CDSSOverrideReasonCategory;
  overriddenBy?: string;
  overriddenAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  feedbackRating?: 1 | 2 | 3 | 4 | 5;
  feedbackComment?: string;
}

export interface CDSSOverrideRecord {
  id: string;
  recommendationId: string;
  recommendationTitle: string;
  patientId: string;
  patientName: string;
  clinicianId: string;
  clinicianName: string;
  clinicianRole: string;
  action: CDSSOverrideAction;
  reasonCategory: CDSSOverrideReasonCategory;
  reason: string;
  timestamp: string;
  notes?: string;
  /** Which module context this response was submitted from */
  sourceModule?: CDSSSourceModule;
}

export interface CDSSStats {
  totalActive: number;
  critical: number;
  warnings: number;
  info: number;
  overriddenToday: number;
  followedToday: number;
  acknowledgedToday: number;
  accuracyRate: number;
}

export interface CDSSHospitalGraphSummary {
  patients?: number;
  diagnoses?: number;
  medications?: number;
  allergies?: number;
  labs?: number;
  radiology?: number;
}

export interface CDSSHospitalModuleCard {
  module: CDSSSourceModule;
  label: string;
  active: number;
  critical: number;
  warning: number;
  info: number;
}

export interface CDSSHospitalSignal {
  label: string;
  group: string;
  occurrences: number;
  rank: number;
}

export interface CDSSHospitalHotspotPatient {
  patientId: string;
  patientName: string;
  patientMRN: string;
  active: number;
  critical: number;
}

export interface CDSSHospitalSummary {
  graphSummary: CDSSHospitalGraphSummary;
  recommendationSummary: {
    active: number;
    critical: number;
    warning: number;
    info: number;
  };
  moduleCards: CDSSHospitalModuleCard[];
  topRecommendationTypes: Array<{
    type: string;
    total: number;
  }>;
  topGraphSignals: CDSSHospitalSignal[];
  hotspotPatients: CDSSHospitalHotspotPatient[];
}

export interface CDSSPatientModuleGraphSummary {
  patientId: string;
  module: string;
  title: string;
  summary: string;
  counts: {
    diagnoses: number;
    medications: number;
    allergies: number;
    labs: number;
    radiology: number;
  };
  sections: Array<{
    label: string;
    items: string[];
  }>;
}

/** Contextual metadata passed from a clinical module to the CDSS layer */
export interface CDSSModuleContext {
  module: CDSSSourceModule;
  patientId?: string;
  encounterId?: string;
  focusedMedications?: string[];
}

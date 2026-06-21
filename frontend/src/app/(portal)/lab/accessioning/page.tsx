"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScanLine, Printer, CheckCircle2, AlertCircle, FlaskConical, X } from "lucide-react";
import { SpecimenBadge } from "@/features/lab/components/SpecimenBadge";
import { createAccession, listAccessions, listSpecimens } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { AccessionRecord, Specimen } from "@/types";
import { cn } from "@/lib/utils";

export default function AccessioningPage() {
  const token = useAuthStore((state) => state.token);
  const [accessions, setAccessions] = useState<AccessionRecord[]>([]);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [pendingSpecimen, setPendingSpecimen] = useState<Specimen | null>(null);

  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string; variant?: "success" | "error" }>({ open: false, title: "", message: "" });

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listAccessions(token ?? undefined),
      listSpecimens({}, token ?? undefined),
    ])
      .then(([accessionData, specimenData]) => {
        if (!cancelled) {
          setAccessions(accessionData);
          setSpecimens(specimenData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccessions([]);
          setSpecimens([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const matchedSpecimen = specimens.find((specimen) => {
    const needle = scanValue.trim().toLowerCase();
    if (!needle) return false;
    return (
      specimen.id.toLowerCase() === needle ||
      specimen.barcode.toLowerCase() === needle ||
      specimen.patientName.toLowerCase().includes(needle)
    );
  });

  const testCatalog: { category: string; tests: string[] }[] = [
    { category: "Hematology", tests: ["Complete Blood Count", "ESR", "Reticulocyte Count", "D-Dimer"] },
    { category: "Chemistry", tests: ["BMP \u2013 Renal Profile", "Liver Function Tests", "Lipid Panel", "HbA1c", "Fasting Blood Glucose", "Urine Microalbumin"] },
    { category: "Cardiac", tests: ["Cardiac Enzymes", "Troponin I", "BNP", "PT / INR"] },
    { category: "Microbiology", tests: ["Blood Culture", "Urine Culture", "Throat Swab Culture"] },
    { category: "Blood Gas", tests: ["ABG"] },
  ];

  function toggleTest(test: string) {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test],
    );
  }

  function handleAccessionClick() {
    if (!token || isSubmitting) return;
    const specimen = matchedSpecimen;
    if (!specimen) {
      setAlertDialog({ open: true, title: "No Specimen Selected", message: "Enter a valid specimen ID or barcode first.", variant: "error" });
      return;
    }
    setPendingSpecimen(specimen);
    setSelectedTests(specimen.testNames?.length ? [...specimen.testNames] : []);
    setTestDialogOpen(true);
  }

  async function handleConfirmAccession() {
    if (!token || !pendingSpecimen || isSubmitting) return;
    if (selectedTests.length === 0) return;

    try {
      setIsSubmitting(true);
      setTestDialogOpen(false);
      const created = await createAccession(
        {
          specimen: pendingSpecimen.id,
          condition: pendingSpecimen.condition ?? "acceptable",
          test_names: selectedTests,
        },
        token,
      );
      setAccessions((current) => [created, ...current]);
      setScanValue(created.specimenId);
      setAlertDialog({ open: true, title: "Accession Created", message: `Accession ${created.accessionNumber} created for ${created.patientName}.`, variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't accession this specimen.";
      setAlertDialog({ open: true, title: "Accession Failed", message, variant: "error" });
    } finally {
      setIsSubmitting(false);
      setPendingSpecimen(null);
    }
  }

  function handlePrintLabel() {
    const accession =
      accessions.find((item) => item.specimenId === matchedSpecimen?.id) ??
      (matchedSpecimen ? accessions[0] : null);

    if (!matchedSpecimen && !accession) {
      setAlertDialog({ open: true, title: "No Specimen", message: "Scan or enter a specimen first so we know which label to print.", variant: "error" });
      return;
    }

    const labelLines = [
      "MedHub Lab Label",
      accession ? `Accession: ${accession.accessionNumber}` : "Accession: Pending",
      `Specimen: ${matchedSpecimen?.barcode ?? accession?.specimenId ?? scanValue}`,
      `Patient: ${matchedSpecimen?.patientName ?? accession?.patientName ?? "Unknown patient"}`,
      `MRN: ${accession?.mrn ?? "-"}`,
      `Type: ${matchedSpecimen?.type ?? accession?.specimenType ?? "-"}`,
      `Printed: ${new Date().toLocaleString()}`,
    ];

    const popup = window.open("", "_blank", "width=420,height=320");
    if (!popup) {
      setAlertDialog({ open: true, title: "Popup Blocked", message: "Please allow popups to print labels.", variant: "error" });
      return;
    }

    popup.document.write(`
      <html>
        <head><title>Lab Label</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <div style="border: 2px solid #111; padding: 16px; width: 280px;">
            ${labelLines.map((line) => `<div style="margin-bottom: 8px;">${line}</div>`).join("")}
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accessioning</h1>
        <p className="text-sm text-muted-foreground mt-1">Receive specimens, verify identity, and print barcode labels</p>
      </div>

      <Card className="border-primary/30 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" /> Scan / Enter Specimen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Scan barcode or type specimen ID..."
                className="pl-10 h-10 font-mono"
                autoFocus
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
              />
            </div>
            <Button className="gap-2" onClick={handleAccessionClick} disabled={isSubmitting}>
              <CheckCircle2 className="h-4 w-4" /> {isSubmitting ? "Accessioning..." : "Accession"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handlePrintLabel}>
              <Printer className="h-4 w-4" /> Print Label
            </Button>
          </div>
          {matchedSpecimen ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Ready: {matchedSpecimen.patientName} · {matchedSpecimen.type}
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Match by specimen ID, barcode, or patient name to accession and print a label.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Today&apos;s Accession Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Accession #</th>
                  <th className="text-left py-2 px-3 font-medium">Specimen</th>
                  <th className="text-left py-2 px-3 font-medium">Patient</th>
                  <th className="text-left py-2 px-3 font-medium">MRN</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-left py-2 px-3 font-medium">Tests</th>
                  <th className="text-left py-2 px-3 font-medium">Condition</th>
                  <th className="text-left py-2 px-3 font-medium">Received</th>
                  <th className="text-center py-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {accessions.map((accession) => (
                  <tr key={accession.id} className={cn("border-b border-border/30 hover:bg-muted/40 transition-colors", accession.condition !== "acceptable" && "bg-orange-500/[0.04]")}>
                    <td className="py-2 px-3 font-mono text-xs font-medium">{accession.accessionNumber}</td>
                    <td className="py-2 px-3"><SpecimenBadge barcode={`LAB-${accession.specimenId.slice(-6)}`} status="received" specimenType={accession.specimenType} /></td>
                    <td className="py-2 px-3 font-medium text-xs">{accession.patientName}</td>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{accession.mrn}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-[10px] capitalize">{accession.specimenType}</Badge></td>
                    <td className="py-2 px-3 text-xs">{(accession.testNames ?? []).join(", ")}</td>
                    <td className="py-2 px-3">
                      <Badge variant={accession.condition === "acceptable" ? "outline" : "destructive"} className="text-[10px] capitalize">
                        {accession.condition === "acceptable" ? "OK" : accession.condition}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{new Date(accession.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-2 px-3 text-center"><Badge variant="outline" className="text-[10px] capitalize">{accession.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Test Selection Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={(open) => { if (!open) { setTestDialogOpen(false); setPendingSpecimen(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Select Tests for Accession
            </DialogTitle>
            <DialogDescription>
              {pendingSpecimen && (
                <span>
                  Specimen <span className="font-mono font-medium text-foreground">{pendingSpecimen.barcode}</span> for <span className="font-medium text-foreground">{pendingSpecimen.patientName}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Selected tests */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Selected Tests ({selectedTests.length})</Label>
            {selectedTests.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border bg-muted/30 min-h-[40px]">
                {selectedTests.map((test) => (
                  <Badge key={test} className="text-xs gap-1 pr-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer" onClick={() => toggleTest(test)}>
                    {test}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center p-3 rounded-lg border border-dashed text-xs text-muted-foreground">
                Click tests below to select them
              </div>
            )}
          </div>

          {/* Test catalog */}
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {testCatalog.map((group) => (
              <div key={group.category}>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.category}</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {group.tests.map((test) => {
                    const isSelected = selectedTests.includes(test);
                    return (
                      <button
                        key={test}
                        type="button"
                        onClick={() => toggleTest(test)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {test}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setTestDialogOpen(false); setPendingSpecimen(null); }}>
              Cancel
            </Button>
            <Button onClick={() => void handleConfirmAccession()} disabled={selectedTests.length === 0 || isSubmitting}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {isSubmitting ? "Creating..." : `Accession ${selectedTests.length} Test${selectedTests.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert/Feedback Dialog */}
      <Dialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {alertDialog.variant === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              {alertDialog.title}
            </DialogTitle>
            <DialogDescription>{alertDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setAlertDialog((prev) => ({ ...prev, open: false }))}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { AlertTriangle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PatientDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Patient Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This portal is temporarily disabled until a dedicated patient-to-user backend endpoint is available.
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-50/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
            <Shield className="h-4 w-4" />
            Access Guard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-amber-950">
          <p>
            The previous version of this screen loaded the full patient list in the browser and matched records by
            email. That is not safe for protected health information.
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-white/70 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
            <p>
              The frontend route remains in place, but patient-specific data stays blocked until the backend exposes a
              secure self-service endpoint tied directly to the authenticated patient user.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

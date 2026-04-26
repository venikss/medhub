"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { useNotificationStore } from "../stores/notification-store";

function getBackendOrigin() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_WS_ORIGIN?.replace(/\/+$/, "") ||
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.replace(/\/+$/, "") ||
    "http://127.0.0.1:8001"
  );
}

function getWsUrl(token: string) {
  const backendOrigin = getBackendOrigin();
  const url = new URL(backendOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.searchParams.set("token", token);
  return url.toString();
}

function getStoredToken() {
  try {
    const raw = window.localStorage.getItem("medhub-auth");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } } | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

export function useNotifications() {
  const { token, isAuthenticated } = useAuthStore();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    const handleAuthRefresh = () => {
      setAuthRevision((value) => value + 1);
    };

    window.addEventListener("storage", handleAuthRefresh);
    window.addEventListener("medhub-auth-refreshed", handleAuthRefresh as EventListener);

    return () => {
      window.removeEventListener("storage", handleAuthRefresh);
      window.removeEventListener("medhub-auth-refreshed", handleAuthRefresh as EventListener);
    };
  }, []);

  useEffect(() => {
    const liveToken = getStoredToken() ?? token;

    if (!isAuthenticated || !liveToken) {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    const socket = new WebSocket(getWsUrl(liveToken));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          event?: string;
          payload?: Record<string, unknown>;
        };
        const eventName = data.event;
        const payload = data.payload ?? {};

        switch (eventName) {
          case "lab.result_released":
            addNotification({
              title: "New Lab Result",
              message: String(payload.message ?? "A lab result is ready."),
              type: "success",
              link: "/doctor/results",
            });
            break;
          case "lab.critical_result":
            addNotification({
              title: "Critical Lab Result",
              message: String(payload.message ?? "A critical lab result needs review."),
              type: "error",
              link: "/doctor/results",
            });
            break;
          case "adt.admission":
          case "adt.discharge":
            addNotification({
              title: eventName === "adt.admission" ? "Patient Admitted" : "Patient Discharged",
              message: String(payload.message ?? "Patient status updated."),
              type: "info",
              link: payload.patientId ? `/doctor/patients/${payload.patientId}` : undefined,
            });
            break;
          case "radiology.report_signed":
          case "radiology.critical_finding":
            addNotification({
              title: eventName === "radiology.critical_finding" ? "Critical Imaging Finding" : "Radiology Report Signed",
              message: String(payload.message ?? "Radiology update received."),
              type: eventName === "radiology.critical_finding" ? "error" : "success",
              link: payload.patientId ? `/doctor/patients/${payload.patientId}` : undefined,
            });
            break;
          case "pharmacy.rx_verified":
          case "pharmacy.rx_dispensed":
            addNotification({
              title: eventName === "pharmacy.rx_verified" ? "Prescription Verified" : "Medication Dispensed",
              message: String(payload.message ?? "Pharmacy workflow updated."),
              type: "info",
              link: payload.patientId ? `/doctor/patients/${payload.patientId}` : undefined,
            });
            break;
          case "pharmacy.new_prescription":
            addNotification({
              title: payload.isNew ? "New Prescription Received" : "Prescription Updated",
              message: String(payload.message ?? "A prescription needs review."),
              type: payload.priority === "stat" ? "error" : "info",
              link: "/pharmacy/verification",
            });
            break;
          case "pharmacy.rx_rejected":
            addNotification({
              title: "Prescription Rejected by Pharmacy",
              message: String(payload.message ?? "Your prescription was rejected."),
              type: "error",
              link: payload.patientId ? `/doctor/patients/${payload.patientId}` : "/doctor/prescriptions",
            });
            break;
          case "pharmacy.rx_on_hold":
            addNotification({
              title: "Prescription On Hold",
              message: String(payload.message ?? "Your prescription was put on hold."),
              type: "warning",
              link: payload.patientId ? `/doctor/patients/${payload.patientId}` : "/doctor/prescriptions",
            });
            break;
          case "pharmacy.intervention_created":
            addNotification({
              title: "Pharmacist Intervention",
              message: String(payload.message ?? "Pharmacist raised a concern about your prescription."),
              type: "warning",
              link: "/pharmacy/interventions",
            });
            break;
          case "pharmacy.substitution_proposed":
            addNotification({
              title: "Substitution Proposed",
              message: String(payload.message ?? "Pharmacist suggested a medication substitution."),
              type: "info",
              link: "/pharmacy/substitutions",
            });
            break;
          case "pharmacy.rx_cancelled":
            addNotification({
              title: "Prescription Cancelled by Pharmacy",
              message: String(payload.message ?? "Your prescription was cancelled by pharmacy."),
              type: "error",
              link: payload.patientId ? `/doctor/patients/${payload.patientId}` : "/doctor/prescriptions",
            });
            break;
          case "pharmacy.prescription_discontinued":
            addNotification({
              title: "Prescription Discontinued",
              message: String(payload.message ?? "A prescription has been discontinued by the doctor."),
              type: "warning",
              link: "/pharmacy/verification",
            });
            break;
          case "pharmacy.substitution_approved":
            addNotification({
              title: "Substitution Approved",
              message: String(payload.message ?? "Your medication substitution was approved."),
              type: "success",
              link: payload.patientId ? `/doctor/patients/${payload.patientId}` : "/doctor/prescriptions",
            });
            break;
          case "pharmacy.substitution_rejected":
            addNotification({
              title: "Substitution Rejected",
              message: String(payload.message ?? "Your medication substitution was rejected."),
              type: "error",
              link: payload.patientId ? `/doctor/patients/${payload.patientId}` : "/doctor/prescriptions",
            });
            break;
          case "cdss.new_recommendation":
          case "cdss.recommendation_updated":
            addNotification({
              title: eventName === "cdss.new_recommendation" ? "Clinical Alert" : "Clinical Alert Updated",
              message: String(payload.message ?? "Clinical recommendation available."),
              type: payload.severity === "critical" ? "error" : "warning",
              metadata: {
                recommendationId: String(payload.id ?? payload.recommendationId ?? ""),
              },
            });
            break;
          default:
            break;
        }
      } catch (error) {
        console.error("[WS] Message error:", error);
      }
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (!isAuthenticated) {
        return;
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        setReconnectNonce((value) => value + 1);
      }, 3000);
    };

    socket.onerror = () => {
      // Connection errors are handled via onclose + reconnect logic.
    };

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socket.close();
      socketRef.current = null;
    };
  }, [isAuthenticated, token, addNotification, reconnectNonce, authRevision]);

  return null;
}

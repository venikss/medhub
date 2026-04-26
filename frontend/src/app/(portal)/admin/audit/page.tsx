"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ShieldAlert, Info, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditLogs } from "@/features/admin/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { AuditAction, AuditLogEntry, AuditSeverity } from "@/types";

const SEVERITY_COLORS: Record<AuditSeverity, string> = {
  info: "bg-sky-500/10 text-sky-700 border-sky-300/40",
  warning: "bg-amber-500/10 text-amber-700 border-amber-300/40",
  critical: "bg-red-500/10 text-red-700 border-red-300/40",
};

const SEVERITY_ICONS: Record<AuditSeverity, React.ReactNode> = {
  info: <Info className="h-3 w-3" />,
  warning: <AlertTriangle className="h-3 w-3" />,
  critical: <ShieldAlert className="h-3 w-3" />,
};

const OUTCOME_COLORS = {
  success: "text-emerald-600",
  failure: "text-red-600",
};

function toDisplayText(value: unknown, fallback = "-") {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  if (value == null) {
    return fallback;
  }

  return String(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function resolveUserName(name: string | null | undefined): string {
  if (!name || UUID_RE.test(name.trim())) return "Unknown User";
  return name;
}

export default function AuditPage() {
  const token = useAuthStore((state) => state.token);
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "all">("all");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [userSearch, setUserSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listAuditLogs(
      {
        severity: severityFilter === "all" ? undefined : severityFilter,
        action: actionFilter === "all" ? undefined : actionFilter,
      },
      token ?? undefined,
    )
      .then((data) => {
        if (!cancelled) {
          setLogs(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLogs([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actionFilter, severityFilter, token]);

  const uniqueActions = useMemo(
    () => [...new Set(logs.map((log) => String(log.action ?? "")).filter(Boolean))],
    [logs],
  );

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      const matchUser =
        userSearch === "" || log.userName.toLowerCase().includes(userSearch.toLowerCase());
      const logDate = log.timestamp.slice(0, 10);
      const matchDate = (!dateFrom || logDate >= dateFrom) && (!dateTo || logDate <= dateTo);
      return matchUser && matchDate;
    });
  }, [dateFrom, dateTo, logs, userSearch]);

  function exportCsv() {
    const rows = [
      ["Timestamp", "User", "Role", "Action", "Resource", "Details", "IP Address", "Severity", "Outcome"].join(","),
      ...filtered.map((log) =>
        [
          log.timestamp,
          log.userName,
          toDisplayText(log.userRole),
          toDisplayText(log.action),
          log.resource,
          toDisplayText(log.details),
          log.ipAddress ?? "",
          log.severity,
          log.outcome,
        ]
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-log.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filtered.length} events · Security and activity log
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-3">
        {(["info", "warning", "critical"] as AuditSeverity[]).map((severity) => {
          const count = logs.filter((log) => log.severity === severity).length;
          return (
            <button
              key={severity}
              onClick={() => setSeverityFilter(severityFilter === severity ? "all" : severity)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${SEVERITY_COLORS[severity]} ${severityFilter === severity ? "ring-2 ring-current ring-offset-1" : ""}`}
            >
              {SEVERITY_ICONS[severity]}
              <span className="capitalize">{severity}</span>
              <span className="ml-1 font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          className="h-9 w-44 text-sm"
          placeholder="Search user..."
          value={userSearch}
          onChange={(event) => setUserSearch(event.target.value)}
        />
        <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as AuditAction | "all")}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((action) => (
              <SelectItem key={action} value={action} className="capitalize">
                {action.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">From</span>
          <Input
            type="date"
            className="h-9 w-36 text-sm"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">To</span>
          <Input
            type="date"
            className="h-9 w-36 text-sm"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs font-semibold">Timestamp</TableHead>
              <TableHead className="text-xs font-semibold">User / Role</TableHead>
              <TableHead className="text-xs font-semibold">Action</TableHead>
              <TableHead className="text-xs font-semibold">Resource</TableHead>
              <TableHead className="text-xs font-semibold">Details</TableHead>
              <TableHead className="text-xs font-semibold">IP Address</TableHead>
              <TableHead className="text-xs font-semibold">Severity</TableHead>
              <TableHead className="text-xs font-semibold">Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No audit events match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow
                  key={log.id}
                  className={
                    log.severity === "critical"
                      ? "bg-red-500/5 hover:bg-red-500/10"
                      : "hover:bg-muted/30"
                  }
                >
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {log.timestamp.replace("T", " ").slice(0, 19)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{resolveUserName(log.userName)}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {String(log.userRole ?? "unknown").replace("_", " ")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {String(log.action ?? "unknown").replace("_", " ")}
                  </Badge>
                </TableCell>
                  <TableCell className="text-xs font-medium">{log.resource}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground" title={toDisplayText(log.details)}>
                    {toDisplayText(log.details)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.ipAddress || "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${SEVERITY_COLORS[log.severity]}`}
                    >
                      {SEVERITY_ICONS[log.severity]}
                      <span className="capitalize">{log.severity}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-semibold ${OUTCOME_COLORS[log.outcome]}`}>
                      {log.outcome === "success" ? "✓" : "✗"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

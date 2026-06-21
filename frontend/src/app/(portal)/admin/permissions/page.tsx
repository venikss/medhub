"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listPermissions, updatePermissions } from "@/features/admin/api";
import { RoleBadge } from "@/features/admin/components/RoleBadge";
import type { AdminUserRole, PermissionAction, PermissionResource, RolePermission } from "@/types";

const ALL_ROLES: AdminUserRole[] = [
  "admin", "doctor", "nurse", "lab_tech", "radiologist",
  "pharmacist", "billing_staff", "front_desk", "patient",
];

const ALL_RESOURCES: PermissionResource[] = [
  "patients", "admissions", "appointments", "encounters", "orders", "prescriptions",
  "nursing", "lab_results", "radiology_reports", "pharmacy",
  "invoices", "claims", "payments",
  "cdss", "users", "departments", "beds", "catalogs", "audit_logs", "settings",
];

const ALL_ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "approve", "export"];

const ACTION_COLORS: Record<PermissionAction, string> = {
  view: "bg-sky-500/15 text-sky-700",
  create: "bg-emerald-500/15 text-emerald-700",
  edit: "bg-amber-500/15 text-amber-700",
  delete: "bg-red-500/15 text-red-700",
  approve: "bg-violet-500/15 text-violet-700",
  export: "bg-indigo-500/15 text-indigo-700",
};

/** Backend-enforced defaults — derived from DRF permission_classes on each view. */
const BACKEND_DEFAULTS: Record<PermissionResource, Partial<Record<AdminUserRole, PermissionAction[]>>> = {
  patients: {
    admin:         ["view", "create", "edit", "delete", "export"],
    doctor:        ["view"],
    nurse:         ["view"],
    lab_tech:      ["view"],
    radiologist:   ["view"],
    pharmacist:    ["view"],
    billing_staff: ["view"],
    front_desk:    ["view", "create", "edit", "delete"],
  },
  admissions: {
    admin:     ["view", "create", "edit"],
    doctor:    ["view", "create", "edit"],
    nurse:     ["view", "edit"],
    front_desk:["view", "create", "edit"],
  },
  appointments: {
    admin:     ["view", "create", "edit", "delete"],
    doctor:    ["view", "edit"],
    nurse:     ["view"],
    front_desk:["view", "create", "edit", "delete"],
  },
  encounters: {
    admin:  ["view"],
    doctor: ["view", "create", "edit"],
  },
  orders: {
    doctor: ["view", "create", "edit", "delete"],
  },
  prescriptions: {
    doctor: ["view", "create", "edit"],
  },
  nursing: {
    nurse:  ["view", "create", "edit", "delete"],
    doctor: ["view"],
  },
  lab_results: {
    lab_tech: ["view", "create", "edit", "approve"],
    doctor:   ["view"],
  },
  radiology_reports: {
    radiologist: ["view", "create", "edit", "approve"],
    doctor:      ["view", "create"],
  },
  pharmacy: {
    pharmacist: ["view", "create", "edit", "approve"],
    doctor:     ["view"],
    admin:      ["view"],
  },
  invoices: {
    billing_staff: ["view", "create", "edit"],
    admin:         ["view", "create", "edit", "delete", "approve"],
  },
  claims: {
    billing_staff: ["view", "create", "edit"],
    admin:         ["view", "create", "edit"],
  },
  payments: {
    billing_staff: ["view", "create"],
    admin:         ["view", "create", "edit"],
    front_desk:    ["view", "create"],
  },
  cdss: {
    admin:       ["view", "create", "edit"],
    doctor:      ["view", "create", "edit"],
    nurse:       ["view", "create", "edit"],
    lab_tech:    ["view", "create", "edit"],
    radiologist: ["view", "create", "edit"],
    pharmacist:  ["view", "create", "edit"],
  },
  users: {
    admin:     ["view", "create", "edit", "delete"],
    front_desk:["view", "create"],
  },
  departments: {
    admin:     ["view", "create", "edit"],
    front_desk:["view", "create"],
  },
  beds: {
    admin: ["view", "create", "edit", "delete"],
    nurse: ["view", "edit"],
  },
  catalogs: {
    admin: ["view", "create", "edit"],
  },
  audit_logs: {
    admin: ["view", "export"],
  },
  settings: {
    admin: ["view", "edit"],
  },
};

type PermMatrix = Record<AdminUserRole, Record<PermissionResource, Set<PermissionAction>>>;

function buildMatrix(permissions: RolePermission[]): PermMatrix {
  const matrix = {} as PermMatrix;

  for (const role of ALL_ROLES) {
    matrix[role] = {} as Record<PermissionResource, Set<PermissionAction>>;
    for (const resource of ALL_RESOURCES) {
      matrix[role][resource] = new Set();
    }
  }

  for (const permission of permissions) {
    if (matrix[permission.role] && matrix[permission.role][permission.resource]) {
      permission.actions.forEach((action) => matrix[permission.role][permission.resource].add(action));
    }
  }

  return matrix;
}

function buildDefaultMatrix(): PermMatrix {
  const matrix = {} as PermMatrix;
  for (const role of ALL_ROLES) {
    matrix[role] = {} as Record<PermissionResource, Set<PermissionAction>>;
    for (const resource of ALL_RESOURCES) {
      const defaults = BACKEND_DEFAULTS[resource]?.[role] ?? [];
      matrix[role][resource] = new Set(defaults);
    }
  }
  return matrix;
}

function flattenMatrix(matrix: PermMatrix) {
  return ALL_ROLES.flatMap((role) =>
    ALL_RESOURCES.flatMap((resource) =>
      ALL_ACTIONS.map((action) => ({
        role,
        resource,
        action,
        allowed: matrix[role][resource].has(action),
      })),
    ),
  );
}

export default function PermissionsPage() {
  const token = useAuthStore((state) => state.token);
  const [matrix, setMatrix] = useState<PermMatrix>(buildMatrix([]));
  const [selectedRole, setSelectedRole] = useState<AdminUserRole | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void listPermissions(token ?? undefined)
      .then((permissions) => {
        if (!cancelled) {
          if (permissions.length > 0) {
            setMatrix(buildMatrix(permissions));
          } else {
            setMatrix(buildDefaultMatrix());
            setDirty(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatrix(buildDefaultMatrix());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function toggle(role: AdminUserRole, resource: PermissionResource, action: PermissionAction) {
    setMatrix((prev) => {
      const next = { ...prev, [role]: { ...prev[role], [resource]: new Set(prev[role][resource]) } };
      if (next[role][resource].has(action)) {
        next[role][resource].delete(action);
      } else {
        next[role][resource].add(action);
      }
      return next;
    });
    setDirty(true);
    setMessage("");
    setError("");
  }

  async function handleSave() {
    try {
      await updatePermissions(flattenMatrix(matrix), token ?? undefined);
      setDirty(false);
      setMessage("Permissions saved.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save permission changes.");
      setMessage("");
    }
  }

  function handleResetDefaults() {
    setMatrix(buildDefaultMatrix());
    setDirty(true);
    setMessage("Reset to backend defaults. Click Save to apply.");
    setError("");
  }

  const displayRoles = useMemo(() => (selectedRole ? [selectedRole] : ALL_ROLES), [selectedRole]);
  const selectedCount = useMemo(
    () =>
      displayRoles.reduce(
        (count, role) =>
          count +
          ALL_RESOURCES.reduce((resourceCount, resource) => resourceCount + matrix[role][resource].size, 0),
        0,
      ),
    [displayRoles, matrix],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Permission Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure role-based access control for all resources
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleResetDefaults}>
            Reset to Defaults
          </Button>
          <Button size="sm" className="gap-1.5" disabled={!dirty} onClick={() => void handleSave()}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-300/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          {String(message)}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-300/50 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {typeof error === "string" ? error : JSON.stringify(error)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ALL_ACTIONS.map((action) => (
          <Badge key={action} variant="outline" className={`text-xs capitalize ${ACTION_COLORS[action]}`}>
            {action}
          </Badge>
        ))}
        <Badge variant="secondary" className="text-xs">{selectedCount} granted</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedRole(null)}
          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${selectedRole === null ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:bg-muted/50"}`}
        >
          All Roles
        </button>
        {ALL_ROLES.map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role === selectedRole ? null : role)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors capitalize ${selectedRole === role ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:bg-muted/50"}`}
          >
            {role.replace("_", " ")}
          </button>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/50">
                  <th className="sticky left-0 z-10 bg-muted/60 text-left py-3 px-4 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[140px]">
                    Resource
                  </th>
                  {displayRoles.map((role) => (
                    <th key={role} className="py-3 px-2 text-center min-w-[130px]">
                      <RoleBadge role={role} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_RESOURCES.map((resource) => (
                  <tr key={resource} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="sticky left-0 bg-background border-r border-border/30 py-3 px-4 font-medium capitalize" style={{ fontVariant: "small-caps" }}>
                      {resource.replace("_", " ")}
                    </td>
                    {displayRoles.map((role) => (
                      <td key={role} className="py-2.5 px-2">
                        <div className="flex flex-wrap justify-center gap-1">
                          {ALL_ACTIONS.map((action) => {
                            const hasPermission = matrix[role][resource].has(action);
                            return (
                              <button
                                key={action}
                                title={`${role} - ${resource} - ${action}`}
                                onClick={() => toggle(role, resource, action)}
                                className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${
                                  hasPermission
                                    ? `${ACTION_COLORS[action]} border-transparent`
                                    : "border-border/40 text-muted-foreground/30 hover:border-border"
                                }`}
                              >
                                {hasPermission ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3 opacity-30" />}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-center mt-1 text-muted-foreground/50 text-[10px]">
                          {ALL_ACTIONS.map((action) => action[0].toUpperCase()).join("")}
                        </p>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

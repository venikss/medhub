"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Network,
  Pill,
  ScanLine,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type GraphNode = {
  id: string;
  label: string;
  group: string;
};

type GraphLink = {
  source: string;
  target: string;
  label: string;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

type NodeKind =
  | "patient"
  | "condition"
  | "medication"
  | "allergy"
  | "lab"
  | "radiology"
  | "ontology"
  | "other";

type FilterKey = Exclude<NodeKind, "other">;

type DisplayNode = GraphNode & {
  kind: NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  isPrimaryPatient: boolean;
};

type PerspectiveKey = "clinical" | "pharmacy" | "lab" | "radiology" | "nursing";

const FILTERS: Array<{
  key: FilterKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  chip: string;
}> = [
  { key: "patient", label: "Patient", icon: Network, color: "#3b82f6", chip: "bg-blue-500/12 text-blue-200 border-blue-400/20" },
  { key: "condition", label: "Diagnoses", icon: Stethoscope, color: "#ef4444", chip: "bg-rose-500/12 text-rose-200 border-rose-400/20" },
  { key: "medication", label: "Medications", icon: Pill, color: "#10b981", chip: "bg-emerald-500/12 text-emerald-200 border-emerald-400/20" },
  { key: "allergy", label: "Allergies", icon: ShieldAlert, color: "#f59e0b", chip: "bg-amber-500/12 text-amber-200 border-amber-400/20" },
  { key: "lab", label: "Labs", icon: FlaskConical, color: "#a855f7", chip: "bg-fuchsia-500/12 text-fuchsia-200 border-fuchsia-400/20" },
  { key: "radiology", label: "Radiology", icon: ScanLine, color: "#06b6d4", chip: "bg-cyan-500/12 text-cyan-200 border-cyan-400/20" },
  { key: "ontology", label: "Ontology", icon: ClipboardList, color: "#94a3b8", chip: "bg-slate-500/12 text-slate-200 border-slate-400/20" },
];

const CANVAS = {
  width: 1600,
  height: 1040,
  centerX: 780,
  centerY: 520,
};

const SECTION_LABELS = [
  { key: "condition" as const, text: "Diagnoses", x: CANVAS.centerX, y: 96 },
  { key: "medication" as const, text: "Medications", x: 1340, y: 244 },
  { key: "allergy" as const, text: "Allergies", x: 220, y: 244 },
  { key: "lab" as const, text: "Labs", x: CANVAS.centerX, y: 950 },
  { key: "radiology" as const, text: "Radiology", x: 220, y: 794 },
  { key: "ontology" as const, text: "Ontology Links", x: 1340, y: 794 },
];

const PERSPECTIVES: Array<{
  key: PerspectiveKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  filters: Record<FilterKey, boolean>;
}> = [
  {
    key: "clinical",
    label: "Doctor",
    icon: Stethoscope,
    description: "Problem list, medications, labs, and imaging in one clinical picture.",
    filters: { patient: true, condition: true, medication: true, allergy: true, lab: true, radiology: true, ontology: false },
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    icon: Pill,
    description: "Medication safety with allergies and renal or electrolyte context nearby.",
    filters: { patient: true, condition: false, medication: true, allergy: true, lab: true, radiology: false, ontology: true },
  },
  {
    key: "lab",
    label: "Lab",
    icon: FlaskConical,
    description: "Results first, with the linked disease context around them.",
    filters: { patient: true, condition: true, medication: false, allergy: false, lab: true, radiology: false, ontology: true },
  },
  {
    key: "radiology",
    label: "Radiology",
    icon: ScanLine,
    description: "Imaging findings and follow-up context with the patient problem list beside them.",
    filters: { patient: true, condition: true, medication: false, allergy: false, lab: false, radiology: true, ontology: true },
  },
  {
    key: "nursing",
    label: "Nursing",
    icon: HeartPulse,
    description: "Bedside-relevant problems, medications, and recent lab context for escalation.",
    filters: { patient: true, condition: true, medication: true, allergy: true, lab: true, radiology: false, ontology: false },
  },
];

function inferNodeKind(group: string): NodeKind {
  if (group === "PatientNode") return "patient";
  if (group === "DiseaseNode" || group === "SymptomNode") return "condition";
  if (group === "MedicationNode") return "medication";
  if (group === "AllergyNode") return "allergy";
  if (group === "LabResultNode") return "lab";
  if (group === "RadiologyReportNode") return "radiology";
  if (group.includes("ConceptNode")) return "ontology";
  return "other";
}

function getNodeColor(kind: NodeKind) {
  return FILTERS.find((item) => item.key === kind)?.color ?? "#64748b";
}

function truncate(text: string, max = 30) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function dedupeLinks(links: GraphLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const source = String(link.source);
    const target = String(link.target);
    const key = `${source}|${target}|${link.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function layoutRow(nodes: DisplayNode[], centerX: number, y: number, gap: number) {
  const totalWidth = nodes.reduce((sum, node) => sum + node.width, 0) + Math.max(0, nodes.length - 1) * gap;
  let cursor = centerX - totalWidth / 2;
  nodes.forEach((node) => {
    node.x = cursor + node.width / 2;
    node.y = y;
    cursor += node.width + gap;
  });
}

function layoutColumn(nodes: DisplayNode[], x: number, centerY: number, gap: number) {
  const totalHeight = nodes.reduce((sum, node) => sum + node.height, 0) + Math.max(0, nodes.length - 1) * gap;
  let cursor = centerY - totalHeight / 2;
  nodes.forEach((node) => {
    node.x = x;
    node.y = cursor + node.height / 2;
    cursor += node.height + gap;
  });
}

export default function KnowledgeGraphExplorer({ patientId }: { patientId: string }) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [perspective, setPerspective] = useState<PerspectiveKey>("clinical");
  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, boolean>>({
    patient: true,
    condition: true,
    medication: true,
    allergy: true,
    lab: true,
    radiology: true,
    ontology: false,
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const preset = PERSPECTIVES.find((item) => item.key === perspective);
    if (preset) {
      setActiveFilters(preset.filters);
    }
  }, [perspective]);

  useEffect(() => {
    async function fetchGraph() {
      try {
        setLoading(true);
        setGraphError(null);
        const data = await apiFetch<GraphData>(`/cdss/patients/${patientId}/graph/`);
        setGraphData({
          nodes: Array.isArray(data?.nodes) ? data.nodes : [],
          links: Array.isArray(data?.links) ? dedupeLinks(data.links) : [],
        });
      } catch (err) {
        setGraphError(err instanceof Error ? err.message : "Failed to fetch graph data.");
      } finally {
        setLoading(false);
      }
    }

    void fetchGraph();
  }, [patientId]);

  const graphModel = useMemo(() => {
    const adjacency = new Map<string, string[]>();
    const links = graphData.links.map((link) => {
      const source = String(link.source);
      const target = String(link.target);
      adjacency.set(source, [...(adjacency.get(source) ?? []), target]);
      adjacency.set(target, [...(adjacency.get(target) ?? []), source]);
      return { ...link, source, target };
    });

    const displayNodes: DisplayNode[] = graphData.nodes.map((node) => {
      const kind = inferNodeKind(node.group);
      const isPrimaryPatient = kind === "patient";
      return {
        ...node,
        kind,
        x: CANVAS.centerX,
        y: CANVAS.centerY,
        width: isPrimaryPatient ? 260 : kind === "ontology" ? 196 : 220,
        height: isPrimaryPatient ? 104 : 70,
        isPrimaryPatient,
      };
    });

    const primaryPatient = displayNodes.find((node) => node.isPrimaryPatient) ?? null;
    const primaryNeighbors = new Set<string>(adjacency.get(primaryPatient?.id ?? "") ?? []);

    const visibleNodes = displayNodes.filter((node) => {
      if (node.isPrimaryPatient) return true;
      if (node.kind === "ontology") return primaryNeighbors.has(node.id);
      return primaryNeighbors.has(node.id);
    });

    const byKind = new Map<NodeKind, DisplayNode[]>();
    visibleNodes.forEach((node) => {
      byKind.set(node.kind, [...(byKind.get(node.kind) ?? []), node]);
    });

    const conditionNodes = (byKind.get("condition") ?? []).sort((a, b) => a.label.localeCompare(b.label));
    const medicationNodes = (byKind.get("medication") ?? []).sort((a, b) => a.label.localeCompare(b.label));
    const allergyNodes = (byKind.get("allergy") ?? []).sort((a, b) => a.label.localeCompare(b.label));
    const labNodes = (byKind.get("lab") ?? []).sort((a, b) => a.label.localeCompare(b.label));
    const radiologyNodes = (byKind.get("radiology") ?? []).sort((a, b) => a.label.localeCompare(b.label));
    const ontologyNodes = (byKind.get("ontology") ?? []).sort((a, b) => a.label.localeCompare(b.label));

    if (primaryPatient) {
      primaryPatient.x = CANVAS.centerX;
      primaryPatient.y = CANVAS.centerY;
    }

    layoutRow(conditionNodes, CANVAS.centerX, 200, 22);
    layoutColumn(medicationNodes, 1320, CANVAS.centerY - 110, 18);
    layoutColumn(allergyNodes, 240, CANVAS.centerY - 110, 18);
    layoutRow(labNodes, CANVAS.centerX, 842, 22);
    layoutColumn(radiologyNodes, 240, CANVAS.centerY + 220, 18);
    layoutColumn(ontologyNodes, 1320, CANVAS.centerY + 220, 18);

    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    const visibleLinks = links.filter(
      (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target),
    );

    const counts = FILTERS.reduce<Record<string, number>>((acc, item) => {
      acc[item.key] = visibleNodes.filter((node) => node.kind === item.key).length;
      return acc;
    }, {});

    return {
      nodes: visibleNodes,
      links: visibleLinks,
      counts,
    };
  }, [graphData]);

  const filteredNodes = useMemo(
    () =>
      graphModel.nodes.filter((node) =>
        node.kind === "other" ? false : activeFilters[node.kind as FilterKey],
      ),
    [activeFilters, graphModel.nodes],
  );

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);

  const filteredLinks = useMemo(
    () =>
      graphModel.links.filter(
        (link) => filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target),
      ),
    [filteredNodeIds, graphModel.links],
  );

  useEffect(() => {
    if (!selectedNodeId && filteredNodes[0]) {
      setSelectedNodeId(filteredNodes[0].id);
      return;
    }
    if (selectedNodeId && !filteredNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(filteredNodes[0]?.id ?? null);
    }
  }, [filteredNodeIds, filteredNodes, selectedNodeId]);

  const selectedNode = filteredNodes.find((node) => node.id === selectedNodeId) ?? null;
  const activePerspective = PERSPECTIVES.find((item) => item.key === perspective) ?? PERSPECTIVES[0];

  const selectedRelationships = useMemo(() => {
    if (!selectedNode) return [];
    return filteredLinks
      .filter((link) => link.source === selectedNode.id || link.target === selectedNode.id)
      .map((link) => {
        const otherId = link.source === selectedNode.id ? link.target : link.source;
        const otherNode = filteredNodes.find((node) => node.id === otherId);
        return {
          label: link.label.replaceAll("_", " "),
          otherNode,
        };
      })
      .filter((item) => item.otherNode);
  }, [filteredLinks, filteredNodes, selectedNode]);

  const patientSummary = useMemo(() => {
    const primaryPatient = filteredNodes.find((node) => node.isPrimaryPatient) ?? filteredNodes[0];
    return {
      label: primaryPatient?.label ?? "Selected Patient",
      conditions: graphModel.counts.condition ?? 0,
      meds: graphModel.counts.medication ?? 0,
      allergies: graphModel.counts.allergy ?? 0,
      labs: graphModel.counts.lab ?? 0,
      radiology: graphModel.counts.radiology ?? 0,
    };
  }, [filteredNodes, graphModel.counts]);

  return (
    <div className="grid h-[95vh] w-full grid-cols-1 gap-3 rounded-3xl border border-slate-800/70 bg-slate-950 p-3 text-slate-100 shadow-2xl lg:grid-cols-[1.95fr_0.5fr]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(180deg,_#111827,_#0b1220)]">
        <div className="border-b border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-blue-300">
                <Network className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300/80">
                  Patient Knowledge Graph
                </span>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-white">
                {patientSummary.label}
              </h2>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Diagnoses", value: patientSummary.conditions },
                { label: "Meds", value: patientSummary.meds },
                { label: "Allergies", value: patientSummary.allergies },
                { label: "Labs", value: patientSummary.labs },
                { label: "Imaging", value: patientSummary.radiology },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-center"
                >
                  <p className="text-base font-semibold text-white">{item.value}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="mr-1 flex flex-wrap gap-2">
              {PERSPECTIVES.map((item) => {
                const Icon = item.icon;
                const selected = perspective === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPerspective(item.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      selected
                        ? "border-blue-400/50 bg-blue-500/12 text-blue-100"
                        : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {FILTERS.map((filter) => {
              const enabled = activeFilters[filter.key];
              const Icon = filter.icon;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() =>
                    setActiveFilters((prev) => ({ ...prev, [filter.key]: !prev[filter.key] }))
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    enabled
                      ? `${filter.chip} shadow-sm`
                      : "border-slate-700 bg-slate-900/50 text-slate-500 hover:border-slate-600 hover:text-slate-300",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {filter.label}
                  <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
                    {graphModel.counts[filter.key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {activePerspective.description}
          </p>
        </div>

        <div className="relative min-h-0 flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : graphError ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-100">
                <p className="font-semibold text-rose-200">Unable to load graph data</p>
                <p className="mt-2 text-rose-100/90">{graphError}</p>
              </div>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
              All graph layers are hidden. Re-enable at least one filter to view the patient map.
            </div>
          ) : (
            <div className="h-full w-full overflow-auto p-2">
              <svg
                viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
                className="h-full min-h-[920px] w-full"
                role="img"
                aria-label="Patient clinical knowledge graph"
              >
                <defs>
                  <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(15,23,42,0.45)" />
                  </filter>
                </defs>

                <circle cx={CANVAS.centerX} cy={CANVAS.centerY} r="152" fill="rgba(30,41,59,0.18)" stroke="rgba(59,130,246,0.14)" />
                <circle cx={CANVAS.centerX} cy={CANVAS.centerY} r="364" fill="none" stroke="rgba(148,163,184,0.08)" strokeDasharray="6 8" />

                {SECTION_LABELS.filter((item) => activeFilters[item.key]).map((item) => (
                  <text
                    key={item.key}
                    x={item.x}
                    y={item.y}
                    fill="rgba(148,163,184,0.76)"
                    fontSize="13"
                    fontWeight="700"
                    textAnchor="middle"
                    letterSpacing="0.12em"
                  >
                    {item.text.toUpperCase()}
                  </text>
                ))}

                {filteredLinks.map((link, index) => {
                  const sourceNode = filteredNodes.find((node) => node.id === link.source);
                  const targetNode = filteredNodes.find((node) => node.id === link.target);
                  if (!sourceNode || !targetNode) return null;

                  const isPatientEdge = sourceNode.isPrimaryPatient || targetNode.isPrimaryPatient;
                  return (
                    <line
                      key={`${link.source}-${link.target}-${index}`}
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke={isPatientEdge ? "rgba(96,165,250,0.34)" : "rgba(148,163,184,0.18)"}
                      strokeWidth={isPatientEdge ? 2.2 : 1.2}
                    />
                  );
                })}

                {filteredNodes.map((node) => {
                  const color = getNodeColor(node.kind);
                  const isSelected = node.id === selectedNodeId;
                  const x = node.x - node.width / 2;
                  const y = node.y - node.height / 2;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x}, ${y})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                    >
                      <rect
                        width={node.width}
                        height={node.height}
                        rx="20"
                        fill={node.isPrimaryPatient ? "rgba(30,64,175,0.94)" : "rgba(15,23,42,0.94)"}
                        stroke={isSelected ? color : "rgba(148,163,184,0.24)"}
                        strokeWidth={isSelected ? 2.8 : node.isPrimaryPatient ? 2 : 1.4}
                        filter="url(#nodeShadow)"
                      />
                      <circle cx="18" cy="18" r="6" fill={color} />
                      <text x="34" y="22" fill="#e2e8f0" fontSize="11" fontWeight="700">
                        {node.group.replace("Node", "").replace("Concept", " Concept")}
                      </text>
                      <text
                        x="18"
                        y={node.isPrimaryPatient ? 58 : 45}
                        fill="#ffffff"
                        fontSize={node.isPrimaryPatient ? "18" : "14"}
                        fontWeight={node.isPrimaryPatient ? "700" : "600"}
                      >
                        {truncate(node.label, node.isPrimaryPatient ? 28 : node.kind === "ontology" ? 24 : 30)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/90">
        <div className="border-b border-slate-800/80 px-3 py-3">
          <div className="flex items-center gap-2 text-slate-200">
            <ClipboardList className="h-4 w-4 text-blue-300" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Node Details
            </h3>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {selectedNode ? (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: getNodeColor(selectedNode.kind) }}
                  />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {selectedNode.group}
                  </p>
                </div>
                <h4 className="mt-2 text-base font-semibold text-white">{selectedNode.label}</h4>
                <p className="mt-2 text-sm text-slate-400">
                  {selectedNode.isPrimaryPatient
                    ? "This is the patient anchor node. The surrounding nodes are the connected clinical facts used by CDSS."
                    : "This node is a patient-connected clinical fact from the knowledge graph."}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Current View
                </p>
                <div className="mt-2 rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-2.5">
                  <p className="text-sm font-semibold text-white">{activePerspective.label} perspective</p>
                  <p className="mt-1 text-sm text-slate-400">{activePerspective.description}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Connected Relationships
                </p>
                <div className="mt-2 space-y-2">
                  {selectedRelationships.length === 0 ? (
                    <p className="text-sm text-slate-500">No visible relationships for this node in the current filters.</p>
                  ) : (
                    selectedRelationships.map((item, index) => (
                      <div
                        key={`${item.label}-${item.otherNode?.id}-${index}`}
                        className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-2"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm text-slate-200">{item.otherNode?.label}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-500">
              Select a node to inspect its details and connected facts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

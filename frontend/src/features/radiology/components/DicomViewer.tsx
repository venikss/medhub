"use client";

/**
 * DicomViewer — Cornerstone3D v5 DICOM viewer.
 *
 * 2D Stack mode  — single or multi-file, scroll slices, window presets.
 * 3D MPR mode    — 4-up: Axial / Sagittal / Coronal / 3D MIP (≥4 slices).
 *
 * Props:
 *  dicomUrl   — auth-gated proxy URL (fetch + blob)
 *  blobFiles  — client-side File[] from upload (no fetch needed)
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const AUTH_KEY = "medhub-auth";

function readToken(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.state?.token) return p.state.token;
    if (p?.token)        return p.token;
    return null;
  } catch { return null; }
}

const PRESETS = [
  { label: "Soft Tissue", wc:   50, ww:  400 },
  { label: "Lung",        wc: -600, ww: 1500 },
  { label: "Bone",        wc:  300, ww: 1500 },
  { label: "Brain",       wc:   40, ww:   80 },
  { label: "Abdomen",     wc:   60, ww:  400 },
] as const;

export interface DicomViewerProps {
  dicomUrl?:        string;
  blobFiles?:       File[];
  /** Pre-signed or auth-gated MinIO URLs for all slices in a stored series */
  seriesFileUrls?:  string[];
  modality?:        string;
  className?:       string;
}

function Toolbar({
  active, onPreset, onReset, extra,
}: {
  active: string;
  onPreset: (label: string, wc: number, ww: number) => void;
  onReset: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900 flex-wrap">
      <span className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mr-1">WINDOW</span>
      {PRESETS.map(({ label, wc, ww }) => (
        <button key={label} type="button" onClick={() => onPreset(label, wc, ww)}
          className={cn("px-2 py-0.5 text-[10px] rounded font-mono transition-colors",
            active === label ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600")}>
          {label}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-2">
        {extra}
        <button type="button" onClick={onReset}
          className="px-2 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 font-mono">
          Reset
        </button>
      </div>
    </div>
  );
}

function StackViewer({ imageIds, onError }: { imageIds: string[]; onError(m: string): void }) {
  const elRef  = useRef<HTMLDivElement>(null);
  const vpRef  = useRef<any>(null);
  const engRef = useRef<any>(null);
  const [ready,  setReady]  = useState(false);
  const [preset, setPreset] = useState("Soft Tissue");
  const [slice,  setSlice]  = useState(0);

  useEffect(() => {
    if (!elRef.current || !imageIds.length) return;
    let dead = false;
    const ENG = `stack-${Date.now()}`;

    (async () => {
      try {
        const cs   = await import("@cornerstonejs/core");
        const lMod: any = await import("@cornerstonejs/dicom-image-loader");
        (lMod?.default?.init ?? lMod?.init)?.({ maxWebWorkers: 1 });
        await cs.init({ rendering: { useGenericViewport: true } });
        if (dead || !elRef.current) return;

        const engine = new cs.RenderingEngine(ENG);
        engRef.current = engine;
        engine.setViewports([{ viewportId: "sv", type: cs.Enums.ViewportType.STACK, element: elRef.current }]);
        const vp: any = engine.getViewport("sv");
        vpRef.current = vp;

        elRef.current.addEventListener("cornerstoneimagerendered", () => {
          setSlice(vp.getCurrentImageIdIndex?.() ?? 0);
        });

        await vp.setStack(imageIds);
        vp.render();
        setReady(true);
      } catch (e: any) {
        if (!dead) onError(e?.message ?? String(e));
      }
    })();

    return () => { dead = true; try { engRef.current?.destroy(); } catch {/***/} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIds.join("|")]);

  function applyPreset(label: string, wc: number, ww: number) {
    setPreset(label);
    try { vpRef.current?.setProperties({ voiRange: { lower: wc - ww / 2, upper: wc + ww / 2 } }); vpRef.current?.render(); } catch {/***/}
  }
  function reset() {
    try { vpRef.current?.resetProperties(); vpRef.current?.resetCamera(); vpRef.current?.render(); } catch {/***/}
    setPreset("Soft Tissue");
  }

  return (
    <div className="flex flex-col">
      <Toolbar active={preset} onPreset={applyPreset} onReset={reset}
        extra={imageIds.length > 1 && <span className="text-[10px] text-zinc-500 tabular-nums">Slice {slice + 1}/{imageIds.length}</span>} />
      <div className="relative bg-black" style={{ height: 460 }}>
        <div ref={elRef} style={{ width: "100%", height: "100%" }} />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
            <span className="text-[11px] text-zinc-500">Loading {imageIds.length} slice{imageIds.length > 1 ? "s" : ""}…</span>
          </div>
        )}
      </div>
      <div className="px-3 py-1 bg-zinc-900 text-center">
        <p className="text-[10px] text-zinc-600">Scroll = navigate slices · Drag = pan · Ctrl+drag = zoom</p>
      </div>
    </div>
  );
}

const PANELS = [
  { id: "axial",    label: "AXIAL",    color: "#ef4444" },
  { id: "sagittal", label: "SAGITTAL", color: "#22c55e" },
  { id: "coronal",  label: "CORONAL",  color: "#3b82f6" },
  { id: "vol3d",    label: "3D MIP",   color: "#f59e0b" },
] as const;

function MprViewer({ imageIds, onError }: { imageIds: string[]; onError(m: string): void }) {
  const refs = {
    axial:    useRef<HTMLDivElement>(null),
    sagittal: useRef<HTMLDivElement>(null),
    coronal:  useRef<HTMLDivElement>(null),
    vol3d:    useRef<HTMLDivElement>(null),
  };
  const engRef = useRef<any>(null);
  const [ready,    setReady]    = useState(false);
  const [progress, setProgress] = useState(0);
  const [preset,   setPreset]   = useState("Soft Tissue");

  useEffect(() => {
    if (imageIds.length < 4) return;
    let dead = false;
    const ENG = `mpr-${Date.now()}`;
    const VOL = `vol-${Date.now()}`;
    let csRef: any = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let modifiedListener: ((e: any) => void) | null = null;

    (async () => {
      try {
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        if (dead) return;

        const cs: any = await import("@cornerstonejs/core");
        const lMod: any = await import("@cornerstonejs/dicom-image-loader");
        csRef = cs;

        (lMod?.default?.init ?? lMod?.init)?.({ maxWebWorkers: 2 });

        try { await cs.init(); } catch { /* already initialised */ }
        if (dead) return;

        for (const [id, ref] of Object.entries(refs)) {
          const el = (ref as React.RefObject<HTMLDivElement>).current;
          if (!el) throw new Error(`MPR panel not mounted: ${id}`);
          if (el.clientWidth === 0 || el.clientHeight === 0) {
            throw new Error(`MPR panel has zero dimensions: ${id} — try resizing the window`);
          }
        }

        const engine = new cs.RenderingEngine(ENG);
        engRef.current = engine;

        const vpIds = ["axial", "sagittal", "coronal", "vol3d"] as const;

        engine.setViewports([
          {
            viewportId: "axial",
            type: cs.Enums.ViewportType.ORTHOGRAPHIC,
            element: refs.axial.current!,
            defaultOptions: { orientation: cs.Enums.OrientationAxis.AXIAL,    background: [0, 0, 0] as [number,number,number] },
          },
          {
            viewportId: "sagittal",
            type: cs.Enums.ViewportType.ORTHOGRAPHIC,
            element: refs.sagittal.current!,
            defaultOptions: { orientation: cs.Enums.OrientationAxis.SAGITTAL, background: [0, 0, 0] as [number,number,number] },
          },
          {
            viewportId: "coronal",
            type: cs.Enums.ViewportType.ORTHOGRAPHIC,
            element: refs.coronal.current!,
            defaultOptions: { orientation: cs.Enums.OrientationAxis.CORONAL,  background: [0, 0, 0] as [number,number,number] },
          },
          {
            viewportId: "vol3d",
            type: cs.Enums.ViewportType.VOLUME_3D,
            element: refs.vol3d.current!,
            defaultOptions: { background: [0.04, 0.04, 0.08] as [number,number,number] },
          },
        ]);

        const volume: any = await cs.volumeLoader.createAndCacheVolume(VOL, { imageIds });

        const handleModified = (evt: any) => {
          if (dead) return;
          try {
            const { framesLoaded, numFrames } = evt?.detail ?? {};
            if (numFrames > 0) setProgress(Math.round((framesLoaded / numFrames) * 100));
          } catch { /* non-fatal */ }
          engine.renderViewports([...vpIds]);
        };
        modifiedListener = handleModified;
        cs.eventTarget.addEventListener(cs.Enums.Events.IMAGE_VOLUME_MODIFIED, handleModified);

        await cs.setVolumesForViewports(engine, [{ volumeId: VOL }], [...vpIds]);
        if (dead) return;

        try {
          const vp3d: any = engine.getViewport("vol3d");
          if (cs.Enums?.BlendModes?.MAXIMUM_INTENSITY_BLEND !== undefined) {
            vp3d?.setBlendMode?.(cs.Enums.BlendModes.MAXIMUM_INTENSITY_BLEND);
          }
        } catch { /* non-fatal — default blend is still visible */ }

        const finalise = () => {
          if (dead) return;
          setProgress(100);

          (["axial", "sagittal", "coronal"] as const).forEach((id) => {
            try {
              const vp: any = engine.getViewport(id);
              vp?.resetCamera?.();
              vp?.setProperties?.({ voiRange: { lower: -150, upper: 250 } });
              vp?.render?.();
            } catch { /* non-fatal */ }
          });

          try {
            const vp3d: any = engine.getViewport("vol3d");
            vp3d?.resetCamera?.();

            const actor = vp3d?.getDefaultActor?.()?.actor;
            if (actor) {
              const prop = actor.getProperty?.();
              if (prop) {
                prop.setIndependentComponents?.(false);
                prop.setInterpolationTypeToLinear?.();

                const ofun = prop.getScalarOpacity?.(0);
                if (ofun) {
                  ofun.removeAllPoints();
                  ofun.addPoint(-1000, 0.00);
                  ofun.addPoint(  150, 0.00);
                  ofun.addPoint(  500, 0.15);
                  ofun.addPoint(  900, 0.45);
                  ofun.addPoint( 1500, 0.80);
                  ofun.addPoint( 3000, 1.00);
                }

                const cfun = prop.getRGBTransferFunction?.(0);
                if (cfun) {
                  cfun.removeAllPoints();
                  cfun.addRGBPoint(-1000, 0.00, 0.00, 0.00);
                  cfun.addRGBPoint(  150, 0.40, 0.20, 0.10);
                  cfun.addRGBPoint(  500, 0.80, 0.50, 0.25);
                  cfun.addRGBPoint( 1000, 1.00, 0.90, 0.80);
                  cfun.addRGBPoint( 3000, 1.00, 1.00, 1.00);
                }
              }
            }
            vp3d?.render?.();
          } catch { /* non-fatal */ }

          engine.renderViewports([...vpIds]);
          setReady(true);
        };

        try {
          volume.load(finalise);
        } catch {
          volume.load();
        }

        let pollCount = 0;
        pollTimer = setInterval(() => {
          if (dead || pollCount++ > 200) {
            if (pollTimer) clearInterval(pollTimer);
            return;
          }
          try {
            const vol = csRef?.cache?.getVolume?.(VOL);
            const framesLoaded = vol?.loadStatus?.framesLoaded ?? 0;
            const total        = vol?.loadStatus?.numFrames    ?? imageIds.length;
            if (total > 0) setProgress(Math.round((framesLoaded / total) * 100));
            engine.renderViewports([...vpIds]);
            if (framesLoaded >= total && total > 0) {
              clearInterval(pollTimer!);
              pollTimer = null;
              if (!ready) finalise();
            }
          } catch { /* non-fatal */ }
        }, 300);

      } catch (e: any) {
        if (!dead) onError(e?.message ?? String(e));
      }
    })();

    return () => {
      dead = true;
      if (pollTimer) clearInterval(pollTimer);
      try { engRef.current?.destroy(); } catch { /* */ }
      if (csRef && modifiedListener) {
        try {
          csRef.eventTarget.removeEventListener(
            csRef.Enums.Events.IMAGE_VOLUME_MODIFIED,
            modifiedListener,
          );
        } catch { /* */ }
      }
      if (csRef) {
        try { csRef.cache.removeVolume?.(VOL); } catch { /* */ }
        try { csRef.cache.removeVolumeLoadObject?.(VOL); } catch { /* */ }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIds.join("|")]);

  function applyPreset(label: string, wc: number, ww: number) {
    setPreset(label);
    const eng = engRef.current;
    if (!eng) return;
    ["axial", "sagittal", "coronal"].forEach((id) => {
      try {
        const vp: any = eng.getViewport(id);
        vp?.setProperties?.({ voiRange: { lower: wc - ww / 2, upper: wc + ww / 2 } });
        vp?.render?.();
      } catch { /**/ }
    });
  }

  function reset() {
    const eng = engRef.current;
    if (!eng) return;
    ["axial", "sagittal", "coronal"].forEach((id) => {
      try {
        const vp: any = eng.getViewport(id);
        vp?.resetProperties?.();
        vp?.resetCamera?.();
        vp?.render?.();
      } catch { /**/ }
    });
    setPreset("Soft Tissue");
  }

  return (
    <div className="flex flex-col">
      <Toolbar active={preset} onPreset={applyPreset} onReset={reset}
        extra={
          <span className="text-[10px] text-zinc-500 tabular-nums">
            {ready ? `${imageIds.length} slices` : `Loading… ${progress}%`}
          </span>
        }
      />
      <div className="relative bg-zinc-950 grid grid-cols-2 gap-px" style={{ height: 480 }}>
        {PANELS.map(({ id, label, color }) => (
          <div key={id} className="relative bg-black" style={{ height: 240 }}>
            <div ref={refs[id as keyof typeof refs]} style={{ width: "100%", height: "100%" }} />
            <span className="absolute top-1 left-2 text-[9px] font-bold pointer-events-none select-none"
              style={{ color, textShadow: "0 1px 3px #000" }}>
              {label}
            </span>
          </div>
        ))}
        {!ready && (
          <div className="absolute inset-0 col-span-2 flex flex-col items-center justify-center bg-black/80 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
            <span className="text-xs text-zinc-300">
              Building 3D volume from {imageIds.length} slices…
            </span>
            {progress > 0 && (
              <div className="w-48 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
            <span className="text-[10px] text-zinc-600">
              {progress > 0 ? `${progress}%` : "Preparing volume…"}
            </span>
          </div>
        )}
      </div>
      <div className="px-3 py-1 bg-zinc-900 text-center">
        <p className="text-[10px] text-zinc-600">Drag = pan · Scroll = zoom · Right-drag = W/L · 3D panel = MIP volume rendering</p>
      </div>
    </div>
  );
}

export function DicomViewer({ dicomUrl, blobFiles, seriesFileUrls, className }: DicomViewerProps) {
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [mode,     setMode]     = useState<"2d" | "3d">("2d");
  const [error,    setError]    = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const blobsRef = useRef<string[]>([]);

  const seriesKey = seriesFileUrls?.join("|") ?? "";

  useEffect(() => {
    let dead = false;
    blobsRef.current.forEach(URL.revokeObjectURL);
    blobsRef.current = [];
    setError(null); setImageIds([]);

    if (typeof window === "undefined") return;

    (async () => {
      setFetching(true);
      try {
        if (blobFiles && blobFiles.length > 0) {
          const urls = blobFiles.map((f) => URL.createObjectURL(f));
          blobsRef.current = urls;
          if (!dead) {
            const ids = urls.map((u) => `wadouri:${u}`);
            setImageIds(ids);
            if (urls.length >= 8) setMode("3d");
          }
        } else if (seriesFileUrls && seriesFileUrls.length > 0) {
          const token = readToken();
          const blobs = await Promise.all(
            seriesFileUrls.map(async (url) => {
              const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
              if (!r.ok) throw new Error(`DICOM fetch ${r.status} from ${url}`);
              return URL.createObjectURL(await r.blob());
            }),
          );
          blobsRef.current = blobs;
          if (!dead) {
            setImageIds(blobs.map((u) => `wadouri:${u}`));
            if (blobs.length >= 8) setMode("3d");
          }
        } else if (dicomUrl) {
          const token = readToken();
          const r = await fetch(dicomUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
          if (!r.ok) throw new Error(`DICOM fetch ${r.status}: ${r.statusText}`);
          const url = URL.createObjectURL(await r.blob());
          blobsRef.current = [url];
          if (!dead) setImageIds([`wadouri:${url}`]);
        }
      } catch (e: any) {
        if (!dead) setError(e?.message ?? "Failed to load DICOM.");
      } finally {
        if (!dead) setFetching(false);
      }
    })();

    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dicomUrl, blobFiles, seriesKey]);

  useEffect(() => () => { blobsRef.current.forEach(URL.revokeObjectURL); }, []);

  const canMpr = imageIds.length >= 4;

  return (
    <div className={cn("flex flex-col rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950", className)}>
      {/* Mode switcher */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-zinc-900 border-b border-zinc-800">
        <button type="button" onClick={() => setMode("2d")}
          className={cn("px-3 py-0.5 text-[10px] rounded font-semibold transition-colors",
            mode === "2d" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-zinc-200")}>
          2D Stack
        </button>
        <button type="button" onClick={() => setMode("3d")} disabled={!canMpr}
          title={canMpr ? "MPR — Axial / Sagittal / Coronal + 3D MIP" : `Upload ≥4 slices to enable 3D (have ${imageIds.length})`}
          className={cn("px-3 py-0.5 text-[10px] rounded font-semibold transition-colors",
            mode === "3d"  ? "bg-blue-700 text-white" : "text-zinc-400 hover:text-zinc-200",
            !canMpr && "opacity-30 cursor-not-allowed")}>
          3D MPR
        </button>
        <span className="ml-auto text-[9px] text-zinc-600">
          {imageIds.length > 0 && `${imageIds.length} slice${imageIds.length > 1 ? "s" : ""}`}
        </span>
      </div>

      {fetching ? (
        <div className="flex flex-col items-center justify-center bg-black gap-2" style={{ minHeight: 460 }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
          <span className="text-xs text-zinc-500">Loading…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center bg-black gap-2 px-6 text-center" style={{ minHeight: 460 }}>
          <span className="text-sm text-red-400 font-semibold">Failed to load</span>
          <span className="text-xs text-zinc-500">{error}</span>
        </div>
      ) : imageIds.length === 0 ? (
        <div className="flex items-center justify-center bg-black text-zinc-600 text-xs" style={{ minHeight: 460 }}>
          No image loaded
        </div>
      ) : mode === "3d" && canMpr ? (
        <MprViewer  imageIds={imageIds} onError={setError} />
      ) : (
        <StackViewer imageIds={imageIds} onError={setError} />
      )}
    </div>
  );
}

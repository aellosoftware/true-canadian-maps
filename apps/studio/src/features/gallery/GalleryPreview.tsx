"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { Map as MlMap, addProtocol, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { compileStyle, type CompileTargets, type StyleConfig } from "@tcm/style-compiler";

let ready = false;
function prep() { if (ready) return; setWorkerUrl(new URL("/vendor/maplibre/maplibre-gl-worker.mjs", window.location.origin).href); addProtocol("pmtiles", new Protocol().tile); ready = true; }

function Preview({ config, targets }: { config: StyleConfig; targets: Omit<CompileTargets, "markers" | "markersSpriteUrl" | "layerOverrides"> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    prep();
    const map = new MlMap({ container: ref.current, style: compileStyle(config, { ...targets, markers: { type: "FeatureCollection", features: [] } }), center: [-75.7, 45.42], zoom: 5.5, attributionControl: { compact: false }, interactive: true });
    return () => map.remove();
  }, [config, targets]);
  return <div ref={ref} style={{ position: "absolute", inset: 0 }} role="region" aria-label="Style preview" />;
}

export const GalleryPreview = dynamic(() => Promise.resolve(Preview), { ssr: false });

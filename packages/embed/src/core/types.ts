import type { Map as MlMap } from "maplibre-gl";

export interface EmbedConfigResponse {
  projectId: string;
  environment: string;
  releaseId: string;
  styleUrl: string;
  markersUrl: string;
  spriteUrl: string;
  manifestUrl: string;
  camera: { center: [number, number]; zoom: number; minZoom?: number; maxZoom?: number; bearing?: number; pitch?: number; maxBounds?: [number, number, number, number] };
  locale: string;
  attribution: string;
  markerCount: number;
  config: { cluster: boolean; showTitles: boolean };
}

export interface LocationRecord {
  id: string;
  title: string;
  description: string | null;
  link: { label: string; url: string } | null;
  imageUrl: string | null;
  category: string | null;
  lng: number;
  lat: number;
  properties: Record<string, unknown>;
}

export interface CreateMapOptions {
  container: string | HTMLElement;
  projectId: string;
  publicKey: string;
  /** Absolute URL of the API (…/v1 parent). Defaults to what the loader's server advertises. */
  apiUrl?: string;
  environment?: string;
  locale?: "en-CA" | "fr-CA" | string;
  /** Where to render the accessible location list: below the map, in a target element, or nowhere. */
  list?: "auto" | "below" | "none" | string | HTMLElement;
  fitToMarkers?: boolean;
  interactive?: boolean;
  cooperativeGestures?: boolean;
  onError?: (err: Error) => void;
}

export interface TcmEvents {
  ready: { releaseId: string };
  "location:selected": { locationId: string; source: "map" | "list" | "api" };
  "location:hover": { locationId: string | null };
  "viewport:change": { center: [number, number]; zoom: number };
  error: { error: Error };
}

export interface TcmMap {
  readonly map: MlMap;
  readonly release: { id: string; manifestUrl: string; attribution: string };
  on<E extends keyof TcmEvents>(event: E, cb: (payload: TcmEvents[E]) => void): () => void;
  off<E extends keyof TcmEvents>(event: E, cb: (payload: TcmEvents[E]) => void): void;
  selectLocation(id: string, opts?: { openPopup?: boolean; fly?: boolean }): void;
  setCategoryFilter(categories: string[] | null): void;
  getLocations(): LocationRecord[];
  resize(): void;
  destroy(): void;
}

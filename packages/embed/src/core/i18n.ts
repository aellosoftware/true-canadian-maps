export interface Strings {
  skipToList: string;
  locations: string;
  showOnMap: string;
  noLocations: string;
  showing: (title: string) => string;
  mapLabel: string;
}

const en: Strings = {
  skipToList: "Skip map, go to the locations list",
  locations: "Locations",
  showOnMap: "Show on map",
  noLocations: "No locations to show.",
  showing: (t) => `Showing ${t}`,
  mapLabel: "Interactive map",
};
const fr: Strings = {
  skipToList: "Passer la carte, aller à la liste des emplacements",
  locations: "Emplacements",
  showOnMap: "Afficher sur la carte",
  noLocations: "Aucun emplacement à afficher.",
  showing: (t) => `Affichage de ${t}`,
  mapLabel: "Carte interactive",
};

export function strings(locale: string | undefined): Strings {
  return locale?.toLowerCase().startsWith("fr") ? fr : en;
}

/** MapLibre control/ARIA strings. */
export function maplibreLocale(locale: string | undefined): Record<string, string> | undefined {
  if (!locale?.toLowerCase().startsWith("fr")) return undefined;
  return {
    "NavigationControl.ZoomIn": "Zoom avant",
    "NavigationControl.ZoomOut": "Zoom arrière",
    "NavigationControl.ResetBearing": "Réinitialiser l’orientation",
    "AttributionControl.ToggleAttribution": "Afficher les attributions",
    "Popup.Close": "Fermer",
    "Map.Title": "Carte",
    "CooperativeGesturesHandler.WindowsHelpText": "Utilisez Ctrl + défilement pour zoomer",
    "CooperativeGesturesHandler.MacHelpText": "Utilisez ⌘ + défilement pour zoomer",
    "CooperativeGesturesHandler.MobileHelpText": "Utilisez deux doigts pour déplacer la carte",
  };
}

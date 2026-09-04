/** Flat colour tokens of a Protomaps basemap flavor (v5 schema), grouped for the editor. */
export const FLAVOR_COLOR_KEYS = [
  "background", "earth", "park_a", "park_b", "hospital", "industrial", "school", "wood_a", "wood_b",
  "pedestrian", "scrub_a", "scrub_b", "glacier", "sand", "beach", "aerodrome", "runway", "water", "zoo", "military",
  "tunnel_other_casing", "tunnel_minor_casing", "tunnel_link_casing", "tunnel_major_casing", "tunnel_highway_casing",
  "tunnel_other", "tunnel_minor", "tunnel_link", "tunnel_major", "tunnel_highway",
  "pier", "buildings",
  "minor_service_casing", "minor_casing", "link_casing", "major_casing_late", "highway_casing_late",
  "other", "minor_service", "minor_a", "minor_b", "link", "major_casing_early", "major", "highway_casing_early", "highway",
  "railway", "boundaries",
  "bridges_other_casing", "bridges_minor_casing", "bridges_link_casing", "bridges_major_casing", "bridges_highway_casing",
  "bridges_other", "bridges_minor", "bridges_link", "bridges_major", "bridges_highway",
  "roads_label_minor", "roads_label_minor_halo", "roads_label_major", "roads_label_major_halo",
  "ocean_label", "subplace_label", "subplace_label_halo", "city_label", "city_label_halo",
  "state_label", "state_label_halo", "country_label", "address_label", "address_label_halo",
] as const;
export type FlavorColorKey = (typeof FLAVOR_COLOR_KEYS)[number];

export const POI_KEYS = ["blue", "green", "lapis", "pink", "red", "slategray", "tangerine", "turquoise"] as const;
export const LANDCOVER_KEYS = ["barren", "farmland", "forest", "glacier", "grassland", "scrub", "urban_area"] as const;

export interface TokenGroup {
  id: string;
  label: string;
  keys: readonly FlavorColorKey[];
  /** pairs of fill/outline or text/halo shown together */
  pairs?: ReadonlyArray<readonly [FlavorColorKey, FlavorColorKey]>;
}

/** Editor grouping. Every colour key appears in exactly one group (tested). */
export const TOKEN_GROUPS: readonly TokenGroup[] = [
  { id: "land", label: "Land & water", keys: ["background", "earth", "water", "glacier", "sand", "beach", "wood_a", "wood_b", "scrub_a", "scrub_b"] },
  { id: "landuse", label: "Parks & land use", keys: ["park_a", "park_b", "hospital", "industrial", "school", "zoo", "military", "aerodrome", "runway", "pedestrian", "pier"] },
  {
    id: "roads", label: "Roads",
    keys: ["highway", "highway_casing_early", "highway_casing_late", "major", "major_casing_early", "major_casing_late", "minor_a", "minor_b", "minor_casing", "minor_service", "minor_service_casing", "link", "link_casing", "other", "railway"],
    pairs: [["highway", "highway_casing_late"], ["major", "major_casing_late"], ["minor_a", "minor_casing"], ["minor_service", "minor_service_casing"], ["link", "link_casing"]],
  },
  {
    id: "bridges", label: "Bridges",
    keys: ["bridges_highway", "bridges_highway_casing", "bridges_major", "bridges_major_casing", "bridges_minor", "bridges_minor_casing", "bridges_link", "bridges_link_casing", "bridges_other", "bridges_other_casing"],
    pairs: [["bridges_highway", "bridges_highway_casing"], ["bridges_major", "bridges_major_casing"], ["bridges_minor", "bridges_minor_casing"], ["bridges_link", "bridges_link_casing"], ["bridges_other", "bridges_other_casing"]],
  },
  {
    id: "tunnels", label: "Tunnels",
    keys: ["tunnel_highway", "tunnel_highway_casing", "tunnel_major", "tunnel_major_casing", "tunnel_minor", "tunnel_minor_casing", "tunnel_link", "tunnel_link_casing", "tunnel_other", "tunnel_other_casing"],
    pairs: [["tunnel_highway", "tunnel_highway_casing"], ["tunnel_major", "tunnel_major_casing"], ["tunnel_minor", "tunnel_minor_casing"], ["tunnel_link", "tunnel_link_casing"], ["tunnel_other", "tunnel_other_casing"]],
  },
  { id: "buildings", label: "Buildings", keys: ["buildings"] },
  { id: "boundaries", label: "Boundaries", keys: ["boundaries"] },
  {
    id: "labels", label: "Labels",
    keys: ["country_label", "state_label", "state_label_halo", "city_label", "city_label_halo", "subplace_label", "subplace_label_halo", "roads_label_major", "roads_label_major_halo", "roads_label_minor", "roads_label_minor_halo", "ocean_label", "address_label", "address_label_halo"],
    pairs: [["state_label", "state_label_halo"], ["city_label", "city_label_halo"], ["subplace_label", "subplace_label_halo"], ["roads_label_major", "roads_label_major_halo"], ["roads_label_minor", "roads_label_minor_halo"], ["address_label", "address_label_halo"]],
  },
];

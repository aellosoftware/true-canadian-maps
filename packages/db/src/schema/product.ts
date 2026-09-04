import { sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  geometry,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";

const tenant = () => text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const projectStatus = pgEnum("project_status", ["active", "archived"]);
export const projectTemplate = pgEnum("project_template", ["blank", "store_locator", "public_facilities", "editorial"]);
export const releaseStatus = pgEnum("release_status", ["queued", "building", "published", "failed", "superseded"]);
export const apiKeyKind = pgEnum("api_key_kind", ["public", "server"]);
export const apiKeyStatus = pgEnum("api_key_status", ["active", "revoked"]);
export const iconKind = pgEnum("icon_kind", ["svg"]);
export const basemapStatus = pgEnum("basemap_status", ["available", "deprecated"]);
export const actorType = pgEnum("actor_type", ["user", "system", "api_key"]);

export const basemapVersions = pgTable("basemap_versions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pmtilesPath: text("pmtiles_path").notNull(),
  sourceUrl: text("source_url"),
  sourceBuildDate: text("source_build_date"),
  tilesetSchema: integer("tileset_schema").notNull().default(4),
  bbox: jsonb("bbox").$type<[number, number, number, number]>(),
  minZoom: integer("min_zoom"),
  maxZoom: integer("max_zoom"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  sha256: text("sha256"),
  attribution: text("attribution").notNull().default("© OpenStreetMap contributors, Protomaps"),
  status: basemapStatus("status").notNull().default("available"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("basemap_versions_name_uq").on(t.name)]);

export interface Camera {
  center: [number, number];
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  bearing?: number;
  pitch?: number;
  maxBounds?: [number, number, number, number];
}

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: tenant(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  template: projectTemplate("template").notNull().default("blank"),
  defaultLocale: text("default_locale").notNull().default("en-CA"),
  basemapVersionId: text("basemap_version_id").references(() => basemapVersions.id),
  camera: jsonb("camera").$type<Camera>().notNull(),
  status: projectStatus("status").notNull().default("active"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("projects_org_slug_uq").on(t.organizationId, t.slug),
  index("projects_org_idx").on(t.organizationId),
]);

export const projectEnvironments = pgTable("project_environments", {
  id: text("id").primaryKey(),
  organizationId: tenant(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  currentReleaseId: text("current_release_id"),
  previousReleaseId: text("previous_release_id"),
  pointerUpdatedAt: timestamp("pointer_updated_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("project_environments_project_name_uq").on(t.projectId, t.name)]);

export const styles = pgTable("styles", {
  id: text("id").primaryKey(),
  organizationId: tenant(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  layerOverrides: jsonb("layer_overrides").$type<Record<string, unknown> | null>(),
  presetId: text("preset_id"),
  revision: integer("revision").notNull().default(1),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("styles_project_uq").on(t.projectId)]);

export const stylePresets = pgTable("style_presets", {
  id: text("id").primaryKey(),
  /** null = platform preset available to every tenant */
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  previewImagePath: text("preview_image_path"),
  isPublic: boolean("is_public").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  sourceProjectId: text("source_project_id"),
  sourceReleaseId: text("source_release_id"),
  useCount: integer("use_count").notNull().default(0),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("style_presets_slug_uq").on(t.slug),
  index("style_presets_public_idx").on(t.isPublic),
]);

export interface MarkerLink { label: string; url: string }

export const markers = pgTable("markers", {
  id: text("id").primaryKey(),
  organizationId: tenant(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  title: text("title").notNull(),
  location: geometry("location", { type: "point", mode: "xy", srid: 4326 }).notNull(),
  description: text("description"),
  link: jsonb("link").$type<MarkerLink | null>(),
  imageUrl: text("image_url"),
  icon: text("icon").notNull().default("pin"),
  color: text("color").notNull().default("#E23B3B"),
  category: text("category"),
  properties: jsonb("properties").$type<Record<string, string | number | boolean | null>>().notNull().default(sql`'{}'::jsonb`),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("markers_project_idx").on(t.projectId, t.sortOrder),
  index("markers_location_gist").using("gist", t.location),
  uniqueIndex("markers_project_external_uq").on(t.projectId, t.externalId).where(sql`${t.externalId} is not null`),
]);

export const iconAssets = pgTable("icon_assets", {
  id: text("id").primaryKey(),
  organizationId: tenant(),
  /** null = organization-wide library */
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: iconKind("kind").notNull().default("svg"),
  storagePath: text("storage_path").notNull(),
  width: integer("width"),
  height: integer("height"),
  sha256: text("sha256").notNull(),
  sanitized: boolean("sanitized").notNull().default(true),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("icon_assets_org_idx").on(t.organizationId, t.projectId)]);

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  organizationId: tenant(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: apiKeyKind("kind").notNull().default("public"),
  label: text("label").notNull(),
  publicKey: text("public_key").notNull(),
  secretHash: text("secret_hash"),
  allowedOrigins: text("allowed_origins").array().notNull().default(sql`'{}'::text[]`),
  environments: text("environments").array().notNull().default(sql`'{production}'::text[]`),
  status: apiKeyStatus("status").notNull().default("active"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("api_keys_public_key_uq").on(t.publicKey),
  index("api_keys_project_idx").on(t.projectId),
]);

export const releases = pgTable("releases", {
  id: text("id").primaryKey(),
  organizationId: tenant(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  environment: text("environment").notNull().default("production"),
  number: integer("number").notNull(),
  status: releaseStatus("status").notNull().default("queued"),
  styleRevision: integer("style_revision").notNull(),
  styleConfigSnapshot: jsonb("style_config_snapshot").$type<Record<string, unknown>>().notNull(),
  layerOverridesSnapshot: jsonb("layer_overrides_snapshot").$type<Record<string, unknown> | null>(),
  markerCount: integer("marker_count").notNull().default(0),
  manifest: jsonb("manifest").$type<Record<string, unknown> | null>(),
  artifactPrefix: text("artifact_prefix"),
  basemapVersionId: text("basemap_version_id").references(() => basemapVersions.id),
  error: text("error"),
  jobId: text("job_id"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("releases_project_number_uq").on(t.projectId, t.number),
  index("releases_project_idx").on(t.projectId, t.createdAt),
]);

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  organizationId: tenant(),
  actorType: actorType("actor_type").notNull().default("user"),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
}, (t) => [index("audit_events_org_created_idx").on(t.organizationId, t.createdAt)]);

// Shared row types
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectEnvironment = typeof projectEnvironments.$inferSelect;
export type Style = typeof styles.$inferSelect;
export type StylePreset = typeof stylePresets.$inferSelect;
export type Marker = typeof markers.$inferSelect;
export type NewMarker = typeof markers.$inferInsert;
export type IconAsset = typeof iconAssets.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Release = typeof releases.$inferSelect;
export type BasemapVersion = typeof basemapVersions.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

import { z } from "zod";

export const SlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "lowercase letters, numbers and hyphens only");

export const CameraSchema = z.object({
  center: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  zoom: z.number().min(0).max(22),
  minZoom: z.number().min(0).max(22).optional(),
  maxZoom: z.number().min(0).max(22).optional(),
  bearing: z.number().optional(),
  pitch: z.number().min(0).max(85).optional(),
  maxBounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type Camera = z.infer<typeof CameraSchema>;

/** Canada-wide default view */
export const DEFAULT_CAMERA: Camera = { center: [-96.5, 57], zoom: 3.2, minZoom: 2, maxZoom: 18 };

export const CreateOrganizationInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: SlugSchema.optional(),
});

export const UpdateOrganizationInput = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: SlugSchema.optional(),
  logo: z.string().url().nullable().optional(),
});

export const ProjectTemplate = z.enum(["blank", "store_locator", "public_facilities", "editorial"]);

export const CreateProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  slug: SlugSchema.optional(),
  description: z.string().trim().max(500).optional(),
  template: ProjectTemplate.default("blank"),
  defaultLocale: z.enum(["en-CA", "fr-CA"]).default("en-CA"),
  camera: CameraSchema.optional(),
  presetSlug: z.string().optional(),
});

export const UpdateProjectInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: SlugSchema.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  defaultLocale: z.enum(["en-CA", "fr-CA"]).optional(),
  camera: CameraSchema.optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const SetupInput = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  password: z.string().min(10).max(128),
  organizationName: z.string().trim().min(2).max(80),
});

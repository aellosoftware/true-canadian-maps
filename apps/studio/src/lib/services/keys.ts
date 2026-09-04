import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, isValidOriginRule, newId, newPublicKey } from "@tcm/shared";
import { apiKeys, type ApiKey } from "@tcm/db";
import { db } from "../db";
import { getProject } from "./projects";
import { recordAudit } from "./audit";

const OriginRule = z.string().trim().min(1).max(253).refine(isValidOriginRule, "use https://example.com, https://*.example.com or http://localhost:*");

export const CreateKeyInput = z.object({
  label: z.string().trim().min(1).max(80),
  allowedOrigins: z.array(OriginRule).min(1).max(50),
  environments: z.array(z.enum(["production"])).default(["production"]),
});
export const UpdateKeyInput = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  allowedOrigins: z.array(OriginRule).min(1).max(50).optional(),
  status: z.enum(["active", "revoked"]).optional(),
});

export type PublicApiKey = Omit<ApiKey, "secretHash">;
const strip = ({ secretHash, ...key }: ApiKey): PublicApiKey => {
  void secretHash;
  return key;
};

export async function listKeys(orgId: string, projectId: string): Promise<PublicApiKey[]> {
  await getProject(orgId, projectId);
  const rows = await db().select().from(apiKeys).where(and(eq(apiKeys.organizationId, orgId), eq(apiKeys.projectId, projectId))).orderBy(desc(apiKeys.createdAt));
  return rows.map(strip);
}

export async function createKey(orgId: string, projectId: string, userId: string, input: z.infer<typeof CreateKeyInput>): Promise<PublicApiKey> {
  await getProject(orgId, projectId);
  const id = newId("apiKey");
  const publicKey = newPublicKey("live");
  await db().transaction(async (tx) => {
    await tx.insert(apiKeys).values({ id, organizationId: orgId, projectId, kind: "public", label: input.label, publicKey, allowedOrigins: input.allowedOrigins, environments: input.environments, createdBy: userId });
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: "apikey.create", targetType: "api_key", targetId: id, metadata: { label: input.label, origins: input.allowedOrigins } }, tx);
  });
  const [k] = await db().select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return strip(k!);
}

export async function updateKey(orgId: string, projectId: string, keyId: string, userId: string, input: z.infer<typeof UpdateKeyInput>): Promise<PublicApiKey> {
  const [k] = await db().select().from(apiKeys).where(and(eq(apiKeys.organizationId, orgId), eq(apiKeys.projectId, projectId), eq(apiKeys.id, keyId))).limit(1);
  if (!k) throw ApiError.notFound("key");
  await db().transaction(async (tx) => {
    await tx.update(apiKeys).set({ ...input, updatedAt: new Date() }).where(eq(apiKeys.id, keyId));
    await recordAudit({ organizationId: orgId, actorUserId: userId, action: input.status === "revoked" ? "apikey.revoke" : "apikey.update", targetType: "api_key", targetId: keyId, metadata: { fields: Object.keys(input) } }, tx);
  });
  const [u] = await db().select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
  return strip(u!);
}

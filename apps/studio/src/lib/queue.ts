import { PgBoss } from "pg-boss";
import { env } from "./env";

export const QUEUES = { publish: "publish", pointer: "pointer" } as const;

declare global {
  var __tcmBoss: Promise<PgBoss> | undefined;
}

/** Shared pg-boss producer for the studio. The worker process consumes. */
export function boss(): Promise<PgBoss> {
  if (!globalThis.__tcmBoss) {
    globalThis.__tcmBoss = (async () => {
      const b = new PgBoss({ connectionString: env().DATABASE_URL, schema: "pgboss", max: 3 });
      b.on("error", (err: unknown) => console.error("[pg-boss]", err));
      await b.start();
      await b.createQueue(QUEUES.publish).catch(() => {});
      await b.createQueue(QUEUES.pointer).catch(() => {});
      return b;
    })();
  }
  return globalThis.__tcmBoss;
}

export interface PublishJob { releaseId: string; organizationId: string; projectId: string; requestedBy: string }
export interface PointerJob { organizationId: string; projectId: string; environment: string; releaseId: string }

export async function enqueuePublish(job: PublishJob): Promise<string | null> {
  const b = await boss();
  return b.send(QUEUES.publish, job, { singletonKey: job.projectId, retryLimit: 2, retryDelay: 15, retryBackoff: true, expireInSeconds: 900 });
}

export async function enqueuePointer(job: PointerJob): Promise<string | null> {
  const b = await boss();
  return b.send(QUEUES.pointer, job, { retryLimit: 3, retryDelay: 5 });
}

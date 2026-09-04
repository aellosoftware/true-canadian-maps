import { writeFile } from "node:fs/promises";
import { PgBoss } from "pg-boss";
import { createContext } from "./context";
import { log } from "./log";
import { runPublish, type PublishJobData } from "./jobs/publish";
import { writePointer } from "./jobs/pointer";

const QUEUES = { publish: "publish", pointer: "pointer" } as const;

async function main() {
  const ctx = createContext();
  const boss = new PgBoss({ connectionString: ctx.env.DATABASE_URL, schema: "pgboss", max: 3 });
  boss.on("error", (err: unknown) => log.error({ err }, "pg-boss error"));
  await boss.start();
  await boss.createQueue(QUEUES.publish).catch(() => {});
  await boss.createQueue(QUEUES.pointer).catch(() => {});

  await boss.work<PublishJobData>(QUEUES.publish, { batchSize: 1, pollingIntervalSeconds: 1 }, async (jobs) => {
    for (const job of jobs) {
      log.info({ jobId: job.id, releaseId: job.data.releaseId }, "publish job start");
      await runPublish(ctx, job.data);
    }
  });
  await boss.work<{ projectId: string; environment: string }>(QUEUES.pointer, { batchSize: 5, pollingIntervalSeconds: 1 }, async (jobs) => {
    for (const job of jobs) {
      const pointer = await writePointer(ctx, job.data.projectId, job.data.environment);
      log.info({ jobId: job.id, projectId: job.data.projectId, releaseId: pointer?.release_id ?? null }, "pointer written");
    }
  });

  const heartbeat = setInterval(() => { void writeFile(ctx.env.WORKER_HEARTBEAT_FILE, String(Date.now())).catch(() => {}); }, 15_000);
  log.info({ version: ctx.env.TCM_VERSION, store: ctx.store.kind }, "worker ready");

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    clearInterval(heartbeat);
    await boss.stop({ graceful: true, timeout: 20_000 }).catch(() => {});
    await ctx.pool.end().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log.fatal({ err }, "worker failed to start");
  process.exit(1);
});

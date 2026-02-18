import IORedis from "ioredis";

let redis: IORedis;

declare global {
  var __redis: IORedis | undefined;
}

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

if (process.env.NODE_ENV === "production") {
  redis = new IORedis(getRedisUrl(), { maxRetriesPerRequest: null });
} else {
  if (!globalThis.__redis) {
    globalThis.__redis = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
    });
  }
  redis = globalThis.__redis;
}

export default redis;

import { Queue } from "bullmq";
import redis from "./redis.server";

export const trackingQueue = new Queue("tracking", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

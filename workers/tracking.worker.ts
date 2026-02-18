import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "tracking",
  async (job) => {
    const { shipmentId } = job.data;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { tenant: true },
    });

    if (!shipment || !shipment.trackingNumber) {
      console.log(`Skipping tracking for shipment ${shipmentId}: no tracking number`);
      return;
    }

    if (shipment.status === "DELIVERED" || shipment.status === "CANCELLED") {
      console.log(`Skipping tracking for shipment ${shipmentId}: already ${shipment.status}`);
      return;
    }

    const { getCarrierAdapter } = await import("../app/lib/carriers/registry");

    const adapter = await getCarrierAdapter(shipment.carrier, {
      customerId: shipment.tenant.glsCustomerId || undefined,
      apiUsername: shipment.tenant.glsApiUsername || undefined,
      apiPassword: shipment.tenant.glsApiPassword || undefined,
    });

    const tracking = await adapter.getTracking(shipment.trackingNumber);

    const newStatus = tracking.delivered
      ? "DELIVERED"
      : tracking.events.length > 0
        ? "IN_TRANSIT"
        : shipment.status;

    if (newStatus !== shipment.status) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { status: newStatus },
      });
      console.log(`Updated shipment ${shipmentId} status: ${shipment.status} → ${newStatus}`);
    }
  },
  { connection: redis },
);

worker.on("failed", (job, err) => {
  console.error(`Tracking job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`Tracking job ${job.id} completed`);
});

console.log("Tracking worker started");

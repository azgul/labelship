import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { ShipmondoClient } from "../app/lib/shipmondo/client";

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

    if (!shipment || !shipment.shipmondoId) {
      console.log(`Skipping tracking for shipment ${shipmentId}: no Shipmondo ID`);
      return;
    }

    if (shipment.status === "DELIVERED" || shipment.status === "CANCELLED") {
      console.log(`Skipping tracking for shipment ${shipmentId}: already ${shipment.status}`);
      return;
    }

    if (!shipment.tenant.shipmondoApiUser || !shipment.tenant.shipmondoApiKey) {
      console.log(`Skipping tracking for shipment ${shipmentId}: no API credentials`);
      return;
    }

    const client = new ShipmondoClient({
      apiUser: shipment.tenant.shipmondoApiUser,
      apiKey: shipment.tenant.shipmondoApiKey,
    });

    const shipmondoShipment = await client.getShipment(shipment.shipmondoId);

    // Shipmondo doesn't expose granular tracking status via their API,
    // but we can check if tracking links/codes have been updated.
    // For detailed tracking, the tracking URL points to the carrier's page.
    const trackingNumber = shipmondoShipment.parcels?.[0]?.pkg_no
      || shipmondoShipment.tracking_codes?.[0]
      || shipment.trackingNumber;

    const trackingUrl = shipmondoShipment.tracking_links?.[0] || shipment.trackingUrl;

    if (trackingNumber !== shipment.trackingNumber || trackingUrl !== shipment.trackingUrl) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { trackingNumber, trackingUrl },
      });
      console.log(`Updated tracking for shipment ${shipmentId}`);
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

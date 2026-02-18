import prisma from "~/db.server";
import type { Tenant, Shipment } from "@prisma/client";
import { getCarrierAdapter } from "~/lib/carriers/registry";
import type { Address, Parcel } from "~/lib/carriers/types";

interface CreateShipmentInput {
  shopifyOrderId?: string;
  shopifyOrderName?: string;
  recipient: Address;
  parcels: Parcel[];
  product: string;
  parcelShopId?: string;
}

function getTenantSenderAddress(tenant: Tenant): Address {
  if (!tenant.senderName || !tenant.senderStreet || !tenant.senderZip || !tenant.senderCity) {
    throw new Error("Sender address not configured. Go to Settings to set your sender address.");
  }
  return {
    name: tenant.senderName,
    street: tenant.senderStreet,
    zip: tenant.senderZip,
    city: tenant.senderCity,
    country: tenant.senderCountry,
    phone: tenant.senderPhone || undefined,
    email: tenant.senderEmail || undefined,
  };
}

function getTenantCarrierCredentials(tenant: Tenant) {
  return {
    customerId: tenant.glsCustomerId || undefined,
    apiUsername: tenant.glsApiUsername || undefined,
    apiPassword: tenant.glsApiPassword || undefined,
  };
}

export async function createShipment(
  tenant: Tenant,
  input: CreateShipmentInput,
): Promise<Shipment> {
  const sender = getTenantSenderAddress(tenant);
  const credentials = getTenantCarrierCredentials(tenant);
  const adapter = await getCarrierAdapter(tenant.defaultCarrier, credentials);

  // Create the shipment record first (PENDING)
  const shipment = await prisma.shipment.create({
    data: {
      tenantId: tenant.id,
      carrier: tenant.defaultCarrier,
      shopifyOrderId: input.shopifyOrderId,
      shopifyOrderName: input.shopifyOrderName,
      recipientName: input.recipient.name,
      recipientStreet: input.recipient.street,
      recipientZip: input.recipient.zip,
      recipientCity: input.recipient.city,
      recipientCountry: input.recipient.country,
      recipientPhone: input.recipient.phone,
      recipientEmail: input.recipient.email,
      carrierProduct: input.product,
      parcelShopId: input.parcelShopId,
      weight: input.parcels[0]?.weight,
    },
  });

  try {
    const result = await adapter.createShipment({
      sender,
      recipient: input.recipient,
      parcels: input.parcels,
      product: input.product,
      parcelShopId: input.parcelShopId,
      reference: shipment.id,
    });

    // Update with carrier response
    return await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "LABEL_CREATED",
        carrierRef: result.carrierRef,
        trackingNumber: result.trackingNumber,
        trackingUrl: result.trackingUrl,
        labelData: new Uint8Array(result.labelPdf),
      },
    });
  } catch (error) {
    // Mark as failed
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function cancelShipment(
  tenant: Tenant,
  shipmentId: string,
): Promise<Shipment> {
  const shipment = await prisma.shipment.findFirstOrThrow({
    where: { id: shipmentId, tenantId: tenant.id },
  });

  if (!shipment.carrierRef) {
    throw new Error("Shipment has no carrier reference — cannot cancel");
  }

  const credentials = getTenantCarrierCredentials(tenant);
  const adapter = await getCarrierAdapter(shipment.carrier, credentials);
  await adapter.cancelShipment(shipment.carrierRef);

  return prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: "CANCELLED" },
  });
}

export async function getShipmentLabel(
  tenant: Tenant,
  shipmentId: string,
): Promise<Buffer> {
  const shipment = await prisma.shipment.findFirstOrThrow({
    where: { id: shipmentId, tenantId: tenant.id },
  });

  if (!shipment.labelData) {
    throw new Error("No label data available for this shipment");
  }

  return Buffer.from(shipment.labelData);
}

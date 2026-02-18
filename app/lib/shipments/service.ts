import prisma from "~/db.server";
import type { Tenant, Shipment } from "@prisma/client";
import { ShipmondoClient } from "~/lib/shipmondo/client";
import type { ShipmondoParty } from "~/lib/shipmondo/types";

interface CreateShipmentInput {
  shopifyOrderId?: string;
  shopifyOrderName?: string;
  recipientName: string;
  recipientStreet: string;
  recipientZip: string;
  recipientCity: string;
  recipientCountry?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  productCode: string;
  serviceCodes?: string;
  servicePointId?: string;
  weight: number; // grams
}

function getShipmondoClient(tenant: Tenant): ShipmondoClient {
  if (!tenant.shipmondoApiUser || !tenant.shipmondoApiKey) {
    throw new Error("Shipmondo API credentials not configured. Go to Settings.");
  }
  return new ShipmondoClient({
    apiUser: tenant.shipmondoApiUser,
    apiKey: tenant.shipmondoApiKey,
  });
}

function buildSenderParty(tenant: Tenant): ShipmondoParty {
  if (!tenant.senderName || !tenant.senderStreet || !tenant.senderZip || !tenant.senderCity) {
    throw new Error("Sender address not configured. Go to Settings.");
  }
  return {
    type: "sender",
    name: tenant.senderName,
    address1: tenant.senderStreet,
    postal_code: tenant.senderZip,
    city: tenant.senderCity,
    country_code: tenant.senderCountry,
    phone: tenant.senderPhone || undefined,
    email: tenant.senderEmail || undefined,
  };
}

export async function createShipment(
  tenant: Tenant,
  input: CreateShipmentInput,
): Promise<Shipment> {
  const client = getShipmondoClient(tenant);
  const sender = buildSenderParty(tenant);

  // Create local record first (PENDING)
  const shipment = await prisma.shipment.create({
    data: {
      tenantId: tenant.id,
      productCode: input.productCode,
      shopifyOrderId: input.shopifyOrderId,
      shopifyOrderName: input.shopifyOrderName,
      recipientName: input.recipientName,
      recipientStreet: input.recipientStreet,
      recipientZip: input.recipientZip,
      recipientCity: input.recipientCity,
      recipientCountry: input.recipientCountry || "DK",
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      servicePointId: input.servicePointId,
      weight: input.weight,
    },
  });

  try {
    const result = await client.createShipment({
      own_agreement: false,
      product_code: input.productCode,
      service_codes: input.serviceCodes,
      parties: [
        sender,
        {
          type: "receiver",
          name: input.recipientName,
          address1: input.recipientStreet,
          postal_code: input.recipientZip,
          city: input.recipientCity,
          country_code: input.recipientCountry || "DK",
          phone: input.recipientPhone,
          email: input.recipientEmail,
        },
      ],
      parcels: [{ weight: input.weight }],
      reference: input.shopifyOrderName || shipment.id,
      order_id: input.shopifyOrderId,
    });

    const trackingNumber = result.parcels?.[0]?.pkg_no || result.tracking_codes?.[0];
    const trackingUrl = result.tracking_links?.[0];

    return await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "LABEL_CREATED",
        shipmondoId: result.id,
        carrierCode: result.carrier_code,
        trackingNumber,
        trackingUrl,
        labelBase64: result.label_base64,
      },
    });
  } catch (error) {
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

export async function getShipmentLabel(
  tenant: Tenant,
  shipmentId: string,
  format: "a4_pdf" | "10x19_pdf" | "zpl" = "a4_pdf",
): Promise<string> {
  const shipment = await prisma.shipment.findFirstOrThrow({
    where: { id: shipmentId, tenantId: tenant.id },
  });

  // If we already have the label stored, return it
  if (shipment.labelBase64) {
    return shipment.labelBase64;
  }

  // Otherwise fetch from Shipmondo
  if (!shipment.shipmondoId) {
    throw new Error("No Shipmondo ID for this shipment");
  }

  const client = getShipmondoClient(tenant);
  const labels = await client.getShipmentLabels(shipment.shipmondoId, format);
  return labels.base64;
}

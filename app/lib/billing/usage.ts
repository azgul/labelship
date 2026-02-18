import prisma from "~/db.server";
import type { Tenant } from "@prisma/client";

const PRICE_PER_LABEL_DKK = 2.0;

export async function recordUsageCharge(
  tenant: Tenant,
  shipmentId: string,
  admin: any,
): Promise<boolean> {
  // Check if still within free labels
  if (tenant.freeLabelsUsed < tenant.freeLabelsLimit) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { freeLabelsUsed: { increment: 1 } },
    });

    await prisma.billingRecord.create({
      data: {
        tenantId: tenant.id,
        shipmentId,
        amount: 0,
        currency: "DKK",
        description: `Free label (${tenant.freeLabelsUsed + 1}/${tenant.freeLabelsLimit})`,
      },
    });

    return false;
  }

  if (!tenant.billingActive) {
    console.warn(`Billing not active for tenant ${tenant.id}, cannot charge`);
    return false;
  }

  try {
    const response = await admin.graphql(
      `
      mutation appUsageRecordCreate($subscriptionLineItemId: ID!, $price: MoneyInput!, $description: String!) {
        appUsageRecordCreate(
          subscriptionLineItemId: $subscriptionLineItemId
          price: $price
          description: $description
        ) {
          appUsageRecord { id }
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          subscriptionLineItemId: await getActiveSubscriptionLineItemId(admin),
          price: {
            amount: PRICE_PER_LABEL_DKK.toFixed(2),
            currencyCode: "DKK",
          },
          description: "Shipping label created",
        },
      },
    );

    const data = await response.json();
    const result = data.data?.appUsageRecordCreate;

    if (result?.userErrors?.length > 0) {
      console.error("Usage record errors:", result.userErrors);
      return false;
    }

    await prisma.billingRecord.create({
      data: {
        tenantId: tenant.id,
        shipmentId,
        shopifyUsageRecordId: result?.appUsageRecord?.id,
        amount: PRICE_PER_LABEL_DKK,
        currency: "DKK",
        description: "Shipping label created",
      },
    });

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { billed: true },
    });

    return true;
  } catch (err) {
    console.error("Failed to record usage charge:", err);
    return false;
  }
}

async function getActiveSubscriptionLineItemId(admin: any): Promise<string> {
  const response = await admin.graphql(`
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          lineItems {
            id
            plan {
              pricingDetails {
                __typename
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const subscriptions =
    data.data?.currentAppInstallation?.activeSubscriptions || [];

  for (const sub of subscriptions) {
    for (const lineItem of sub.lineItems) {
      if (
        lineItem.plan?.pricingDetails?.__typename ===
        "AppUsagePricingDetails"
      ) {
        return lineItem.id;
      }
    }
  }

  throw new Error("No active usage-based subscription found");
}

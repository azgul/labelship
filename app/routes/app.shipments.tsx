import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  EmptyState,
  Badge,
  Link,
  BlockStack,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const tenant = await prisma.tenant.findUnique({
    where: { shop: session.shop },
  });

  if (!tenant) {
    return json({ shipments: [] });
  }

  const shipments = await prisma.shipment.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json({
    shipments: shipments.map((s) => ({
      id: s.id,
      orderName: s.shopifyOrderName || "-",
      recipient: `${s.recipientName}, ${s.recipientCity}`,
      carrier: s.carrierCode || "-",
      product: s.productCode || "-",
      trackingNumber: s.trackingNumber || "-",
      trackingUrl: s.trackingUrl,
      status: s.status,
      hasLabel: !!s.labelBase64,
      createdAt: s.createdAt,
    })),
  });
};

const STATUS_BADGE: Record<string, "info" | "success" | "warning" | "critical" | "attention"> = {
  PENDING: "attention",
  LABEL_CREATED: "info",
  IN_TRANSIT: "info",
  DELIVERED: "success",
  CANCELLED: "warning",
  FAILED: "critical",
};

export default function Shipments() {
  const { shipments } = useLoaderData<typeof loader>();

  return (
    <Page title="Shipments" primaryAction={{ content: "Create label", url: "/app/ship" }}>
      <Layout>
        <Layout.Section>
          <Card>
            {shipments.length === 0 ? (
              <EmptyState
                heading="No shipments yet"
                image=""
                action={{ content: "Create your first label", url: "/app/ship" }}
              >
                <p>Your shipping labels will appear here.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Order", "Recipient", "Carrier", "Product", "Tracking", "Status"]}
                rows={shipments.map((s) => [
                  s.orderName,
                  s.recipient,
                  s.carrier,
                  s.product,
                  s.trackingUrl ? (
                    <Link url={s.trackingUrl} target="_blank">{s.trackingNumber}</Link>
                  ) : (
                    s.trackingNumber
                  ),
                  <Badge tone={STATUS_BADGE[s.status] || "info"}>
                    {s.status.replace("_", " ")}
                  </Badge>,
                ])}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

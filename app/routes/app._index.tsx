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
  Text,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const tenant = await prisma.tenant.findUnique({
    where: { shop: session.shop },
  });

  if (!tenant) {
    return json({ shipments: [], stats: { total: 0, thisMonth: 0 } });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [recentShipments, totalCount, monthCount] = await Promise.all([
    prisma.shipment.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.shipment.count({ where: { tenantId: tenant.id } }),
    prisma.shipment.count({
      where: { tenantId: tenant.id, createdAt: { gte: startOfMonth } },
    }),
  ]);

  return json({
    shipments: recentShipments.map((s) => ({
      id: s.id,
      orderName: s.shopifyOrderName || "-",
      recipient: s.recipientName,
      trackingNumber: s.trackingNumber || "-",
      status: s.status,
      createdAt: s.createdAt,
    })),
    stats: { total: totalCount, thisMonth: monthCount },
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

export default function Dashboard() {
  const { shipments, stats } = useLoaderData<typeof loader>();

  return (
    <Page title="Labelship">
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Labels this month</Text>
              <Text as="p" variant="headingXl">{stats.thisMonth}</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Total labels</Text>
              <Text as="p" variant="headingXl">{stats.total}</Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingSm">Recent shipments</Text>
              {shipments.length === 0 ? (
                <EmptyState
                  heading="No shipments yet"
                  image=""
                  action={{ content: "Create label", url: "/app/ship" }}
                >
                  <p>Create your first shipping label to get started.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Order", "Recipient", "Tracking", "Status"]}
                  rows={shipments.map((s) => [
                    s.orderName,
                    s.recipient,
                    s.trackingNumber,
                    <Badge tone={STATUS_BADGE[s.status] || "info"}>{s.status.replace("_", " ")}</Badge>,
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Banner,
  Button,
  BlockStack,
  Text,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const USAGE_CAP_DKK = 500;
const PRICE_PER_LABEL_DKK = 2.0;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const tenant = await prisma.tenant.findUnique({
    where: { shop: session.shop },
  });

  if (!tenant) {
    return json({
      billingActive: false,
      freeLabelsUsed: 0,
      freeLabelsLimit: 10,
      records: [],
    });
  }

  const records = await prisma.billingRecord.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json({
    billingActive: tenant.billingActive,
    freeLabelsUsed: tenant.freeLabelsUsed,
    freeLabelsLimit: tenant.freeLabelsLimit,
    records: records.map((r) => ({
      description: r.description,
      amount: Number(r.amount),
      currency: r.currency,
      createdAt: r.createdAt,
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Create a usage-based subscription
  const response = await admin.graphql(
    `
    mutation appSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!) {
      appSubscriptionCreate(
        name: $name
        lineItems: $lineItems
        returnUrl: $returnUrl
        test: true
      ) {
        appSubscription { id }
        confirmationUrl
        userErrors { field message }
      }
    }
  `,
    {
      variables: {
        name: "Labelship - Pay per label",
        lineItems: [
          {
            plan: {
              appUsagePricingDetails: {
                terms: `${PRICE_PER_LABEL_DKK.toFixed(2)} DKK per shipping label. First ${10} labels free.`,
                cappedAmount: {
                  amount: USAGE_CAP_DKK.toFixed(2),
                  currencyCode: "DKK",
                },
              },
            },
          },
        ],
        returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing?activated=true`,
      },
    },
  );

  const data = await response.json();
  const result = data.data?.appSubscriptionCreate;

  if (result?.userErrors?.length > 0) {
    return json({ error: result.userErrors[0].message }, { status: 400 });
  }

  // Mark billing as active
  await prisma.tenant.update({
    where: { shop: session.shop },
    data: { billingActive: true },
  });

  // Redirect merchant to Shopify's confirmation page
  return redirect(result.confirmationUrl);
};

export default function Billing() {
  const { billingActive, freeLabelsUsed, freeLabelsLimit, records } =
    useLoaderData<typeof loader>();

  return (
    <Page title="Billing" backAction={{ url: "/app" }}>
      <BlockStack gap="400">
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">Free labels</Text>
                <Text as="p" variant="headingXl">
                  {freeLabelsUsed} / {freeLabelsLimit}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  After free labels, each label costs {PRICE_PER_LABEL_DKK.toFixed(2)} DKK
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">Billing status</Text>
                {billingActive ? (
                  <Banner tone="success">
                    <p>Usage billing is active.</p>
                  </Banner>
                ) : (
                  <BlockStack gap="200">
                    <Banner tone="warning">
                      <p>
                        Billing is not active. You need to activate billing to
                        create labels beyond the free tier.
                      </p>
                    </Banner>
                    <form method="post">
                      <Button variant="primary" submit>
                        Activate billing
                      </Button>
                    </form>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {records.length > 0 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">Billing history</Text>
                  <DataTable
                    columnContentTypes={["text", "numeric", "text"]}
                    headings={["Description", "Amount", "Currency"]}
                    rows={records.map((r) => [
                      r.description,
                      r.amount.toFixed(2),
                      r.currency,
                    ])}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>
    </Page>
  );
}

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  BlockStack,
  Text,
} from "@shopify/polaris";
import { useState } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createShipment } from "~/lib/shipments/service";
import { ShipmondoClient } from "~/lib/shipmondo/client";
import { recordUsageCharge } from "~/lib/billing/usage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const tenant = await prisma.tenant.findUnique({
    where: { shop: session.shop },
  });

  if (!tenant) {
    return json({ products: [], configured: false });
  }

  const hasSender = !!(tenant.senderName && tenant.senderStreet && tenant.senderZip && tenant.senderCity);
  const hasApi = !!(tenant.shipmondoApiUser && tenant.shipmondoApiKey);

  let products: Array<{ code: string; name: string; carrier: string }> = [];

  if (hasApi) {
    try {
      const client = new ShipmondoClient({
        apiUser: tenant.shipmondoApiUser!,
        apiKey: tenant.shipmondoApiKey!,
      });
      const shipmondoProducts = await client.getProducts({ country_code: "DK" });
      products = shipmondoProducts.map((p) => ({
        code: p.code,
        name: `${p.carrier_name} - ${p.name}`,
        carrier: p.carrier_code,
      }));
    } catch {
      // API credentials may be invalid
    }
  }

  return json({
    products,
    configured: hasSender && hasApi,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { shop: session.shop },
  });

  try {
    const shipment = await createShipment(tenant, {
      shopifyOrderId: (formData.get("shopifyOrderId") as string) || undefined,
      shopifyOrderName: (formData.get("shopifyOrderName") as string) || undefined,
      recipientName: formData.get("recipientName") as string,
      recipientStreet: formData.get("recipientStreet") as string,
      recipientZip: formData.get("recipientZip") as string,
      recipientCity: formData.get("recipientCity") as string,
      recipientCountry: (formData.get("recipientCountry") as string) || "DK",
      recipientPhone: (formData.get("recipientPhone") as string) || undefined,
      recipientEmail: (formData.get("recipientEmail") as string) || undefined,
      productCode: formData.get("productCode") as string,
      servicePointId: (formData.get("servicePointId") as string) || undefined,
      weight: parseInt(formData.get("weight") as string, 10) || 1000,
    });

    await recordUsageCharge(tenant, shipment.id, admin);

    return redirect(`/app/shipments`);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Failed to create label" },
      { status: 400 },
    );
  }
};

export default function Ship() {
  const { products, configured } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [productCode, setProductCode] = useState(products[0]?.code || "");

  if (!configured) {
    return (
      <Page title="Create Label" backAction={{ url: "/app" }}>
        <Banner tone="warning">
          <p>
            Please configure your sender address and Shipmondo API credentials in{" "}
            <a href="/app/settings">Settings</a> before creating labels.
          </p>
        </Banner>
      </Page>
    );
  }

  return (
    <Page title="Create Label" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section>
          {actionData && "error" in actionData && (
            <Banner tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}

          <form method="post" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">Recipient</Text>
                  <FormLayout>
                    <TextField label="Name" name="recipientName" autoComplete="off" requiredIndicator />
                    <TextField label="Street" name="recipientStreet" autoComplete="off" requiredIndicator />
                    <FormLayout.Group>
                      <TextField label="ZIP" name="recipientZip" autoComplete="off" requiredIndicator />
                      <TextField label="City" name="recipientCity" autoComplete="off" requiredIndicator />
                    </FormLayout.Group>
                    <FormLayout.Group>
                      <TextField label="Country" name="recipientCountry" autoComplete="off" value="DK" />
                      <TextField label="Phone" name="recipientPhone" autoComplete="off" />
                    </FormLayout.Group>
                    <TextField label="Email" name="recipientEmail" autoComplete="off" />
                  </FormLayout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingSm">Shipping</Text>
                  <FormLayout>
                    <TextField
                      label="Weight (grams)"
                      name="weight"
                      type="number"
                      autoComplete="off"
                      value="1000"
                    />
                    <Select
                      label="Product"
                      name="productCode"
                      options={products.map((p) => ({ label: p.name, value: p.code }))}
                      value={productCode}
                      onChange={setProductCode}
                    />
                    <TextField label="Service Point ID (if pickup point delivery)" name="servicePointId" autoComplete="off" />
                  </FormLayout>
                </BlockStack>
              </Card>

              <input type="hidden" name="productCode" value={productCode} />

              <Button variant="primary" submit loading={isSubmitting}>
                Create Label
              </Button>
            </BlockStack>
          </form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

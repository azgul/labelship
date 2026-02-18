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
import { getCarrierAdapter } from "~/lib/carriers/registry";
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
  const hasCarrier = !!(tenant.glsCustomerId && tenant.glsApiUsername && tenant.glsApiPassword);

  let products: Array<{ code: string; name: string; requiresParcelShop: boolean }> = [];

  if (hasCarrier) {
    try {
      const adapter = await getCarrierAdapter(tenant.defaultCarrier, {
        customerId: tenant.glsCustomerId || undefined,
        apiUsername: tenant.glsApiUsername || undefined,
        apiPassword: tenant.glsApiPassword || undefined,
      });
      products = adapter.getProducts();
    } catch {
      // Carrier not configured properly
    }
  }

  return json({
    products,
    configured: hasSender && hasCarrier,
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
      shopifyOrderId: formData.get("shopifyOrderId") as string || undefined,
      shopifyOrderName: formData.get("shopifyOrderName") as string || undefined,
      recipient: {
        name: formData.get("recipientName") as string,
        street: formData.get("recipientStreet") as string,
        zip: formData.get("recipientZip") as string,
        city: formData.get("recipientCity") as string,
        country: (formData.get("recipientCountry") as string) || "DK",
        phone: formData.get("recipientPhone") as string || undefined,
        email: formData.get("recipientEmail") as string || undefined,
      },
      parcels: [
        {
          weight: parseFloat(formData.get("weight") as string) || 1,
        },
      ],
      product: formData.get("product") as string,
      parcelShopId: formData.get("parcelShopId") as string || undefined,
    });

    // Bill for the label
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

  const [product, setProduct] = useState(products[0]?.code || "PARCEL");

  if (!configured) {
    return (
      <Page title="Create Label" backAction={{ url: "/app" }}>
        <Banner tone="warning">
          <p>
            Please configure your sender address and GLS credentials in{" "}
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
                  <Text as="h2" variant="headingSm">Parcel</Text>
                  <FormLayout>
                    <TextField label="Weight (kg)" name="weight" type="number" autoComplete="off" value="1" />
                    <Select
                      label="Shipping product"
                      name="product"
                      options={products.map((p) => ({ label: p.name, value: p.code }))}
                      value={product}
                      onChange={setProduct}
                    />
                    {products.find((p) => p.code === product)?.requiresParcelShop && (
                      <TextField label="Parcel Shop ID" name="parcelShopId" autoComplete="off" requiredIndicator />
                    )}
                  </FormLayout>
                </BlockStack>
              </Card>

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

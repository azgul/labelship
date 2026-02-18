import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  let tenant = await prisma.tenant.findUnique({
    where: { shop: session.shop },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { shop: session.shop },
    });
  }

  return json({
    senderName: tenant.senderName || "",
    senderStreet: tenant.senderStreet || "",
    senderZip: tenant.senderZip || "",
    senderCity: tenant.senderCity || "",
    senderCountry: tenant.senderCountry,
    senderPhone: tenant.senderPhone || "",
    senderEmail: tenant.senderEmail || "",
    shipmondoApiUser: tenant.shipmondoApiUser || "",
    hasShipmondoApiKey: !!tenant.shipmondoApiKey,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const data: Record<string, string | undefined> = {
    senderName: formData.get("senderName") as string,
    senderStreet: formData.get("senderStreet") as string,
    senderZip: formData.get("senderZip") as string,
    senderCity: formData.get("senderCity") as string,
    senderCountry: formData.get("senderCountry") as string,
    senderPhone: formData.get("senderPhone") as string,
    senderEmail: formData.get("senderEmail") as string,
    shipmondoApiUser: formData.get("shipmondoApiUser") as string,
  };

  const apiKey = formData.get("shipmondoApiKey") as string;
  if (apiKey) {
    data.shipmondoApiKey = apiKey;
  }

  await prisma.tenant.update({
    where: { shop: session.shop },
    data,
  });

  return json({ success: true });
};

export default function Settings() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [form, setForm] = useState({
    senderName: loaderData.senderName,
    senderStreet: loaderData.senderStreet,
    senderZip: loaderData.senderZip,
    senderCity: loaderData.senderCity,
    senderCountry: loaderData.senderCountry,
    senderPhone: loaderData.senderPhone,
    senderEmail: loaderData.senderEmail,
    shipmondoApiUser: loaderData.shipmondoApiUser,
    shipmondoApiKey: "",
  });

  const handleChange = useCallback(
    (field: keyof typeof form) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(form)) {
      formData.set(key, value);
    }
    submit(formData, { method: "post" });
  }, [form, submit]);

  return (
    <Page title="Settings" backAction={{ url: "/app" }}>
      <BlockStack gap="400">
        {actionData && "success" in actionData && (
          <Banner tone="success" onDismiss={() => {}}>
            <p>Settings saved.</p>
          </Banner>
        )}

        <Layout>
          <Layout.AnnotatedSection
            title="Sender address"
            description="Your return address printed on every label."
          >
            <Card>
              <FormLayout>
                <TextField label="Company / Name" name="senderName" autoComplete="off" value={form.senderName} onChange={handleChange("senderName")} />
                <TextField label="Street" name="senderStreet" autoComplete="off" value={form.senderStreet} onChange={handleChange("senderStreet")} />
                <FormLayout.Group>
                  <TextField label="ZIP" name="senderZip" autoComplete="off" value={form.senderZip} onChange={handleChange("senderZip")} />
                  <TextField label="City" name="senderCity" autoComplete="off" value={form.senderCity} onChange={handleChange("senderCity")} />
                </FormLayout.Group>
                <TextField label="Country" name="senderCountry" autoComplete="off" value={form.senderCountry} onChange={handleChange("senderCountry")} />
                <FormLayout.Group>
                  <TextField label="Phone" name="senderPhone" autoComplete="off" value={form.senderPhone} onChange={handleChange("senderPhone")} />
                  <TextField label="Email" name="senderEmail" autoComplete="off" value={form.senderEmail} onChange={handleChange("senderEmail")} />
                </FormLayout.Group>
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Shipmondo API"
            description="Get your API credentials from Shipmondo: Settings > API > Access. A free Shipmondo account is all you need."
          >
            <Card>
              <FormLayout>
                <TextField label="API User" name="shipmondoApiUser" autoComplete="off" value={form.shipmondoApiUser} onChange={handleChange("shipmondoApiUser")} />
                <TextField
                  label="API Key"
                  name="shipmondoApiKey"
                  type="password"
                  autoComplete="off"
                  value={form.shipmondoApiKey}
                  onChange={handleChange("shipmondoApiKey")}
                  placeholder={loaderData.hasShipmondoApiKey ? "Leave blank to keep current" : ""}
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>

        <Button variant="primary" onClick={handleSubmit} loading={isSaving}>
          Save settings
        </Button>
      </BlockStack>
    </Page>
  );
}

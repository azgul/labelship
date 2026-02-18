/**
 * Test script for the Shipmondo API client against the sandbox.
 *
 * Usage:
 *   SHIPMONDO_API_USER=xxx SHIPMONDO_API_KEY=yyy npx tsx scripts/test-shipmondo.ts
 *
 * Request sandbox access: email support with your name, email, and reason.
 * Sandbox login: https://sandbox.shipmondo.com/account/login/
 * API credentials: Settings > API > Access in the sandbox dashboard.
 */

import { ShipmondoClient } from "../app/lib/shipmondo/client";

const apiUser = process.env.SHIPMONDO_API_USER;
const apiKey = process.env.SHIPMONDO_API_KEY;

if (!apiUser || !apiKey) {
  console.error("Missing SHIPMONDO_API_USER or SHIPMONDO_API_KEY env vars");
  console.error("Usage: SHIPMONDO_API_USER=xxx SHIPMONDO_API_KEY=yyy npx tsx scripts/test-shipmondo.ts");
  process.exit(1);
}

const client = new ShipmondoClient({ apiUser, apiKey, sandbox: true });

async function section(name: string, fn: () => Promise<void>) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${name}`);
  console.log("=".repeat(60));
  try {
    await fn();
    console.log(`\n  ✓ ${name} passed`);
  } catch (err) {
    console.error(`\n  ✗ ${name} FAILED:`);
    console.error(err instanceof Error ? `  ${err.message}` : err);
  }
}

async function main() {
  // 1. Test account balance
  await section("Account Balance", async () => {
    const balance = await client.getBalance();
    console.log(`  Balance: ${balance.amount} ${balance.currency}`);
  });

  // 2. List available products for DK
  let productCode = "GLSDK_HD"; // fallback
  await section("List Products (DK)", async () => {
    const products = await client.getProducts({ country_code: "DK" });
    console.log(`  Found ${products.length} products:`);
    for (const p of products.slice(0, 10)) {
      console.log(`    ${p.code} - ${p.carrier_name} ${p.name}`);
    }
    if (products.length > 10) {
      console.log(`    ... and ${products.length - 10} more`);
    }
    // Use the first GLS product if available
    const glsProduct = products.find((p) => p.carrier_code === "gls");
    if (glsProduct) {
      productCode = glsProduct.code;
      console.log(`  Using product: ${productCode}`);
    }
  });

  // 3. Find GLS pickup points near 5000 Odense
  await section("Find Pickup Points (GLS, 5000)", async () => {
    const points = await client.getPickupPoints({
      carrier_code: "gls",
      country_code: "DK",
      zipcode: "5000",
    });
    console.log(`  Found ${points.length} pickup points:`);
    for (const p of points.slice(0, 5)) {
      console.log(`    ${p.id} - ${p.company_name}, ${p.address}, ${p.zipcode} ${p.city} (${p.distance}m)`);
    }
  });

  // 4. Create a test shipment
  let shipmondoId: number | undefined;
  let trackingNumber: string | undefined;
  await section("Create Shipment", async () => {
    const shipment = await client.createShipment({
      own_agreement: false,
      product_code: productCode,
      service_codes: "EMAIL_NT",
      parties: [
        {
          type: "sender",
          name: "Labelship Test",
          address1: "Hvilehøjvej 25",
          postal_code: "5220",
          city: "Odense SØ",
          country_code: "DK",
          email: "test@labelship.dk",
          phone: "12345678",
        },
        {
          type: "receiver",
          name: "Test Modtager",
          address1: "Vindegade 112",
          postal_code: "5000",
          city: "Odense C",
          country_code: "DK",
          email: "modtager@test.dk",
          phone: "87654321",
        },
      ],
      parcels: [{ weight: 1000 }],
      reference: "TEST-001",
    });

    shipmondoId = shipment.id;
    console.log(`  Shipment ID: ${shipment.id}`);
    console.log(`  Carrier: ${shipment.carrier_code}`);
    console.log(`  Product: ${shipment.product_code}`);

    if (shipment.parcels?.length) {
      trackingNumber = shipment.parcels[0].pkg_no;
      console.log(`  Parcel number: ${trackingNumber}`);
    }
    if (shipment.tracking_links?.length) {
      console.log(`  Tracking URL: ${shipment.tracking_links[0]}`);
    }

    if (shipment.label_base64) {
      const labelSize = Math.round(shipment.label_base64.length * 0.75 / 1024);
      console.log(`  Label PDF: ${labelSize} KB (base64 included in response)`);

      // Write label to file for manual inspection
      const fs = await import("fs");
      const labelBuffer = Buffer.from(shipment.label_base64, "base64");
      fs.writeFileSync("scripts/test-label.pdf", labelBuffer);
      console.log(`  Label saved to: scripts/test-label.pdf`);
    } else {
      console.log("  No label_base64 in response — will try GET /labels endpoint");
    }
  });

  // 5. Fetch label via separate endpoint (if not included in create response)
  if (shipmondoId) {
    await section("Get Shipment Labels", async () => {
      const labels = await client.getShipmentLabels(shipmondoId!, "a4_pdf");
      const labelSize = Math.round(labels.base64.length * 0.75 / 1024);
      console.log(`  Label format: ${labels.file_format}`);
      console.log(`  Label size: ${labelSize} KB`);

      const fs = await import("fs");
      const labelBuffer = Buffer.from(labels.base64, "base64");
      fs.writeFileSync("scripts/test-label-from-endpoint.pdf", labelBuffer);
      console.log(`  Label saved to: scripts/test-label-from-endpoint.pdf`);
    });
  }

  // 6. Get shipment details
  if (shipmondoId) {
    await section("Get Shipment Details", async () => {
      const shipment = await client.getShipment(shipmondoId!);
      console.log(`  ID: ${shipment.id}`);
      console.log(`  Carrier: ${shipment.carrier_code}`);
      console.log(`  Product: ${shipment.product_code}`);
      console.log(`  Created: ${shipment.created_at}`);
      console.log(`  Parcels: ${shipment.parcels?.length || 0}`);
    });
  }

  // 7. List recent shipments
  await section("List Shipments", async () => {
    const shipments = await client.listShipments({ per_page: 5 });
    console.log(`  Found ${shipments.length} shipments:`);
    for (const s of shipments) {
      console.log(`    #${s.id} - ${s.carrier_code} ${s.product_code} - ${s.reference || "no ref"}`);
    }
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log("  All tests complete!");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

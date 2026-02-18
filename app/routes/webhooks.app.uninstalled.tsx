import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const tenant = await prisma.tenant.findUnique({
    where: { shop },
  });

  if (tenant) {
    await prisma.billingRecord.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.shipment.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }

  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }

  return new Response(null, { status: 200 });
};

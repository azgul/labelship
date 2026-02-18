import type { CarrierAdapter } from "./types";
import type { CarrierCode } from "@prisma/client";

export interface CarrierCredentials {
  customerId?: string;
  apiUsername?: string;
  apiPassword?: string;
  apiUrl?: string;
}

const adapters: Record<
  CarrierCode,
  (creds: CarrierCredentials) => Promise<CarrierAdapter>
> = {
  GLS: async (creds) => {
    const { GlsAdapter } = await import("./gls/adapter");
    return new GlsAdapter(creds);
  },
  POSTNORD: async () => {
    throw new Error("PostNord adapter not yet implemented");
  },
  DAO: async () => {
    throw new Error("DAO adapter not yet implemented");
  },
  BRING: async () => {
    throw new Error("Bring adapter not yet implemented");
  },
};

export async function getCarrierAdapter(
  carrier: CarrierCode,
  credentials: CarrierCredentials,
): Promise<CarrierAdapter> {
  const factory = adapters[carrier];
  if (!factory) {
    throw new Error(`Unknown carrier: ${carrier}`);
  }
  return factory(credentials);
}

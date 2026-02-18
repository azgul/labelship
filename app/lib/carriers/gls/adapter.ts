import type { CarrierCode } from "@prisma/client";
import type {
  CarrierAdapter,
  CarrierProduct,
  ParcelShop,
  ShipmentRequest,
  ShipmentResult,
  TrackingResult,
} from "../types";
import type { CarrierCredentials } from "../registry";
import { GlsApiClient } from "./client";
import {
  toGlsShipmentRequest,
  fromGlsShipmentResponse,
  fromGlsTrackingResponse,
  fromGlsParcelShopsResponse,
} from "./mapper";

const GLS_PRODUCTS: CarrierProduct[] = [
  {
    code: "PARCEL",
    name: "GLS Business Parcel",
    description: "Standard business parcel delivery",
    requiresParcelShop: false,
  },
  {
    code: "SHOP_DELIVERY",
    name: "GLS Pakkeshop",
    description: "Delivery to a GLS parcel shop for pickup",
    requiresParcelShop: true,
  },
  {
    code: "EXPRESS",
    name: "GLS Express",
    description: "Next-day express delivery",
    requiresParcelShop: false,
  },
  {
    code: "PRIVATE",
    name: "GLS Private Delivery",
    description: "Delivery to private address with SMS notification",
    requiresParcelShop: false,
  },
];

export class GlsAdapter implements CarrierAdapter {
  readonly code: CarrierCode = "GLS";
  private client: GlsApiClient;
  private customerId: string;

  constructor(credentials: CarrierCredentials) {
    this.client = new GlsApiClient(credentials);
    this.customerId = credentials.customerId!;
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentResult> {
    const glsRequest = toGlsShipmentRequest(
      this.customerId,
      request.sender,
      request.recipient,
      request.parcels,
      request.product,
      request.parcelShopId,
      request.reference,
    );

    const response = await this.client.createShipment(glsRequest);
    return fromGlsShipmentResponse(response);
  }

  async cancelShipment(carrierRef: string): Promise<void> {
    await this.client.cancelShipment(carrierRef);
  }

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    const response = await this.client.getTracking(trackingNumber);
    return fromGlsTrackingResponse(trackingNumber, response);
  }

  getProducts(): CarrierProduct[] {
    return GLS_PRODUCTS;
  }

  async findParcelShops(
    zip: string,
    country: string = "DK",
  ): Promise<ParcelShop[]> {
    const response = await this.client.findParcelShops(zip, country);
    return fromGlsParcelShopsResponse(response);
  }
}

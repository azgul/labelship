import type { CarrierCode } from "@prisma/client";

export interface Address {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface Parcel {
  weight: number; // kg
  length?: number; // cm
  width?: number; // cm
  height?: number; // cm
  reference?: string;
}

export interface ShipmentRequest {
  sender: Address;
  recipient: Address;
  parcels: Parcel[];
  product: string; // carrier-specific product code (e.g. "PARCEL", "SHOP_DELIVERY")
  parcelShopId?: string; // for pickup point delivery
  reference?: string;
}

export interface ShipmentResult {
  carrierRef: string;
  trackingNumber: string;
  trackingUrl: string;
  labelPdf: Buffer;
}

export interface TrackingEvent {
  timestamp: Date;
  status: string;
  description: string;
  location?: string;
}

export interface TrackingResult {
  trackingNumber: string;
  delivered: boolean;
  events: TrackingEvent[];
}

export interface CarrierProduct {
  code: string;
  name: string;
  description: string;
  requiresParcelShop: boolean;
}

export interface ParcelShop {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  distance?: number; // meters
}

export interface CarrierAdapter {
  readonly code: CarrierCode;

  /** Create a shipment and return the label PDF + tracking info. */
  createShipment(request: ShipmentRequest): Promise<ShipmentResult>;

  /** Cancel a previously created shipment. */
  cancelShipment(carrierRef: string): Promise<void>;

  /** Get tracking events for a shipment. */
  getTracking(trackingNumber: string): Promise<TrackingResult>;

  /** List available shipping products. */
  getProducts(): CarrierProduct[];

  /** Find nearby parcel shops / pickup points. */
  findParcelShops(zip: string, country?: string): Promise<ParcelShop[]>;
}

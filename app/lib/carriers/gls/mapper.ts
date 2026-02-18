import type { Address, Parcel } from "../types";
import type {
  GlsAddress,
  GlsParcel,
  GlsCreateShipmentRequest,
  GlsCreateShipmentResponse,
  GlsTrackingResponse,
  GlsParcelShopResponse,
} from "./types";
import type {
  ShipmentResult,
  TrackingResult,
  ParcelShop,
} from "../types";

export function toGlsAddress(address: Address): GlsAddress {
  return {
    Name1: address.name,
    Street1: address.street,
    ZipCode: address.zip,
    City: address.city,
    CountryCode: address.country,
    ContactPhone: address.phone,
    ContactEmail: address.email,
  };
}

export function toGlsParcel(parcel: Parcel, product: string, parcelShopId?: string): GlsParcel {
  const services = [];

  if (product === "SHOP_DELIVERY" && parcelShopId) {
    services.push({
      ServiceName: "ShopDeliveryService",
      ParcelShopId: parcelShopId,
    });
  }

  return {
    Weight: Math.round(parcel.weight * 1000), // kg → grams
    Reference: parcel.reference,
    ...(services.length > 0 ? { Services: services } : {}),
  };
}

export function toGlsShipmentRequest(
  customerId: string,
  sender: Address,
  recipient: Address,
  parcels: Parcel[],
  product: string,
  parcelShopId?: string,
  reference?: string,
): GlsCreateShipmentRequest {
  const today = new Date();
  const shipmentDate = today.toISOString().slice(0, 10).replace(/-/g, "");

  return {
    Customerid: customerId,
    Shipmentdate: shipmentDate,
    Reference: reference,
    Addresses: {
      Delivery: toGlsAddress(recipient),
    },
    Parcels: parcels.map((p) => toGlsParcel(p, product, parcelShopId)),
  };
}

export function fromGlsShipmentResponse(
  response: GlsCreateShipmentResponse,
): ShipmentResult {
  const firstParcel = response.Parcels[0];
  return {
    carrierRef: response.ConsignmentId,
    trackingNumber: firstParcel.ParcelNumber,
    trackingUrl: firstParcel.TrackUrl,
    labelPdf: Buffer.from(response.PdfData, "base64"),
  };
}

export function fromGlsTrackingResponse(
  trackingNumber: string,
  response: GlsTrackingResponse,
): TrackingResult {
  const events = (response.Events || []).map((e) => ({
    timestamp: new Date(`${e.EventDate}T${e.EventTime}`),
    status: e.StatusCode,
    description: e.EventDescription,
    location: e.EventLocation,
  }));

  const delivered = events.some(
    (e) => e.status === "DELIVERED" || e.status === "FINAL_DELIVERY",
  );

  return { trackingNumber, delivered, events };
}

export function fromGlsParcelShopsResponse(
  response: GlsParcelShopResponse,
): ParcelShop[] {
  return (response.ParcelShops || []).map((ps) => ({
    id: ps.ParcelShopId,
    name: ps.CompanyName,
    street: ps.Streetname,
    zip: ps.ZipCode,
    city: ps.CityName,
    country: ps.CountryCode,
    distance: ps.DistanceMeters,
  }));
}

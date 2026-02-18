// GLS ShipIT API request/response types
// These will be fleshed out once we have API documentation and credentials.

export interface GlsCreateShipmentRequest {
  Customerid: string;
  Contactid?: string;
  Shipmentdate: string; // YYYYMMDD
  Reference?: string;
  Addresses: {
    AlternativeShipper?: GlsAddress;
    Delivery: GlsAddress;
  };
  Parcels: GlsParcel[];
}

export interface GlsAddress {
  Name1: string;
  Name2?: string;
  Street1: string;
  Street2?: string;
  ZipCode: string;
  City: string;
  CountryCode: string;
  ContactPhone?: string;
  ContactEmail?: string;
}

export interface GlsParcel {
  Weight: number; // grams
  Reference?: string;
  Services?: GlsService[];
}

export interface GlsService {
  ServiceName: string;
  ParcelShopId?: string;
}

export interface GlsCreateShipmentResponse {
  Parcels: Array<{
    ParcelNumber: string;
    TrackUrl: string;
  }>;
  ConsignmentId: string;
  PdfData: string; // base64 encoded PDF
}

export interface GlsTrackingResponse {
  Events: Array<{
    EventDate: string;
    EventTime: string;
    EventDescription: string;
    EventLocation?: string;
    StatusCode: string;
  }>;
}

export interface GlsParcelShopResponse {
  ParcelShops: Array<{
    ParcelShopId: string;
    CompanyName: string;
    Streetname: string;
    ZipCode: string;
    CityName: string;
    CountryCode: string;
    DistanceMeters?: number;
  }>;
}

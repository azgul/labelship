// Shipmondo REST API v3 types

export interface ShipmondoParty {
  type: "sender" | "receiver";
  name: string;
  attention?: string;
  address1: string;
  address2?: string;
  postal_code: string;
  city: string;
  country_code: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

export interface ShipmondoParcel {
  weight: number; // grams
  length?: number; // cm
  width?: number; // cm
  height?: number; // cm
  quantity?: number;
  internal_reference?: string;
}

export interface ShipmondoCreateShipmentRequest {
  own_agreement: boolean;
  product_code: string;
  service_codes?: string;
  parties: ShipmondoParty[];
  parcels: ShipmondoParcel[];
  reference?: string;
  order_id?: string;
  print?: false; // we never print via their Print Client
}

export interface ShipmondoShipmentParcel {
  pkg_no: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  internal_reference?: string;
}

export interface ShipmondoShipment {
  id: number;
  carrier_code: string;
  product_code: string;
  service_codes: string;
  reference?: string;
  order_id?: string;
  created_at: string;
  updated_at: string;
  label_base64?: string;
  parcels: ShipmondoShipmentParcel[];
  parties: ShipmondoParty[];
  tracking_codes?: string[];
  tracking_links?: string[];
}

export interface ShipmondoProduct {
  code: string;
  name: string;
  carrier_code: string;
  carrier_name: string;
  country_code: string;
  requires_service_point?: boolean;
  available_service_codes?: string[];
}

export interface ShipmondoPickupPoint {
  number: string;
  id: string;
  company_name: string;
  name: string;
  address: string;
  address2?: string;
  zipcode: string;
  city: string;
  country: string;
  distance?: number;
  longitude?: number;
  latitude?: number;
  carrier_code: string;
  opening_hours?: Record<string, string>;
}

export interface ShipmondoLabelsResponse {
  base64: string;
  file_format: string;
}

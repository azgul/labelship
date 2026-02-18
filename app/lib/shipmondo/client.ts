import type {
  ShipmondoCreateShipmentRequest,
  ShipmondoShipment,
  ShipmondoProduct,
  ShipmondoPickupPoint,
  ShipmondoLabelsResponse,
} from "./types";

const BASE_URL = "https://app.shipmondo.com/api/public/v3";
const SANDBOX_URL = "https://sandbox.shipmondo.com/api/public/v3";

export interface ShipmondoCredentials {
  apiUser: string;
  apiKey: string;
  sandbox?: boolean;
}

export class ShipmondoClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(credentials: ShipmondoCredentials) {
    this.baseUrl = credentials.sandbox ? SANDBOX_URL : BASE_URL;
    this.authHeader = `Basic ${Buffer.from(`${credentials.apiUser}:${credentials.apiKey}`).toString("base64")}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shipmondo API ${response.status}: ${text}`);
    }

    return response.json();
  }

  /** Create a shipment. Returns the shipment with label_base64 included. */
  async createShipment(
    req: ShipmondoCreateShipmentRequest,
  ): Promise<ShipmondoShipment> {
    return this.request<ShipmondoShipment>("POST", "/shipments", {
      ...req,
      print: false, // never trigger their Print Client
    });
  }

  /** Get a single shipment by ID. */
  async getShipment(id: number): Promise<ShipmondoShipment> {
    return this.request<ShipmondoShipment>("GET", `/shipments/${id}`);
  }

  /** List shipments with optional pagination. */
  async listShipments(params?: {
    page?: number;
    per_page?: number;
    order_id?: string;
  }): Promise<ShipmondoShipment[]> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.per_page) queryParams.per_page = String(params.per_page);
    if (params?.order_id) queryParams.order_id = params.order_id;
    return this.request<ShipmondoShipment[]>("GET", "/shipments", undefined, queryParams);
  }

  /** Get label PDF as base64 for a shipment. */
  async getShipmentLabels(
    shipmentId: number,
    format: "a4_pdf" | "10x19_pdf" | "zpl" = "a4_pdf",
  ): Promise<ShipmondoLabelsResponse> {
    return this.request<ShipmondoLabelsResponse>(
      "GET",
      `/shipments/${shipmentId}/labels`,
      undefined,
      { label_format: format },
    );
  }

  /** List available shipping products for a country/carrier. */
  async getProducts(params?: {
    country_code?: string;
    carrier_code?: string;
  }): Promise<ShipmondoProduct[]> {
    const queryParams: Record<string, string> = {};
    if (params?.country_code) queryParams.country_code = params.country_code;
    if (params?.carrier_code) queryParams.carrier_code = params.carrier_code;
    return this.request<ShipmondoProduct[]>("GET", "/products", undefined, queryParams);
  }

  /** Find nearby pickup points / service points. */
  async getPickupPoints(params: {
    carrier_code: string;
    country_code: string;
    zipcode: string;
    address?: string;
  }): Promise<ShipmondoPickupPoint[]> {
    return this.request<ShipmondoPickupPoint[]>(
      "GET",
      "/pickup_points",
      undefined,
      params as Record<string, string>,
    );
  }

  /** Get account balance. */
  async getBalance(): Promise<{ amount: number; currency: string }> {
    return this.request("GET", "/account/balance");
  }
}

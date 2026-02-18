import type { CarrierCredentials } from "../registry";
import type {
  GlsCreateShipmentRequest,
  GlsCreateShipmentResponse,
  GlsTrackingResponse,
  GlsParcelShopResponse,
} from "./types";

const DEFAULT_API_URL = "https://api.gls.dk";

export class GlsApiClient {
  private baseUrl: string;
  private customerId: string;
  private username: string;
  private password: string;

  constructor(credentials: CarrierCredentials) {
    if (!credentials.customerId || !credentials.apiUsername || !credentials.apiPassword) {
      throw new Error("GLS requires customerId, apiUsername, and apiPassword");
    }
    this.baseUrl = credentials.apiUrl || DEFAULT_API_URL;
    this.customerId = credentials.customerId;
    this.username = credentials.apiUsername;
    this.password = credentials.apiPassword;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString("base64")}`;
  }

  async createShipment(
    request: GlsCreateShipmentRequest,
  ): Promise<GlsCreateShipmentResponse> {
    const response = await fetch(`${this.baseUrl}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GLS API error ${response.status}: ${body}`);
    }

    return response.json();
  }

  async cancelShipment(consignmentId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/shipments/${consignmentId}`,
      {
        method: "DELETE",
        headers: { Authorization: this.authHeader },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GLS cancel error ${response.status}: ${body}`);
    }
  }

  async getTracking(parcelNumber: string): Promise<GlsTrackingResponse> {
    const response = await fetch(
      `${this.baseUrl}/tracking/${parcelNumber}`,
      {
        headers: { Authorization: this.authHeader },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GLS tracking error ${response.status}: ${body}`);
    }

    return response.json();
  }

  async findParcelShops(
    zip: string,
    countryCode: string = "DK",
  ): Promise<GlsParcelShopResponse> {
    const params = new URLSearchParams({
      zipcode: zip,
      countrycode: countryCode,
    });

    const response = await fetch(
      `${this.baseUrl}/parcelshops?${params}`,
      {
        headers: { Authorization: this.authHeader },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GLS parcelshop error ${response.status}: ${body}`);
    }

    return response.json();
  }
}

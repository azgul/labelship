# Labelship - Shopify Shipping Label App

## Overview
Shopify embedded app for buying and printing shipping labels via the Shipmondo API.
Pay-per-label pricing (2 DKK/label), no monthly fee. First 10 labels free.

Each user brings their own free Shipmondo account — we use the Shipmondo REST API v3
to create shipments and fetch label PDFs. This avoids needing direct carrier agreements.

## Tech Stack
- Framework: Shopify Remix (Remix + Polaris UI)
- Database: PostgreSQL + Prisma ORM
- Queue: BullMQ + Redis
- Shipping: Shipmondo REST API v3 (Basic Auth)
- Billing: Shopify usage-based billing API
- Deployment: Fly.io (Amsterdam region)

## Project Structure
- app/routes/ - Remix routes (dashboard, ship, shipments, settings, billing, webhooks)
- app/lib/shipmondo/ - Shipmondo API client and types
- app/lib/shipments/ - Shipment creation service
- app/lib/billing/ - Shopify usage billing
- workers/ - BullMQ worker for tracking updates
- prisma/ - Database schema and migrations

## Key Commands
- npm run dev - Start development (requires shopify CLI auth)
- npm run dev:remix - Start only Remix dev server
- npm run dev:worker - Start tracking worker in dev mode
- npm run build - Build for production
- npm run setup - Generate Prisma client + run migrations
- npm run prisma:migrate - Create new migration
- npm run prisma:studio - Open Prisma Studio

## Architecture
- Shipmondo handles all carrier integrations (GLS, PostNord, DAO, Bring, etc.)
- Users configure their Shipmondo API credentials in Settings
- Labels are fetched as base64 PDF from Shipmondo and stored on the shipment record
- We never use Shipmondo's Print Client — we serve the PDF directly for download/print
- Web process handles OAuth, UI, label creation
- Worker process can poll Shipmondo for tracking updates

## Shipmondo API
- Base URL: https://app.shipmondo.com/api/public/v3
- Auth: HTTP Basic Auth (api_user:api_key)
- Key endpoints: POST /shipments, GET /shipments/{id}/labels, GET /products, GET /pickup_points
- Sandbox: https://sandbox.shipmondo.com/api/public/v3

## Environment Variables
See .env.example for required configuration.
Shipmondo credentials are stored per-tenant in the database (not in env vars).

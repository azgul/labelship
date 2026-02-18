# Labelship - Shopify Shipping Label App

## Overview
Shopify embedded app for buying and printing shipping labels. Pay-per-label pricing (2 DKK/label), no monthly fee. First 10 labels free.

## Tech Stack
- Framework: Shopify Remix (Remix + Polaris UI)
- Database: PostgreSQL + Prisma ORM
- Queue: BullMQ + Redis
- Billing: Shopify usage-based billing API
- Deployment: Fly.io (Amsterdam region)

## Project Structure
- app/routes/ - Remix routes (dashboard, ship, shipments, settings, billing, webhooks)
- app/lib/carriers/ - Carrier adapter interface + registry
- app/lib/carriers/gls/ - GLS adapter (client, mapper, types)
- app/lib/shipments/ - Shipment creation/cancellation service
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
- Carrier-agnostic: CarrierAdapter interface in app/lib/carriers/types.ts
- Adding a new carrier = new folder under carriers/, implement the interface, register in registry.ts
- GLS is the first carrier, PostNord/DAO/Bring are stubbed in the registry
- Web process handles OAuth, UI, label creation
- Worker process polls carrier tracking APIs
- Labels stored as binary in DB (shipment.labelData)
- Carrier credentials stored on tenant record

## Environment Variables
See .env.example for required configuration.

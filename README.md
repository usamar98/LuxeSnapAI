# LuxeSnap AI

Production-oriented SaaS scaffold for AI luxury lifestyle photo editing. Users sign in, buy credits, upload a selfie, choose a luxury scene, let Claude create safe visual direction, and render with fal.ai FLUX.1 Kontext [pro].

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- shadcn/ui Base components
- Supabase Auth, Postgres, Row Level Security, Storage
- Anthropic Claude vision for selfie analysis and prompt direction
- fal.ai fal-ai/flux-pro/kontext for image editing
- Stripe Checkout Sessions and webhooks for credit packs
- Vercel hosting

## Local setup

1. Install dependencies:


npm install


2. Copy .env.example to .env.local and fill in the provider keys.

3. Apply the Supabase migration in supabase/migrations/001_luxesnap_schema.sql.

4. Run the app:


npm run dev


5. Register the Stripe webhook endpoint:


POST https://your-domain.com/api/stripe/webhook


Listen for checkout.session.completed.

## Data model

- profiles: Supabase user profile, Stripe customer id, credit balance.
- generation_jobs: one row per LuxeSnap render.
- credit_ledger: immutable usage, refund, and purchase events.
- stripe_events: idempotent webhook processing.
- Storage buckets: private selfies and private outputs, scoped by user id path.

## Notes

The UI can render without secrets in demo mode. Live generation requires Supabase public and secret keys, Anthropic, fal.ai, and Stripe credentials.

## Deployment

See DEPLOYMENT.md for the exact Vercel environment variables, Supabase SQL migration, Supabase Auth redirect URLs, and Stripe webhook setup.

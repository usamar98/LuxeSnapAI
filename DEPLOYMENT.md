# Deployment checklist

## Vercel environment variables

Add these in Vercel Project Settings -> Environment Variables for Production, Preview, and Development as needed:

| Key | Where to get it |
| --- | --- |
| NEXT_PUBLIC_SITE_URL | Your Vercel app URL, for example https://your-app.vercel.app |
| NEXT_PUBLIC_SUPABASE_URL | Supabase Project Settings -> API -> Project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase Project Settings -> API -> publishable/anon key |
| SUPABASE_SECRET_KEY | Supabase Project Settings -> API -> secret/service role key. Keep server-only. |
| ANTHROPIC_API_KEY | Anthropic Console API key |
| ANTHROPIC_MODEL | Optional. Defaults to claude-sonnet-4-5 |
| FAL_KEY | fal.ai dashboard API key |
| STRIPE_SECRET_KEY | Stripe Developers -> API keys -> secret key |
| STRIPE_WEBHOOK_SECRET | Stripe webhook endpoint signing secret |

Do not add SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY, FAL_KEY, STRIPE_SECRET_KEY, or STRIPE_WEBHOOK_SECRET to client-side code or NEXT_PUBLIC variables.

## Supabase database setup

Run this SQL file in Supabase SQL Editor:

supabase/migrations/001_luxesnap_schema.sql

It creates:

- profiles
- generation_jobs
- credit_ledger
- stripe_events
- private storage bucket: selfies
- private storage bucket: outputs
- RLS policies, credit functions, and auth profile trigger

## Auth URLs

In Supabase Auth URL Configuration, add:

- Site URL: your Vercel production URL
- Redirect URL: https://your-app.vercel.app/auth/callback
- Local Redirect URL for development: http://localhost:3000/auth/callback

## Stripe webhook

Create a Stripe webhook endpoint:

https://your-app.vercel.app/api/stripe/webhook

Listen for:

- checkout.session.completed

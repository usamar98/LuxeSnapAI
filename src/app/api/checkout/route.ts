import { NextResponse } from "next/server";
import { z } from "zod";

import { getBaseUrl, getProviderStatus } from "@/lib/env";
import { getCreditPack } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const checkoutSchema = z.object({
  planId: z.string().min(1),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const providers = getProviderStatus();

  if (!providers.supabase || !providers.supabaseAdmin || !providers.stripe) {
    return NextResponse.json(
      { error: "Billing providers are not configured." },
      { status: 503 }
    );
  }

  const parsed = checkoutSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const pack = getCreditPack(parsed.data.planId);

  if (!pack) {
    return NextResponse.json({ error: "Unknown credit pack." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id,email")
    .eq("id", userId)
    .maybeSingle();

  const stripe = getStripe();
  let customerId = profile?.stripe_customer_id ?? null;
  const email = profile?.email ?? userData.user?.email ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: userId },
    });
    customerId = customer.id;
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  const baseUrl = getBaseUrl(request.url);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    success_url: baseUrl + "/?checkout=success",
    cancel_url: baseUrl + "/?checkout=cancelled",
    allow_promotion_codes: true,
    metadata: {
      user_id: userId,
      plan_id: pack.id,
      credits: String(pack.credits),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: {
            name: "LuxeSnap AI " + pack.name + " credits",
            description: pack.description,
            metadata: {
              credits: String(pack.credits),
            },
          },
        },
      },
    ],
  });

  return NextResponse.json({ url: session.url });
}

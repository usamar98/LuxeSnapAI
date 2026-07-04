import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getRequiredEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      getRequiredEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook verification failed.",
      },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const credits = Number(session.metadata?.credits ?? 0);

    if (userId && credits > 0) {
      const admin = getSupabaseAdmin();
      const { error } = await admin.rpc("grant_purchased_credits", {
        p_user_id: userId,
        p_session_id: session.id,
        p_amount: credits,
        p_description: "Stripe checkout " + session.id,
        p_event_id: event.id,
        p_event_type: event.type,
        p_payload: event as unknown as Json,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
